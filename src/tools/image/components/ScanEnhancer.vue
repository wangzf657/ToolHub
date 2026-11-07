<script setup lang="ts">
/** 扫描件增强：黑白阈值 / 高对比灰度两种模式 + 亮度补偿 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, type ImageOp } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const mode = ref<'bw' | 'contrast'>('bw')
const threshold = ref(140)
const brightness = ref(0)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

function render() {
  if (!src.value) return
  const ops: ImageOp[] = [{ op: 'grayscale', intensity: 1 }]
  if (brightness.value !== 0) ops.push({ op: 'brightness', value: brightness.value })
  if (mode.value === 'bw') ops.push({ op: 'threshold', level: threshold.value })
  else ops.push({ op: 'contrast', value: 55 })
  base.value?.setOutput(applyOps(src.value, ops))
}

let timer = 0
watch([mode, threshold, brightness], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-scan" @loaded="onLoaded">
    <div class="chips mt-2">
      <button class="chip" :class="{ active: mode === 'bw' }" @click="mode = 'bw'">黑白文档（阈值二值化）</button>
      <button class="chip" :class="{ active: mode === 'contrast' }" @click="mode = 'contrast'">高对比灰度</button>
    </div>
    <div class="sliders mt-2">
      <label v-if="mode === 'bw'"><span class="field-label">二值化阈值：{{ threshold }}（文字越浅越低）</span><input v-model.number="threshold" type="range" min="60" max="220" step="2" /></label>
      <label><span class="field-label">亮度补偿：{{ brightness }}</span><input v-model.number="brightness" type="range" min="-60" max="60" step="2" /></label>
    </div>
    <p class="muted small mt-1">手机翻拍偏暗就调高亮度补偿；阈值过高会让纸张发黑，过低会让文字变虚。</p>
  </ImageToolBase>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sliders {
  display: grid;
  gap: 10px;
  max-width: 460px;
}
</style>
