<script setup lang="ts">
/**
 * 处理前后对比滑块（UX1.0 图片家族共享）：
 * 底层放结果画布、上层放原图画布并以 clip-path 裁到左侧 pct%，拖动分割线逐区域比对。
 * Pointer 事件 + setPointerCapture + touch-action:none，移动端拖动不滚动页面；支持方向键微调。
 * 传入的画布会被复制到内部图层，不移动父组件的 DOM 节点。
 */
import { onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    before: HTMLCanvasElement | null
    after: HTMLCanvasElement | null
    beforeLabel?: string
    afterLabel?: string
  }>(),
  { beforeLabel: '原图', afterLabel: '结果' },
)

const pct = ref(50)
const wrap = ref<HTMLElement | null>(null)
const beforeCv = ref<HTMLCanvasElement | null>(null)
const afterCv = ref<HTMLCanvasElement | null>(null)
let dragging = false

function draw(dst: HTMLCanvasElement | null, src: HTMLCanvasElement | null) {
  if (!dst || !src) return
  dst.width = src.width
  dst.height = src.height
  const ctx = dst.getContext('2d')!
  ctx.drawImage(src, 0, 0)
}

watch(
  () => [props.before, props.after] as const,
  ([b, a]) => {
    draw(beforeCv.value, b)
    draw(afterCv.value, a)
  },
  { flush: 'post' },
)

function update(e: PointerEvent) {
  if (!wrap.value) return
  const r = wrap.value.getBoundingClientRect()
  const p = ((e.clientX - r.left) / Math.max(1, r.width)) * 100
  pct.value = Math.min(100, Math.max(0, p))
}
function onDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  update(e)
}
function onMove(e: PointerEvent) {
  if (dragging) update(e)
}
function onUp(e: PointerEvent) {
  dragging = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch { /* 忽略 */ }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') pct.value = Math.max(0, pct.value - 5)
  if (e.key === 'ArrowRight') pct.value = Math.min(100, pct.value + 5)
}

onBeforeUnmount(() => {
  dragging = false
})
</script>

<template>
  <div
    v-if="props.before && props.after"
    ref="wrap"
    class="cmp"
    :style="{ aspectRatio: `${props.before.width} / ${props.before.height}` }"
    @pointerdown.prevent="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @keydown="onKey"
    tabindex="0"
    role="slider"
    aria-label="拖动对比原图与结果"
    :aria-valuenow="Math.round(pct)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <canvas ref="afterCv" class="layer"></canvas>
    <canvas ref="beforeCv" class="layer" :style="{ clipPath: `inset(0 ${100 - pct}% 0 0)` }"></canvas>
    <span class="divider" :style="{ left: pct + '%' }"></span>
    <span class="handle" :style="{ left: pct + '%' }"><span class="knob"></span></span>
    <span class="tag tag-l">{{ props.beforeLabel }}</span>
    <span class="tag tag-r">{{ props.afterLabel }}</span>
  </div>
</template>

<style scoped>
.cmp {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--border);
  touch-action: none;
  user-select: none;
  cursor: ew-resize;
  max-height: min(60vh, 640px);
  background:
    repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.25);
  display: grid;
  place-items: center;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.knob {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 8px solid #333;
  transform: rotate(90deg);
  filter: drop-shadow(1px 0 0 #fff);
}
.tag {
  position: absolute;
  top: 8px;
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  pointer-events: none;
}
.tag-l {
  left: 8px;
}
.tag-r {
  right: 8px;
}
</style>
