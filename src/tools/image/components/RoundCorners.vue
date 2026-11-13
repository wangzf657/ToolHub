<script setup lang="ts">
/**
 * 圆角图片（UX1.0）：
 * - 预设 chips + 数值输入与滑杆双向同步（rx1）
 * - 进阶：四角独立半径（rx2，本地实现圆角路径）
 * - 组合描边：圆角 + 描边一次导出（rx3）
 * - 小尺寸回看：48/64px 缩略预览（rx5/P0）；预览高度由基座 46vh 上限约束（rx4/P0）
 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const radius = ref(24)
const maxR = ref(300)
const advanced = ref(false)
const tl = ref(0)
const tr = ref(0)
const bl = ref(0)
const br = ref(0)
const withBorder = ref(false)
const borderWidth = ref(4)
const borderColor = ref('#111111')
const output = shallowRef<HTMLCanvasElement | null>(null)
const cv48 = ref<HTMLCanvasElement | null>(null)
const cv64 = ref<HTMLCanvasElement | null>(null)

const PRESETS = [
  { v: 8, t: '8' }, { v: 16, t: '16' }, { v: 24, t: '24' }, { v: 48, t: '48' }, { v: 96, t: '96' }, { v: -1, t: '胶囊' },
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  maxR.value = Math.floor(Math.min(c.width, c.height) / 2)
  radius.value = Math.min(24, maxR.value)
  tl.value = tr.value = bl.value = br.value = 0
  render()
}

const radiusOf = () => ({
  tl: advanced.value ? Math.max(0, Math.min(tl.value, maxR.value)) : radius.value,
  tr: advanced.value ? Math.max(0, Math.min(tr.value, maxR.value)) : radius.value,
  bl: advanced.value ? Math.max(0, Math.min(bl.value, maxR.value)) : radius.value,
  br: advanced.value ? Math.max(0, Math.min(br.value, maxR.value)) : radius.value,
})

/** 四角独立圆角路径 */
function roundPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: { tl: number; tr: number; br: number; bl: number }) {
  ctx.beginPath()
  ctx.moveTo(x + r.tl, y)
  ctx.lineTo(x + w - r.tr, y)
  ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr)
  ctx.lineTo(x + w, y + h - r.br)
  ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br)
  ctx.lineTo(x + r.bl, y + h)
  ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl)
  ctx.lineTo(x, y + r.tl)
  ctx.arcTo(x, y, x + r.tl, y, r.tl)
  ctx.closePath()
}

function render() {
  const s = src.value
  if (!s) return
  const r = radiusOf()
  const bw = withBorder.value ? Math.max(1, Math.round(borderWidth.value)) : 0
  const out = document.createElement('canvas')
  out.width = s.width + bw * 2
  out.height = s.height + bw * 2
  const ctx = out.getContext('2d')!
  roundPath(ctx, bw, bw, s.width, s.height, r)
  ctx.save()
  ctx.clip()
  ctx.drawImage(s, bw, bw)
  ctx.restore()
  if (bw > 0) {
    roundPath(ctx, bw, bw, s.width, s.height, r)
    ctx.strokeStyle = borderColor.value
    ctx.lineWidth = bw * 2 // 一半在图外、一半压在图缘，外缘完整
    ctx.stroke()
  }
  output.value = out
  base.value?.setOutput(out)
}

/** 小尺寸回看：把输出缩到 48/64px，圆角比例与导出一致 */
watch(output, () => {
  for (const [cv, size] of [[cv48.value, 48], [cv64.value, 64]] as const) {
    if (!cv || !output.value) continue
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(output.value, 0, 0, size, size)
  }
}, { flush: 'post' })

function setPreset(v: number) {
  radius.value = v === -1 ? maxR.value : Math.min(v, maxR.value)
  render()
}

let timer = 0
const debouncedRender = () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
}
watch([radius, tl, tr, bl, br, borderWidth], debouncedRender)
watch([advanced, withBorder, borderColor], render)
</script>

<template>
  <ImageToolBase ref="base" suffix="-rounded" @loaded="onLoaded">
    <div class="mt-2" style="max-width: 480px">
      <span class="field-label">圆角半径：{{ radius }} px（最大 {{ maxR }}）</span>
      <div class="row row-wrap" style="gap: 6px">
        <button v-for="p in PRESETS" :key="p.t" class="chip" :class="{ active: radius === (p.v === -1 ? maxR : p.v) }" @click="setPreset(p.v)">
          {{ p.t }}
        </button>
      </div>
      <input v-model.number="radius" type="range" min="0" :max="maxR" step="1" />
      <input v-model.number="radius" type="number" class="input" min="0" :max="maxR" step="1" style="width: 110px; margin-top: 6px" />

      <details class="tune mt-2" @toggle="advanced = ($event.target as HTMLDetailsElement).open">
        <summary>进阶：四角独立半径</summary>
        <div class="corners">
          <label><span class="field-label">左上 {{ tl }}</span><input v-model.number="tl" type="range" min="0" :max="maxR" /></label>
          <label><span class="field-label">右上 {{ tr }}</span><input v-model.number="tr" type="range" min="0" :max="maxR" /></label>
          <label><span class="field-label">左下 {{ bl }}</span><input v-model.number="bl" type="range" min="0" :max="maxR" /></label>
          <label><span class="field-label">右下 {{ br }}</span><input v-model.number="br" type="range" min="0" :max="maxR" /></label>
        </div>
        <p class="muted small">开启后以下四杆为准，上方统一半径不再生效。</p>
      </details>

      <label class="check mt-2"><input v-model="withBorder" type="checkbox" /> 同时加描边</label>
      <div v-if="withBorder" class="row" style="gap: 14px; margin-top: 6px">
        <label><span class="field-label">宽度 {{ borderWidth }}px</span><input v-model.number="borderWidth" type="range" min="1" max="40" /></label>
        <label><span class="field-label">颜色</span><input v-model="borderColor" type="color" /></label>
      </div>
    </div>

    <!-- 小尺寸回看（P0）：头像/favicon 观感 -->
    <div v-if="output" class="mini mt-2">
      <span class="field-label">小尺寸回看（圆角在小尺寸下的观感）</span>
      <div class="mini-row">
        <canvas ref="cv48" width="48" height="48"></canvas>
        <canvas ref="cv64" width="64" height="64"></canvas>
        <span class="muted small">48px / 64px</span>
      </div>
    </div>

    <p class="muted small mt-1">半径拉到最大即为胶囊形；输出 PNG，四角透明。</p>
  </ImageToolBase>
</template>

<style scoped>
.tune {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
}
.tune summary {
  cursor: pointer;
  color: var(--text-2);
  font-size: 13.5px;
  user-select: none;
}
.corners {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
.corners label {
  display: grid;
  gap: 4px;
}
.mini {
  display: grid;
  gap: 6px;
}
.mini-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  background:
    repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px;
}
</style>
