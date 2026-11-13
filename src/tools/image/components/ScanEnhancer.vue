<script setup lang="ts">
/**
 * 扫描件增强（UX1.0）：
 * - Otsu 自动档（rx1）：默认「自动」，按直方图类间方差最优阈值填入滑杆并渲染。
 * - 透视校正（rx3）：四角拖拽 + 网格细分透视映射（见下方 warpQuad）。
 * - 多页衔接（rx5）：完成后「合成 PDF」入口（带结果走图片家族转场，由 jpg-to-pdf 侧接收）。
 */
import { nextTick, ref, shallowRef, watch } from 'vue'
import { FileText, RotateCcw } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, canvasToBlob, type ImageOp } from '@/lib/imageEngine'
import { handoffImage } from './handoff'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const mode = ref<'bw' | 'contrast'>('bw')
const threshold = ref(140)
const brightness = ref(0)
const auto = ref(true)

/** Otsu 自动阈值（rx1） */
function otsu(c: HTMLCanvasElement): number {
  const t = document.createElement('canvas')
  t.width = 200
  t.height = Math.max(1, Math.round((c.height / c.width) * 200))
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height)
  const d = t.getContext('2d')!.getImageData(0, 0, t.width, t.height).data
  const hist = new Array<number>(256).fill(0)
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!)
    hist[v]++
    n++
  }
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]!
  let sumB = 0
  let wB = 0
  let best = 0
  let bestVar = -1
  for (let t2 = 0; t2 < 256; t2++) {
    wB += hist[t2]!
    if (!wB) continue
    const wF = n - wB
    if (!wF) break
    sumB += t2 * hist[t2]!
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > bestVar) {
      bestVar = between
      best = t2
    }
  }
  return best
}

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  threshold.value = otsu(c)
  auto.value = true
  render()
}

function render() {
  if (!src.value) return
  const ops: ImageOp[] = [{ op: 'grayscale', intensity: 1 }]
  if (brightness.value !== 0) ops.push({ op: 'brightness', value: brightness.value })
  if (mode.value === 'bw') ops.push({ op: 'threshold', level: threshold.value })
  else ops.push({ op: 'contrast', value: 55 })
  base.value?.setOutput(applyOps(src.value, ops))
}

function applyAuto() {
  if (!src.value) return
  threshold.value = otsu(src.value)
  auto.value = true
  render()
}
function manualT() {
  auto.value = false
}

/* rx3 透视校正：四角拖拽（图像比例坐标）+ 12×12 网格仿射细分 */
const warpOn = ref(false)
const corners = ref([
  { x: 0.02, y: 0.02 }, // 左上
  { x: 0.98, y: 0.03 }, // 右上
  { x: 0.97, y: 0.97 }, // 右下
  { x: 0.03, y: 0.98 }, // 左下
])
let dragCorner = -1

function warpQuad(img: HTMLCanvasElement, cs: { x: number; y: number }[]): HTMLCanvasElement {
  const W = img.width
  const H = img.height
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')!
  const N = 12
  const P = cs.map((p) => ({ x: p.x * W, y: p.y * H }))
  // 双线性插值四边形内部网格点（src 空间为规则网格）
  const pt = (u: number, v: number) => ({
    x: (1 - u) * (1 - v) * P[0]!.x + u * (1 - v) * P[1]!.x + u * v * P[2]!.x + (1 - u) * v * P[3]!.x,
    y: (1 - u) * (1 - v) * P[0]!.y + u * (1 - v) * P[1]!.y + u * v * P[2]!.y + (1 - u) * v * P[3]!.y,
  })
  const su = W / N
  const sv = H / N
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const u0 = ix / N
      const v0 = iy / N
      const u1 = (ix + 1) / N
      const v1 = (iy + 1) / N
      // 目标规则小矩形 ← 源四边形子块（仿射近似：以子块三顶点确定变换）
      const d00 = pt(u0, v0)
      const d10 = pt(u1, v0)
      const d01 = pt(u0, v1)
      const dx = d10.x - d00.x
      const dy = d10.y - d00.y
      const dx2 = d01.x - d00.x
      const dy2 = d01.y - d00.y
      const sx0 = ix * su
      const sy0 = iy * sv
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(d00.x, d00.y)
      ctx.lineTo(d10.x, d10.y)
      ctx.lineTo(d01.x + (pt(u1, v1).x - d10.x), d01.y + (pt(u1, v1).y - d10.y))
      ctx.lineTo(d01.x, d01.y)
      ctx.closePath()
      ctx.clip()
      // 仿射矩阵：src 单位方块 → 目标平行四边形
      ctx.transform(dx / su, dy / su, dx2 / sv, dy2 / sv, d00.x - (dx / su) * sx0 - (dx2 / sv) * sy0, d00.y - (dy / su) * sx0 - (dy2 / sv) * sy0)
      ctx.drawImage(img, 0, 0)
      ctx.restore()
    }
  }
  return out
}

