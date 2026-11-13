<script setup lang="ts">
/**
 * 配色方案提取（UX1.0 五处方）：
 * - 算法精化（rx1）：色桶结果叠加 k-means 迭代（3 轮），主色饱和度更准。
 * - 色数与占比（rx2）：4/6/8/12 色切换；鲜艳组带占比标签。
 * - 复制格式（rx3）：HEX/RGB/HSL 三格式 + 「全部复制为 CSS 变量」。
 * - 方案编辑（rx4）：色块弹层（锁定 + HSL 微调）+ 和谐方案（互补/三角/类比各 5 色）。
 * - 隐藏原图（rx5）：预览与色板之间「收起原图」开关。
 */
import { computed, ref } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { paletteFrom, hexToRgb, rgbToHex } from '@/lib/imageEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

interface Swatch {
  hex: string
  ratio: number
  sat: number
  locked?: boolean
}

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const srcCv = ref<HTMLCanvasElement | null>(null)
const main = ref<Swatch[]>([])
const vivid = ref<Swatch[]>([])
const kCount = ref(6)
const hideOrig = ref(false)
/** rx4 弹层编辑 */
const editing = ref<Swatch | null>(null)

function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * l - 1) || 1)
}
function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b > 168
}

/** rx1：在桶结果基础上做 k-means 精化（3 轮，k = 色数） */
function kmeansRefine(c: HTMLCanvasElement, k: number, seeds: string[]): { hex: string; ratio: number }[] {
  const s = Math.min(c.width, 200)
  const sc = s / c.width
  const t = document.createElement('canvas')
  t.width = s
  t.height = Math.max(1, Math.round(c.height * sc))
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height)
  const d = t.getContext('2d')!.getImageData(0, 0, t.width, t.height).data
  const px: [number, number, number][] = []
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 128) continue
    px.push([d[i]!, d[i + 1]!, d[i + 2]!])
  }
  if (!px.length) return seeds.map((hex) => ({ hex, ratio: 0 }))
  let centers = seeds.slice(0, k).map((h) => hexToRgb(h) as [number, number, number])
  while (centers.length < k) {
    const p = px[Math.floor(Math.random() * px.length)]!
    centers.push([p[0], p[1], p[2]])
  }
  let assign = new Array<number>(px.length).fill(0)
  for (let iter = 0; iter < 3; iter++) {
    // 分配
    for (let i = 0; i < px.length; i++) {
      let best = 0
      let bestD = Infinity
      for (let ci = 0; ci < centers.length; ci++) {
        const dd = (px[i]![0]! - centers[ci]![0]) ** 2 + (px[i]![1]! - centers[ci]![1]) ** 2 + (px[i]![2]! - centers[ci]![2]) ** 2
        if (dd < bestD) {
          bestD = dd
          best = ci
        }
      }
      assign[i] = best
    }
    // 更新中心
    const sums = centers.map(() => [0, 0, 0, 0])
    for (let i = 0; i < px.length; i++) {
      const a = assign[i]!
      sums[a]![0]! += px[i]![0]!
      sums[a]![1]! += px[i]![1]!
      sums[a]![2]! += px[i]![2]!
      sums[a]![3]!++
    }
    centers = sums.map((sm, ci) => (sm[3]! > 0 ? ([sm[0]! / sm[3]!, sm[1]! / sm[3]!, sm[2]! / sm[3]!] as [number, number, number]) : centers[ci]!))
  }
  const total = px.length
  const counts = centers.map(() => 0)
  for (const a of assign) counts[a]!++
  return centers
    .map((cc, ci) => ({ hex: rgbToHex(cc[0], cc[1], cc[2]), ratio: counts[ci]! / total }))
    .filter((x) => x.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio)
}

