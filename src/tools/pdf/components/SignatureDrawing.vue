<script setup lang="ts">
/** 手写签名板：Pointer Events + 中点贝塞尔平滑，导出透明背景 PNG（可作 PDF 签名图章） */
import { onMounted, ref } from 'vue'
import { Download, Eraser, RotateCcw, Copy } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const stage = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const color = ref('#111111')
const width = ref(4)
const drawing = ref(false)
const strokes = ref<{ points: { x: number; y: number; p: number }[]; color: string; width: number }[]>([])
let current: { points: { x: number; y: number; p: number }[]; color: string; width: number } | null = null
let ctx: CanvasRenderingContext2D | null = null

onMounted(() => {
  const c = canvas.value!
  // 2 倍像素密度防模糊
  const W = 720
  const H = 300
  c.width = W * 2
  c.height = H * 2
  c.style.width = '100%'
  c.style.aspectRatio = `${W} / ${H}`
  ctx = c.getContext('2d')!
  ctx.scale(2, 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.fillStyle = 'rgba(0,0,0,0.035)'
  ctx.fillRect(0, 150, W, 1) // 底部基线
  ctx.strokeStyle = 'rgba(0,0,0,0.035)'
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
})

/** 触屏用 e.pressure 调笔宽，鼠标固定 0.5 */
const pos = (e: PointerEvent) => {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
  const scale = 720 / rect.width
  return {
    x: (e.clientX - rect.left) * scale,
    y: (e.clientY - rect.top) * scale,
    p: e.pressure > 0 && e.pointerType !== 'mouse' ? e.pressure : 0.5,
  }
}

const start = (e: PointerEvent) => {
  e.preventDefault()
  ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
  current = { points: [pos(e)], color: color.value, width: width.value }
  strokes.value.push(current)
  drawing.value = true
}
const move = (e: PointerEvent) => {
  if (!drawing.value || !current) return
  current.points.push(pos(e))
  redraw()
}
const end = () => {
  drawing.value = false
  current = null
}

/** 全量重绘：中点二次贝塞尔平滑（相邻点中点为锚） */
const redraw = () => {
  if (!ctx) return
  ctx.clearRect(0, 0, 720, 300)
  ctx.fillStyle = 'rgba(0,0,0,0.035)'
  ctx.fillRect(0, 150, 720, 1)
  ctx.strokeStyle = 'rgba(0,0,0,0.035)'
  ctx.strokeRect(0.5, 0.5, 719, 299)
  for (const s of strokes.value) {
    ctx.strokeStyle = s.color
    const pts = s.points
    ctx.lineWidth = s.width * (0.75 + s.points[0].p)
    ctx.beginPath()
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, (s.width * (0.75 + s.points[0].p)) / 2, 0, Math.PI * 2)
      ctx.fillStyle = s.color
      ctx.fill()
      continue
    }
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2
      const my = (pts[i].y + pts[i + 1].y) / 2
      const lw = s.width * (0.6 + pts[i].p * 0.8)
      if (Math.abs(lw - ctx.lineWidth) > 0.2) {
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(pts[i].x, pts[i].y)
        ctx.lineWidth = lw
      }
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
    }
    ctx.stroke()
  }
}

const undo = () => {
  strokes.value.pop()
  redraw()
}
const clearAll = () => {
  strokes.value = []
  redraw()
}

const produce = async (): Promise<Blob> => {
  if (!strokes.value.length) throw new Error('请先手写签名')
  return new Promise((resolve) => canvas.value!.toBlob((b) => resolve(b!), 'image/png'))
}

const download = async () => {
  try {
    saveBlob(await produce(), '手写签名.png')
    toast.ok('签名 PNG 已下载（透明背景，可直接做 PDF 图章）')
  } catch (e) {
    toast.err((e as Error).message)
  }
}

const copyPng = async () => {
  try {
    const blob = await produce()
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.ok('已复制到剪贴板')
  } catch (e) {
    toast.err((e as Error).message || '复制失败（浏览器可能不支持复制图片）')
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 14px; align-items: center">
      <label class="opt">
        <span class="field-label">笔色</span>
        <select v-model="color" class="select" style="width: 110px">
          <option value="#111111">黑色</option>
          <option value="#14329c">蓝色</option>
          <option value="#c0341d">红色</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">笔宽</span>
        <input v-model.number="width" type="range" min="2" max="10" class="input" style="width: 110px" />
        <span class="muted small">{{ width }}px</span>
      </label>
      <button class="btn btn-ghost btn-sm" @click="undo"><RotateCcw :size="14" /> 撤销</button>
      <button class="btn btn-ghost btn-sm" @click="clearAll"><Eraser :size="14" /> 清空</button>
    </div>

    <div ref="stage" class="sig-stage">
      <canvas
        ref="canvas"
        @pointerdown="start"
        @pointermove="move"
        @pointerup="end"
        @pointercancel="end"
        @pointerleave="end"
        class="sig-canvas"
      ></canvas>
      <span v-if="!strokes.length" class="sig-tip">在此手写签名（触屏按压可变笔宽）</span>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!strokes.length" @click="download"><Download :size="15" /> 下载透明 PNG</button>
      <button class="btn btn-ghost" :disabled="!strokes.length" @click="copyPng"><Copy :size="15" /> 复制图片</button>
      <span class="muted small">推荐 720×300 比例，签名后可到「给 PDF 添加图片」盖章。</span>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.sig-stage {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  touch-action: none;
  background: color-mix(in srgb, var(--panel-solid) 80%, transparent);
}
.sig-canvas {
  display: block;
  cursor: crosshair;
}
.sig-tip {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-3);
  font-size: 14px;
  pointer-events: none;
}
</style>
