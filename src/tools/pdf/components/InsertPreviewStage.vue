<script setup lang="ts">
/** 插入图片的预览舞台子组件：canvas 渲染 + ghost 轮廓叠加 + 拖动微调 + 翻页器 */
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ChevronLeft, ChevronRight, MousePointerClick } from 'lucide-vue-next'
import { renderPageToCanvas } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

export interface GhostPlacement {
  pageIndex: number
  xRatio: number
  yRatio: number
  scalePct: number
  opacity: number
  image: File
}

const props = defineProps<{
  file: File | Blob | null
  pageIdx: number
  pageCount: number
  placements: GhostPlacement[]
}>()
const emit = defineEmits<{ go: [d: number]; pick: [e: PointerEvent]; 'ghost-move': [index: number, x: number, y: number] }>()

const toast = useToast()
const stage = ref<HTMLDivElement | null>(null)
const rendering = ref(false)
let dragIdx = -1

const renderPreview = async () => {
  if (!props.file || !stage.value) return
  rendering.value = true
  try {
    const c = await renderPageToCanvas(props.file, props.pageIdx, 1.2)
    await nextTick()
    const box = stage.value
    if (box) {
      box.querySelectorAll('canvas').forEach((n) => n.remove())
      c.style.width = '100%'
      c.style.height = 'auto'
      c.style.display = 'block'
      c.style.cursor = 'crosshair'
      box.prepend(c)
    }
  } catch (e) {
    toast.err((e as Error).message || '页面渲染失败')
  } finally {
    rendering.value = false
  }
}
watch([() => props.file, () => props.pageIdx], renderPreview, { immediate: true })

/* ghost 缩略图对象 URL 缓存 */
const ghostUrls = new Map<File, string>()
const urlOf = (f: File): string => {
  let u = ghostUrls.get(f)
  if (!u) {
    u = URL.createObjectURL(f)
    ghostUrls.set(f, u)
  }
  return u
}
onBeforeUnmount(() => {
  for (const u of ghostUrls.values()) URL.revokeObjectURL(u)
  ghostUrls.clear()
})

const ghostStyle = (p: GhostPlacement) => ({
  left: `${p.xRatio * 100}%`,
  top: `${p.yRatio * 100}%`,
  width: `${p.scalePct}%`,
  opacity: String(0.45 + 0.55 * p.opacity),
})

const onGhostDown = (i: number, e: PointerEvent) => {
  e.stopPropagation()
  e.preventDefault()
  dragIdx = i
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
const onGhostMove = (e: PointerEvent) => {
  if (dragIdx < 0) return
  e.stopPropagation()
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  emit('ghost-move', dragIdx, x, y)
}
const onGhostUp = () => (dragIdx = -1)

defineExpose({ rendering })
</script>

<template>
  <div>
    <div class="row" style="gap: 8px; margin-bottom: 8px">
      <button class="btn btn-soft btn-sm" :disabled="pageIdx <= 0" @click="emit('go', -1)"><ChevronLeft :size="14" /></button>
      <span class="small muted">第 {{ pageIdx + 1 }} / {{ pageCount }} 页</span>
      <button class="btn btn-soft btn-sm" :disabled="pageIdx >= pageCount - 1" @click="emit('go', 1)"><ChevronRight :size="14" /></button>
      <MousePointerClick :size="14" class="muted" />
      <span class="small muted">点击页面放置（点击点=图片中心），拖动轮廓微调</span>
    </div>
    <div class="stage" @pointerdown="(e) => emit('pick', e)">
      <div ref="stage" class="holder">
        <div
          v-for="(p, i) in placements"
          :key="i"
          v-show="p.pageIndex === pageIdx"
          class="ghost"
          :style="ghostStyle(p)"
          @pointerdown="onGhostDown(i, $event)"
          @pointermove="onGhostMove"
          @pointerup="onGhostUp"
          @pointercancel="onGhostUp"
        >
          <img :src="urlOf(p.image)" alt="" draggable="false" />
          <span class="g-no">{{ i + 1 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  min-height: 200px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
  touch-action: none;
}
.holder {
  position: relative;
}
.ghost {
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: move;
  touch-action: none;
}
.ghost img {
  width: 100%;
  display: block;
  border: 1px dashed var(--accent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  pointer-events: none;
}
.g-no {
  position: absolute;
  left: -8px;
  top: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  display: grid;
  place-items: center;
  pointer-events: none;
}
</style>
