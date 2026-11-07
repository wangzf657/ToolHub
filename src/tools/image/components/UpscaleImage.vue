<script setup lang="ts">
/** AI 图片放大：2×/4× 分步高质量重采样 + 可选锐化后处理 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const scale = ref(2)
const sharpen = ref(true)
const outSize = ref<{ w: number; h: number } | null>(null)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

/** 分步放大：每次 ×2 且 imageSmoothingQuality=high，比一步到位更清晰 */
function upscale(c: HTMLCanvasElement, target: number): HTMLCanvasElement {
  let cur = c
  let done = 1
  while (done * 2 <= target) {
    const t = document.createElement('canvas')
    t.width = cur.width * 2
    t.height = cur.height * 2
    const ctx = t.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, t.width, t.height)
    cur = t
    done *= 2
  }
  if (done < target) {
    const t = document.createElement('canvas')
    t.width = Math.round(cur.width * (target / done))
    t.height = Math.round(cur.height * (target / done))
    const ctx = t.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, t.width, t.height)
    cur = t
  }
  return cur
}

function render() {
  const c = src.value
  if (!c) return
  let out = upscale(c, scale.value)
  if (sharpen.value) out = applyOps(out, [{ op: 'sharpen', amount: 25 }])
  outSize.value = { w: out.width, h: out.height }
  base.value?.setOutput(out)
}

let timer = 0
watch([scale, sharpen], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-upscaled" @loaded="onLoaded">
    <div class="chips mt-2">
      <span class="field-label">放大倍数：</span>
      <button class="chip" :class="{ active: scale === 2 }" @click="scale = 2">2×</button>
      <button class="chip" :class="{ active: scale === 4 }" @click="scale = 4">4×</button>
      <label class="check" style="margin-left: 8px"><input v-model="sharpen" type="checkbox" /> 放大后轻度锐化</label>
    </div>
    <div v-if="outSize" class="row row-wrap mt-1" style="gap: 10px">
      <span class="badge badge-plain">{{ src!.width }} × {{ src!.height }} → {{ outSize.w }} × {{ outSize.h }}</span>
      <span v-if="outSize.w * outSize.h > 40_000_000" class="notice notice-warn" style="flex: 1">
        输出超过 4000 万像素，浏览器内存占用较大，导出可能变慢或失败。
      </span>
    </div>
    <p class="muted small mt-1">本工具为高质量重采样放大（非神经网络超分），放大 4× 时细节仍有限，配合锐化观感更佳。</p>
  </ImageToolBase>
</template>

<style scoped>
.chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
