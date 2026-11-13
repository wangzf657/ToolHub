<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfJs, loadPdfLib, parsePageSpec } from '@/lib/pdfEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 扫描 PDF 清理：黑白化 / 增强灰度。
 * 首页试看（阈值/模式变更 300ms 重渲）+ 页范围（组件级管线：范围内页栅格化清理、其余页原样保留）+ 体积对比。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const mode = ref<'bw' | 'contrast'>('bw')
const level = ref(180)
const rangeSpec = ref('')
const busy = ref(false)
const progress = ref(0)
const previewUrl = ref('')
const sizeInfo = ref<{ before: number; after: number } | null>(null)

/** 与引擎 cleanScannedPdf 相同的像素处理（试看/全量一致） */
const applyPixels = (c: HTMLCanvasElement, m: 'bw' | 'contrast', lv: number) => {
  const ctx = c.getContext('2d')!
  const id = ctx.getImageData(0, 0, c.width, c.height)
  const d = id.data
  for (let k = 0; k < d.length; k += 4) {
    const lum = 0.299 * d[k]! + 0.587 * d[k + 1]! + 0.114 * d[k + 2]!
    const v = m === 'bw' ? (lum > lv ? 255 : 0) : Math.min(255, Math.max(0, (lum - 60) * 1.6))
    d[k] = d[k + 1] = d[k + 2] = v
  }
  ctx.putImageData(id, 0, 0)
}

const renderOne = async (file: File | Blob, idx: number) => {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    const page = await doc.getPage(idx + 1)
    const viewport = page.getViewport({ scale: 2 })
    const c = document.createElement('canvas')
    c.width = Math.floor(viewport.width)
    c.height = Math.floor(viewport.height)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
    applyPixels(c, mode.value, level.value)
    return c
  } finally {
    doc.destroy()
  }
}

/* 试看：首页清理效果预览（300ms 防抖） */
let pvTimer: number | null = null
const refreshPreview = () => {
  const file = base.value?.files[0]
  if (!file) {
    previewUrl.value = ''
    return
  }
  if (pvTimer) window.clearTimeout(pvTimer)
  pvTimer = window.setTimeout(async () => {
    try {
      const c = await renderOne(file, 0)
      previewUrl.value = c.toDataURL('image/jpeg', 0.85)
    } catch {
      previewUrl.value = ''
    }
  }, 300)
}
watch([mode, level], refreshPreview)
watch(() => base.value?.files[0], () => {
  sizeInfo.value = null
  refreshPreview()
}, { immediate: true })

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const pdfjs = await loadPdfJs()
    const doc0 = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const total = doc0.numPages
    const targets = rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, total) : Array.from({ length: total }, (_, i) => i)
    if (!targets.length) {
      toast.warn(`页范围「${rangeSpec.value}」没有匹配到任何页（共 ${total} 页）`)
      return
    }
    const inRange = new Set(targets)
    const { PDFDocument } = await loadPdfLib()
    const out = await PDFDocument.create()
    // 未在范围内的页原样复制保留
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const copied = await out.copyPages(src, Array.from({ length: total }, (_, i) => i).filter((i) => !inRange.has(i)))
    let copyPtr = 0
    for (let i = 0; i < total; i++) {
      if (!inRange.has(i)) {
        out.addPage(copied[copyPtr++]!)
        continue
      }
      const c = await renderOne(file, i)
      const jpg = await canvasToBlob(c, 'image/jpeg', 0.85)
      const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()))
      const page = out.addPage([img.width, img.height])
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      progress.value = i / total
    }
    out.setProducer('ToolHub')
    if (!out.getCreator()) out.setCreator('ToolHub')
    const bytes = await out.save({ updateMetadata: false } as never)
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    sizeInfo.value = { before: file.size, after: blob.size }
    saveBlob(blob, '清理后.pdf')
    toast.ok(`扫描件清理完成（${targets.length} / ${total} 页）`)
  } catch (e) {
    toast.err((e as Error).message || '清理失败，页数过多时请耐心等待')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div v-if="previewUrl" class="preview-box mt-2">
      <img :src="previewUrl" alt="第 1 页清理效果试看" />
      <span class="small muted">第 1 页清理效果试看（阈值/模式变更约 0.3s 后更新，无需点击开始）</span>
    </div>

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">清理模式</span>
        <select v-model="mode" class="select">
          <option value="bw">高对比黑白（推荐扫描文字）</option>
          <option value="contrast">增强灰度（保留层次）</option>
        </select>
      </div>
      <div class="span2">
        <span class="field-label">黑白阈值：{{ level }}{{ mode === 'contrast' ? '（增强灰度模式下不生效）' : '（越大文字越少）' }}</span>
        <input v-model.number="level" type="range" class="range" min="100" max="240" step="5" :disabled="mode === 'contrast'" />
      </div>
      <div>
        <span class="field-label">应用页范围（空 = 全部）</span>
        <input v-model="rangeSpec" type="text" class="input" placeholder="如 1-5" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始清理并下载
      </button>
      <span v-if="busy && base?.pageCount" class="small muted">已处理 {{ Math.round(progress * (base?.pageCount ?? 0)) }} / {{ base?.pageCount }} 页</span>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="sizeInfo" class="notice mt-2 small" :class="sizeInfo.after > sizeInfo.before ? 'notice-warn' : 'notice-ok'">
      原 {{ (sizeInfo.before / 1048576).toFixed(2) }} MB → 清理后 {{ (sizeInfo.after / 1048576).toFixed(2) }} MB
      <span v-if="sizeInfo.after > sizeInfo.before">（体积增大：纯文字/高清扫描页栅格化常见，属预期行为）</span>
      · 接下来：<a href="/t/searchable-pdf">扫描件 OCR 可搜索化</a>（让清理后的文件重新可搜索）
    </div>

    <p class="notice notice-warn mt-2 small">
      清理需要逐页高清渲染再重新合成，页数多时耗时较长（每页约 1-3 秒），请保持页面打开。清理后文字会变为图像，体积可能增大。
    </p>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
.range:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.span2 {
  grid-column: span 2;
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
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.preview-box {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  display: grid;
  gap: 6px;
  justify-items: start;
}
.preview-box img {
  max-height: min(50vh, 460px);
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
</style>
