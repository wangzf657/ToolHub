<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Wrench } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, toPdfBlob, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 修复损坏 PDF：一级重建交叉引用，二级逐页渲染转图片版救回内容 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const log = ref<string[]>([])

const run = async () => {
  const file = base.value?.files[0]
  if (!file) return toast.warn('请先选择一个 PDF 文件')
  busy.value = true
  log.value = []
  const say = (s: string) => log.value.push(s)
  try {
    const { PDFDocument } = await loadPdfLib()
    const bytes = new Uint8Array(await file.arrayBuffer())
    say('① 尝试直接解析并重建文档结构…')
    let rebuilt: Uint8Array | null = null
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
      say(`✔ 解析成功，共 ${src.getPageCount()} 页，已重建交叉引用表`)
    } catch (e1) {
      say(`✖ 直接解析失败：${(e1 as Error).message.slice(0, 80)}`)
    }

    if (rebuilt && srcDoc) {
      srcDoc.setProducer('ToolHub')
      srcDoc.setCreator('ToolHub')
      const out2 = await srcDoc.save({ useObjectStreams: false, updateFieldAppearances: false })
      saveBlob(toPdfBlob(out2), '修复后.pdf')
      toast.ok('修复完成（结构重建），请打开验证内容')
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
        say(`✖ 无法确定页数：${(e2 as Error).message.slice(0, 80)}`)
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
    const { imagesToPdf } = await import('@/lib/pdfEngine')
    const outBlob = await imagesToPdf(images, { pageSize: 'auto' })
    saveBlob(outBlob, '修复后（图片版）.pdf')
    say(`✔ 成功救回 ${ok}/${pages} 页（图片版）`)
    toast.ok(`已救回 ${ok} 页并重建 PDF（图片版，文本不可选中）`)
  } catch (e) {
    toast.err(`修复失败：${(e as Error).message}`)
  } finally {
    busy.value = false
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
</style>
