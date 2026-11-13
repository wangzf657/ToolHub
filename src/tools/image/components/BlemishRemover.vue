<script setup lang="ts">
/**
 * 瑕疵修补笔（UX1.0 四处方）：
 * - 光标预览圈（rx1）：半透明圆跟随鼠标，直径=实际修复痕迹直径，调滑杆同步。
 * - 画布缩放（rx3）：滚轮 100%~800%，坐标换算无偏移（按显示矩形映射）。
 * - 描涂模式（rx4）：按住拖动沿轨迹连续修复，笔刷半径即修复半径。
 * - 增量撤销（rx5）：快照仅存修复圆外接矩形前值，20 步内存增量极小。
 */
import { nextTick, ref, shallowRef } from 'vue'
import { Download, Undo2 } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const work = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const ring = ref<HTMLElement | null>(null)
const radius = ref(9)
const zoom = ref(1)
/** 增量快照：受影响矩形 + 前值像素 */
interface Patch {
  x: number
  y: number
  w: number
  h: number
  before: ImageData
}
const history = shallowRef<Patch[]>([])

let mounted: HTMLCanvasElement | null = null

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
    work.value = w
    history.value = []
    zoom.value = 1
    await nextTick()
    if (mounted) mounted.remove()
    if (stage.value) {
      w.style.width = '100%'
      w.style.height = 'auto'
      w.style.display = 'block'
      w.style.cursor = 'none'
      w.style.touchAction = 'none'
      stage.value.appendChild(w)
      mounted = w
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function resetAll() {
  work.value = null
  file.value = null
  history.value = []
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

/* ---------- 坐标与缩放 ---------- */
function toCanvas(e: PointerEvent | MouseEvent): { x: number; y: number } | null {
  const c = work.value
  if (!c) return null
  const rect = c.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * c.width,
    y: ((e.clientY - rect.top) / rect.height) * c.height,
  }
}

function onWheel(e: WheelEvent) {
  if (!work.value) return
  e.preventDefault()
  const next = e.deltaY < 0 ? zoom.value * 1.25 : zoom.value / 1.25
  zoom.value = Math.min(8, Math.max(1, Number(next.toFixed(3))))
  if (mounted) mounted.style.width = `${zoom.value * 100}%`
}

/** 光标预览圈（rx1）：跟随鼠标，直径与修复痕迹一致 */
function onHover(e: PointerEvent | MouseEvent) {
  const c = work.value
  const r = ring.value
  if (!c || !r) return
  const rect = c.getBoundingClientRect()
  const stageRect = stage.value!.getBoundingClientRect()
  const d = (radius.value * 2 * rect.width) / c.width
  r.style.width = `${d}px`
  r.style.height = `${d}px`
  r.style.left = `${e.clientX - stageRect.left - d / 2}px`
  r.style.top = `${e.clientY - stageRect.top - d / 2}px`
  r.style.display = 'block'
}

/* ---------- 修复与增量撤销 ---------- */
function pushPatch(cx: number, cy: number, r: number) {
  const c = work.value!
  const W = c.width
  const H = c.height
  const x0 = Math.max(0, Math.floor(cx - r * 2))
  const y0 = Math.max(0, Math.floor(cy - r * 2))
  const w = Math.min(W, Math.ceil(cx + r * 2)) - x0
  const h = Math.min(H, Math.ceil(cy + r * 2)) - y0
  if (w <= 0 || h <= 0) return
  const before = c.getContext('2d')!.getImageData(x0, y0, w, h)
  history.value = [...history.value.slice(-19), { x: x0, y: y0, w, h, before }]
}

function healAt(cx: number, cy: number) {
  const c = work.value
  if (!c) return
  const r = radius.value
  pushPatch(cx, cy, r)
  const W = c.width
  const H = c.height
  const ctx = c.getContext('2d')!
  const id = ctx.getImageData(0, 0, W, H)
  const d = id.data
  let sr = 0, sg = 0, sb = 0, n = 0
  const r0 = r + 3
  const r1 = r * 1.9
  for (let y = Math.max(0, cy - r1) | 0; y <= Math.min(H - 1, cy + r1); y++) {
    for (let x = Math.max(0, cx - r1) | 0; x <= Math.min(W - 1, cx + r1); x++) {
      const dist = Math.hypot(x - cx, y - cy)
      if (dist < r0 || dist > r1) continue
      const i = ((y | 0) * W + (x | 0)) * 4
      sr += d[i]!
      sg += d[i + 1]!
      sb += d[i + 2]!
      n++
    }
  }
  if (!n) return
  const ar = sr / n, ag = sg / n, ab = sb / n
  for (let y = Math.max(0, cy - r) | 0; y <= Math.min(H - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r) | 0; x <= Math.min(W - 1, cx + r); x++) {
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > r) continue
      const i = ((y | 0) * W + (x | 0)) * 4
      const k = dist > r * 0.75 ? 0.55 : 1
      d[i] = d[i]! * (1 - k) + ar * k
      d[i + 1] = d[i + 1]! * (1 - k) + ag * k
      d[i + 2] = d[i + 2]! * (1 - k) + ab * k
    }
  }
  ctx.putImageData(id, 0, 0)
}

