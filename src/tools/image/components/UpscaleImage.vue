<script setup lang="ts">
/**
 * 图片放大（UX1.0 四处方）：
 * - 100% 局部核对（rx2）：原图/结果双 1:1 局部窗并排（200×200，点击预览选点）。
 * - 自定义目标宽度（rx3）：按目标宽换算为 ≤4× 的分步重采样。
 * - 前置尺寸拦截（rx5）：4× 估算 >100MP 时禁用 4× 档并说明原因。
 * - 文案诚实（rx1）：面板声明"高质量重采样放大（非神经网络超分）"；注册表 title 去"AI"另提申请。
 */
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const scale = ref(2)
const sharpen = ref(true)
const targetW = ref<number | ''>('')
const outSize = ref<{ w: number; h: number } | null>(null)
const out = shallowRef<HTMLCanvasElement | null>(null)
const loupeSrc = ref<HTMLCanvasElement | null>(null)
const loupeOut = ref<HTMLCanvasElement | null>(null)
const sample = ref({ x: 0.5, y: 0.5 })

/** rx5：4× 估算像素 >100MP 时拦截 */
const tooBigFor4x = computed(() => !!src.value && src.value.width * src.value.height * 16 > 100_000_000)
const targetPx = computed(() => (targetW.value ? Math.round(Number(targetW.value)) : src.value ? src.value.width * scale.value : 0))
const effScale = computed(() => (src.value ? targetPx.value / src.value.width : 0))
const targetTooFar = computed(() => effScale.value > 4)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  targetW.value = ''
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
  const target = Math.min(targetPx.value, Math.round(c.width * 4))
  let o = upscale(c, Math.max(1, target / c.width))
  if (sharpen.value) o = applyOps(o, [{ op: 'sharpen', amount: 25 }])
  out.value = o
  outSize.value = { w: o.width, h: o.height }
  base.value?.setOutput(o)
  drawLoupes()
}

/** rx2 双 1:1 局部窗 */
function drawLoupes() {
  const ls = loupeSrc.value
  const lo = loupeOut.value
  const s = src.value
  const o = out.value
  if (!ls || !lo || !s || !o) return
  const sx = Math.round(sample.value.x * s.width)
  const sy = Math.round(sample.value.y * s.height)
  const draw = (cv: HTMLCanvasElement, img: HTMLCanvasElement, px: number, py: number) => {
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, px - 100, py - 100, 200, 200, 0, 0, 200, 200)
  }
  draw(ls, s, sx, sy)
  // 结果窗取样点按比例映射
  draw(lo, o, Math.round(sample.value.x * o.width), Math.round(sample.value.y * o.height))
}

function bindPreview() {
  const c = base.value?.output ?? null
  if (!c) return
  c.style.cursor = 'crosshair'
  c.onclick = (e: MouseEvent) => {
    const rect = c.getBoundingClientRect()
    sample.value = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
    drawLoupes()
  }
}

let timer = 0
watch([scale, sharpen, targetW], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 120)
})
watch(out, () => {
  void nextTick()
  bindPreview()
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-upscaled" @loaded="onLoaded">
    <div class="chips mt-2">
      <span class="field-label">放大倍数：</span>
      <button class="chip" :class="{ active: scale === 2 }" @click="((scale = 2), (targetW = ''))">2×</button>
      <button
        class="chip"
        :class="{ active: scale === 4 }"
        :disabled="tooBigFor4x"
        :title="tooBigFor4x ? '4× 输出超过 1 亿像素，已禁用' : ''"
        @click="((scale = 4), (targetW = ''))"
      >
        4×
      </button>
      <label class="opt">
        <span class="field-label">或按目标宽度放大（px）</span>
        <input v-model.number="targetW" type="number" min="16" class="input" style="width: 120px" placeholder="如 4000" />
      </label>
      <label class="check" style="margin-top: 18px"><input v-model="sharpen" type="checkbox" /> 放大后轻度锐化</label>
    </div>
    <p v-if="tooBigFor4x" class="notice notice-warn mt-1 small">
      源图 {{ src?.width }}×{{ src?.height }} 的 4× 输出将超过 1 亿像素（约 {{ Math.round((src!.width * src!.height * 16) / 1_000_000) }}MP），
      已禁用 4× 档 —— 请使用 2× 或按目标宽度放大。
    </p>
    <p v-if="targetW && targetTooFar" class="notice notice-warn mt-1 small">
      目标宽度对应 {{ effScale.toFixed(1) }}× 超过 4× 上限，将按 4× 输出（{{ Math.round((src?.width ?? 0) * 4) }}px 宽）。
    </p>
    <div v-if="outSize" class="row row-wrap mt-1" style="gap: 10px">
      <span class="badge badge-plain">{{ src!.width }} × {{ src!.height }} → {{ outSize.w }} × {{ outSize.h }}</span>
      <span v-if="outSize.w * outSize.h > 40_000_000" class="notice notice-warn" style="flex: 1">
        输出超过 4000 万像素，浏览器内存占用较大，导出可能变慢或失败。
      </span>
    </div>

    <!-- rx2 双 1:1 局部核对窗 -->
    <div v-if="out" class="loupes mt-2">
      <div class="loupe-cell">
        <canvas ref="loupeSrc" width="200" height="200"></canvas>
        <span class="muted small">原图 1:1</span>
      </div>
      <div class="loupe-cell">
        <canvas ref="loupeOut" width="200" height="200"></canvas>
        <span class="muted small">结果 1:1</span>
      </div>
      <span class="muted small">点击预览图选择取样位置，核对文字笔画边缘有无插值糊化</span>
    </div>

    <p class="muted small mt-1">本工具为高质量重采样放大（非神经网络超分），放大 4× 时细节仍有限，配合锐化观感更佳。</p>
  </ImageToolBase>
</template>

<style scoped>
.chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.opt {
  display: grid;
  gap: 4px;
}
.loupes {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: flex-end;
}
.loupe-cell {
  display: grid;
  gap: 4px;
  justify-items: center;
}
.loupe-cell canvas {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 10px 10px;
}
</style>
