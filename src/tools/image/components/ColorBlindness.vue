<script setup lang="ts">
/** 色盲模拟器：三种色觉缺陷的 LMS 变换矩阵逐像素模拟 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const mode = ref<'protanopia' | 'deuteranopia' | 'tritanopia'>('deuteranopia')
const origThumb = ref('')
const simThumb = ref('')

const MODES = [
  { v: 'protanopia' as const, t: '红色盲（protanopia）' },
  { v: 'deuteranopia' as const, t: '绿色盲（deuteranopia）' },
  { v: 'tritanopia' as const, t: '蓝黄色盲（tritanopia）' },
]

/** 常用色觉模拟矩阵（RGB → 模拟 RGB） */
const MATRICES: Record<string, number[]> = {
  protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
}

function makeThumb(c: HTMLCanvasElement): string {
  const t = document.createElement('canvas')
  const k = Math.min(1, 160 / Math.max(c.width, 1))
  t.width = Math.max(1, Math.round(c.width * k))
  t.height = Math.max(1, Math.round(c.height * k))
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height)
  return t.toDataURL('image/png')
}

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  origThumb.value = makeThumb(c)
  render()
}

function render() {
  const c = src.value
  if (!c) return
  const m = MATRICES[mode.value]
  const out = document.createElement('canvas')
  out.width = c.width
  out.height = c.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(c, 0, 0)
  const id = ctx.getImageData(0, 0, out.width, out.height)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    d[i] = m[0] * r + m[1] * g + m[2] * b
    d[i + 1] = m[3] * r + m[4] * g + m[5] * b
    d[i + 2] = m[6] * r + m[7] * g + m[8] * b
  }
  ctx.putImageData(id, 0, 0)
  simThumb.value = makeThumb(out)
  base.value?.setOutput(out)
}

let timer = 0
watch(mode, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <div>
    <ImageToolBase ref="base" suffix="-cb" @loaded="onLoaded">
      <div class="chips mt-2">
        <button v-for="m in MODES" :key="m.v" class="chip" :class="{ active: mode === m.v }" @click="mode = m.v">
          {{ m.t }}
        </button>
      </div>
      <div v-if="origThumb" class="compare mt-2">
        <figure><img :src="origThumb" alt="原图缩略" /><figcaption>原图</figcaption></figure>
        <figure><img :src="simThumb" alt="模拟缩略" /><figcaption>当前模拟</figcaption></figure>
      </div>
      <p class="muted small mt-1">用 LMS 色觉变换矩阵逐像素模拟，适合检查 UI 配色与数据可视化的无障碍表现。</p>
    </ImageToolBase>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.compare {
  display: flex;
  gap: 16px;
}
.compare figure {
  margin: 0;
  text-align: center;
}
.compare img {
  max-height: 160px;
  max-width: 100%;
  border-radius: 10px;
  border: 1px solid var(--border);
}
figcaption {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}
</style>