/* 描涂（rx4）：按住拖动沿轨迹连续修复，间距 = 半径×0.5 保证无断点 */
let painting = false
let last: { x: number; y: number } | null = null

function onDown(e: PointerEvent) {
  const c = work.value
  if (!c || !e.isPrimary) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  painting = true
  const p = toCanvas(e)
  last = p
  if (p) healAt(p.x, p.y)
}
function onMove(e: PointerEvent) {
  onHover(e)
  if (!painting) return
  const p = toCanvas(e)
  if (!p || !last) {
    last = p
    return
  }
  const step = radius.value * 0.5
  const dist = Math.hypot(p.x - last.x, p.y - last.y)
  if (dist < step) return
  // 沿轨迹插值补点，快速拖动不断线
  const steps = Math.min(12, Math.ceil(dist / step))
  for (let i = 1; i <= steps; i++) {
    healAt(last.x + ((p.x - last.x) * i) / steps, last.y + ((p.y - last.y) * i) / steps)
  }
  last = p
}
function onUp() {
  painting = false
  last = null
}
function onLeave() {
  if (ring.value) ring.value.style.display = 'none'
}

function undo() {
  const c = work.value
  const snap = history.value[history.value.length - 1]
  if (!c || !snap) return
  c.getContext('2d')!.putImageData(snap.before, snap.x, snap.y)
  history.value = history.value.slice(0, -1)
}

async function download() {
  if (!work.value || !file.value) return
  const blob = await canvasToBlob(work.value, 'image/png')
  saveBlob(blob, `${baseName(file.value.name)}-fixed.png`)
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!work"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="点按或按住拖过痘印 / 灰尘 / 划痕，用周围肤色补上"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 14px">
        <div style="min-width: 220px">
          <span class="field-label">修复半径：{{ radius }} px</span>
          <input v-model.number="radius" type="range" min="4" max="40" step="1" />
        </div>
        <span class="muted small">缩放 {{ Math.round(zoom * 100) }}%（滚轮调节）</span>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length" @click="undo"><Undo2 :size="14" /> 撤销（{{ history.length }}）</button>
        <button class="btn btn-ghost btn-sm" @click="resetAll">换一张</button>
      </div>

      <div ref="stage" class="stage mt-2" @wheel="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="onLeave">
        <div ref="ring" class="cursor-ring" aria-hidden="true"></div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="download"><Download :size="16" /> 下载结果 PNG</button>
        <span class="muted small">修复半径应略大于瑕疵本身；大图可滚轮放大后处理细节</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
}
.cursor-ring {
  position: absolute;
  display: none;
  border: 1.5px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(0, 0, 0, 0.25);
  border-radius: 999px;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.12);
  z-index: 2;
}
</style>