function extract() {
  const c = srcCv.value
  if (!c) return
  const kept = main.value.filter((s) => s.locked)
  const seeds = kept.map((s) => s.hex)
  const refined = kmeansRefine(c, kCount.value, seeds.length ? seeds : paletteFrom(c, 8).map((x) => x.hex))
  // 锁定色保留并重算占比
  const merged: Swatch[] = [...kept]
  for (const r of refined) {
    if (!kept.some((s) => s.hex === r.hex)) merged.push({ ...r, sat: saturation(r.hex) })
  }
  main.value = merged
    .map((s) => (s.locked ? s : { ...s, sat: saturation(s.hex) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, kCount.value)
  vivid.value = [...main.value].filter((s) => s.sat > 0.2).sort((a, b) => b.sat - a.sat).slice(0, 6)
}

function onLoaded(c: HTMLCanvasElement) {
  srcCv.value = c
  main.value = []
  extract()
}

function setK(n: number) {
  kCount.value = n
  extract()
}

/* rx3 复制格式 */
function hexToHsl(hex: string): string {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r0, g0, b0)
  const min = Math.min(r0, g0, b0)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const dd = max - min
    s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min)
    if (max === r0) h = ((g0 - b0) / dd + (g0 < b0 ? 6 : 0)) / 6
    else if (max === g0) h = ((b0 - r0) / dd + 2) / 6
    else h = ((r0 - g0) / dd + 4) / 6
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}
async function copy(v: string, label = v) {
  if (await copyText(v)) toast.ok(`已复制 ${label}`)
  else toast.err('复制失败')
}
async function copyAllCss() {
  const css = main.value.map((s, i) => `  --palette-${i + 1}: ${s.hex};`).join('\n')
  const text = `:root {\n${css}\n}`
  if (await copyText(text)) toast.ok('已复制 CSS 变量块')
  else toast.err('复制失败')
}

/* rx4 方案编辑 */
function openEdit(s: Swatch) {
  editing.value = { ...s }
}
function applyEdit() {
  const e = editing.value
  if (!e) return
  const idx = main.value.findIndex((s) => s.hex === e.hex)
  const [r, g, b] = hexToRgb(e.hex)
  const newSwatch: Swatch = { ...e, hex: rgbToHex(r, g, b), sat: saturation(e.hex), locked: true }
  if (idx >= 0) main.value.splice(idx, 1, newSwatch)
  else main.value.push(newSwatch)
  editing.value = null
}
function toggleLock(s: Swatch) {
  s.locked = !s.locked
}

/** rx4 和谐方案：互补 / 三角 / 类比 各 5 色 */
const harmony = computed(() => {
  const e = editing.value
  if (!e) return []
  const [r, g, b] = hexToRgb(e.hex)
  const [h0, s0, l0] = rgb2hsl(r, g, b)
  const mk = (h: number) => hsl2hex(h, s0, l0)
  return [
    { t: '互补', colors: [mk(h0), mk((h0 + 0.5) % 1), mk((h0 + 0.42) % 1), mk((h0 + 0.58) % 1), mk((h0 + 0.08) % 1)] },
    { t: '三角', colors: [mk(h0), mk((h0 + 1 / 3) % 1), mk((h0 + 2 / 3) % 1), mk((h0 + 1 / 3 + 0.06) % 1), mk((h0 + 2 / 3 - 0.06 + 1) % 1)] },
    { t: '类比', colors: [mk((h0 + 0.92) % 1), mk((h0 + 0.96) % 1), mk(h0), mk((h0 + 0.04) % 1), mk((h0 + 0.08) % 1)] },
  ]
})

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  const [r0, g0, b0] = [r / 255, g / 255, b / 255]
  const max = Math.max(r0, g0, b0)
  const min = Math.min(r0, g0, b0)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const dd = max - min
  const s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min)
  let h: number
  if (max === r0) h = ((g0 - b0) / dd + (g0 < b0 ? 6 : 0)) / 6
  else if (max === g0) h = ((b0 - r0) / dd + 2) / 6
  else h = ((r0 - g0) / dd + 4) / 6
  return [h, s, l]
}
function hsl2hex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255)
  }
  return rgbToHex(f(0), f(8), f(4))
}
</script>

