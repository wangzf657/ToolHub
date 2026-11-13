<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Eraser } from 'lucide-vue-next'

/** 手写签名板：quadraticCurveTo 平滑笔迹，输出透明 PNG dataURL */
const props = withDefaults(
  defineProps<{
    color?: string
    width?: number
  }>(),
  { color: '#1a2233', width: 3 },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let lastX = 0
let lastY = 0
let midX = 0
let midY = 0
let touched = false

const setup = () => {
  const c = canvasRef.value
  if (!c) return
  // 内部分辨率乘 devicePixelRatio（高清屏笔迹无锯齿），CSS 负责响应式缩放；逻辑坐标固定 640×220
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
  c.width = 640 * dpr
  c.height = 220 * dpr
  ctx = c.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  clear()
}

const clear = () => {
  if (!ctx || !canvasRef.value) return
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
  ctx.clearRect(0, 0, canvasRef.value.width / dpr, canvasRef.value.height / dpr)
  touched = false
}

/** 逻辑坐标（640×220）取点，配合 ctx.scale(dpr) 保持高清 */
const pos = (e: PointerEvent) => {
  const c = canvasRef.value!
  const r = c.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * 640, y: ((e.clientY - r.top) / r.height) * 220 }
}

const down = (e: PointerEvent) => {
  if (!ctx) return
  drawing = true
  canvasRef.value?.setPointerCapture(e.pointerId)
  const p = pos(e)
  lastX = p.x
  lastY = p.y
  midX = p.x
  midY = p.y
}

const move = (e: PointerEvent) => {
  if (!drawing || !ctx) return
  const p = pos(e)
  // 中点二次贝塞尔平滑
  const mx = (lastX + p.x) / 2
  const my = (lastY + p.y) / 2
  ctx.strokeStyle = props.color
  ctx.lineWidth = props.width * 2
  ctx.beginPath()
  ctx.moveTo(midX, midY)
  ctx.quadraticCurveTo(lastX, lastY, mx, my)
  ctx.stroke()
  lastX = p.x
  lastY = p.y
  midX = mx
  midY = my
  touched = true
}

const up = () => (drawing = false)

/** 载入既有签名（手写签名板一键交接 / 记住签名回填）：按宽高比适配绘制 */
const load = (dataUrl: string) => {
  if (!ctx) return
  const img = new Image()
  img.onload = () => {
    if (!ctx || !canvasRef.value) return
    clear()
    const k = Math.min(640 / img.width, 220 / img.height, 1)
    const w = img.width * k
    const h = img.height * k
    ctx.drawImage(img, (640 - w) / 2, (220 - h) / 2, w, h)
    touched = true
  }
  img.src = dataUrl
}

onMounted(setup)

defineExpose({
  /** 是否已签画 */
  isEmpty: () => !touched,
  /** 导出透明 PNG dataURL */
  toDataURL: () => canvasRef.value?.toDataURL('image/png') ?? '',
  clear,
  load,
})
</script>

<template>
  <div>
    <canvas
      ref="canvasRef"
      class="pad"
      @pointerdown.prevent="down"
      @pointermove.prevent="move"
      @pointerup.prevent="up"
      @pointercancel="up"
    ></canvas>
    <div class="row mt-1">
      <button class="btn btn-ghost btn-sm" @click="clear"><Eraser :size="14" /> 重写</button>
      <span class="small muted">用鼠标或手指在框内签写姓名</span>
    </div>
  </div>
</template>

<style scoped>
.pad {
  width: 100%;
  height: 160px;
  border: 1.5px dashed var(--border-strong);
  border-radius: 12px;
  background:
    linear-gradient(transparent 79%, var(--border) 79%, var(--border) 80%, transparent 80%),
    #fff;
  touch-action: none;
  cursor: crosshair;
}
</style>
