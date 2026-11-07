<script setup lang="ts">
/** 图片加边框：宽度滑杆 + 颜色选择 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const width = ref(12)
const color = ref('#ffffff')
const maxW = ref(200)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  maxW.value = Math.max(10, Math.floor(Math.min(c.width, c.height) / 4))
  width.value = Math.min(12, maxW.value)
  render()
}

function render() {
  if (!src.value) return
  const ops = []
  if (width.value > 0) ops.push({ op: 'border' as const, width: width.value, color: color.value })
  base.value?.setOutput(ops.length ? applyOps(src.value, ops) : null)
}

let timer = 0
watch([width, color], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-bordered" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 24px">
      <div style="max-width: 380px; min-width: 240px">
        <span class="field-label">边框宽度：{{ width }} px</span>
        <input v-model.number="width" type="range" min="0" :max="maxW" step="1" />
      </div>
      <label class="opt">
        <span class="field-label">边框颜色</span>
        <input v-model="color" type="color" />
      </label>
    </div>
    <p class="muted small mt-1">宽度为 0 时保持原图；四边对称加框。</p>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
</style>
