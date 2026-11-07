<script setup lang="ts">
/** 老照片修复增强：去噪 → 提亮 → 锐化 → 可选上色 四步流水线，每步可调 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, type ImageOp } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)

const denoiseOn = ref(true)
const denoiseR = ref(1)
const brightOn = ref(true)
const brightV = ref(12)
const contrastV = ref(18)
const sharpenOn = ref(true)
const sharpenV = ref(35)
const colorizeOn = ref(false)
const colorizeV = ref(30)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

function render() {
  if (!src.value) return
  const ops: ImageOp[] = []
  if (denoiseOn.value && denoiseR.value > 0) ops.push({ op: 'blur', radius: denoiseR.value })
  if (brightOn.value) {
    if (brightV.value !== 0) ops.push({ op: 'brightness', value: brightV.value })
    if (contrastV.value !== 0) ops.push({ op: 'contrast', value: contrastV.value })
  }
  if (colorizeOn.value && colorizeV.value > 0) ops.push({ op: 'sepia', intensity: colorizeV.value / 100 })
  if (sharpenOn.value && sharpenV.value > 0) ops.push({ op: 'sharpen', amount: sharpenV.value })
  base.value?.setOutput(ops.length ? applyOps(src.value, ops) : null)
}

let timer = 0
watch([denoiseOn, denoiseR, brightOn, brightV, contrastV, sharpenOn, sharpenV, colorizeOn, colorizeV], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-restored" @loaded="onLoaded">
    <div class="steps mt-2">
      <div class="step">
        <label class="check"><input v-model="denoiseOn" type="checkbox" /> ① 去噪（小半径模糊）</label>
        <input v-model.number="denoiseR" type="range" min="0.4" max="3" step="0.2" :disabled="!denoiseOn" />
        <span class="muted small">半径 {{ denoiseR }} px</span>
      </div>
      <div class="step">
        <label class="check"><input v-model="brightOn" type="checkbox" /> ② 提亮 / 对比</label>
        <input v-model.number="brightV" type="range" min="-30" max="50" step="2" :disabled="!brightOn" />
        <span class="muted small">亮度 {{ brightV }}</span>
        <input v-model.number="contrastV" type="range" min="-20" max="50" step="2" :disabled="!brightOn" />
        <span class="muted small">对比度 {{ contrastV }}</span>
      </div>
      <div class="step">
        <label class="check"><input v-model="sharpenOn" type="checkbox" /> ③ 锐化</label>
        <input v-model.number="sharpenV" type="range" min="10" max="100" step="5" :disabled="!sharpenOn" />
        <span class="muted small">强度 {{ sharpenV }}</span>
      </div>
      <div class="step">
        <label class="check"><input v-model="colorizeOn" type="checkbox" /> ④ 上色（sepia 暖调混合）</label>
        <input v-model.number="colorizeV" type="range" min="0" max="100" step="5" :disabled="!colorizeOn" />
        <span class="muted small">强度 {{ colorizeV }}%（想要神经网络上色请用「老照片智能上色」）</span>
      </div>
    </div>
    <p class="muted small mt-1">流水线顺序固定为 去噪 → 提亮 → 上色 → 锐化，与真实修片流程一致。</p>
  </ImageToolBase>
</template>

<style scoped>
.steps {
  display: grid;
  gap: 14px;
  max-width: 520px;
}
.step {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
</style>
