<script setup lang="ts">
/** 老照片智能上色：本地启发式算法 —— 按亮度区域映射色调 + 顶部天空渐变混合 */
import { ref, shallowRef, watch } from 'vue'
import { Info } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const strength = ref(65)
/** rx3 色调微调：暖↔冷（-50~50）、饱和度（-100~100），作用于映射输出 */
const warmth = ref(0)
const satur = ref(0)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

function render() {
  const c = src.value
  if (!c) return
  const k = strength.value / 100
  const wAmp = warmth.value / 500 // 每通道最大 ±10% 增益
  const sat = 1 + satur.value / 100
  const out = document.createElement('canvas')
  out.width = c.width
  out.height = c.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(c, 0, 0)
  const id = ctx.getImageData(0, 0, out.width, out.height)
  const d = id.data
  const h = out.height
  for (let y = 0; y < h; y++) {
    // 顶部 1/3 天空权重（越靠上越强）
    const skyW = y < h / 3 ? (1 - y / (h / 3)) : 0
    for (let x = 0; x < out.width; x++) {
      const i = (y * out.width + x) * 4
      const lum0 = (0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) / 255
      let r: number, g: number, b: number
      if (lum0 < 0.3) {
        // 暗部 → 棕
        r = d[i]! * 1.18
        g = d[i + 1]! * 0.94
        b = d[i + 2]! * 0.72
      } else if (lum0 < 0.7) {
        // 中灰 → 暖肤色
        r = d[i]! * 1.1
        g = d[i + 1]! * 1.0
        b = d[i + 2]! * 0.86
      } else {
        // 高光 → 冷白
        r = d[i]! * 0.97
        g = d[i + 1]! * 1.0
        b = d[i + 2]! * 1.06
      }
      // 天空区域按亮度向蓝色渐变混合
      if (skyW > 0 && lum0 > 0.45) {
        const s = skyW * (lum0 - 0.45) * 1.4
        r = r * (1 - s) + 150 * s
        g = g * (1 - s) + 185 * s
        b = b * (1 - s) + 225 * s
      }
      // rx3：暖↔冷（红蓝反向增益）与饱和度，作用于映射输出
      if (wAmp !== 0) {
        r *= 1 + wAmp
        b *= 1 - wAmp
      }
      if (sat !== 1) {
        const lm = 0.299 * r + 0.587 * g + 0.114 * b
        r = lm + (r - lm) * sat
        g = lm + (g - lm) * sat
        b = lm + (b - lm) * sat
      }
      const cl = (v: number) => Math.min(255, Math.max(0, v))
      d[i] = d[i]! * (1 - k) + cl(r) * k
      d[i + 1] = d[i + 1]! * (1 - k) + cl(g) * k
      d[i + 2] = d[i + 2]! * (1 - k) + cl(b) * k
    }
  }
  ctx.putImageData(id, 0, 0)
  base.value?.setOutput(k === 0 ? null : out)
}

let timer = 0
watch([strength, warmth, satur], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <div>
    <div class="notice notice-info mt-1">
      <Info :size="16" style="flex: none; margin-top: 2px" />
      <span>
        本工具使用<strong>本地启发式上色</strong>：按亮度区域映射色调（暗部偏棕、中灰偏暖肤色、高光偏冷白，上部天空混入蓝色渐变），
        <strong>并非神经网络模型</strong>，适合给黑白照片一个自然的怀旧色彩基调。
      </span>
    </div>
    <ImageToolBase ref="base" suffix="-colorized" @loaded="onLoaded">
      <div class="mt-2" style="max-width: 420px">
        <span class="field-label">上色强度：{{ strength }}%{{ strength === 0 ? '（0 = 保持原黑白）' : '' }}</span>
        <input v-model.number="strength" type="range" min="0" max="100" step="5" />
        <span class="field-label mt-1">色调微调：{{ warmth > 0 ? '暖 +' : warmth < 0 ? '冷 ' : '' }}{{ warmth }}</span>
        <input v-model.number="warmth" type="range" min="-50" max="50" step="5" />
        <span class="field-label mt-1">饱和度：{{ satur }}</span>
        <input v-model.number="satur" type="range" min="-100" max="100" step="5" />
      </div>
    </ImageToolBase>
  </div>
</template>
