<script setup lang="ts">
/**
 * 色盲模拟器（UX1.0 两处方）：
 * - 补全 8 型（rx1）：三色盲 + 三色弱 + 全色盲 + 全色弱（Coblis 通用模拟矩阵）。
 * - 强度滑杆（rx2）：0~100% 在恒等阵与目标矩阵间线性插值，0% 输出与原图逐像素一致。
 * 处理前后对比滑块：拖动分割线核对模拟效果（CompareSlider）。
 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import CompareSlider from './CompareSlider.vue'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const mode = ref('deuteranopia')
const intensity = ref(100)
const outCv = shallowRef<HTMLCanvasElement | null>(null)

const MODES = [
  { v: 'protanopia', t: '红色盲（protanopia）' },
  { v: 'protanomaly', t: '红色弱（protanomaly）' },
  { v: 'deuteranopia', t: '绿色盲（deuteranopia）' },
  { v: 'deuteranomaly', t: '绿色弱（deuteranomaly）' },
  { v: 'tritanopia', t: '蓝黄色盲（tritanopia）' },
  { v: 'tritanomaly', t: '蓝黄色弱（tritanomaly）' },
  { v: 'achromatopsia', t: '全色盲（achromatopsia）' },
  { v: 'achromatomaly', t: '全色弱（achromatomaly）' },
]

/** 常用色觉模拟矩阵（RGB → 模拟 RGB，行优先 3×3） */
const MATRICES: Record<string, number[]> = {
  protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  protanomaly: [0.817, 0.183, 0, 0.333, 0.667, 0, 0, 0.125, 0.875],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  deuteranomaly: [0.8, 0.2, 0, 0.258, 0.742, 0, 0, 0.142, 0.858],
  tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
  tritanomaly: [0.967, 0.033, 0, 0, 0.733, 0.267, 0, 0.183, 0.817],
  achromatopsia: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
  achromatomaly: [0.618, 0.32, 0.062, 0.163, 0.775, 0.062, 0.163, 0.32, 0.517],
}

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

function render() {
  const c = src.value
  if (!c) return
  const m = MATRICES[mode.value] ?? MATRICES.deuteranopia!
  const k = intensity.value / 100
  // 恒等阵与目标阵线性插值（rx2）：0% 逐像素一致，100% 完整模拟
  const e = m.map((v, i) => (i % 4 === 0 ? 1 : 0) + (v - (i % 4 === 0 ? 1 : 0)) * k)
  const out = document.createElement('canvas')
  out.width = c.width
  out.height = c.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(c, 0, 0)
  const id = ctx.getImageData(0, 0, out.width, out.height)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!
    const g = d[i + 1]!
    const b = d[i + 2]!
    d[i] = e[0]! * r + e[1]! * g + e[2]! * b
    d[i + 1] = e[3]! * r + e[4]! * g + e[5]! * b
    d[i + 2] = e[6]! * r + e[7]! * g + e[8]! * b
  }
  ctx.putImageData(id, 0, 0)
  outCv.value = out
  base.value?.setOutput(out)
}

let timer = 0
watch([mode, intensity], () => {
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
      <div class="strength mt-2">
        <span class="field-label">模拟强度：{{ intensity }}%{{ intensity === 0 ? '（即原图）' : '' }}</span>
        <input v-model.number="intensity" type="range" min="0" max="100" step="5" />
      </div>
      <CompareSlider v-if="src && outCv" :before="src" :after="outCv" class="mt-2" before-label="原图" after-label="模拟结果" />
      <p class="muted small mt-1">用 LMS 色觉变换矩阵逐像素模拟（色弱型为恒等阵与色盲阵的插值），适合检查 UI 配色与数据可视化的无障碍表现。</p>
    </ImageToolBase>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.strength {
  display: grid;
  gap: 4px;
  max-width: 380px;
}
</style>
