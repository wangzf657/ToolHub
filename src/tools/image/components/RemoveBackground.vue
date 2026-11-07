<script setup lang="ts">
/** 抠图：色键 flood-fill（四角取背景色）或画笔擦除，即时可用无需下载模型 */
import { ref, shallowRef, nextTick } from 'vue'
import { Download, Undo2, Info } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
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
    await nextTick()
    if (mounted) mounted.remove()
    if (stage.value) {
      w.style.maxWidth = '100%'
      w.style.height = 'auto'
      w.style.display = 'block'
      w.style.cursor = tab.value === 'brush' ? 'crosshair' : 'default'
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
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

function pushHistory() {
  const w = work.value
  if (!w) return
  const snap = w.getContext('2d')!.getImageData(0, 0, w.width, w.height)
  history.value = [...history.value.slice(-4), snap]
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

/* ---------- 画笔擦除 ---------- */
function paintStroke(e: PointerEvent) {
  const c = work.value!
  const ctx = c.getContext('2d')!
  const p = pt(e)
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
  lastPt = p
}

function onPointerDown(e: PointerEvent) {
  if (tab.value !== 'brush' || !work.value) return
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

/* ---------- 色键 flood-fill 抠图 ---------- */
function floodFill() {
  const w = work.value
  if (!w) return
  pushHistory()
  const ctx = w.getContext('2d')!
  const id = ctx.getImageData(0, 0, w.width, w.height)
  const d = id.data
  const W = w.width
  const H = w.height
  // 四角 5×5 平均色作为背景种子色
  let sr = 0, sg = 0, sb = 0, n = 0
  const sample = (cx: number, cy: number) => {
    for (let y = cy; y < cy + 5 && y < H; y++)
      for (let x = cx; x < cx + 5 && x < W; x++) {
        const i = (y * W + x) * 4
        sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++
      }
  }
  sample(0, 0); sample(W - 5, 0); sample(0, H - 5); sample(W - 5, H - 5)
  const br = sr / n, bg = sg / n, bb = sb / n
  const tol = tolerance.value * 2.2
  const visited = new Uint8Array(W * H)
  const queue = new Int32Array(W * H)
  let head = 0, tail = 0
  const seeds: [number, number][] = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]
  const match = (i: number) =>
    Math.abs(d[i] - br) <= tol && Math.abs(d[i + 1] - bg) <= tol && Math.abs(d[i + 2] - bb) <= tol
  for (const [sx, sy] of seeds) {
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
  // 边缘羽化 1px：与被抠除区相邻的保留像素降低透明度
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

function switchTab(t: 'key' | 'brush') {
  tab.value = t
  if (mounted) mounted.style.cursor = t === 'brush' ? 'crosshair' : 'default'
}

async function produce() {
  if (!work.value) throw new Error('请先载入图片')
  return canvasToBlob(work.value, 'image/png')
}
</script>

<template>
  <div>
    <div class="notice notice-info mt-1">
      <Info :size="16" style="flex: none; margin-top: 2px" />
      <span>
        端侧模型版（AI 分割）需下载约 40MB 模型文件；本实现提供<strong>即时可用</strong>的
        色键 flood-fill 抠图（适合背景干净的证件照 / 商品图）与画笔擦除。
      </span>
    </div>

    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="建议主体与背景颜色差异明显"
      @files="onFiles"
    />
    <div v-else>
      <div class="chips mt-2">
        <button class="chip" :class="{ active: tab === 'key' }" @click="switchTab('key')">色键抠图</button>
        <button class="chip" :class="{ active: tab === 'brush' }" @click="switchTab('brush')">画笔擦除</button>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length" @click="undo"><Undo2 :size="14" /> 撤销</button>
        <button class="btn btn-ghost btn-sm" @click="resetAll">换一张</button>
      </div>

      <div v-if="tab === 'key'" class="row row-wrap mt-2" style="gap: 18px">
        <div style="min-width: 240px">
          <span class="field-label">背景容差：{{ tolerance }}</span>
          <input v-model.number="tolerance" type="range" min="4" max="100" step="2" />
        </div>
        <button class="btn btn-primary" @click="floodFill"><Download :size="15" /> 开始抠图</button>
        <span class="muted small">从四角取平均背景色向外扩散；边缘自动 1px 羽化</span>
      </div>
      <div v-else class="row row-wrap mt-2" style="gap: 18px">
        <div style="min-width: 240px">
          <span class="field-label">画笔大小：{{ brush }} px</span>
          <input v-model.number="brush" type="range" min="6" max="120" step="2" />
        </div>
        <span class="muted small">在图上按住拖动即可擦除（做出透明），配合撤销键修边</span>
      </div>

      <div ref="stage" class="stage mt-2" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointerleave="onPointerUp"></div>

      <div class="row mt-2">
        <DownloadButton :produce="produce" :default-name="(file ? baseName(file.name) : 'image') + '-cutout.png'" button-text="下载透明 PNG" />
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
}
</style>