function renderWarp() {
  const s = src.value
  if (!s) return
  const warped = warpQuad(s, corners.value)
  const ops: ImageOp[] = [{ op: 'grayscale', intensity: 1 }]
  if (brightness.value !== 0) ops.push({ op: 'brightness', value: brightness.value })
  if (mode.value === 'bw') ops.push({ op: 'threshold', level: threshold.value })
  else ops.push({ op: 'contrast', value: 55 })
  base.value?.setOutput(applyOps(warped, ops))
}

function bindCornerDrag() {
  const c = base.value?.output ?? null
  if (!c) return
  c.style.touchAction = 'none'
  c.style.cursor = 'move'
  c.onpointerdown = (e: PointerEvent) => {
    if (!warpOn.value) return
    const rect = c.getBoundingClientRect()
    const fx = (e.clientX - rect.left) / rect.width
    const fy = (e.clientY - rect.top) / rect.height
    dragCorner = corners.value.findIndex((p) => Math.hypot(p.x - fx, p.y - fy) < 0.06)
    if (dragCorner >= 0) {
      e.preventDefault()
      c.setPointerCapture(e.pointerId)
    }
  }
  c.onpointermove = (e: PointerEvent) => {
    if (!warpOn.value || dragCorner < 0) return
    const rect = c.getBoundingClientRect()
    corners.value[dragCorner] = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
    renderWarp()
  }
  c.onpointerup = () => {
    dragCorner = -1
  }
}
watch(warpOn, () => {
  void nextTick()
  bindCornerDrag()
  if (warpOn.value) renderWarp()
  else render()
})
function resetCorners() {
  corners.value = [
    { x: 0.02, y: 0.02 },
    { x: 0.98, y: 0.03 },
    { x: 0.97, y: 0.97 },
    { x: 0.03, y: 0.98 },
  ]
  renderWarp()
}

/** rx5 合成 PDF 入口：当前结果带入 jpg-to-pdf */
async function goPdf() {
  const c = base.value?.output
  if (!c) return
  const blob = await canvasToBlob(c, 'image/jpeg', 0.92)
  handoffImage(blob, 'scan.jpg')
  toast.ok('已带入「JPG 转 PDF」')
}

let timer = 0
watch([mode, threshold, brightness], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => (warpOn.value ? renderWarp() : render()), 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-scan" @loaded="onLoaded">
    <div class="chips mt-2">
      <button class="chip" :class="{ active: mode === 'bw' }" @click="mode = 'bw'">黑白文档（阈值二值化）</button>
      <button class="chip" :class="{ active: mode === 'contrast' }" @click="mode = 'contrast'">高对比灰度</button>
    </div>
    <div class="sliders mt-2">
      <label v-if="mode === 'bw'">
        <span class="field-label">二值化阈值：{{ threshold }}（文字越浅越低）</span>
        <input v-model.number="threshold" type="range" min="60" max="220" step="2" @input="manualT" />
        <span class="row mt-1" style="gap: 8px">
          <button class="chip" :class="{ active: auto }" @click="applyAuto">自动（Otsu）</button>
          <span class="muted small">{{ auto ? '已按直方图最优阈值自动填入' : '手动模式' }}</span>
        </span>
      </label>
      <label><span class="field-label">亮度补偿：{{ brightness }}</span><input v-model.number="brightness" type="range" min="-60" max="60" step="2" /></label>
    </div>

    <!-- rx3 透视校正 -->
    <div class="row row-wrap mt-2" style="gap: 12px; align-items: center">
      <label class="check"><input v-model="warpOn" type="checkbox" /> 透视校正（四角拖拽）</label>
      <button v-if="warpOn" class="btn btn-ghost btn-sm" @click="resetCorners"><RotateCcw :size="13" /> 复位四角</button>
      <span v-if="warpOn" class="muted small">拖动输出图四个角到纸张边缘，校正梯形翻拍</span>
    </div>

    <!-- rx5 合成 PDF 入口 -->
    <div class="row mt-2">
      <button class="btn btn-soft" @click="goPdf"><FileText :size="15" /> 带结果去合成 PDF（JPG 转 PDF）</button>
    </div>

    <p class="muted small mt-1">手机翻拍偏暗就调高亮度补偿；阈值过高会让纸张发黑，过低会让文字变虚。</p>
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
  max-width: 460px;
}
.mt-1 {
  margin-top: 6px;
}
</style>
