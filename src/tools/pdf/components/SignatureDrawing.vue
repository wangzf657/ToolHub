<script setup lang="ts">
/** 手写签名板：Pointer Events + 中点贝塞尔平滑；导出按墨迹包围盒裁边（纯透明、无基线边框）；可一键送到 PDF 签名 */
import { computed, onMounted, ref } from 'vue'
import { Download, Eraser, RotateCcw, Copy, FileSignature } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const canvas = ref<HTMLCanvasElement | null>(null)
const color = ref('#111111')
const width = ref(4)
const drawing = ref(false)
const strokes = ref<{ points: { x: number; y: number; p: number }[]; color: string; width: number }[]>([])
let current: { points: { x: number; y: number; p: number }[]; color: string; width: number } | null = null
let ctx: CanvasRenderingContext2D | null = null

/* 移动端（≤560px）画布加高：竖屏可视高度 ≥220px */
const W = 720
const H = computed(() => (typeof window !== 'undefined' && window.innerWidth <= 560 ? 460 : 300))

onMounted(() => {
  const c = canvas.value!
  // 2 倍像素密度防模糊
  c.width = W * 2
  c.height = H.value * 2
  c.style.width = '100%'
  c.style.aspectRatio = `${W} / ${H.value}`
  ctx = c.getContext('2d')!
  ctx.scale(2, 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawGuides()
})

/** 触屏用 e.pressure 调笔宽，鼠标固定 0.5 */
const pos = (e: PointerEvent) => {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
  const scale = W / rect.width
  return {
    x: (e.clientX - rect.left) * scale,
    y: (e.clientY - rect.top) * scale,
    p: e.pressure > 0 && e.pointerType !== 'mouse' ? e.pressure : 0.5,
  }
}

const drawGuides = () => {
  if (!ctx) return
  ctx.fillStyle = 'rgba(0,0,0,0.035)'
  ctx.fillRect(0, H.value / 2, W, 1) // 中部基线
  ctx.strokeStyle = 'rgba(0,0,0,0.035)'
  ctx.strokeRect(0.5, 0.5, W - 1, H.value - 1)
}

const start = (e: PointerEvent) => {
  e.preventDefault()
  ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
  current = { points: [pos(e)], color: color.value, width: width.value }
  strokes.value.push(current)
  drawing.value = true
}

/** 增量绘制：只画最新一段，避免全量重绘卡顿 */
const segFrom = (s: { points: { x: number; y: number; p: number }[]; color: string; width: number }, i: number) => {
  if (!ctx) return
  const pts = s.points
  const a = pts[i - 1]!
  const b = pts[i]!
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.width * (0.6 + b.p * 0.8)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

const move = (e: PointerEvent) => {
  if (!drawing.value || !current) return
  const p = pos(e)
  const idx = current.points.length
  current.points.push(p)
  if (idx >= 1) segFrom(current, idx)
}

const end = () => {
  if (drawing.value) redraw()
  drawing.value = false
  current = null
}

/** 全量重绘：中点二次贝塞尔平滑（相邻点中点为锚）+ 辅助线 */
const redraw = () => {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H.value)
  drawGuides()
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

/** 墨迹包围盒（含笔宽余量），导出 = 包围盒 + 6px 边距 */
const bbox = () => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const s of strokes.value) {
    for (const p of s.points) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
  }
  const pad = width.value * 1.5 + 4
  return {
    x: Math.max(0, x0 - pad),
    y: Math.max(0, y0 - pad),
    w: Math.min(W, x1 + pad) - Math.max(0, x0 - pad),
    h: Math.min(H.value, y1 + pad) - Math.max(0, y0 - pad),
  }
}

/** 离屏重绘：只画墨迹，不含基线/边框（纯透明导出） */
const produce = async (): Promise<Blob> => {
  if (!strokes.value.length) throw new Error('请先手写签名')
  const b = bbox()
  const SS = 2
  const off = document.createElement('canvas')
  off.width = Math.max(1, Math.round(b.w * SS))
  off.height = Math.max(1, Math.round(b.h * SS))
  const c2 = off.getContext('2d')!
  c2.scale(SS, SS)
  c2.translate(-b.x, -b.y)
  c2.lineCap = 'round'
  c2.lineJoin = 'round'
  for (const s of strokes.value) {
    c2.strokeStyle = s.color
    const pts = s.points
    c2.lineWidth = s.width * (0.75 + s.points[0].p)
    c2.beginPath()
    if (pts.length === 1) {
      c2.arc(pts[0].x, pts[0].y, (s.width * (0.75 + s.points[0].p)) / 2, 0, Math.PI * 2)
      c2.fillStyle = s.color
      c2.fill()
      continue
    }
    c2.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2
      const my = (pts[i].y + pts[i + 1].y) / 2
      c2.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
    }
    c2.stroke()
  }
  return new Promise((resolve) => off.toBlob((blob) => resolve(blob!), 'image/png'))
}

const download = async () => {
  try {
    saveBlob(await produce(), '手写签名.png')
    toast.ok('签名 PNG 已下载（按墨迹裁边、纯透明背景）')
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

/** 一键送到 PDF 签名：localStorage 交接 + 跳转（sign-pdf 自动载入） */
const sendToSign = async () => {
  try {
    const blob = await produce()
    const dataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.readAsDataURL(blob)
    })
    localStorage.setItem('toolhub.sig.handoff', dataUrl)
    void router.push('/t/sign-pdf')
    toast.ok('已送到「PDF 签名」，打开后自动载入该签名')
  } catch (e) {
    toast.err((e as Error).message || '生成签名失败')
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

    <div class="sig-stage">
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

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="!strokes.length" @click="download"><Download :size="15" /> 下载透明 PNG</button>
      <button class="btn btn-ghost" :disabled="!strokes.length" @click="copyPng"><Copy :size="15" /> 复制图片</button>
      <button class="btn btn-soft" :disabled="!strokes.length" @click="sendToSign"><FileSignature :size="15" /> 送到 PDF 签名</button>
      <span class="muted small">导出按墨迹包围盒裁边（含 6px 边距）；也可到「给 PDF 添加图片」盖章。</span>
    </div>
  </div>
</template>

<style scoped>
.opt { display: grid; gap: 4px; }
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
.sig-tip { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 14px; pointer-events: none; }
@media (max-width: 560px) {
  .sig-canvas {
    aspect-ratio: 720 / 460;
  }
}
</style>
