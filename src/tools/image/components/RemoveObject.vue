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
const brush = ref(24)
const filling = ref(false)
const history = shallowRef<{ img: ImageData; mask: ImageData }[]>([])

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
  if (!maskEl.value) return
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

/** 由外向内逐圈用非蒙版邻域均值填补（onion peeling） */
function fill() {
  const w = work.value
  const m = maskEl.value
  if (!w || !m) return
  filling.value = true
  setTimeout(() => {
    try {
      const W = w.width
      const H = w.height
      const img = w.getContext('2d')!.getImageData(0, 0, W, H)
      const d = img.data
      const mk = m.getContext('2d')!.getImageData(0, 0, W, H).data
      const masked = new Uint8Array(W * H)
      let remaining = 0
      for (let i = 0; i < W * H; i++) {
        if (mk[i * 4 + 3] > 40) {
          masked[i] = 1
          remaining++
        }
      }
      if (!remaining) {
        toast.warn('请先用画笔涂抹要抹除的区域')
        return
      }
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
      // 蒙版像素索引列表（只遍历蒙版区，不扫全图）
      let list: number[] = []
      for (let i = 0; i < W * H; i++) if (masked[i]) list.push(i)
      let guard = 0
      while (remaining > 0 && guard++ < 600) {
        const boundary = list.filter((i) => NB.some((off) => neighborOf(i, off) >= 0 && !masked[neighborOf(i, off)]))
        if (!boundary.length) break
        // 先按当前状态计算全部新颜色，再统一写入（严格的逐圈生长）
        const fills = boundary.map((i) => {
          let r = 0, g = 0, b = 0, n = 0
          for (const off of NB) {
            const j = neighborOf(i, off)
            if (j < 0 || masked[j]) continue
            r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++
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
      }
      w.getContext('2d')!.putImageData(img, 0, 0)
      clearMask()
      toast.ok('填补完成，不满意可撤销后调整笔刷再试')
    } finally {
      filling.value = false
    }
  }, 30)
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
      <div class="row row-wrap mt-1" style="gap: 14px">
        <div style="min-width: 220px">
          <span class="field-label">笔刷大小：{{ brush }} px</span>
          <input v-model.number="brush" type="range" min="8" max="80" step="2" />
        </div>
        <button class="btn btn-primary" :disabled="filling" @click="fill">
          <Brush :size="15" /> {{ filling ? '正在填补…' : '填补蒙版区域' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length" @click="undo"><Undo2 :size="14" /> 撤销</button>
        <button class="btn btn-ghost btn-sm" @click="clearMask">清除蒙版</button>
        <button class="btn btn-ghost btn-sm" @click="resetAll">换一张</button>
      </div>

      <div ref="stage" class="stage mt-2">
        <canvas ref="maskEl" class="mask-cv" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointerleave="onUp"></canvas>
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
  cursor: crosshair;
}
</style>
