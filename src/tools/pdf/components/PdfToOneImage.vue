<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfJs } from '@/lib/pdfEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 转纵向长图：组件级逐页渲染（带进度与超限预警）。
 * 16000px 高度上限：超限禁用并提示最大倍数；可开「分段导出」按上限自动分组打 ZIP。
 */
const MAX_H = 16000
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const scale = ref(1.5)
const gap = ref(8)
const segmented = ref(false)
const busy = ref(false)
const progress = ref(0)
const progressLabel = ref('')
const pageSize = ref<{ w: number; h: number } | null>(null)

const pageCount = computed(() => base.value?.pageCount ?? 0)

/* 首页尺寸探测（估算长图高度） */
const probe = async () => {
  const file = base.value?.files[0]
  if (!file) {
    pageSize.value = null
    return
  }
  try {
    const pdfjs = await loadPdfJs()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const page = await doc.getPage(1)
    const vp = page.getViewport({ scale: 1 })
    pageSize.value = { w: Math.floor(vp.width), h: Math.floor(vp.height) }
    doc.destroy()
  } catch {
    pageSize.value = null
  }
}
watch(() => base.value?.files[0], () => void probe(), { immediate: true })

/** 预计长图高度（按首页尺寸 × 页数估算） */
const estHeight = computed(() => {
  if (!pageSize.value || !pageCount.value) return 0
  return Math.round(pageCount.value * pageSize.value.h * scale.value + (pageCount.value - 1) * gap.value)
})
const estWidth = computed(() => (pageSize.value ? Math.round(pageSize.value.w * scale.value) : 0))
const overLimit = computed(() => estHeight.value > MAX_H)
/** 超限时的最大倍数（0.5 步进向下取） */
const maxScale = computed(() => {
  if (!pageSize.value || !pageCount.value) return 3
  const raw = (MAX_H - (pageCount.value - 1) * gap.value) / (pageCount.value * pageSize.value.h)
  return Math.max(0.5, Math.floor(raw * 2) / 2)
})

const renderPages = async (file: File | Blob, indices: number[], onP: (done: number, total: number) => void) => {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const canvases: HTMLCanvasElement[] = []
  let width = 0
  let totalH = 0
  try {
    for (let k = 0; k < indices.length; k++) {
      const page = await doc.getPage(indices[k] + 1)
      const viewport = page.getViewport({ scale: scale.value })
      const c = document.createElement('canvas')
      c.width = Math.floor(viewport.width)
      c.height = Math.floor(viewport.height)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
      canvases.push(c)
      width = Math.max(width, c.width)
      totalH += c.height + gap.value
      onP(k + 1, indices.length)
    }
  } finally {
    doc.destroy()
  }
  const out = document.createElement('canvas')
  out.width = width
  out.height = Math.max(1, totalH)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  let y = 0
  for (const c of canvases) {
    ctx.drawImage(c, Math.floor((width - c.width) / 2), y)
    y += c.height + gap.value
  }
  return { blob: await canvasToBlob(out, format.value, 0.9), w: out.width, h: out.height }
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (overLimit.value && !segmented.value) return
  busy.value = true
  progress.value = 0
  try {
    const n = pageCount.value
    const all = Array.from({ length: n }, (_, i) => i)
    if (segmented.value) {
      // 分段导出：按 16000px 上限自动分组
      const perSeg = Math.max(1, Math.floor((MAX_H - gap.value) / ((pageSize.value?.h ?? 842) * scale.value + gap.value)))
      const out: { name: string; blob: Blob }[] = []
      for (let s = 0; s * perSeg < n; s++) {
        const seg = all.slice(s * perSeg, (s + 1) * perSeg)
        const r = await renderPages(file, seg, (d, t) => {
          progress.value = (s * perSeg + d) / n
          progressLabel.value = `正在渲染第 ${s * perSeg + d} / ${n} 页`
        })
        out.push({ name: `长图-第${s + 1}段-共${Math.ceil(n / perSeg)}段.${format.value === 'image/png' ? 'png' : 'jpg'}`, blob: r.blob })
      }
      await saveMany(out, `长图-分段-${n}页.zip`)
      toast.ok(`已按上限分组导出 ${out.length} 张长图（每张 ≤16000px）`)
    } else {
      const r = await renderPages(file, all, (d, t) => {
        progress.value = d / t
        progressLabel.value = `正在渲染第 ${d} / ${t} 页`
      })
      const mb = r.blob.size / 1048576
      saveBlob(r.blob, `长图-${n}页-${scale.value}x.${format.value === 'image/png' ? 'png' : 'jpg'}`)
      toast.ok(`长图已生成：${r.w}×${r.h} px · ${mb.toFixed(1)} MB`)
    }
  } catch (e) {
    toast.err((e as Error).message || '生成失败，页数过多时请降低清晰度')
  } finally {
    busy.value = false
    progressLabel.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <p v-if="pageSize && pageCount && !busy" class="small muted mt-2">
      预计长图约 {{ estWidth }}×{{ estHeight }} px（{{ pageCount }} 页 × {{ scale }}x，估算）
      <span v-if="overLimit" class="warn-text">· 超过 16000px 上限</span>
    </p>

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">图片格式</span>
        <select v-model="format" class="select">
          <option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option>
        </select>
      </div>
      <div>
        <span class="field-label">清晰度倍数：{{ scale }}x</span>
        <input v-model.number="scale" type="range" class="range" min="1" max="3" step="0.5" />
      </div>
      <div>
        <span class="field-label">页间留白（px）</span>
        <input v-model.number="gap" type="number" class="input" min="0" max="80" />
      </div>
    </div>

    <p v-if="overLimit && !segmented" class="notice notice-warn mt-2 small">
      页数过多：当前倍数最大 {{ maxScale }}x。请降低倍数，或开启下方分段导出。
    </p>
    <label class="check mt-1"><input v-model="segmented" type="checkbox" /> 分段导出：超长时按 16000px 上限自动分组为多张长图（打包 ZIP）</label>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length || (overLimit && !segmented)" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> {{ segmented ? '分段生成长图' : '生成纵向长图' }}
      </button>
      <span v-if="progressLabel" class="small muted">{{ progressLabel }}</span>
      <span v-else class="small muted">页数较多时建议倍数 ≤ 1.5x</span>
    </div>

    <div v-if="busy" class="progress mt-1">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
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
  max-width: 420px;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.warn-text {
  color: var(--warn);
}
</style>
