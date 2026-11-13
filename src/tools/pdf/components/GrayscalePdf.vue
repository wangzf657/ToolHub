<script setup lang="ts">
import { ref, watch } from 'vue'
import { Download, Loader2, Contrast } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, loadPdfJs, parsePageSpec, renderPageToCanvas, toPdfBlob } from '@/lib/pdfEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 黑白化（灰度）：pdfjs 逐页渲染 → 逐像素按亮度灰化 → JPG 重编码重建 PDF。
 * 页面变为图片，文本不可选中；超过 100 页时提示分批处理；支持页范围（范围外页原样保留）。
 */
const MAX_PAGES = 100
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const quality = ref(0.85)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')
const outBlob = ref<Blob | null>(null)
const result = ref<{ pages: number; beforeKB: number; afterKB: number } | null>(null)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  outBlob.value = null
  result.value = null
  try {
    const pdfjs = await loadPdfJs()
    stage.value = '正在读取文档…'
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    try {
      if (doc.numPages > MAX_PAGES) {
        throw new Error(`该文档有 ${doc.numPages} 页，超过本工具 100 页的处理上限；请先用「拆分/删除页面」工具分批处理`)
      }
      const total = doc.numPages
      const inRange = new Set(rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, total) : Array.from({ length: total }, (_, i) => i))
      if (!inRange.size) {
        throw new Error(`页范围「${rangeSpec.value}」没有匹配到任何页（共 ${total} 页）`)
      }
      // 范围外页直接从原文档复制（保留原样）
      const { PDFDocument } = await loadPdfLib()
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const copied = await src.save({ useObjectStreams: false } as never)
      void copied
      const srcDoc = src
      const pagesToCopy = Array.from({ length: total }, (_, i) => i).filter((i) => !inRange.has(i))
      // 逐页渲染并灰化（范围内页）
      const jpgs: (Blob | null)[] = []
      for (let i = 1; i <= total; i++) {
        if (!inRange.has(i - 1)) {
          jpgs.push(null) // 占位：范围外页由 copyPages 补
          continue
        }
        stage.value = `灰化第 ${i}/${total} 页…`
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale: 2 })
        const c = document.createElement('canvas')
        c.width = Math.floor(viewport.width)
        c.height = Math.floor(viewport.height)
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
        await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
        const id = ctx.getImageData(0, 0, c.width, c.height)
        const d = id.data
        for (let k = 0; k < d.length; k += 4) {
          const v = (0.299 * d[k]! + 0.587 * d[k + 1]! + 0.114 * d[k + 2]!) | 0
          d[k] = d[k + 1] = d[k + 2] = v
        }
        ctx.putImageData(id, 0, 0)
        jpgs.push(await canvasToBlob(c, 'image/jpeg', quality.value))
        progress.value = ((i / doc.numPages) * 0.85)
      }
      // 重建 PDF（统一 ToolHub 元数据）
      stage.value = '正在重建 PDF…'
      const out = await PDFDocument.create()
      out.setProducer('ToolHub')
      out.setCreator('ToolHub')
      // 组装：范围内页为栅格化灰度页，范围外页按原序补原文档页
      const copiedPages = pagesToCopy.length ? await out.copyPages(srcDoc, pagesToCopy) : []
      let copyPtr = 0
      let grayCount = 0
      for (let i = 0; i < jpgs.length; i++) {
        const p = jpgs[i]
        if (p) {
          const img = await out.embedJpg(new Uint8Array(await p.arrayBuffer()))
          const page = out.addPage([img.width, img.height])
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
          grayCount++
        } else {
          out.addPage(copiedPages[copyPtr++]!)
        }
      }
      const blob = toPdfBlob(await out.save({ updateMetadata: false } as never))
      outBlob.value = blob
      result.value = { pages: total, beforeKB: file.size / 1024, afterKB: blob.size / 1024 }
      toast.ok(`已完成 ${grayCount} 页灰度化${pagesToCopy.length ? `（${pagesToCopy.length} 页原样保留）` : ''}`)
      progress.value = 1
    } finally {
      doc.destroy()
    }
  } catch (e) {
    toast.err((e as Error).message || '灰度化失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const download = () => {
  if (outBlob.value) saveBlob(outBlob.value, `${outName.value.trim() || `灰度化-q${Math.round(quality.value * 100)}`}.pdf`)
}

/* ---------- 处理前预览：第 1 页「原色 | 灰度」并排 ---------- */
const previewColor = ref('')
const previewGray = ref('')
const renderPreviewPair = async () => {
  const file = base.value?.files[0]
  if (!file) {
    previewColor.value = ''
    previewGray.value = ''
    return
  }
  try {
    const canvas = await renderPageToCanvas(file, 0, 0.8)
    previewColor.value = canvas.toDataURL('image/jpeg', 0.8)
    const c2 = document.createElement('canvas')
    c2.width = canvas.width
    c2.height = canvas.height
    const ctx = c2.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)
    const id = ctx.getImageData(0, 0, c2.width, c2.height)
    const d = id.data
    for (let k = 0; k < d.length; k += 4) {
      const v = (0.299 * d[k]! + 0.587 * d[k + 1]! + 0.114 * d[k + 2]!) | 0
      d[k] = d[k + 1] = d[k + 2] = v
    }
    ctx.putImageData(id, 0, 0)
    previewGray.value = c2.toDataURL('image/jpeg', 0.8)
  } catch {
    previewColor.value = ''
    previewGray.value = ''
  }
}
watch(() => base.value?.files[0], () => void renderPreviewPair(), { immediate: true })

