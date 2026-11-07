<script setup lang="ts">
/** 翻转图片：水平镜像 / 垂直翻转 */
import { ref, shallowRef, watch } from 'vue'
import { FlipHorizontal, FlipVertical } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const flipH = ref(false)
const flipV = ref(false)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  flipH.value = false
  flipV.value = false
  render()
}

function render() {
  if (!src.value) return
  const ops = []
  if (flipH.value) ops.push({ op: 'flip' as const, axis: 'h' as const })
  if (flipV.value) ops.push({ op: 'flip' as const, axis: 'v' as const })
  base.value?.setOutput(ops.length ? applyOps(src.value, ops) : null)
}

watch([flipH, flipV], render)
</script>

<template>
  <ImageToolBase ref="base" @loaded="onLoaded">
    <div class="row mt-2">
      <button class="chip" :class="{ active: flipH }" @click="flipH = !flipH">
        <FlipHorizontal :size="15" /> 水平镜像
      </button>
      <button class="chip" :class="{ active: flipV }" @click="flipV = !flipV">
        <FlipVertical :size="15" /> 垂直翻转
      </button>
      <span class="muted small">再点一次可撤销对应翻转</span>
    </div>
  </ImageToolBase>
</template>
