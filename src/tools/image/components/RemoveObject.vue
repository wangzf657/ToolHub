<script setup lang="ts">
/** 抹除照片杂物：画笔涂抹蒙版 → 由外向内（onion peeling）邻域平均填补 */
import { ref, shallowRef, nextTick } from 'vue'
import { Download, Undo2, Brush } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const work = shallowRef<HTMLCanvasElement | null>(null)
const maskEl = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const ring = ref<HTMLElement | null>(null)
const brush = ref(24)
const filling = ref(false)
const fillProgress = ref('')
const zoom = ref(1)
/** rx4 增量撤销：仅存蒙版变化区域的前值（20 步） */
interface MaskPatch {
  x: number
  y: number
  w: number
  h: number
  before: ImageData
}
const history = shallowRef<MaskPatch[]>([])
/** 填补前快照（单步撤销填补） */
let fillSnapshot: { img: ImageData; mask: ImageData } | null = null

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

/* rx1 缩放 + rx2 光标圈 */
function onWheel(e: WheelEvent) {
  if (!work.value) return
  e.preventDefault()
  zoom.value = Math.min(8, Math.max(1, Number((e.deltaY < 0 ? zoom.value * 1.25 : zoom.value / 1.25).toFixed(3))))
  if (mounted) mounted.style.width = `${zoom.value * 100}%`
}
function onHover(e: PointerEvent) {
  const m = maskEl.value
  const r = ring.value
  if (!m || !r) return
  const rect = m.getBoundingClientRect()
  const stageRect = stage.value!.getBoundingClientRect()
  const d = (brush.value * 2 * rect.width) / m.width
  r.style.width = `${d}px`
  r.style.height = `${d}px`
  r.style.left = `${e.clientX - stageRect.left - d / 2}px`
  r.style.top = `${e.clientY - stageRect.top - d / 2}px`
  r.style.display = 'block'
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
  if (!maskEl.value) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pushPatch()
  painting = true
  lastPt = null
  paintMask(e)
}
function onMove(e: PointerEvent) {
  onHover(e)
  if (painting) paintMask(e)
}
function onUp() {
  painting = false
  lastPt = null
}

/** rx4：涂抹前保存蒙版矩形增量 */
function pushPatch() {
  const m = maskEl.value!
  const p = lastPt
  const W = m.width
  const H = m.height
  const r = brush.value + 2
  const x0 = Math.max(0, Math.floor((p?.x ?? W / 2) - r))
  const y0 = Math.max(0, Math.floor((p?.y ?? H / 2) - r))
  const w = Math.min(W, Math.ceil((p?.x ?? W / 2) + r)) - x0
  const h = Math.min(H, Math.ceil((p?.y ?? H / 2) + r)) - y0
  if (w <= 0 || h <= 0) return
  history.value = [...history.value.slice(-19), { x: x0, y: y0, w, h, before: m.getContext('2d')!.getImageData(x0, y0, w, h) }]
}

function undo() {
  const w = work.value
  const m = maskEl.value
  if (!w || !m) return
  // 先撤填补快照，再撤蒙版增量
  if (fillSnapshot && !history.value.length) {
    w.getContext('2d')!.putImageData(fillSnapshot.img, 0, 0)
    m.getContext('2d')!.putImageData(fillSnapshot.mask, 0, 0)
    fillSnapshot = null
    return
  }
  const snap = history.value[history.value.length - 1]
  if (!snap) return
  m.getContext('2d')!.putImageData(snap.before, snap.x, snap.y)
  history.value = history.value.slice(0, -1)
}

function clearMask() {
  const m = maskEl.value
  if (m) m.getContext('2d')!.clearRect(0, 0, m.width, m.height)
}

/** 由外向内逐圈用非蒙版邻域均值填补（onion peeling，rx5：分片让渡保持 UI 响应 + 进度） */
const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0))

