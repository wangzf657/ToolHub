<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Eraser, PenTool } from 'lucide-vue-next'

/** 手绘签名板：鼠标/触摸绘制，导出透明 PNG */
const canvas = ref<HTMLCanvasElement | null>(null)
const color = ref('#1a2233')
const width = ref(3)
let drawing = false
let ctx: CanvasRenderingContext2D | null = null
let hasInk = false

const W = 460
const H = 180

onMounted(() => {
  const c = canvas.value!
  c.width = W
  c.height = H
  ctx = c.getContext('2d')!
  clear()
})

const clear = () => {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  hasInk = false
}

const pos = (e: PointerEvent): [number, number] => {
  const r = canvas.value!.getBoundingClientRect()
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
}

const start = (e: PointerEvent) => {
  if (!ctx) return
  drawing = true
  hasInk = true
  const [x, y] = pos(e)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

const move = (e: PointerEvent) => {
  if (!drawing || !ctx) return
  const [x, y] = pos(e)
  ctx.strokeStyle = color.value
  ctx.lineWidth = width.value
  ctx.lineTo(x, y)
  ctx.stroke()
}

const end = () => {
  drawing = false
}

/** 是否有笔迹 */
const hasContent = () => hasInk

/** 导出透明 PNG dataURL（裁掉空白边缘） */
const exportPng = (): string | null => {
  if (!hasInk || !ctx) return null
  // 扫描非空边界
  const img = ctx.getImageData(0, 0, W, H)
  let minX = W, minY = H, maxX = 0, maxY = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (img.data[(y * W + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null
  const pad = 6
  const w = Math.min(W, maxX - minX + pad * 2)
  const h = Math.min(H, maxY - minY + pad * 2)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(canvas.value!, minX - pad, minY - pad, w, h, 0, 0, w, h)
  return out.toDataURL('image/png')
}

defineExpose({ exportPng, hasContent, clear })
</script>

<template>
  <div class="sig">
    <div class="row row-wrap">
      <label class="check">
        笔色
        <input v-model="color" type="color" />
      </label>
      <label class="check">
        粗细
        <input v-model.number="width" type="range" min="1" max="8" style="width: 90px" />
      </label>
      <button class="btn btn-ghost btn-sm" @click="clear"><Eraser :size="14" /> 清除</button>
    </div>
    <div class="pad-wrap">
      <canvas
        ref="canvas"
        class="pad"
        @pointerdown.prevent="start"
        @pointermove="move"
        @pointerup="end"
        @pointerleave="end"
      ></canvas>
      <PenTool v-if="!hasContent" :size="22" class="pad-hint" />
    </div>
  </div>
</template>

<style scoped>
.pad-wrap {
  position: relative;
  margin-top: 8px;
  border: 1.5px dashed var(--border-strong);
  border-radius: 12px;
  background:
    linear-gradient(90deg, transparent calc(100% - 1px), var(--border) 0) no-repeat 50% 100% / calc(100% - 40px) 1px;
  background-color: color-mix(in srgb, var(--panel-solid) 60%, transparent);
}
.pad {
  display: block;
  width: 100%;
  height: 180px;
  cursor: crosshair;
  touch-action: none;
}
.pad-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-3);
  opacity: 0.5;
  pointer-events: none;
}
</style>
