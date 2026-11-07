<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import { blackenRegions, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

interface Box {
  page: number
  x: number
  y: number
  w: number
  h: number
}

/** PDF 黑条遮盖：预览上拖拽画框，比例坐标烧录黑条 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const checked = ref<number[]>([])
const order = ref<PageEntry[]>([])
const boxes = ref<Box[]>([])
const busy = ref(false)
const file = ref<File | Blob | null>(null)
const work = ref<Blob | null>(null)
const stage = ref<HTMLDivElement | null>(null)
const drawing = ref<Box | null>(null)

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  work.value = null
  checked.value = []
  boxes.value = []
}

const activePage = () => (checked.value.length ? checked.value[0] : 0)

const renderPreview = async () => {
  if (!file.value || !stage.value) return
  try {
    const canvas = await renderPageToCanvas(file.value, activePage(), 1)
    canvas.style.maxWidth = '100%'
    stage.value.replaceChildren(canvas)
  } catch {
    /* 预览失败忽略 */
  }
}

watch([file, checked], renderPreview)

const pageBoxes = () => boxes.value.filter((b) => b.page === activePage())

/* 拖拽画框 */
let startX = 0
let startY = 0
const onDown = (e: PointerEvent) => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  startX = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  startY = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  drawing.value = { page: activePage(), x: startX, y: startY, w: 0, h: 0 }
  stage.value?.setPointerCapture(e.pointerId)
}
const onMove = (e: PointerEvent) => {
  if (!drawing.value) return
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  const cx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const cy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  drawing.value = {
    page: activePage(),
    x: Math.min(startX, cx),
    y: Math.min(startY, cy),
    w: Math.abs(cx - startX),
    h: Math.abs(cy - startY),
  }
}
const onUp = () => {
  const d = drawing.value
  drawing.value = null
  if (!d || d.w < 0.01 || d.h < 0.01) return
  boxes.value.push(d)
}

const undo = () => boxes.value.pop()
const clearPage = () => (boxes.value = boxes.value.filter((b) => b.page !== activePage()))

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!boxes.value.length) {
    toast.warn('请先在预览上拖拽画出遮盖区域')
    return
  }
  busy.value = true
  try {
    const blob = await blackenRegions(file.value, boxes.value)
    work.value = blob
    saveBlob(blob, '遮盖后.pdf')
    toast.ok(`已烧录 ${boxes.value.length} 处遮盖黑条`)
  } catch (e) {
    toast.err((e as Error).message || '遮盖失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <p v-if="file" class="small muted mt-1">
      在缩略图选中要编辑的页，然后在预览上<b>按住拖拽</b>画出黑条；框选比例精确记录，生成时按每页实际尺寸烧录。
    </p>

    <PageThumbs v-if="file" v-model:checked="checked" v-model:order="order" :file="file" :selectable="true" :movable="false" :rotatable="false" class="mt-2" />

    <div class="stage mt-2" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
      <div ref="stage" class="holder">
        <div
          v-for="(b, i) in [...pageBoxes(), ...(drawing ? [drawing] : [])]"
          :key="i"
          class="blackbox"
          :style="{ left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' }"
        ></div>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !file || !boxes.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 生成遮盖 PDF
      </button>
      <button class="btn btn-ghost" :disabled="!boxes.length" @click="undo">撤销上一个</button>
      <button class="btn btn-ghost" :disabled="!pageBoxes().length" @click="clearPage">清空本页</button>
      <span class="small muted">当前 {{ boxes.length }} 个遮盖区域</span>
    </div>

    <p class="notice notice-warn mt-2 small">
      注意：黑条只是「画上去的覆盖」，底层文字仍然存在于 PDF 中（复制/搜索可见）。若需彻底移除敏感信息，请使用配套的「PDF 深度脱敏」，或生成遮盖后用「压缩 PDF」栅格化销毁文字层。
    </p>
  </div>
</template>

<style scoped>
.stage {
  display: flex;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 6px;
  background: var(--bg-soft);
  touch-action: none;
  cursor: crosshair;
}
.holder {
  position: relative;
  display: inline-block;
  line-height: 0;
  max-width: 100%;
}
.holder :deep(canvas) {
  max-width: 100%;
  height: auto;
}
.blackbox {
  position: absolute;
  background: #000;
  opacity: 0.85;
  pointer-events: none;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
