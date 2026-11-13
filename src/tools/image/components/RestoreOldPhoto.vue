<script setup lang="ts">
/**
 * 老照片修复增强（UX1.0 三处方）：
 * - 一键翻新预设（rx1）：轻度/中度/重度三 chip 联动全部滑杆（默认中度），手动调任一杆不重置其余。
 * - 上色导流（rx4）：④旁按钮直达「老照片智能上色」。
 * - 预设记忆（rx5）：localStorage 记住上次滑杆组合（toolhub. 前缀）。
 */
import { onMounted, ref, shallowRef, watch } from 'vue'
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

const LS_KEY = 'toolhub.restoreOldPhoto.v1'
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      const s = saved as Record<string, unknown>
      denoiseOn.value = !!s.denoiseOn
      denoiseR.value = Number(s.denoiseR ?? 1)
      brightOn.value = !!s.brightOn
      brightV.value = Number(s.brightV ?? 12)
      contrastV.value = Number(s.contrastV ?? 18)
      sharpenOn.value = !!s.sharpenOn
      sharpenV.value = Number(s.sharpenV ?? 35)
      colorizeOn.value = !!s.colorizeOn
      colorizeV.value = Number(s.colorizeV ?? 30)
    }
  } catch { /* 忽略 */ }
})

/** rx1 一键翻新预设（默认中度） */
function preset(kind: 'light' | 'mid' | 'heavy') {
  if (kind === 'light') {
    denoiseOn.value = true; denoiseR.value = 0.6
    brightOn.value = true; brightV.value = 6; contrastV.value = 10
    sharpenOn.value = true; sharpenV.value = 20
    colorizeOn.value = false; colorizeV.value = 0
  } else if (kind === 'mid') {
    denoiseOn.value = true; denoiseR.value = 1
    brightOn.value = true; brightV.value = 12; contrastV.value = 18
    sharpenOn.value = true; sharpenV.value = 35
    colorizeOn.value = false; colorizeV.value = 0
  } else {
    denoiseOn.value = true; denoiseR.value = 1.6
    brightOn.value = true; brightV.value = 20; contrastV.value = 26
    sharpenOn.value = true; sharpenV.value = 55
    colorizeOn.value = true; colorizeV.value = 40
  }
}

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
  timer = window.setTimeout(() => {
    render()
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ denoiseOn: denoiseOn.value, denoiseR: denoiseR.value, brightOn: brightOn.value, brightV: brightV.value, contrastV: contrastV.value, sharpenOn: sharpenOn.value, sharpenV: sharpenV.value, colorizeOn: colorizeOn.value, colorizeV: colorizeV.value }),
      )
    } catch { /* 忽略 */ }
  }, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-restored" @loaded="onLoaded">
    <div class="row mt-2" style="gap: 8px">
      <span class="field-label">一键翻新</span>
      <button class="chip" @click="preset('light')">轻度（微调）</button>
      <button class="chip" @click="preset('mid')">中度（默认推荐）</button>
      <button class="chip" @click="preset('heavy')">重度（老照片强修）</button>
    </div>
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
        <div class="row mt-1" style="gap: 10px; align-items: center">
          <span class="muted small">强度 {{ colorizeV }}%</span>
          <RouterLink class="go-colorize" to="/t/colorize-photo">想要真实彩色？去「老照片智能上色」→</RouterLink>
        </div>
      </div>
    </div>
    <p class="muted small mt-1">流水线顺序固定为 去噪 → 提亮 → 上色 → 锐化，与真实修片流程一致；滑杆组合会自动记住。</p>
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
.go-colorize {
  font-size: 12.5px;
  color: var(--accent-text);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 999px;
  padding: 2px 10px;
  text-decoration: none;
}
.go-colorize:hover {
  background: var(--accent-soft);
}
</style>
