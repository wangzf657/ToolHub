<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Wrench } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, toPdfBlob, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 修复损坏 PDF：一级重建交叉引用，二级逐页渲染转图片版救回内容；中文错误映射 + 双级进度 + 结果对比 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const log = ref<string[]>([])
const progress = ref(0)
const stageLabel = ref('')
const sizeResult = ref<{ src: number; out: number } | null>(null)

/** 常见异常 → 中文短句 */
const zhError = (e: unknown): string => {
  const raw = ((e as Error).message || String(e)).toLowerCase()
  if ((e as { name?: string })?.name === 'PasswordException' || raw.includes('password') || raw.includes('encrypt'))
    return '该文件被密码保护，请先用「PDF 解密」工具解除密码再修复'
  if (raw.includes('eof') || raw.includes('trailer') || raw.includes('xref'))
    return '文件不完整（缺少结尾标记或交叉引用表损坏）'
  if (raw.includes('invalid object') || raw.includes('parse')) return '文档对象解析失败（结构损坏）'
  if (raw.includes('expected') || raw.includes('format')) return '文件格式异常（不是有效 PDF）'
  return (e as Error).message || '未知错误'
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) return toast.warn('请先选择一个 PDF 文件')
  busy.value = true
  log.value = []
  progress.value = 0
  stageLabel.value = ''
  sizeResult.value = null
  const say = (s: string) => log.value.push(s)
  try {
    const { PDFDocument } = await loadPdfLib()
    const bytes = new Uint8Array(await file.arrayBuffer())
    say('① 尝试直接解析并重建文档结构…')
    let rebuilt: Uint8Array | null = null
    let srcPages = 0
    let srcDoc: { setProducer: (s: string) => void; setCreator: (s: string) => void; save: (opts?: { useObjectStreams?: boolean; updateFieldAppearances?: boolean }) => Promise<Uint8Array> } | null = null
    try {
      const src = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
        updateMetadata: false,
      } as never)
      // 重新载入验证可读
      const out = await src.save({ useObjectStreams: false, updateFieldAppearances: false })
      await PDFDocument.load(out, { ignoreEncryption: true, updateMetadata: false })
      rebuilt = out
      srcDoc = src
      srcPages = src.getPageCount()
      say(`✔ 解析成功，共 ${srcPages} 页，已重建交叉引用表`)
    } catch (e1) {
      say(`✖ 直接解析失败：${zhError(e1)}`)
      if ((e1 as { name?: string })?.name === 'PasswordException' || /password|encrypt/i.test((e1 as Error).message)) {
        toast.err('该文件被密码保护，请先用「PDF 解密」工具解除密码后再修复')
        return
      }
    }

    if (rebuilt && srcDoc) {
      srcDoc.setProducer('ToolHub')
      srcDoc.setCreator('ToolHub')
      const out2 = await srcDoc.save({ useObjectStreams: false, updateFieldAppearances: false })
      sizeResult.value = { src: srcPages, out: srcPages }
      saveBlob(toPdfBlob(out2), '修复后.pdf')
      toast.ok(`修复完成（结构重建）：原 ${srcPages} 页 → 修复后 ${srcPages} 页`)
      return
    }

    say('② 降级方案：逐页渲染为图片后重建 PDF（文本不可选中）…')
    // pdfjs 对损坏文件的容错更高，先探测可读页数
    let pages = 0
    try {
      pages = await probePageCount(file)
    } catch {
      pages = 0
    }
    if (!pages) {
      try {
        const { pdfInfo } = await import('@/lib/pdfEngine')
        pages = (await pdfInfo(file)).pages
      } catch (e2) {
        say(`✖ 无法确定页数：${zhError(e2)}`)
      }
    }
    if (!pages) {
      toast.err('该文件损坏过于严重，无法抢救；如急需内容可尝试截图或向来源重新获取')
      return
    }
    const images: Blob[] = []
    let ok = 0
    for (let i = 0; i < pages; i++) {
      try {
        stageLabel.value = `已渲染 ${i + 1} / ${pages} 页`
        progress.value = ((i + 1) / pages) * 0.8
        const canvas = await renderPageToCanvas(file, i, 2)
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (blob) {
          images.push(blob)
          ok++
        }
      } catch {
        say(`  · 第 ${i + 1} 页渲染失败，跳过`)
      }
    }
    if (!ok) {
      toast.err('所有页面均无法渲染，无法抢救')
      return
    }
    stageLabel.value = '正在重建 PDF…'
    progress.value = 0.9
    const { imagesToPdf } = await import('@/lib/pdfEngine')
    const outBlob = await imagesToPdf(images, { pageSize: 'auto' })
    progress.value = 1
    sizeResult.value = { src: pages, out: ok }
    saveBlob(outBlob, '修复后（图片版）.pdf')
    say(`✔ 成功救回 ${ok}/${pages} 页（图片版）`)
    toast.ok(`已救回 ${ok} 页并重建 PDF（图片版，文本不可选中）：原 ${pages} 页 → 修复后 ${ok} 页`)
  } catch (e) {
    toast.err(`修复失败：${zhError(e)}`)
  } finally {
    busy.value = false
    stageLabel.value = ''
  }
}

/** 探测页数：pdfjs 的 getDocument 带 ignoreErrors 容错 */
const probePageCount = async (file: File): Promise<number> => {
  const { loadPdfJs } = await import('@/lib/pdfEngine')
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), ignoreErrors: true } as never).promise
  const n = doc.numPages
  doc.destroy()
  return n
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Wrench v-else :size="16" /> 开始修复
      </button>
    </div>

    <div v-if="busy" class="mt-2">
      <p v-if="stageLabel" class="small muted mb-1">{{ stageLabel }}</p>
      <div class="progress"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <p v-if="sizeResult" class="notice notice-ok mt-2 small">
      结果对比：原 {{ sizeResult.src }} 页 → 修复后 {{ sizeResult.out }} 页
    </p>

    <div v-if="log.length" class="log mt-2 mono">
      <p v-for="(l, i) in log" :key="i">{{ l }}</p>
    </div>

    <p class="notice notice-info mt-2 small">
      两级抢救：先重建 PDF 交叉引用表（保留文字与结构）；失败则降级为逐页图片重建，保住可读内容（输出后文字不可选中、不可搜索）。全程本地处理。
    </p>
  </div>
</template>

<style scoped>
.log { padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; font-size: 13px; max-height: 220px; overflow: auto; }
.progress { height: 6px; border-radius: 999px; background: var(--bg-soft); overflow: hidden; max-width: 420px; }
.fill { height: 100%; background: var(--accent); transition: width 0.2s; }
</style>
