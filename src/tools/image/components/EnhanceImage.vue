<script setup lang="ts">
/** 图片清晰锐化：卷积锐化强度 + 先去噪再锐化的组合开关 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, type ImageOp } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const amount = ref(40)
const denoise = ref(false)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

function render() {
  if (!src.value) return
  const ops: ImageOp[] = []
  if (denoise.value) ops.push({ op: 'blur', radius: 0.6 })
  if (amount.value > 0) ops.push({ op: 'sharpen', amount: amount.value })
  base.value?.setOutput(ops.length ? applyOps(src.value, ops) : null)
}

let timer = 0
watch([amount, denoise], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-sharp" @loaded="onLoaded">
    <div class="sliders mt-2">
      <label><span class="field-label">锐化强度：{{ amount }}</span><input v-model.number="amount" type="range" min="0" max="100" step="5" /></label>
      <label class="check"><input v-model="denoise" type="checkbox" /> 先轻度模糊去噪，再锐化（噪点多的照片建议开启）</label>
    </div>
    <p class="muted small mt-1">强度超过 70 容易出现白色镶边，建议从 40 左右开始尝试。</p>
  </ImageToolBase>
</template>

<style scoped>
.sliders {
  display: grid;
  gap: 10px;
  max-width: 460px;
}
</style>
