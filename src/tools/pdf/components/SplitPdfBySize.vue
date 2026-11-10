<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, Scissors } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, toPdfBlob } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 按目标体积拆分 PDF：先逐页「单页 save 实测体积」（真实数据，非估算），
 * 再按贪心策略把页面打包成不超过目标体积的若干卷，打包 ZIP 下载。
 * 保存统一 updateMetadata:false + setProducer/Creator('ToolHub')，遵守引擎元数据契约。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const targetMB = ref(10)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')
const result = ref<{ volKB: number; pages: number }[] | null>(null)
const outFiles = ref<{ name: string; blob: Blob }[]>([])

const fmtKB = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(2)} MB` : `${Math.ceil(n)} KB`)

/** 载入源文档（忽略加密标记，与 pdfEngine 各工具一致） */
const loadSrc = async (file: File | Blob) => {
  const { PDFDocument } = await loadPdfLib()
  return PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
}

/** 新建输出文档并写入 ToolHub 元数据 */
const newDoc = async () => {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.create()
  doc.setProducer('ToolHub')
  doc.setCreator('ToolHub')
  return doc
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!targetMB.value || targetMB.value <= 0) {
    toast.warn('请输入大于 0 的目标体积')
    return
  }
  busy.value = true
  progress.value = 0
  result.value = null
  outFiles.value = []
  try {
    stage.value = '正在读取文档…'
    const src = await loadSrc(file)
    const total = src.getPageCount()
    if (total < 2) throw new Error('该 PDF 只有一页，无需拆分')
    const targetBytes = targetMB.value * 1024 * 1024

    // 第一步：逐页单页 save 实测体积（含该页引用的共享资源，接近真实拆分结果）
    const sizes = new Array<number>(total).fill(0)
    for (let i = 0; i < total; i++) {
      stage.value = `实测单页体积（${i + 1}/${total}）…`
      const one = await newDoc()
      const [p] = await one.copyPages(src, [i])
      one.addPage(p)
      const saved = await one.save({ updateMetadata: false } as never)
      sizes[i] = saved.length
      progress.value = ((i + 1) / (total + 1)) * 0.7
    }
    if (sizes.some((s) => s > targetBytes)) {
      toast.warn(`有单页体积已超过目标（最大 ${fmtKB(Math.max(...sizes))}），超出页将单独成卷`)
    }

    // 第二步：贪心打包成卷
    stage.value = '正在按体积分卷…'
    const groups: number[][] = []
    let cur: number[] = []
    let curSize = 0
    for (let i = 0; i < total; i++) {
      const s = sizes[i]
      if (cur.length && curSize + s > targetBytes) {
        groups.push(cur)
        cur = []
        curSize = 0
      }
      cur.push(i)
      curSize += s
    }
    if (cur.length) groups.push(cur)

    // 第三步：逐卷生成 PDF（重存为标准 PDF，共享资源按卷内实际引用写入）
    outFiles.value = []
    const stats: { volKB: number; pages: number }[] = []
    for (let g = 0; g < groups.length; g++) {
      stage.value = `生成第 ${g + 1}/${groups.length} 卷…`
      const doc = await newDoc()
      const pages = await doc.copyPages(src, groups[g])
      pages.forEach((p) => doc.addPage(p))
      const blob = toPdfBlob(await doc.save({ updateMetadata: false } as never))
      outFiles.value.push({ name: `第${g + 1}卷（${groups[g][0] + 1}-${groups[g][groups[g].length - 1] + 1}页）.pdf`, blob })
      stats.push({ volKB: blob.size / 1024, pages: groups[g].length })
      progress.value = 0.7 + ((g + 1) / groups.length) * 0.3
    }
    result.value = stats
    toast.ok(`已拆成 ${groups.length} 卷`)
  } catch (e) {
    toast.err((e as Error).message || '拆分失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const download = () => {
  if (!outFiles.value.length) return
  saveMany(outFiles.value, outFiles.value.length > 1 ? '按体积拆分.zip' : '拆分结果.pdf')
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => ((result = null), (outFiles = []))" />

    <div class="grid-2 mt-2">
      <div>
        <span class="field-label">目标体积（MB/卷）</span>
        <input v-model.number="targetMB" type="number" class="input" min="0.1" step="1" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Scissors v-else :size="16" /> 开始拆分
      </button>
      <button v-if="outFiles.length" class="btn btn-soft" @click="download"><Download :size="15" /> 下载{{ outFiles.length > 1 ? '（ZIP）' : '' }}</button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
      <p class="small muted mt-1">{{ stage }}</p>
    </div>

    <div v-if="result" class="stats mt-2">
      <div v-for="(s, i) in result" :key="i" class="stat">
        <span class="k">第 {{ i + 1 }} 卷（{{ s.pages }} 页）</span>
        <span class="v">{{ fmtKB(s.volKB) }}</span>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      体积按「每页独立重存后的实测字节」贪心累加：同一份共享资源（字体/图片）会被计入多卷，
      因此单卷实际体积一般略小于目标值，属于正常现象。页面数量多时逐页实测较慢，请耐心等待。
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 130px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 15px;
  font-weight: 700;
}
</style>
