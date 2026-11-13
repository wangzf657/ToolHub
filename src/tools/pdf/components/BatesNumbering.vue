<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfJs, loadPdfLib } from '@/lib/pdfEngine'
import { hasCJK, stampPngs, textToPng } from './cjkText'
import { renderPageToCanvas } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 贝茨编号：起始号/后缀/日期开关，多文件连续编号；中文前缀走贴图；带进度与首页示意 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const prefix = ref('ABC-')
const suffix = ref('')
const digits = ref(6)
const startNo = ref(1)
const fontSize = ref(10)
const position = ref<'bottom-right' | 'bottom-center'>('bottom-right')
const withDate = ref(false)
const busy = ref(false)
const progress = ref(0)
const progressLabel = ref('')

/* ---------- 首页示意预览 ---------- */
const previewUrl = ref('')
const previewScalePxPerPt = ref(0)
const renderPreview = async () => {
  const file = base.value?.files[0]
  if (!file) {
    previewUrl.value = ''
    return
  }
  try {
    const c = await renderPageToCanvas(file, 0, 1.2)
    previewUrl.value = c.toDataURL('image/jpeg', 0.85)
    previewScalePxPerPt.value = c.width / 595 // A4 近似（示意位置足够）
    // 用首页实际 pt 宽算更准：px/pt = canvas.width / pagePtW
    const pdfjs = await loadPdfJs()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const page = await doc.getPage(1)
    const vp = page.getViewport({ scale: 1 })
    previewScalePxPerPt.value = c.width / vp.width
    doc.destroy()
  } catch {
    previewUrl.value = ''
  }
}
watch(() => base.value?.files[0], renderPreview, { immediate: true })

const sampleText = () => {
  const no = String(startNo.value).padStart(digits.value, '0')
  const date = withDate.value ? `-20261111` : ''
  return `${prefix.value}${no}${suffix.value}${date}`
}
const overlayStyle = () => {
  const k = previewScalePxPerPt.value
  if (!k) return {}
  return {
    right: position.value === 'bottom-right' ? `${28 * k}px` : 'auto',
    left: position.value === 'bottom-center' ? '50%' : 'auto',
    bottom: `${24 * k}px`,
    transform: position.value === 'bottom-center' ? 'translateX(-50%)' : 'none',
    fontSize: `${fontSize.value * k}px`,
  }
}

const run = async () => {
  const files = base.value?.files ?? []
  if (!files.length) {
    toast.warn('请先添加 PDF 文件（可多个，编号跨文件连续）')
    return
  }
  if (digits.value < 1 || digits.value > 10) {
    toast.warn('位数请填写 1-10 之间的整数')
    return
  }
  if (startNo.value < 1) {
    toast.warn('起始编号需不小于 1')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()
    const cjk = hasCJK(prefix.value) || hasCJK(suffix.value)
    const out: { name: string; blob: Blob }[] = []
    let counter = startNo.value
    const dateStr = withDate.value ? `-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}` : ''
    for (let fi = 0; fi < files.length; fi++) {
      const f = files[fi]!
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const pages = doc.getPages()
      const items: Parameters<typeof stampPngs>[1] = []
      const font = cjk ? null : await doc.embedFont(StandardFonts.Helvetica)
      for (let pi = 0; pi < pages.length; pi++) {
        const page = pages[pi]!
        const text = `${prefix.value}${String(counter).padStart(digits.value, '0')}${suffix.value}${dateStr}`
        const { width } = page.getSize()
        if (font) {
          const tw = font.widthOfTextAtSize(text, fontSize.value)
          const x = position.value === 'bottom-center' ? (width - tw) / 2 : width - tw - 28
          page.drawText(text, { x, y: 24, size: fontSize.value, font, color: rgb(0.2, 0.2, 0.25) })
        } else {
          const png = textToPng(text, { sizePt: fontSize.value, color: [0.2, 0.2, 0.25] })
          const x = position.value === 'bottom-center' ? (width - png.wPt) / 2 : width - png.wPt - 28
          items.push({ page: pi, xPt: x, yPt: 24, dataUrl: png.dataUrl, wPt: png.wPt, hPt: png.hPt })
        }
        counter++
        progressLabel.value = `第 ${fi + 1} / ${files.length} 个文件 · 第 ${pi + 1} / ${pages.length} 页`
      }
      doc.setProducer('ToolHub')
      if (!doc.getCreator()) doc.setCreator('ToolHub')
      let blob = new Blob([await doc.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
      if (items.length) blob = await stampPngs(blob, items)
      out.push({ name: `${f.name.replace(/\.pdf$/i, '')}-已编号.pdf`, blob })
      progress.value = (fi + 1) / files.length
    }
    await saveMany(out, '贝茨编号结果.zip')
    toast.ok(`已完成 ${out.length} 个文件的贝茨编号（${startNo.value} 起，共 ${counter - startNo.value} 页）`)
  } catch (e) {
    toast.err((e as Error).message || '编号失败')
  } finally {
    busy.value = false
    progressLabel.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入一个或多个 PDF（编号跨文件连续）" @files="() => (previewUrl = '')" />

    <div v-if="previewUrl" class="preview-wrap mt-2">
      <img :src="previewUrl" alt="首页编号示意" class="preview-img" />
      <span class="ov-num" :style="overlayStyle()">{{ sampleText() }}</span>
      <span class="small muted">首页编号示意（位置/字号即时反映）</span>
    </div>

    <div class="grid-4 mt-2">
      <div>
        <span class="field-label">前缀（支持中文）</span>
        <input v-model="prefix" class="input" placeholder="如 ABC- 或 案卷-" />
      </div>
      <div>
        <span class="field-label">后缀（可选）</span>
        <input v-model="suffix" class="input" placeholder="如 -B" />
      </div>
      <div>
        <span class="field-label">起始编号</span>
        <input v-model.number="startNo" type="number" class="input" min="1" />
      </div>
      <div>
        <span class="field-label">数字位数</span>
        <input v-model.number="digits" type="number" class="input" min="1" max="10" />
      </div>
      <div>
        <span class="field-label">字号（pt）</span>
        <input v-model.number="fontSize" type="number" class="input" min="6" max="24" />
      </div>
      <div>
        <span class="field-label">位置</span>
        <select v-model="position" class="select">
          <option value="bottom-right">右下角</option>
          <option value="bottom-center">底部居中</option>
        </select>
      </div>
      <div>
        <span class="field-label">附加日期</span>
        <label class="check mt-1"><input v-model="withDate" type="checkbox" /> 编号后追加 -YYYYMMDD</label>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <PackageOpen v-else :size="16" /> 开始编号并下载
      </button>
      <span v-if="progressLabel" class="small muted">{{ progressLabel }}</span>
      <span v-else class="small muted">效果示例：{{ sampleText() }}</span>
    </div>

    <div v-if="busy" class="progress mt-1">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <p class="notice notice-info mt-2 small">
      编号从起始号开始、跨文件连续递增（如 ABC-000001 → ABC-000002 …）；zip 内文件名与原文件一一对应（原名-已编号.pdf）。前缀含中文时自动以高清贴图嵌入。
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
.preview-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.preview-img {
  max-width: min(100%, 420px);
  max-height: 50vh;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  display: block;
}
.ov-num {
  position: absolute;
  color: rgba(51, 51, 64, 0.85);
  font-family: Helvetica, Arial, sans-serif;
  white-space: nowrap;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
  max-width: 420px;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.grid-4 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
</style>