/** 页范围（空 = 全部）：范围外页原样保留 */
const rangeSpec = ref('')
const outName = ref('灰度化-q85')
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => ((outBlob = null), (result = null))" />

    <div v-if="previewColor" class="pair mt-2">
      <div class="pair-cell">
        <img :src="previewColor" alt="原色预览" />
        <span class="small muted">原色</span>
      </div>
      <div class="pair-cell">
        <img :src="previewGray" alt="灰度预览" />
        <span class="small muted">灰度（处理前预览）</span>
      </div>
    </div>

    <div class="grid-2 mt-2">
      <div>
        <span class="field-label">JPG 质量（{{ Math.round(quality * 100) }}%）</span>
        <input v-model.number="quality" type="range" class="range" min="0.5" max="0.95" step="0.05" />
      </div>
      <div>
        <span class="field-label">应用页范围（空 = 全部）</span>
        <input v-model="rangeSpec" type="text" class="input" placeholder="如 1-3,7（范围外页原样保留）" />
      </div>
      <div>
        <span class="field-label">输出文件名（不含 .pdf）</span>
        <input v-model="outName" type="text" class="input" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Contrast v-else :size="16" /> 开始灰度化
      </button>
      <button v-if="outBlob" class="btn btn-soft" @click="download"><Download :size="15" /> 下载结果</button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
      <p class="small muted mt-1">{{ stage }}</p>
    </div>

    <div v-if="result" class="stats mt-2">
      <div class="stat"><span class="k">处理页数</span><span class="v">{{ result.pages }}</span></div>
      <div class="stat"><span class="k">原始大小</span><span class="v">{{ result.beforeKB.toFixed(0) }} KB</span></div>
      <div class="stat"><span class="k">处理后</span><span class="v accent">{{ result.afterKB.toFixed(0) }} KB</span></div>
    </div>

    <p v-if="result && result.afterKB > result.beforeKB" class="notice notice-warn mt-2 small">
      输出比原文件大 {{ Math.round((result.afterKB / result.beforeKB - 1) * 100) }}%：该工具适合扫描件/图片型 PDF；纯文字与矢量 PDF 栅格化后体积会增大。
    </p>

    <p class="notice notice-warn mt-2 small">
      重建后页面转为灰度图片：彩色内容变黑白、文本不可再选中，适合打印省墨与扫描件统一观感；
      逐页渲染在页数较多时需要一些时间。输出为灰度位图（非 DeviceGray 色彩空间），省墨效果以打印机实测为准。
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
  min-width: 110px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 17px;
  font-weight: 700;
}
.v.accent {
  color: var(--accent-text);
}
</style>
