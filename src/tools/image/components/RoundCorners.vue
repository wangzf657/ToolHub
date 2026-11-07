<script setup lang="ts">
/** 圆角图片：半径滑杆（0 到半边长），输出透明 PNG */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const radius = ref(24)
const maxR = ref(300)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  maxR.value = Math.floor(Math.min(c.width, c.height) / 2)
  radius.value = Math.min(24, maxR.value)
  render()
}

function render() {
  if (!src.value) return
  base.value?.setOutput(applyOps(src.value, [{ op: 'round', radius: radius.value }]))
}

let timer = 0
watch(radius, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-rounded" @loaded="onLoaded">
    <div class="mt-2" style="max-width: 420px">
      <span class="field-label">圆角半径：{{ radius }} px（最大 {{ maxR }}）</span>
      <input v-model.number="radius" type="range" min="0" :max="maxR" step="1" />
    </div>
    <p class="muted small mt-1">半径拉到最大即为胶囊形；输出 PNG，四角透明。</p>
  </ImageToolBase>
</template>