async function fill() {
  const w = work.value
  const m = maskEl.value
  if (!w || !m) return
  filling.value = true
  try {
    const W = w.width
    const H = w.height
    const img = w.getContext('2d')!.getImageData(0, 0, W, H)
    const d = img.data
    const maskData = m.getContext('2d')!.getImageData(0, 0, W, H)
    const mk = maskData.data
    fillSnapshot = { img: new ImageData(new Uint8ClampedArray(img.data), W, H), mask: new ImageData(new Uint8ClampedArray(mk), W, H) }
    const masked = new Uint8Array(W * H)
    let remaining = 0
    for (let i = 0; i < W * H; i++) {
      if (mk[i * 4 + 3]! > 40) {
        masked[i] = 1
        remaining++
      }
    }
    if (!remaining) {
      toast.warn('请先用画笔涂抹要抹除的区域')
      fillSnapshot = null
      return
    }
    const total0 = remaining
    const NB = [-1, 1, -W, W]
    const neighborOf = (i: number, off: number): number => {
      const x = i % W
      const y = (i / W) | 0
      if (off === -1 && x === 0) return -1
      if (off === 1 && x === W - 1) return -1
      if (off === -W && y === 0) return -1
      if (off === W && y === H - 1) return -1
      return i + off
    }
    let list: number[] = []
    for (let i = 0; i < W * H; i++) if (masked[i]) list.push(i)
    let guard = 0
    while (remaining > 0 && guard++ < 600) {
      const boundary = list.filter((i) => NB.some((off) => neighborOf(i, off) >= 0 && !masked[neighborOf(i, off)]))
      if (!boundary.length) break
      const fills = boundary.map((i) => {
        let r = 0, g = 0, b = 0, n = 0
        for (const off of NB) {
          const j = neighborOf(i, off)
          if (j < 0 || masked[j]) continue
          r += d[j * 4]!
          g += d[j * 4 + 1]!
          b += d[j * 4 + 2]!
          n++
        }
        return { i, r: n ? r / n : 0, g: n ? g / n : 0, b: n ? b / n : 0 }
      })
      for (const f of fills) {
        d[f.i * 4] = f.r
        d[f.i * 4 + 1] = f.g
        d[f.i * 4 + 2] = f.b
        d[f.i * 4 + 3] = 255
        masked[f.i] = 0
        remaining--
      }
      list = list.filter((i) => masked[i])
      // rx5：每圈让渡一帧，滑杆/撤销期间仍可点击，进度可见
      fillProgress.value = `填补中 ${Math.round(((total0 - remaining) / total0) * 100)}%`
      await yieldFrame()
    }
    w.getContext('2d')!.putImageData(img, 0, 0)
    clearMask()
    toast.ok('填补完成，不满意可撤销后调整笔刷再试')
  } finally {
    filling.value = false
    fillProgress.value = ''
  }
}

async function download() {
  if (!work.value || !file.value) return
  const blob = await canvasToBlob(work.value, 'image/png')
  saveBlob(blob, `${baseName(file.value.name)}-cleaned.png`)
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="用画笔涂掉杂物 → 点「填补」，周边像素会自动向内生长"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 14px; align-items: center">
        <div style="min-width: 220px">
          <span class="field-label">笔刷大小：{{ brush }} px</span>
          <input v-model.number="brush" type="range" min="8" max="80" step="2" />
        </div>
        <button class="btn btn-primary" :disabled="filling" @click="fill">
          <Brush :size="15" /> {{ filling ? fillProgress || '正在填补…' : '填补蒙版区域' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length && !fillSnapshot" @click="undo"><Undo2 :size="14" /> 撤销（{{ history.length }}）</button>
        <button class="btn btn-ghost btn-sm" @click="clearMask">清除蒙版</button>
        <button class="btn btn-ghost btn-sm" @click="resetAll">换一张</button>
        <span class="muted small">缩放 {{ Math.round(zoom * 100) }}%（滚轮 100%~800%）</span>
      </div>

      <div ref="stage" class="stage mt-2" @wheel="onWheel">
        <canvas ref="maskEl" class="mask-cv" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointerleave="onUp"></canvas>
        <div ref="ring" class="cursor-ring" aria-hidden="true"></div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="filling" @click="download"><Download :size="16" /> 下载结果 PNG</button>
        <span class="muted small">红色区域为蒙版（仅供参考，不会导出）；大面积区域建议分多次小块涂抹</span>
      </div>
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
  cursor: none;
}
.cursor-ring {
  position: absolute;
  display: none;
  border: 1.5px solid rgba(255, 51, 85, 0.95);
  border-radius: 999px;
  pointer-events: none;
  background: rgba(255, 51, 85, 0.15);
  z-index: 2;
}
</style>
