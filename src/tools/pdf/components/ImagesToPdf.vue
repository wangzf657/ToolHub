<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadPdfLib, savePdf } from '@/lib/pdfEngine'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 图片合成 PDF（jpg-to-pdf / png-to-pdf / images-to-pdf 复用）。
 * 组件级管线（lib imagesToPdf 只读、无 JPG 直通/自动横竖参数）：
 * - JPEG 且 EXIF 方向 ≤1 → embedJpg 原字节直通（体积不膨胀）；含旋转 → canvas 校正后 JPEG 0.92 重编码。
 * - 其余格式 → canvas → PNG（保留透明）。
 * - A4/Letter 支持逐图自动横竖（默认开）。
 */
const toast = useToast()
const route = useRoute()
const files = ref<File[]>([])
const pageSize = ref<'auto' | 'A4' | 'Letter'>('auto')
const marginPreset = ref<'none' | 'small' | 'middle' | 'large' | 'custom'>('none')
const marginCustom = ref(0)
const landscape = ref(false)
const autoOrient = ref(true)
const busy = ref(false)
const result = ref<{ pages: number; pdfMB: number; srcMB: number; url: string; blob: Blob } | null>(null)

const isPngSlug = computed(() => String(route.params.slug || '').includes('png'))

/* slug 差异默认值：png-to-pdf 默认跟随图片尺寸 */
watch(isPngSlug, (v) => {
  if (v) pageSize.value = 'auto'
}, { immediate: true })

const marginPt = computed(() => {
  if (marginPreset.value === 'none') return 0
  if (marginPreset.value === 'small') return 15
  if (marginPreset.value === 'middle') return 30
  if (marginPreset.value === 'large') return 60
  return Math.min(120, Math.max(0, Math.round(marginCustom.value)))
})

/** 边距自定义输入钳制（超 120pt 失焦回落并提示） */
const clampMargin = () => {
  if (marginCustom.value > 120) {
    marginCustom.value = 120
    toast.warn('页边距最大 120pt，已自动回落')
  }
}

const onFiles = (list: File[]) => {
  files.value = list
  clearResult()
}

/* ---------- EXIF 方向解析（JPEG APP1/TIFF tag 0x0112） ---------- */
const jpegOrientation = (bytes: Uint8Array): number => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1
  let off = 2
  while (off + 4 < bytes.length) {
    if (bytes[off] !== 0xff) break
    const marker = bytes[off + 1]
    const size = (bytes[off + 2]! << 8) | bytes[off + 3]!
    if (marker === 0xe1 && off + 10 < bytes.length) {
      // Exif\0\0 + TIFF 头
      const tiff = off + 10
      const le = bytes[tiff + 2] === 0x49 && bytes[tiff + 3] === 0x49
      const rd16 = (o: number) => (le ? bytes[o]! | (bytes[o + 1]! << 8) : (bytes[o]! << 8) | bytes[o + 1]!)
      const rd32 = (o: number) => le ? bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16) | (bytes[o + 3]! << 24) : ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!)
      const ifd0 = rd32(tiff + 4)
      let p = tiff + ifd0
      const n = rd16(p)
      p += 2
      for (let i = 0; i < n && p + 12 <= bytes.length; i++, p += 12) {
        if (rd16(p) === 0x0112) return rd16(p + 8) || 1
      }
      return 1
    }
    if (marker === 0xda) break // SOS
    off += 2 + size
  }
  return 1
}

const PAGE_SIZES: Record<string, [number, number]> = { A4: [595.28, 841.89], Letter: [612, 792] }

