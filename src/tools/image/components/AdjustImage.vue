<script setup lang="ts">
/** 亮度对比度调节（兼图片黑白化 / 颜色反相）：四组滑杆实时调节，所见即所得 */
import { ref, shallowRef, watch } from 'vue'
import { Undo2 } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, type ImageOp } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const brightness = ref(0)
const contrast = ref(0)
const saturate = ref(0)
const gray = ref(0)
const invert = ref(0)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

function render() {
  if (!src.value) return
  const ops: ImageOp[] = []
  if (brightness.value !== 0) ops.push({ op: 'brightness', value: brightness.value })
  if (contrast.value !== 0) ops.push({ op: 'contrast', value: contrast.value })
  if (saturate.value !== 0) ops.push({ op: 'saturate', value: saturate.value })
  if (gray.value > 0) ops.push({ op: 'grayscale', intensity: gray.value / 100 })
  if (invert.value > 0) ops.push({ op: 'invert', intensity: invert.value / 100 })
  base.value?.setOutput(ops.length ? applyOps(src.value, ops) : null)
}

function resetAll() {
  brightness.value = 0
  contrast.value = 0
  saturate.value = 0
  gray.value = 0
  invert.value = 0
}

let timer = 0
watch([brightness, contrast, saturate, gray, invert], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" @loaded="onLoaded">
    <div class="sliders mt-2">
      <label><span class="field-label">亮度 {{ brightness }}</span><input v-model.number="brightness" type="range" min="-100" max="100" /></label>
      <label><span class="field-label">对比度 {{ contrast }}</span><input v-model.number="contrast" type="range" min="-100" max="100" /></label>
      <label><span class="field-label">饱和度 {{ saturate }}</span><input v-model.number="saturate" type="range" min="-100" max="100" /></label>
      <label><span class="field-label">黑白强度 {{ gray }}%</span><input v-model.number="gray" type="range" min="0" max="100" /></label>
      <label><span class="field-label">反相强度 {{ invert }}%</span><input v-model.number="invert" type="range" min="0" max="100" /></label>
    </div>
    <div class="row mt-1">
      <button class="btn btn-ghost btn-sm" @click="resetAll"><Undo2 :size="14" /> 重置全部滑杆</button>
      <span class="muted small">黑白 / 反相拖到 0 即保持原色</span>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.sliders {
  display: grid;
  gap: 10px;
  max-width: 480px;
}
</style>
