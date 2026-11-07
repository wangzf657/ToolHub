<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import SignPad from './SignPad.vue'
import { loadPdfLib, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 签名：手绘签名 → 选页 → 点击放置 → 以 PNG 贴图写入 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const pad = ref<InstanceType<typeof SignPad> | null>(null)
const checked = ref<number[]>([])
const order = ref<PageEntry[]>([])
const inkColor = ref('#1a2233')
const inkWidth = ref(3)
const sigW = ref(30) // 签名宽度占页宽百分比
const busy = ref(false)
const file = ref<File | Blob | null>(null)
const work = ref<Blob | null>(null) // 已叠加签名的工作副本
const previewBox = ref<HTMLDivElement | null>(null)
const placed = ref<{ x: number; y: number } | null>(null) // 页面比例坐标
const sigDataUrl = ref('')

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  work.value = null
  checked.value = []
  placed.value = null
}

const activePage = () => (checked.value.length ? checked.value[0] : 0)

const renderPreview = async () => {
  if (!work.value || !previewBox.value) return
  try {
    const canvas = await renderPageToCanvas(work.value, activePage(), 1)
    canvas.style.maxWidth = '100%'
    previewBox.value.replaceChildren(canvas)
  } catch {
    /* 忽略预览错误 */
  }
}

watch([work, checked], renderPreview)

/** 在预览上点击选择放置点 */
const onPick = (e: MouseEvent) => {
  const box = previewBox.value
  if (!box) return
  const canvas = box.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先等待页面预览加载完成')
    return
  }
  const r = canvas.getBoundingClientRect()
  placed.value = {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  }
}

const prepareSignature = () => {
  if (!pad.value) return false
  if (pad.value.isEmpty()) {
    toast.warn('请先在签名板上手写签名')
    return false
  }
  sigDataUrl.value = pad.value.toDataURL()
  return true
}

const apply = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!prepareSignature()) return
  if (!placed.value) {
    toast.warn('请在页面预览上点击选择签名放置位置')
    return
  }
  busy.value = true
  try {
    const source = work.value ?? file.value
    const { PDFDocument } = await loadPdfLib()
    const doc = await PDFDocument.load(await source.arrayBuffer(), { ignoreEncryption: true })
    const page = doc.getPage(Math.min(activePage(), doc.getPageCount() - 1))
    const { width, height } = page.getSize()
    const png = await doc.embedPng(sigDataUrl.value)
    const w = (sigW.value / 100) * width
    const h = png.height * (w / png.width)
    // 预览点击点是签名左上角；PDF 坐标左下原点
    page.drawImage(png, {
      x: placed.value.x * width,
      y: (1 - placed.value.y) * height - h,
      width: w,
      height: h,
    })
    const out = (await doc.save()) as unknown as Blob
    work.value = out
    toast.ok('签名已放置，可继续放置多个签名或下载')
  } catch (e) {
    toast.err((e as Error).message || '签名失败')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (!work.value) {
    toast.warn('还没有放置任何签名')
    return
  }
  saveBlob(work.value, '签名后.pdf')
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div v-if="file" class="grid-2 mt-2">
      <div>
        <p class="field-label mb-2">1 · 手写签名</p>
        <SignPad ref="pad" v-model:color="inkColor" v-model:width="inkWidth" />
        <div class="grid-2 mt-2">
          <div>
            <span class="field-label">笔迹颜色</span>
            <input v-model="inkColor" type="color" class="input color" />
          </div>
          <div>
            <span class="field-label">笔迹粗细：{{ inkWidth }}</span>
            <input v-model.number="inkWidth" type="range" class="range" min="1" max="8" step="1" />
          </div>
        </div>
        <p class="field-label mt-2">3 · 签名宽度占页宽：{{ sigW }}%</p>
        <input v-model.number="sigW" type="range" class="range" min="8" max="70" step="1" />
      </div>
      <div>
        <p class="field-label mb-2">2 · 选择页面并点击放置位置</p>
        <PageThumbs v-model:checked="checked" v-model:order="order" :file="file" :selectable="true" :movable="false" :rotatable="false" />
        <div class="preview mt-2" @click="onPick">
          <div ref="previewBox" class="canvas-holder">
            <span v-if="placed" class="dot" :style="{ left: placed.x * 100 + '%', top: placed.y * 100 + '%' }"></span>
          </div>
        </div>
        <p class="small muted mt-1">预览中蓝点为放置位置（签名左上角），点击可重新选择</p>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="apply">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 放置签名
      </button>
      <button class="btn btn-soft" :disabled="!work" @click="download">下载签名后 PDF</button>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
.color {
  height: 34px;
  padding: 2px;
}
.preview {
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 6px;
  min-height: 220px;
  display: flex;
  justify-content: center;
  background: var(--bg-soft);
  cursor: crosshair;
}
.canvas-holder {
  position: relative;
  display: inline-block;
  line-height: 0;
  max-width: 100%;
}
.canvas-holder :deep(canvas) {
  max-width: 100%;
  height: auto;
}
.dot {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
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
