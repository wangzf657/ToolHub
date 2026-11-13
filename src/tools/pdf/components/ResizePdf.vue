<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfJs, loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页面缩放：统一到目标纸张尺寸（含自定义 mm/pt），数字卡实时显示缩放与留白，可选「小页不放大」 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const size = ref('A4')
const landscape = ref(false)
const customUnit = ref<'mm' | 'pt'>('mm')
const customW = ref(210)
const customH = ref(130)
const noUpscale = ref(false)
const busy = ref(false)

const PAGE_SIZES: Record<string, [number, number]> = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  Legal: [612, 1008],
}
const MM_TO_PT = 2.83465

const origPt = ref<{ w: number; h: number } | null>(null)
watch(
  () => base.value?.files[0],
  async () => {
    origPt.value = null
    const file = base.value?.files[0]
    if (!file) return
    try {
      const pdfjs = await loadPdfJs()
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
      const page = await doc.getPage(1)
      const vp = page.getViewport({ scale: 1 })
      origPt.value = { w: vp.width, h: vp.height }
      doc.destroy()
    } catch {
      origPt.value = null
    }
  },
  { immediate: true },
)

const targetPt = computed<[number, number]>(() => {
  let [w, h] = size.value === 'custom' ? [customW.value * (customUnit.value === 'mm' ? MM_TO_PT : 1), customH.value * (customUnit.value === 'mm' ? MM_TO_PT : 1)] : PAGE_SIZES[size.value] ?? PAGE_SIZES.A4!
  if (landscape.value) [w, h] = [h, w]
  return [Math.round(w * 10) / 10, Math.round(h * 10) / 10]
})

/** 缩放数字卡：缩放比 + 留白 */
const card = computed(() => {
  if (!origPt.value) return null
  const [W, H] = targetPt.value
  const scale = Math.min(W / origPt.value.w, H / origPt.value.h)
  const effScale = noUpscale.value ? Math.min(1, scale) : scale
  const dw = origPt.value.w * effScale
  const dh = origPt.value.h * effScale
  const padX = Math.max(0, (W - dw) / 2)
  const padY = Math.max(0, (H - dh) / 2)
  return {
    scale: Math.round(effScale * 100),
    padX: Math.round(padX * 10) / 10,
    padY: Math.round(padY * 10) / 10,
    noPad: Math.abs(padX) < 0.5 && Math.abs(padY) < 0.5,
    up: effScale > 1,
  }
})

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (size.value === 'custom' && (customW.value <= 0 || customH.value <= 0)) {
    toast.warn('自定义尺寸请填写大于 0 的宽与高')
    return
  }
  busy.value = true
  try {
    const [W, H] = targetPt.value
    const { PDFDocument } = await loadPdfLib()
    const out = await PDFDocument.create()
    const srcPages = await out.embedPdf(await file.arrayBuffer())
    for (const emb of srcPages) {
      const page = out.addPage([W, H])
      let scale = Math.min(W / emb.width, H / emb.height)
      if (noUpscale.value) scale = Math.min(1, scale)
      const dw = emb.width * scale
      const dh = emb.height * scale
      page.drawPage(emb, { x: (W - dw) / 2, y: (H - dh) / 2, width: dw, height: dh })
    }
    out.setProducer('ToolHub')
    if (!out.getCreator()) out.setCreator('ToolHub')
    const blob = new Blob([await out.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
    saveBlob(blob, `缩放-${landscape.value ? '横' : '纵'}版-${size.value === 'custom' ? '自定义' : size.value}.pdf`)
    toast.ok(`已统一为 ${size.value === 'custom' ? '自定义尺寸' : size.value} 尺寸（${W}×${H} pt）`)
    // 组合导流：A4 且页数 >4 时引导多页合一
    if (size.value === 'A4' && !landscape.value && srcPages.length > 4) {
      toast.toast(`提示：${srcPages.length} 页的 A4 文档可用「PDF 多页合一」拼页省纸（站内工具 pdf-nup）`, 'info', 5000)
    }
  } catch (e) {
    toast.err((e as Error).message || '缩放失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">目标尺寸</span>
        <select v-model="size" class="select">
          <option value="A3">A3</option>
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="Letter">Letter</option>
          <option value="Legal">Legal</option>
          <option value="custom">自定义</option>
        </select>
      </div>
      <div>
        <span class="field-label">方向</span>
        <label class="check mt-1"><input v-model="landscape" type="checkbox" /> 横向</label>
      </div>
      <div v-if="size === 'custom'">
        <span class="field-label">单位</span>
        <select v-model="customUnit" class="select">
          <option value="mm">毫米 mm</option>
          <option value="pt">点 pt</option>
        </select>
      </div>
      <template v-if="size === 'custom'">
        <div>
          <span class="field-label">宽（{{ customUnit }}）</span>
          <input v-model.number="customW" type="number" class="input" min="1" step="0.1" />
        </div>
        <div>
          <span class="field-label">高（{{ customUnit }}）</span>
          <input v-model.number="customH" type="number" class="input" min="1" step="0.1" />
        </div>
      </template>
      <div>
        <span class="field-label">适配</span>
        <label class="check mt-1"><input v-model="noUpscale" type="checkbox" /> 小页不放大（留白适配）</label>
      </div>
    </div>

    <div v-if="card && origPt" class="num-card mt-2">
      原 {{ Math.round(origPt.w) }}×{{ Math.round(origPt.h) }} pt → 目标 {{ targetPt[0] }}×{{ targetPt[1] }} pt ·
      缩放 <b>{{ card.scale }}%</b> · {{ card.noPad ? '无留白' : `留白 左右 ${card.padX} pt / 上下 ${card.padY} pt` }}
    </div>

    <p v-if="card?.up" class="notice notice-warn mt-2 small">
      放大口径说明：文档内嵌位图放大后清晰度受原图分辨率限制（会变模糊）；矢量文字型 PDF 不受影响。
    </p>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 缩放并下载
      </button>
      <span class="small muted">原页面按比例整体缩放并居中，不会变形或裁切</span>
    </div>
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
.num-card {
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  background: var(--accent-soft);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13.5px;
  max-width: 640px;
}
</style>
