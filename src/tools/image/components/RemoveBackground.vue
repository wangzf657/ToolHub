<script setup lang="ts">
/**
 * 抠图换背景（UX1.0 四处方）：
 * - 点击取样种子（rx2）：色键 Tab 点击画布任意位置作为 flood-fill 起点（四角自动种子保留）。
 * - 换背景输出（rx3）：透明｜纯色｜自定义图片背景，合成后导出。
 * - 恢复画笔（rx4）：画笔 Tab 擦除｜恢复二态，撤销深度 20。
 * - 画布缩放（rx5）：滚轮 100%~400%，坐标映射无偏移。
 */
import { nextTick, ref, shallowRef } from 'vue'
import { Undo2, Info, Eraser, Brush } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const work = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const tab = ref<'key' | 'brush'>('key')
const tolerance = ref(28)
const brush = ref(36)
const brushMode = ref<'erase' | 'restore'>('erase')
const zoom = ref(1)
/** rx3 背景 */
const bgMode = ref<'transparent' | 'solid' | 'image'>('transparent')
const bgColor = ref('#438EDB')
const bgImg = shallowRef<HTMLCanvasElement | null>(null)
const history = shallowRef<ImageData[]>([])

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
    if (c.width * c.height > 20_000_000) toast.warn('图片超过 2000 万像素，抠图可能较慢')
    const w = document.createElement('canvas')
    w.width = c.width
    w.height = c.height
    w.getContext('2d')!.drawImage(c, 0, 0)
    src.value = c
    work.value = w
    history.value = []
    zoom.value = 1
    await nextTick()
    if (mounted) mounted.remove()
    if (stage.value) {
      w.style.maxWidth = '100%'
      w.style.height = 'auto'
      w.style.display = 'block'
      w.style.cursor = tab.value === 'brush' ? 'crosshair' : 'pointer'
      w.style.touchAction = 'none'
      stage.value.appendChild(w)
      mounted = w
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
  bgImg.value = null
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

function pushHistory() {
  const w = work.value
  if (!w) return
  const snap = w.getContext('2d')!.getImageData(0, 0, w.width, w.height)
  history.value = [...history.value.slice(-19), snap]
}

function undo() {
  const w = work.value
  const snap = history.value[history.value.length - 1]
  if (!w || !snap) return
  w.getContext('2d')!.putImageData(snap, 0, 0)
  history.value = history.value.slice(0, -1)
}

function pt(e: PointerEvent) {
  const c = work.value!
  const rect = c.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * c.width,
    y: ((e.clientY - rect.top) / rect.height) * c.height,
  }
}

/* rx5 缩放 */
function onWheel(e: WheelEvent) {
  if (!work.value) return
  e.preventDefault()
  zoom.value = Math.min(4, Math.max(1, Number((e.deltaY < 0 ? zoom.value * 1.2 : zoom.value / 1.2).toFixed(3))))
  if (mounted) mounted.style.width = `${zoom.value * 100}%`
}