const run = async () => {
  if (!files.value.length) {
    toast.warn('请先添加至少一张图片')
    return
  }
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const doc = await PDFDocument.create()
    const margin = marginPt.value
    for (const f of files.value) {
      let img: Awaited<ReturnType<typeof doc.embedPng>>
      let w: number
      let h: number
      if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) {
        const raw = new Uint8Array(await f.arrayBuffer())
        const orient = jpegOrientation(raw)
        if (orient <= 1) {
          img = await doc.embedJpg(raw)
          w = img.width
          h = img.height
        } else {
          // 含 EXIF 旋转：canvas 校正方向后重编码 JPEG
          const canvas = await decodeToCanvas(f)
          const jpg = await canvasToBlob(canvas, 'image/jpeg', 0.92)
          img = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()))
          w = img.width
          h = img.height
        }
      } else {
        const canvas = await decodeToCanvas(f)
        const png = await canvasToBlob(canvas, 'image/png')
        img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()))
        w = img.width
        h = img.height
      }
      let pw: number
      let ph: number
      if (pageSize.value === 'auto') {
        pw = w + margin * 2
        ph = h + margin * 2
      } else {
        const [w0, h0] = PAGE_SIZES[pageSize.value]
        const imgLandscape = autoOrient.value ? w > h : landscape.value
        pw = imgLandscape ? h0 : w0
        ph = imgLandscape ? w0 : h0
      }
      const page = doc.addPage([pw, ph])
      const availW = pw - margin * 2
      const availH = ph - margin * 2
      const scale = Math.min(availW / w, availH / h)
      const dw = w * scale
      const dh = h * scale
      page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh })
    }
    doc.setProducer('ToolHub')
    if (!doc.getCreator()) doc.setCreator('ToolHub')
    const bytes = await doc.save({ updateMetadata: false } as never)
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const srcMB = files.value.reduce((a, f) => a + f.size, 0) / 1048576
    const pdfMB = blob.size / 1048576
    clearResult()
    result.value = { pages: files.value.length, pdfMB, srcMB, url: URL.createObjectURL(blob), blob }
    const inflated = pdfMB > srcMB * 1.5
    toast.ok(
      `已生成 ${files.value.length} 页 PDF · ${pdfMB.toFixed(2)} MB（原图片 ${srcMB.toFixed(2)} MB）${inflated ? '；PDF 明显大于原图，可尝试压缩图片后再合成' : ''}`,
    )
  } catch (e) {
    toast.err((e as Error).message || '合成失败，请检查图片格式')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (result.value) saveBlob(result.value.blob, '图片合成.pdf')
}

const clearResult = () => {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}
</script>

<template>
  <div>
    <a v-if="isPngSlug" href="/t/images-to-pdf" class="small muted">更多图片格式（JPG/WebP/HEIC 混排）？使用「图片合成 PDF」→</a>

    <FileDrop accept="image/*" :multiple="true" label="拖入图片（可多选），按列表顺序合成" hint="支持 JPG / PNG / WebP / HEIC / TIFF 等，本地处理" @files="onFiles" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">页面尺寸</span>
        <select v-model="pageSize" class="select">
          <option value="auto">跟随图片尺寸</option>
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
      </div>
      <div>
        <span class="field-label">页边距</span>
        <select v-model="marginPreset" class="select">
          <option value="none">无（0pt）</option>
          <option value="small">小（15pt）</option>
          <option value="middle">中（30pt）</option>
          <option value="large">大（60pt）</option>
          <option value="custom">自定义</option>
        </select>
      </div>
      <div v-if="marginPreset === 'custom'">
        <span class="field-label">边距（pt，≤120）</span>
        <input v-model.number="marginCustom" type="number" class="input" min="0" max="120" @blur="clampMargin" />
      </div>
      <div v-if="pageSize !== 'auto'">
        <span class="field-label">方向</span>
        <label class="check mt-1">
          <input v-model="autoOrient" type="checkbox" /> 自动匹配每张图方向（勾选时忽略下方固定横向）
        </label>
        <label class="check mt-1"><input v-model="landscape" type="checkbox" :disabled="autoOrient" /> 全部横向</label>
      </div>
    </div>

    <p v-if="isPngSlug" class="small muted mt-2">PNG 透明背景将原样保留（PDF 阅读器中显示为白或深色取决于阅读器）。</p>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 合成 PDF
      </button>
      <button v-if="result" class="btn btn-soft" @click="download">下载 PDF</button>
      <span v-if="files.length" class="small muted">共 {{ files.length }} 张图片，列表顺序即页面顺序（可用 ↑↓ 调整）</span>
    </div>

    <div v-if="result" class="notice notice-ok mt-2 small">
      已生成 {{ result.pages }} 页 · {{ result.pdfMB.toFixed(2) }} MB（原图片 {{ result.srcMB.toFixed(2) }} MB）
      <span v-if="result.pdfMB > result.srcMB * 1.5" class="warn-text">· PDF 大于原图片 1.5 倍，可先压缩图片再合成</span>
      · <a :href="result.url" target="_blank" rel="noopener">新窗口查看</a>
    </div>

    <p class="notice notice-info mt-2 small">
      JPG 直通：无旋转的 JPG 直接嵌入原始字节（体积不膨胀）；含 EXIF 旋转的 JPG 校正后嵌入。固定 A4/Letter 时图片按比例缩放并居中（自动横竖默认开）。
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
.warn-text {
  color: var(--warn);
}
</style>
