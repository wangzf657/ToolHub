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
  // 固定内部分辨率，CSS 负责响应式缩放
  c.width = 640
  c.height = 220
  ctx = c.getContext('2d')!
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  clear()
}

const clear = () => {
  if (!ctx || !canvasRef.value) return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  touched = false
}

const pos = (e: PointerEvent) => {
  const c = canvasRef.value!
  const r = c.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
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

onMounted(setup)

defineExpose({
  /** 是否已签画 */
  isEmpty: () => !touched,
  /** 导出透明 PNG dataURL */
  toDataURL: () => canvasRef.value?.toDataURL('image/png') ?? '',
  clear,
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
