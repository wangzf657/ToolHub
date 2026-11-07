<script setup lang="ts">
/** 图片叠加：底图 + 叠加图（Logo/印章），缩放、透明度、九宫位置可调 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { overlay } from '@/lib/imageEngine'
import FileDrop from '@/components/common/FileDrop.vue'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const top = shallowRef<HTMLCanvasElement | null>(null)
const scale = ref(25) // %
const opacity = ref(100) // %
const position = ref('bottom-right')

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

async function onTopFiles(files: File[]) {
  if (!files.length) {
    top.value = null
    render()
    return
  }
  const { decodeToCanvas } = await import('@/lib/imageEngine')
  try {
    top.value = await decodeToCanvas(files[0])
    render()
  } catch {
    /* 解码失败保持原状 */
  }
}

function render() {
  if (!src.value) return
  if (!top.value) {
    base.value?.setOutput(null)
    return
  }
  const c = src.value
  const w = top.value.width * (scale.value / 100)
  const h = top.value.height * (scale.value / 100)
  const pad = Math.round(Math.min(c.width, c.height) * 0.04)
  const col = position.value.includes('left') ? 0 : position.value.includes('right') ? 2 : 1
  const row = position.value.includes('top') ? 0 : position.value.includes('bottom') ? 2 : 1
  const xs = [pad, (c.width - w) / 2, c.width - w - pad]
  const ys = [pad, (c.height - h) / 2, c.height - h - pad]
  base.value?.setOutput(
    overlay(src.value, top.value, {
      x: xs[col],
      y: ys[row],
      scale: scale.value / 100,
      opacity: opacity.value / 100,
    }),
  )
}

let timer = 0
watch([top, scale, opacity, position], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-overlay" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 24px; align-items: flex-start">
      <div style="min-width: 260px">
        <span class="field-label">叠加图（Logo / 印章 / 另一张照片）</span>
        <FileDrop
          accept="image/*"
          :multiple="false"
          label="拖放叠加图到此处"
          hint="建议使用透明背景 PNG"
          @files="onTopFiles"
        />
      </div>
      <div class="grow" style="min-width: 240px">
        <span class="field-label">缩放：{{ scale }}%</span>
        <input v-model.number="scale" type="range" min="5" max="100" step="1" />
        <span class="field-label mt-1">不透明度：{{ opacity }}%</span>
        <input v-model.number="opacity" type="range" min="10" max="100" step="5" />
        <div class="mt-1">
          <span class="field-label">位置</span>
          <div class="pos-grid">
            <button
              v-for="p in POSITIONS"
              :key="p"
              class="pos-cell"
              :class="{ active: position === p }"
              :aria-label="'叠加位置：' + p"
              @click="position = p"
            ></button>
          </div>
        </div>
      </div>
    </div>
  </ImageToolBase>
</template>

<style scoped>
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
