<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'

/** 1:1 大图查看层：拖拽平移，Esc 关闭 */
const props = defineProps<{ src: string; title?: string }>()
const emit = defineEmits<{ close: [] }>()

const viewport = ref<HTMLDivElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const dragging = ref(false)
let sx = 0
let sy = 0
let sl = 0
let st = 0

const onDown = (e: PointerEvent) => {
  const vp = viewport.value
  if (!vp) return
  dragging.value = true
  sx = e.clientX
  sy = e.clientY
  sl = vp.scrollLeft
  st = vp.scrollTop
  vp.setPointerCapture(e.pointerId)
}
const onMove = (e: PointerEvent) => {
  const vp = viewport.value
  if (!dragging.value || !vp) return
  vp.scrollLeft = sl - (e.clientX - sx)
  vp.scrollTop = st - (e.clientY - sy)
}
const onUp = (e: PointerEvent) => {
  dragging.value = false
  viewport.value?.releasePointerCapture(e.pointerId)
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}
watch(
  () => props.src,
  (v) => {
    if (v) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="zo-overlay" @click.self="emit('close')">
      <div class="zo-head">
        <span class="zo-title">{{ title ?? '1:1 大图查看' }}</span>
        <span class="zo-hint">拖拽平移 · Esc 或点击空白关闭</span>
        <button class="zo-close" title="关闭" aria-label="关闭" @click="emit('close')"><X :size="16" /></button>
      </div>
      <div ref="viewport" class="zo-viewport" :class="{ grabbing: dragging }" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
        <img ref="imgEl" :src="src" class="zo-img" alt="1:1 查看大图" draggable="false" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.zo-overlay {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(5px);
  display: grid;
  grid-template-rows: auto 1fr;
  padding: 18px;
  gap: 10px;
}
.zo-head {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-2);
}
.zo-title { font-size: 14px; font-weight: 700; }
.zo-hint { font-size: 12px; color: var(--text-3); }
.zo-close {
  margin-left: auto;
  border: 1px solid var(--border);
  background: none;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  color: var(--text-2);
  cursor: pointer;
}
.zo-close:hover { border-color: var(--err); color: var(--err); }
.zo-viewport {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: repeating-conic-gradient(color-mix(in srgb, var(--text-3) 8%, transparent) 0% 25%, transparent 0% 50%) 50% / 22px 22px;
  cursor: grab;
}
.zo-viewport.grabbing { cursor: grabbing; }
.zo-img {
  max-width: none;
  display: block;
  user-select: none;
}
</style>