/* ---------- 画笔：擦除｜恢复二态（rx4） ---------- */
function paintStroke(e: PointerEvent) {
  const c = work.value!
  const ctx = c.getContext('2d')!
  const p = pt(e)
  if (brushMode.value === 'restore') {
    // 恢复：从原图把该圆域画回来
    ctx.save()
    ctx.beginPath()
    ctx.arc(p.x, p.y, brush.value, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(src.value!, 0, 0)
    ctx.restore()
  } else {
    ctx.globalCompositeOperation = 'destination-out'
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
    ctx.globalCompositeOperation = 'source-over'
  }
  lastPt = p
}

function onPointerDown(e: PointerEvent) {
  if (!work.value) return
  const p = pt(e)
  if (tab.value === 'key') {
    // rx2 点击取样：以点击处 5×5 均值色为种子，从该点扩散
    floodFill([[p.x, p.y]], false)
    return
  }
  pushHistory()
  painting = true
  lastPt = null
  paintStroke(e)
}
function onPointerMove(e: PointerEvent) {
  if (!painting) return
  paintStroke(e)
}
function onPointerUp() {
  painting = false
  lastPt = null
}

/* ---------- 色键 flood-fill：seeds 传像素坐标 ---------- */
function floodFill(seeds: [number, number][], useCorners: boolean) {
  const w = work.value
  if (!w) return
  pushHistory()
  const ctx = w.getContext('2d')!
  const id = ctx.getImageData(0, 0, w.width, w.height)
  const d = id.data
  const W = w.width
  const H = w.height
  let sr = 0, sg = 0, sb = 0, n = 0
  const sample = (cx: number, cy: number) => {
    for (let y = Math.max(0, cy); y < Math.min(H, cy + 5); y++)
      for (let x = Math.max(0, cx); x < Math.min(W, cx + 5); x++) {
        const i = (y * W + x) * 4
        sr += d[i]!
        sg += d[i + 1]!
        sb += d[i + 2]!
        n++
      }
  }
  if (useCorners) {
    sample(0, 0); sample(W - 5, 0); sample(0, H - 5); sample(W - 5, H - 5)
  } else {
    sample(Math.round(seeds[0]![0]) - 2, Math.round(seeds[0]![1]) - 2)
  }
  const br = sr / n, bg2 = sg / n, bb = sb / n
  const tol = tolerance.value * 2.2
  const visited = new Uint8Array(W * H)
  const queue = new Int32Array(W * H)
  let head = 0, tail = 0
  const match = (i: number) => Math.abs(d[i]! - br) <= tol && Math.abs(d[i + 1]! - bg2) <= tol && Math.abs(d[i + 2]! - bb) <= tol
  const seedList: [number, number][] = useCorners
    ? [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]
    : seeds.map(([x, y]) => [Math.max(0, Math.min(W - 1, Math.round(x))), Math.max(0, Math.min(H - 1, Math.round(y)))] as [number, number])
  for (const [sx, sy] of seedList) {
    const idx = sy * W + sx
    if (!visited[idx] && match(idx * 4)) {
      visited[idx] = 1
      queue[tail++] = idx
    }
  }
  let masked = 0
  while (head < tail) {
    const idx = queue[head++]
    masked++
    d[idx * 4 + 3] = 0
    const x = idx % W
    const y = (idx / W) | 0
    if (x > 0 && !visited[idx - 1] && match((idx - 1) * 4)) { visited[idx - 1] = 1; queue[tail++] = idx - 1 }
    if (x < W - 1 && !visited[idx + 1] && match((idx + 1) * 4)) { visited[idx + 1] = 1; queue[tail++] = idx + 1 }
    if (y > 0 && !visited[idx - W] && match((idx - W) * 4)) { visited[idx - W] = 1; queue[tail++] = idx - W }
    if (y < H - 1 && !visited[idx + W] && match((idx + W) * 4)) { visited[idx + W] = 1; queue[tail++] = idx + W }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      if (d[idx * 4 + 3] === 0) continue
      const nb =
        (x > 0 && d[(idx - 1) * 4 + 3] === 0) ||
        (x < W - 1 && d[(idx + 1) * 4 + 3] === 0) ||
        (y > 0 && d[(idx - W) * 4 + 3] === 0) ||
        (y < H - 1 && d[(idx + W) * 4 + 3] === 0)
      if (nb) d[idx * 4 + 3] = 150
    }
  }
  ctx.putImageData(id, 0, 0)
  toast.ok(`已抠除 ${((masked / (W * H)) * 100).toFixed(1)}% 像素，可再调容差重试或用画笔修补`)
}

function floodFromCorners() {
  floodFill([], true)
}

async function loadBg(files: File[]) {
  if (!files.length) return
  try {
    bgImg.value = await decodeToCanvas(files[0])
    bgMode.value = 'image'
  } catch {
    toast.err('背景图解码失败')
  }
}

/** rx3 合成背景导出 */
async function produce() {
  const w = work.value
  if (!w) throw new Error('请先载入图片')
  if (bgMode.value === 'transparent') return canvasToBlob(w, 'image/png')
  const out = document.createElement('canvas')
  out.width = w.width
  out.height = w.height
  const ctx = out.getContext('2d')!
  if (bgMode.value === 'solid') {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, out.width, out.height)
  } else if (bgImg.value) {
    const b = bgImg.value
    const s = Math.max(out.width / b.width, out.height / b.height)
    ctx.drawImage(b, (out.width - b.width * s) / 2, (out.height - b.height * s) / 2, b.width * s, b.height * s)
  }
  ctx.drawImage(w, 0, 0)
  return canvasToBlob(out, 'image/jpeg', 0.94)
}

