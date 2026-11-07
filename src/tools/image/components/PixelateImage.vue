<script setup lang="ts">
/** 像素化马赛克：块大小 2-64 可调 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const size = ref(8)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

function render() {
  if (!src.value) return
  base.value?.setOutput(applyOps(src.value, [{ op: 'pixelate', size: size.value }]))
}

let timer = 0
watch(size, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" @loaded="onLoaded">
    <div class="mt-2" style="max-width: 420px">
      <span class="field-label">马赛克块大小：{{ size }} px</span>
      <input v-model.number="size" type="range" min="2" max="64" step="1" />
    </div>
    <p class="muted small mt-1">块越大越抽象；用于遮挡人脸、车牌等敏感信息时建议 12px 以上。</p>
  </ImageToolBase>
</template>
