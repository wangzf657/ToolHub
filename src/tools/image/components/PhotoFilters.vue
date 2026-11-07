<script setup lang="ts">
/** 照片滤镜：一键预设 + 手动微调滑杆叠加 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, type ImageOp } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const preset = ref('none')
const brightness = ref(0)
const contrast = ref(0)
const saturate = ref(0)

const PRESETS: { key: string; label: string; tint?: [number, number, number]; ops: ImageOp[] }[] = [
  { key: 'none', label: '原图', ops: [] },
  { key: 'bw', label: '黑白', ops: [{ op: 'grayscale', intensity: 1 }] },
  { key: 'sepia', label: '复古', ops: [{ op: 'sepia', intensity: 0.75 }, { op: 'saturate', value: -10 }] },
  { key: 'cold', label: '冷调', tint: [-14, 0, 22], ops: [{ op: 'saturate', value: 8 }, { op: 'brightness', value: 4 }] },
  { key: 'warm', label: '暖阳', tint: [20, 8, -14], ops: [{ op: 'saturate', value: 16 }] },
  { key: 'contrast', label: '高对比', ops: [{ op: 'contrast', value: 38 }, { op: 'saturate', value: 10 }] },
  { key: 'fade', label: '褪色', ops: [{ op: 'contrast', value: -26 }, { op: 'brightness', value: 12 }, { op: 'saturate', value: -35 }] },
  { key: 'vivid', label: '鲜艳', ops: [{ op: 'saturate', value: 42 }, { op: 'contrast', value: 14 }] },
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

/** 通道色调偏移（冷调/暖阳用） */
function tint(c: HTMLCanvasElement, [dr, dg, db]: [number, number, number]): HTMLCanvasElement {
  const t = document.createElement('canvas')
  t.width = c.width
  t.height = c.height
  const ctx = t.getContext('2d')!
  ctx.drawImage(c, 0, 0)
  const id = ctx.getImageData(0, 0, t.width, t.height)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.max(0, Math.min(255, d[i] + dr))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + dg))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + db))
  }
  ctx.putImageData(id, 0, 0)
  return t
}

function render() {
  if (!src.value) return
  const p = PRESETS.find((x) => x.key === preset.value) ?? PRESETS[0]
  let c = p.tint ? tint(src.value, p.tint) : src.value
  const ops: ImageOp[] = [...p.ops]
  if (brightness.value !== 0) ops.push({ op: 'brightness', value: brightness.value })
  if (contrast.value !== 0) ops.push({ op: 'contrast', value: contrast.value })
  if (saturate.value !== 0) ops.push({ op: 'saturate', value: saturate.value })
  base.value?.setOutput(ops.length || p.tint ? applyOps(c, ops) : null)
}

let timer = 0
watch([preset, brightness, contrast, saturate], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" @loaded="onLoaded">
    <div class="chips mt-2">
      <button v-for="p in PRESETS" :key="p.key" class="chip" :class="{ active: preset === p.key }" @click="preset = p.key">
        {{ p.label }}
      </button>
    </div>
    <div class="sliders mt-2">
      <label><span class="field-label">手动 · 亮度 {{ brightness }}</span><input v-model.number="brightness" type="range" min="-100" max="100" /></label>
      <label><span class="field-label">手动 · 对比度 {{ contrast }}</span><input v-model.number="contrast" type="range" min="-100" max="100" /></label>
      <label><span class="field-label">手动 · 饱和度 {{ saturate }}</span><input v-model.number="saturate" type="range" min="-100" max="100" /></label>
    </div>
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
  max-width: 480px;
}
</style>
