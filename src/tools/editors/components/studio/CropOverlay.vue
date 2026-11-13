<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * 自由裁剪选区覆盖层（rx5）：画布上拖拽出选区 + 四角手柄 + 比例锁定。
 * 坐标为底图像素坐标；仅负责选区交互，应用裁剪由父组件完成。
 */
const props = defineProps<{
  /** 底图尺寸 */
  imgW: number
  imgH: number
  /** 显示画布实际渲染尺寸（缩放后） */
  viewW: number
  viewH: number
  /** 比例锁定：'free' 或 '1' / '4/3' / '3/2' / '16/9' */
  ratio: string
}>()

const emit = defineEmits<{ change: [sel: { x0: number; y0: number; x1: number; y1: number }] }>()

const overlay = ref<HTMLCanvasElement | null>(null)
const sel = ref({ x0: 0, y0: 0, x1: 100, y1: 100 })

const ratioOf = (): number => {
  if (props.ratio === 'free') return 0
  if (props.ratio === '1') return 1
  const [w, h] = props.ratio.split('/').map(Number)
  return w > 0 && h > 0 ? w / h : 0
}

const clampV = (v: number, max: number) => Math.max(0, Math.min(max, v))

/** 比例约束：保持 (x0,y0) 锚点，按高度定宽度（超界时反向按宽度定高度） */
const constrain = (s: { x0: number; y0: number; x1: number; y1: number }) => {
  const r = ratioOf()
  if (!r) return s
  const dirX = s.x1 >= s.x0 ? 1 : -1
  const dirY = s.y1 >= s.y0 ? 1 : -1
  let hgt = Math.abs(s.y1 - s.y0)
  let x1 = s.x0 + dirX * hgt * r
  if (x1 < 0 || x1 > props.imgW) {
    const w = Math.min(Math.abs(x1 - s.x0), dirX > 0 ? props.imgW - s.x0 : s.x0)
    x1 = s.x0 + dirX * w
    hgt = w / r
  }
  const y1 = clampV(s.y0 + dirY * hgt, props.imgH)
  return { x0: s.x0, y0: s.y0, x1, y1 }
}

const draw = () => {
  const c = overlay.value
  if (!c || !props.viewW) return
  c.width = props.viewW
  c.height = props.viewH
  const ctx = c.getContext('2d')!
  const k = props.viewW / props.imgW
  const { x0, y0, x1, y1 } = sel.value
  const sx = Math.min(x0, x1) * k
  const sy = Math.min(y0, y1) * k
  const sw = Math.abs(x1 - x0) * k
  const sh = Math.abs(y1 - y0) * k
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, c.width, sy)
  ctx.fillRect(0, sy + sh, c.width, c.height - sy - sh)
  ctx.fillRect(0, sy, sx, sh)
  ctx.fillRect(sx + sw, sy, c.width - sx - sw, sh)
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 1.5
  ctx.strokeRect(sx, sy, sw, sh)
  ctx.fillStyle = '#22d3ee'
  for (const [hx, hy] of [[sx, sy], [sx + sw, sy], [sx, sy + sh], [sx + sw, sy + sh]]) {
    ctx.fillRect(hx - 5, hy - 5, 10, 10)
  }
  ctx.font = '12px sans-serif'
  const tag = `${Math.round(Math.abs(x1 - x0))} × ${Math.round(Math.abs(y1 - y0))}`
  const tw = ctx.measureText(tag).width + 10
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(sx, Math.max(0, sy - 20), tw, 17)
  ctx.fillStyle = '#fff'
  ctx.fillText(tag, sx + 5, Math.max(12, sy - 7))
}

const sync = () => {
  draw()
  emit('change', {
    x0: Math.min(sel.value.x0, sel.value.x1),
    y0: Math.min(sel.value.y0, sel.value.y1),
    x1: Math.max(sel.value.x0, sel.value.x1),
    y1: Math.max(sel.value.y0, sel.value.y1),
  })
}

