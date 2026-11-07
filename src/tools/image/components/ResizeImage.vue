<script setup lang="ts">
/** 调整图片尺寸：宽高输入 + 锁定比例 + 拉伸/适应/裁满模式 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const width = ref(0)
const height = ref(0)
const lock = ref(true)
const mode = ref<'stretch' | 'fit' | 'cover'>('stretch')

const MODES = [
  { v: 'stretch' as const, t: '拉伸' },
  { v: 'fit' as const, t: '适应' },
  { v: 'cover' as const, t: '裁满' },
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  width.value = c.width
  height.value = c.height
  render()
}

let syncing = false
watch(width, (w) => {
  if (lock.value && src.value && !syncing && w > 0) {
    syncing = true
    height.value = Math.max(1, Math.round((w * src.value.height) / src.value.width))
    syncing = false
  }
})
watch(height, (h) => {
  if (lock.value && src.value && !syncing && h > 0) {
    syncing = true
    width.value = Math.max(1, Math.round((h * src.value.width) / src.value.height))
    syncing = false
  }
})

function render() {
  if (!src.value || !width.value || !height.value) return
  const out = applyOps(src.value, [{ op: 'resize', width: width.value, height: height.value, mode: mode.value }])
  base.value?.setOutput(out)
}

let timer = 0
watch([width, height, mode], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">宽度（px）</span>
        <input v-model.number="width" type="number" min="1" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">高度（px）</span>
        <input v-model.number="height" type="number" min="1" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">缩放模式</span>
        <span class="row" style="flex-wrap: wrap">
          <button v-for="m in MODES" :key="m.v" class="chip" :class="{ active: mode === m.v }" @click="mode = m.v">
            {{ m.t }}
          </button>
        </span>
      </label>
      <label class="check" style="margin-top: 20px"><input v-model="lock" type="checkbox" /> 锁定宽高比</label>
    </div>
    <p class="muted small mt-1">
      适应：完整放入目标画布（留白）；裁满：填满目标画布并居中裁切；拉伸：强制变形到目标尺寸。
    </p>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
</style>