function switchTab(t: 'key' | 'brush') {
  tab.value = t
  if (mounted) mounted.style.cursor = t === 'brush' ? 'crosshair' : 'pointer'
}
</script>

<template>
  <div>
    <div class="notice notice-info mt-1">
      <Info :size="16" style="flex: none; margin-top: 2px" />
      <span>
        本实现为<strong>即时可用</strong>的色键 flood-fill 抠图（适合背景干净的证件照 / 商品图）与画笔修补；
        纯色背景可直接点击背景区域取样抠图，再在下方换背景导出。
      </span>
    </div>

    <FileDrop v-if="!src" accept="image/*" :multiple="false" label="拖放图片到此处" hint="建议主体与背景颜色差异明显" @files="onFiles" />
    <div v-else>
      <div class="chips mt-2">
        <button class="chip" :class="{ active: tab === 'key' }" @click="switchTab('key')">色键抠图</button>
        <button class="chip" :class="{ active: tab === 'brush' }" @click="switchTab('brush')">画笔修补</button>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length" @click="undo"><Undo2 :size="14" /> 撤销（{{ history.length }}）</button>
        <button class="btn btn-ghost btn-sm" @click="resetAll">换一张</button>
        <span class="muted small">缩放 {{ Math.round(zoom * 100) }}%</span>
      </div>

      <div v-if="tab === 'key'" class="row row-wrap mt-2" style="gap: 18px; align-items: center">
        <div style="min-width: 240px">
          <span class="field-label">背景容差：{{ tolerance }}</span>
          <input v-model.number="tolerance" type="range" min="4" max="100" step="2" />
        </div>
        <button class="btn btn-primary" @click="floodFromCorners"><Eraser :size="15" /> 四角取样抠图</button>
        <span class="muted small">或直接点击图中背景处，从该点取样扩散（rx2）；边缘自动 1px 羽化</span>
      </div>
      <div v-else class="row row-wrap mt-2" style="gap: 14px; align-items: center">
        <button class="chip" :class="{ active: brushMode === 'erase' }" @click="brushMode = 'erase'"><Eraser :size="14" /> 擦除</button>
        <button class="chip" :class="{ active: brushMode === 'restore' }" @click="brushMode = 'restore'"><Brush :size="14" /> 恢复</button>
        <div style="min-width: 240px">
          <span class="field-label">画笔大小：{{ brush }} px</span>
          <input v-model.number="brush" type="range" min="6" max="120" step="2" />
        </div>
        <span class="muted small">擦多的主体用「恢复」笔补回；滚轮缩放画布处理细节（rx5）</span>
      </div>

      <div ref="stage" class="stage mt-2" @wheel="onWheel" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointerleave="onPointerUp"></div>

      <!-- rx3 换背景输出 -->
      <div class="row row-wrap mt-2" style="gap: 10px; align-items: center">
        <span class="field-label">输出背景</span>
        <button class="chip" :class="{ active: bgMode === 'transparent' }" @click="bgMode = 'transparent'">透明</button>
        <button class="chip" :class="{ active: bgMode === 'solid' }" @click="bgMode = 'solid'">纯色</button>
        <input v-if="bgMode === 'solid'" v-model="bgColor" type="color" />
        <button class="chip" :class="{ active: bgMode === 'image' }" @click="bgMode = 'image'">自定义图片</button>
        <FileDrop v-if="bgMode === 'image' && !bgImg" accept="image/*" :multiple="false" label="拖入背景图" @files="loadBg" />
        <span v-if="bgMode === 'image' && bgImg" class="muted small">背景图已载入（{{ bgImg.width }}×{{ bgImg.height }}）</span>
      </div>

      <div class="row mt-2">
        <DownloadButton :produce="produce" :default-name="(file ? baseName(file.name) : 'image') + (bgMode === 'transparent' ? '-cutout.png' : '-bg.jpg')" :button-text="bgMode === 'transparent' ? '下载透明 PNG' : '下载合成图 JPG'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.stage {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
  touch-action: none;
  overflow: auto;
  max-height: 72vh;
}
</style>