<template>
  <ImageToolBase ref="base" :downloadable="false" suffix="-palette" @loaded="onLoaded">
    <div v-if="main.length" class="mt-2">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label">主色数量</span>
        <button v-for="n in [4, 6, 8, 12]" :key="n" class="chip" :class="{ active: kCount === n }" @click="setK(n)">{{ n }} 色</button>
        <label class="check"><input v-model="hideOrig" type="checkbox" /> 收起原图（rx5）</label>
        <button class="btn btn-soft btn-sm" style="margin-left: auto" @click="copyAllCss">全部复制为 CSS 变量</button>
        <button class="btn btn-ghost btn-sm" @click="extract">重新提取</button>
      </div>

      <div class="field-label mt-2">主色（按占比，点击弹层编辑 / 复制）</div>
      <div class="pal mt-1">
        <div v-for="(s, i) in main" :key="'m' + s.hex + i" class="pal-cell" :style="{ background: s.hex }" role="button" tabindex="0" @click="openEdit(s)" @keydown.enter="openEdit(s)">
          <span class="pal-ratio" :class="{ light: isLight(s.hex) }">{{ (s.ratio * 100).toFixed(1) }}%{{ s.locked ? ' 🔒' : '' }}</span>
          <span class="pal-hex" :class="{ light: isLight(s.hex) }">{{ s.hex }}</span>
        </div>
      </div>

      <div v-if="vivid.length" class="mt-3">
        <div class="field-label">鲜艳点缀色（按饱和度，含占比）</div>
        <div class="pal mt-1">
          <div v-for="(s, i) in vivid" :key="'v' + s.hex + i" class="pal-cell" :style="{ background: s.hex }" role="button" tabindex="0" @click="copy(s.hex)" @keydown.enter="copy(s.hex)">
            <span class="pal-ratio" :class="{ light: isLight(s.hex) }">{{ (s.ratio * 100).toFixed(1) }}%</span>
            <span class="pal-hex" :class="{ light: isLight(s.hex) }">{{ s.hex }}</span>
          </div>
        </div>
      </div>

      <p class="muted small mt-2">算法：色桶聚合 + k-means 3 轮精化；点击主色块可锁定 / HSL 微调 / 生成和谐方案。</p>
    </div>

    <!-- rx4 色块编辑弹层 -->
    <div v-if="editing" class="modal-mask" @click.self="editing = null">
      <div class="modal">
        <div class="row" style="gap: 10px; align-items: center">
          <span class="sw" :style="{ background: editing.hex }"></span>
          <code class="mono">{{ editing.hex }}</code>
          <label class="check"><input v-model="editing.locked" type="checkbox" /> 锁定（重新提取不变）</label>
        </div>
        <div class="mt-2">
          <span class="field-label">微调</span>
          <input v-model="editing.hex" type="color" class="color-in" />
          <span class="muted small" style="margin-left: 8px">或直接选取颜色</span>
        </div>
        <div class="mt-2">
          <span class="field-label">复制格式</span>
          <div class="row" style="gap: 6px; flex-wrap: wrap">
            <button class="chip" @click="copy(editing.hex, editing.hex)">HEX</button>
            <button class="chip" @click="copy((() => { const [r, g, b] = hexToRgb(editing.hex); return `rgb(${r}, ${g}, ${b})` })())">RGB</button>
            <button class="chip" @click="copy(hexToHsl(editing.hex))">HSL</button>
          </div>
        </div>
        <div v-for="h in harmony" :key="h.t" class="mt-2">
          <span class="field-label">和谐方案 · {{ h.t }}</span>
          <div class="row mt-1" style="gap: 6px">
            <button
              v-for="(c, i) in h.colors"
              :key="i"
              class="mini-sw"
              :style="{ background: c }"
              :title="`复制 ${c}`"
              @click="copy(c)"
            ></button>
          </div>
        </div>
        <div class="row mt-2" style="justify-content: flex-end; gap: 8px">
          <button class="btn btn-ghost btn-sm" @click="editing = null">关闭</button>
          <button class="btn btn-primary btn-sm" @click="applyEdit">应用到色板</button>
        </div>
      </div>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.pal {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
.pal-cell {
  height: 84px;
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 8px;
  gap: 2px;
  transition: transform 0.12s ease;
}
.pal-cell:hover {
  transform: translateY(-2px);
}
.pal-ratio {
  font-size: 12px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.55);
}
.pal-ratio.light {
  color: rgba(255, 255, 255, 0.9);
}
.pal-hex {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: rgba(0, 0, 0, 0.78);
}
.pal-hex.light {
  color: rgba(255, 255, 255, 0.9);
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
  padding: 16px;
}
.modal {
  background: var(--panel-solid);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  width: min(440px, 100%);
  max-height: 86vh;
  overflow: auto;
}
.sw {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  display: inline-block;
}
.mini-sw {
  width: 34px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--border);
  cursor: pointer;
}
.color-in {
  width: 44px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  vertical-align: middle;
}
.mt-2 {
  margin-top: 10px;
}
.mt-3 {
  margin-top: 16px;
}
</style>
