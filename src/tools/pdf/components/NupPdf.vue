<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 多页合一（N-up）：2/4/6/9 页拼一版；混尺寸等比适配居中、版数反馈、格子示意预览、进度 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const per = ref<2 | 4 | 6 | 9>(2)
const perOptions = [2, 4, 6, 9] as const
const busy = ref(false)
const progress = ref(0)

const pageCount = computed(() => base.value?.pageCount ?? 0)
const sheets = computed(() => (pageCount.value ? Math.ceil(pageCount.value / per.value) : 0))

/* 格子示意：行优先、从上往下（与产物排布一致） */
const gridCols = computed(() => (per.value === 2 ? 1 : per.value === 4 ? 2 : 3))
const gridRows = computed(() => (per.value === 2 ? 2 : per.value === 4 ? 2 : 3))
const gridTemplate = computed(() => Array.from({ length: gridCols.value * gridRows.value }, (_, k) => k + 1))
watch(per, () => undefined)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const { PDFDocument } = await loadPdfLib()
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const first = src.getPage(0).getSize()
    const cols = gridCols.value
    const rows = gridRows.value
    const cellW = first.width
    const cellH = first.height
    const sheetW = per.value === 2 ? cellW : cellW * cols
    const sheetH = cellH * rows
    const out = await PDFDocument.create()
    const embedded = await out.embedPdf(await file.arrayBuffer())
    const total = Math.ceil(embedded.length / per.value)
    for (let i = 0; i < embedded.length; i += per.value) {
      const page = out.addPage([sheetW, sheetH])
      for (let k = 0; k < per.value && i + k < embedded.length; k++) {
        const col = k % cols
        const row = Math.floor(k / cols)
        // 混尺寸等比适配：按格子与页面宽高比取最小缩放，格子内居中
        const emb = embedded[i + k]!
        const s = Math.min(cellW / emb.width, cellH / emb.height)
        const dw = emb.width * s
        const dh = emb.height * s
        const x = col * cellW + (cellW - dw) / 2
        const y = sheetH - (row + 1) * cellH + (cellH - dh) / 2
        page.drawPage(emb, { x, y, width: dw, height: dh })
      }
      progress.value = Math.min(1, Math.round(i / per.value + 1) / total)
    }
    out.setProducer('ToolHub')
    if (!out.getCreator()) out.setCreator('ToolHub')
    const blob = new Blob([await out.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
    saveBlob(blob, `${per.value}合1.pdf`)
    toast.ok(`已按每版 ${per.value} 页重排为 ${total} 版`)
  } catch (e) {
    toast.err((e as Error).message || '拼页失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="split mt-2">
      <div>
        <span class="field-label">每版页数</span>
        <div class="row gap8 row-wrap">
          <button
            v-for="n in perOptions"
            :key="n"
            class="btn"
            :class="per === n ? 'btn-primary' : 'btn-ghost'"
            @click="per = n"
          >
            {{ n }} 合 1
          </button>
          <span v-if="sheets" class="small muted">产物 {{ sheets }} 版</span>
        </div>

        <!-- 格子示意：数字为该格放的原始页序（行优先，从上往下） -->
        <div class="mt-2">
          <span class="field-label">排列示意（格内数字 = 原始页序）</span>
          <div class="demo" :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }">
            <div v-for="n in gridTemplate" :key="n" class="demo-cell">{{ n }}</div>
          </div>
        </div>

        <div class="row mt-2">
          <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
            <Loader2 v-if="busy" :size="16" class="spinner" /> 拼页并下载
          </button>
          <span v-if="busy" class="small muted">已完成 {{ Math.round(progress * sheets) }} / {{ sheets }} 版</span>
        </div>
        <div v-if="busy" class="progress mt-1">
          <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
        </div>
      </div>
      <div class="row" style="align-items: flex-end">
        <span class="small muted">版面由首页尺寸按网格拼接；不同尺寸页面按格子等比缩放居中（不拉伸变形），适合讲义与幻灯片打印。</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap8 {
  gap: 8px;
}
.split {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 720px) {
  .split {
    grid-template-columns: 1fr;
  }
}
.demo {
  display: grid;
  gap: 6px;
  max-width: 240px;
}
.demo-cell {
  border: 1.5px dashed var(--border-strong);
  border-radius: 8px;
  min-height: 56px;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: var(--text-2);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
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
  max-width: 360px;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
</style>