watch(
  () => [props.imgW, props.imgH, props.viewW, props.viewH],
  () => {
    sel.value = { x0: 0, y0: 0, x1: props.imgW, y1: props.imgH }
    sync()
  },
  { immediate: true },
)

type Mode = 'new' | 'move' | 'nw' | 'ne' | 'sw' | 'se'
let mode: Mode | null = null
let grabOff: { dx: number; dy: number } | null = null
let startSel: { x0: number; y0: number; x1: number; y1: number } | null = null

const hitHandle = (px: number, py: number) => {
  const k = props.viewW / props.imgW
  const { x0, y0, x1, y1 } = sel.value
  const pts: [number, number, Mode][] = [
    [x0, y0, 'nw'],
    [x1, y0, 'ne'],
    [x0, y1, 'sw'],
    [x1, y1, 'se'],
  ]
  for (const [hx, hy, m] of pts) {
    if (Math.abs(hx * k - px) <= 9 && Math.abs(hy * k - py) <= 9) return m
  }
  return null
}

const onDown = (e: PointerEvent) => {
  const c = overlay.value
  if (!c) return
  const r = c.getBoundingClientRect()
  const px = e.clientX - r.left
  const py = e.clientY - r.top
  const k = props.viewW / props.imgW
  const ix = px * k
  const iy = py * k
  mode = hitHandle(px, py)
  if (!mode) {
    const { x0, y0, x1, y1 } = sel.value
    const inSel = ix >= Math.min(x0, x1) && ix <= Math.max(x0, x1) && iy >= Math.min(y0, y1) && iy <= Math.max(y0, y1)
    if (inSel) {
      mode = 'move'
      startSel = { ...sel.value }
      grabOff = { dx: ix - Math.min(x0, x1), dy: iy - Math.min(y0, y1) }
    } else {
      mode = 'new'
      sel.value = { x0: ix, y0: iy, x1: ix, y1: iy }
      grabOff = null
    }
  }
  c.setPointerCapture(e.pointerId)
}

const onMove = (e: PointerEvent) => {
  if (!mode) return
  const c = overlay.value
  if (!c) return
  const r = c.getBoundingClientRect()
  const k = props.viewW / props.imgW
  const ix = clampV((e.clientX - r.left) * k, props.imgW)
  const iy = clampV((e.clientY - r.top) * k, props.imgH)
  const s = startSel ? { ...startSel } : { ...sel.value }
  if (mode === 'new' || (mode !== 'move' && mode !== null)) {
    // 手柄/新建：锚点为对角
    if (mode === 'new') sel.value = constrain({ x0: sel.value.x0, y0: sel.value.y0, x1: ix, y1: iy })
    else if (mode === 'nw') sel.value = constrain({ x0: ix, y0: iy, x1: s.x1, y1: s.y1 })
    else if (mode === 'ne') sel.value = constrain({ x0: s.x0, y0: iy, x1: ix, y1: s.y1 })
    else if (mode === 'sw') sel.value = constrain({ x0: ix, y0: s.y0, x1: s.x1, y1: iy })
    else if (mode === 'se') sel.value = constrain({ x0: s.x0, y0: s.y0, x1: ix, y1: iy })
    sync()
  } else if (mode === 'move' && grabOff && startSel) {
    const w = Math.abs(startSel.x1 - startSel.x0)
    const hgt = Math.abs(startSel.y1 - startSel.y0)
    const nx = clampV(ix - grabOff.dx, props.imgW - w)
    const ny = clampV(iy - grabOff.dy, props.imgH - hgt)
    sel.value = { x0: nx, y0: ny, x1: nx + w, y1: ny + hgt }
    sync()
  }
}

const onUp = (e: PointerEvent) => {
  mode = null
  grabOff = null
  startSel = null
  overlay.value?.releasePointerCapture(e.pointerId)
}

onBeforeUnmount(() => (mode = null))
</script>

<template>
  <canvas ref="overlay" class="crop-overlay" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"></canvas>
</template>

<style scoped>
.crop-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  touch-action: none;
}
</style>
