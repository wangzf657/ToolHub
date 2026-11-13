<script setup lang="ts">
/**
 * 图片清晰锐化（UX1.0 三处方）：
 * - 100% 局部查看（rx1）：200×200 1:1 局部窗，点击预览选点，可看清锐化白边。
 * - unsharp mask（rx3）：半径 0.5~3px（高斯模糊 + 差值叠加，本地实现），大图边缘更自然。
 * - 自动档（rx4）：拉普拉斯方差估算模糊度，一键应用建议强度（糊图建议值显著更高）。
 */
import { nextTick, ref, shallowRef, watch } from 'vue'
import { Wand2 } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, type ImageOp } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const amount = ref(40)
const denoise = ref(false)
const radius = ref(1) // unsharp 半径 px（0 = 用卷积锐化）
const out = shallowRef<HTMLCanvasElement | null>(null)
const loupe = ref<HTMLCanvasElement | null>(null)
const sample = ref({ x: 0.5, y: 0.5 })

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  render()
}

/** 本地 unsharp mask：out = src + amount·(src − gaussian(src, r)) */
function unsharp(s: HTMLCanvasElement, amt: number, r: number): HTMLCanvasElement {
  const blurCv = document.createElement('canvas')
  blurCv.width = s.width
  blurCv.height = s.height
  const bctx = blurCv.getContext('2d')!
  bctx.filter = `blur(${r}px)`
  bctx.drawImage(s, 0, 0)
  bctx.filter = 'none'
  const a = s.getContext('2d')!.getImageData(0, 0, s.width, s.height)
  const b = blurCv.getContext('2d')!.getImageData(0, 0, s.width, s.height)
  const k = amt / 50
  for (let i = 0; i < a.data.length; i += 4) {
    a.data[i] = Math.max(0, Math.min(255, a.data[i]! + (a.data[i]! - b.data[i]!) * k))
    a.data[i + 1] = Math.max(0, Math.min(255, a.data[i + 1]! + (a.data[i + 1]! - b.data[i + 1]!) * k))
    a.data[i + 2] = Math.max(0, Math.min(255, a.data[i + 2]! + (a.data[i + 2]! - b.data[i + 2]!) * k))
  }
  const outCv = document.createElement('canvas')
  outCv.width = s.width
  outCv.height = s.height
  outCv.getContext('2d')!.putImageData(a, 0, 0)
  return outCv
}

function render() {
  const s = src.value
  if (!s) return
  let o: HTMLCanvasElement
  if (radius.value > 0) {
    o = unsharp(s, amount.value, radius.value)
  } else {
    const ops: ImageOp[] = []
    if (denoise.value) ops.push({ op: 'blur', radius: 0.6 })
    if (amount.value > 0) ops.push({ op: 'sharpen', amount: amount.value })
    o = ops.length ? applyOps(s, ops) : s
  }
  out.value = o
  base.value?.setOutput(o === s ? null : o)
  drawLoupe()
}

/** 1:1 局部窗（rx1）：取样点跟随预览点击 */
function drawLoupe() {
  const lp = loupe.value
  const c = out.value
  if (!lp || !c) return
  const ctx = lp.getContext('2d')!
  ctx.clearRect(0, 0, lp.width, lp.height)
  const sx = Math.round(sample.value.x * c.width)
  const sy = Math.round(sample.value.y * c.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(c, sx - 100, sy - 100, 200, 200, 0, 0, 200, 200)
}

/** 点击主预览换取样点：把事件挂到基座输出的 canvas 上 */
function bindPreview() {
  const c = base.value?.output ?? null
  if (!c) return
  c.style.cursor = 'crosshair'
  c.onclick = (e: MouseEvent) => {
    const rect = c.getBoundingClientRect()
    sample.value = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
    drawLoupe()
  }
}

/** 自动档（rx4）：拉普拉斯方差 → 建议强度（糊图显著更高） */
function autoAmount() {
  const s = src.value
  if (!s) return
  const t = document.createElement('canvas')
  t.width = 256
  t.height = Math.max(1, Math.round((s.height / s.width) * 256))
  t.getContext('2d')!.drawImage(s, 0, 0, t.width, t.height)
  const d = t.getContext('2d')!.getImageData(0, 0, t.width, t.height).data
  const g = new Float32Array(t.width * t.height)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) g[p] = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let y = 1; y < t.height - 1; y++) {
    for (let x = 1; x < t.width - 1; x++) {
      const p = y * t.width + x
      const lap = 4 * g[p]! - g[p - 1]! - g[p + 1]! - g[p - t.width]! - g[p + t.width]!
      sum += lap
      sum2 += lap * lap
      n++
    }
  }
  if (!n) return
  const mean = sum / n
  const variance = sum2 / n - mean * mean
  const s2 = variance
  amount.value = s2 < 5 ? 90 : s2 < 20 ? 70 : s2 < 60 ? 50 : s2 < 150 ? 35 : s2 < 400 ? 20 : 10
  render()
}

let timer = 0
watch([amount, denoise, radius], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
watch(out, () => {
  void nextTick()
  bindPreview()
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-sharp" @loaded="onLoaded">
    <div class="sliders mt-2">
      <label>
        <span class="field-label">锐化强度：{{ amount }}</span>
        <input v-model.number="amount" type="range" min="0" max="100" step="5" />
      </label>
      <label>
        <span class="field-label">锐化方式：{{ radius > 0 ? `unsharp 半径 ${radius}px（大图更自然）` : '卷积锐化（经典 3×3）' }}</span>
        <input v-model.number="radius" type="range" min="0" max="3" step="0.5" />
      </label>
      <label class="check"><input v-model="denoise" type="checkbox" /> 先轻度模糊去噪，再锐化（仅卷积模式生效）</label>
      <button class="btn btn-soft btn-sm" style="justify-self: start" @click="autoAmount"><Wand2 :size="14" /> 自动档（按模糊度建议强度）</button>
    </div>
    <div class="loupe-wrap mt-2">
      <canvas ref="loupe" width="200" height="200" class="loupe"></canvas>
      <span class="muted small">1:1 局部查看 —— 点击预览图选择位置，看清锐化白边有无</span>
    </div>
    <p class="muted small mt-1">强度超过 70 容易出现白色镶边，建议从 40 左右开始尝试。</p>
  </ImageToolBase>
</template>

<style scoped>
.sliders {
  display: grid;
  gap: 10px;
  max-width: 460px;
}
.loupe-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.loupe {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 10px 10px;
}
</style>
