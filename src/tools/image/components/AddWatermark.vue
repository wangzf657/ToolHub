<script setup lang="ts">
/** 图片加水印 / 添加文字：文字、九宫位置、字号、颜色、透明度、斜排 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { drawWatermark } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const text = ref('')
const position = ref('bottom-right')
const size = ref(0) // 0 = 自动（图宽 / 24）
const color = ref('#ffffff')
const opacity = ref(60)
const rotate = ref(false)

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  size.value = 0
  render()
}

function render() {
  if (!src.value) return
  if (!text.value.trim()) {
    base.value?.setOutput(null)
    return
  }
  base.value?.setOutput(
    drawWatermark(src.value, text.value, {
      position: position.value,
      size: size.value > 0 ? size.value : undefined,
      color: color.value,
      opacity: opacity.value / 100,
      rotate: rotate.value,
    }),
  )
}

let timer = 0
watch([text, position, size, color, opacity, rotate], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-watermark" @loaded="onLoaded">
    <div class="mt-2" style="max-width: 420px">
      <span class="field-label">要叠加的文字</span>
      <input v-model="text" type="text" class="input" placeholder="输入要叠加的文字，如 @我的名字" />
    </div>
    <div class="row row-wrap mt-2" style="gap: 24px; align-items: flex-start">
      <div>
        <span class="field-label">位置</span>
        <div class="pos-grid">
          <button
            v-for="p in POSITIONS"
            :key="p"
            class="pos-cell"
            :class="{ active: position === p }"
            @click="position = p"
          ></button>
        </div>
      </div>
      <div class="grow" style="min-width: 220px">
        <span class="field-label">字号：{{ size > 0 ? size + ' px' : '自动' }}</span>
        <input v-model.number="size" type="range" min="0" max="200" step="2" />
        <span class="field-label mt-1">不透明度：{{ opacity }}%</span>
        <input v-model.number="opacity" type="range" min="10" max="100" step="5" />
        <div class="row mt-1" style="gap: 16px">
          <label class="opt"><span class="field-label">颜色</span><input v-model="color" type="color" /></label>
          <label class="check" style="margin-top: 18px"><input v-model="rotate" type="checkbox" /> 斜排（-30° 平铺样式）</label>
        </div>
      </div>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.pos-grid {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  grid-template-rows: repeat(3, 34px);
  gap: 4px;
}
.pos-cell {
  border: 1px solid var(--border-strong);
  background: none;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.pos-cell:hover {
  border-color: var(--accent);
}
.pos-cell.active {
  background: var(--accent);
  border-color: var(--accent);
}
</style>
