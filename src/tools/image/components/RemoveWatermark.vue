<script setup lang="ts">
/** 图片去水印：画笔涂抹水印区域 → MI-GAN 模型端侧推理修复（首次使用需下载模型） */
import { ref, shallowRef, nextTick, computed } from 'vue'
import { Download, Undo2, Brush, WandSparkles } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { inpaintCanvas } from '@/lib/inpaintEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { useModel } from '@/composables/useModel'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const model = useModel('图像修复模型')
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const work = shallowRef<HTMLCanvasElement | null>(null)
const maskEl = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const brush = ref(24)
const history = shallowRef<{ img: ImageData; mask: ImageData }[]>([])

const busy = computed(() => model.state.value === 'loading')
const stageText = computed(() => model.progress.value.status)
const pct = computed(() => model.progress.value.progress)

let mounted: HTMLCanvasElement | null = null
let painting = false
let lastPt: { x: number; y: number } | null = null

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  try {
    const c = await decodeToCanvas(files[0])
    file.value = files[0]
    const w = document.createElement('canvas')
    w.width = c.width
    w.height = c.height
    w.getContext('2d')!.drawImage(c, 0, 0)
    src.value = c
    work.value = w
    history.value = []
    await nextTick()
    if (mounted) mounted.remove()
    if (stage.value) {
      w.style.maxWidth = '100%'
      w.style.height = 'auto'
      w.style.display = 'block'
      stage.value.insertBefore(w, stage.value.firstChild)
      mounted = w
      const m = maskEl.value
      if (m) {
        m.width = c.width
        m.height = c.height
      }
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function resetAll() {
  src.value = null
  work.value = null
  file.value = null
  history.value = []
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

function pt(e: PointerEvent) {
  const m = maskEl.value!
  const rect = m.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * m.width,
    y: ((e.clientY - rect.top) / rect.height) * m.height,
  }
}

function paintMask(e: PointerEvent) {
  const m = maskEl.value!
  const ctx = m.getContext('2d')!
  const p = pt(e)
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = '#ff3355'
  ctx.fillStyle = '#ff3355'
  ctx.lineWidth = brush.value * 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (lastPt) {
    ctx.beginPath()
    ctx.moveTo(lastPt.x, lastPt.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(p.x, p.y, brush.value, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  lastPt = p
}

function onDown(e: PointerEvent) {
  if (!maskEl.value || busy.value) return
  e.preventDefault()
  const w = work.value!
  const m = maskEl.value
  history.value = [...history.value.slice(-4), { img: w.getContext('2d')!.getImageData(0, 0, w.width, w.height), mask: m.getContext('2d')!.getImageData(0, 0, m.width, m.height) }]
  painting = true
  lastPt = null
  paintMask(e)
}
function onMove(e: PointerEvent) {
  if (painting) paintMask(e)
}
function onUp() {
  painting = false
  lastPt = null
}

function undo() {
  const w = work.value
  const m = maskEl.value
  const snap = history.value[history.value.length - 1]
  if (!w || !m || !snap) return
  w.getContext('2d')!.putImageData(snap.img, 0, 0)
  m.getContext('2d')!.putImageData(snap.mask, 0, 0)
  history.value = history.value.slice(0, -1)
}

function clearMask() {
  const m = maskEl.value
  if (m) m.getContext('2d')!.clearRect(0, 0, m.width, m.height)
}

/** 涂抹区域交给 MI-GAN 模型重绘（首次自动下载模型） */
async function runInpaint() {
  const w = work.value
  const m = maskEl.value
  if (!w || !m || busy.value) return
  model.begin()
  try {
    await inpaintCanvas(w, m, (status, p) => {
      model.setProgress({ status, progress: p ?? -1 })
    })
    clearMask()
    model.done()
    toast.ok('修复完成，不满意可撤销后调整笔刷再试')
  } catch (e) {
    const msg = (e as Error).message || '修复失败'
    model.fail(msg)
    toast.err(msg)
  }
}

async function download() {
  if (!work.value || !file.value) return
  const blob = await canvasToBlob(work.value, 'image/png')
  saveBlob(blob, `${baseName(file.value.name)}-no-watermark.png`)
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="用画笔涂掉水印 → 点「AI 修复」，模型会按周围画面智能补全"
      @files="onFiles"
    />
    <div v-else>
      <div class="notice notice-info small mb-2">
        修复由浏览器本地 AI 模型完成，图片不会上传；首次使用会自动下载修复模型（约 28MB），完成后浏览器缓存，之后可离线使用。
      </div>
      <div class="row row-wrap mt-1" style="gap: 14px">
        <div style="min-width: 220px">
          <span class="field-label">笔刷大小：{{ brush }} px</span>
          <input v-model.number="brush" type="range" min="8" max="80" step="2" />
        </div>
        <button class="btn btn-primary" :disabled="busy" @click="runInpaint">
          <WandSparkles :size="15" /> {{ busy ? '正在修复…' : 'AI 修复涂抹区域' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length || busy" @click="undo"><Undo2 :size="14" /> 撤销</button>
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="clearMask">清除蒙版</button>
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="resetAll">换一张</button>
      </div>

      <div v-if="busy" class="model-progress mt-2">
        <div class="bar-wrap"><div class="bar" :class="{ indeterminate: pct < 0 }" :style="pct >= 0 ? { width: pct + '%' } : {}"></div></div>
        <span class="muted small">{{ stageText }}{{ pct >= 0 ? ' ' + pct + '%' : '' }}</span>
      </div>

      <div ref="stage" class="stage mt-2">
        <canvas
          ref="maskEl"
          class="mask-cv"
          :style="{ cursor: busy ? 'wait' : 'crosshair' }"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointerleave="onUp"
        ></canvas>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="download"><Download :size="16" /> 下载结果 PNG</button>
        <span class="muted small">红色区域为蒙版（仅供参考，不会导出）；大块水印建议按区域分几次修复</span>
      </div>
      <p class="muted small mt-1">轻微半透明水印、简单背景也可以试试免模型的「抹除照片杂物」。</p>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  line-height: 0;
  touch-action: none;
}
.stage :deep(canvas:first-child) {
  max-width: 100%;
  height: auto;
}
.mask-cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
.model-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}
.model-progress .bar-wrap {
  flex: 0 1 260px;
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}
.model-progress .bar {
  height: 100%;
  border-radius: 3px;
  background: var(--primary, #3b82f6);
  transition: width 0.2s;
}
.model-progress .bar.indeterminate {
  width: 40%;
  animation: slide 1.2s ease-in-out infinite;
}
@keyframes slide {
  0% {
    margin-left: -40%;
  }
  100% {
    margin-left: 100%;
  }
}
</style>
