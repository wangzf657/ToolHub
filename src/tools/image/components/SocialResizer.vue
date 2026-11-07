<script setup lang="ts">
/** 社媒图片尺寸器：按平台推荐尺寸 cover 裁剪，尺寸可编辑 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const platform = ref(0)
const width = ref(900)
const height = ref(383)
const result = shallowRef<HTMLCanvasElement | null>(null)

const PLATFORMS = [
  { name: '微信朋友圈封面', w: 900, h: 383 },
  { name: '小红书竖图', w: 1080, h: 1440 },
  { name: '抖音头像', w: 640, h: 640 },
  { name: '微博头条图', w: 980, h: 450 },
  { name: 'B站视频封面', w: 1146, h: 717 },
  { name: '公众号首图封面', w: 900, h: 383 },
]

function render() {
  const src = base.value?.source
  if (!src || !width.value || !height.value) return
  const out = applyOps(src, [{ op: 'resize', width: width.value, height: height.value, mode: 'cover' }])
  result.value = out
  base.value?.setOutput(out)
}

function onLoaded() {
  render()
}

function pick(i: number) {
  platform.value = i
  width.value = PLATFORMS[i].w
  height.value = PLATFORMS[i].h
}

let timer = 0
watch([platform, width, height], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-social" @loaded="onLoaded">
    <div class="chips mt-2">
      <button v-for="(p, i) in PLATFORMS" :key="p.name" class="chip" :class="{ active: platform === i }" @click="pick(i)">
        {{ p.name }}
      </button>
    </div>
    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">宽（px）</span>
        <input v-model.number="width" type="number" min="16" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">高（px）</span>
        <input v-model.number="height" type="number" min="16" class="input" style="width: 120px" />
      </label>
      <span class="muted small">采用「裁满 cover」：填满画布并居中裁切，不变形</span>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.opt {
  display: grid;
  gap: 4px;
}
</style>
