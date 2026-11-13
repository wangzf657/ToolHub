<script setup lang="ts">
/**
 * 照片滤镜（UX1.0）：
 * - 滤镜强度滑杆（rx2）：0~100%，50% 时效果约为 100% 档的一半，0% 回原图。
 * - 首屏主推滤镜选择（rx5/P0 站内收口）：手动三杆区移除，改为指向「亮度对比度调节」的引导，
 *   两工具参数不再互相覆盖。
 * - 性能（rx4）：预览用 ≤2000px 副本 + 色调/亮度/对比度/饱和度等全部像素操作合并为单次遍历；
 *   导出走原图全分辨率。
 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { canvasToBlob } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
/** 预览副本（≤2000px），12MP 图切档 <100ms */
const previewSrc = shallowRef<HTMLCanvasElement | null>(null)
const preset = ref('none')
const strength = ref(100)

const PRESETS: { key: string; label: string; tint: [number, number, number]; gray: number; sepia: number; brightness: number; contrast: number; saturate: number }[] = [
  { key: 'none', label: '原图', tint: [0, 0, 0], gray: 0, sepia: 0, brightness: 0, contrast: 0, saturate: 0 },
  { key: 'bw', label: '黑白', tint: [0, 0, 0], gray: 1, sepia: 0, brightness: 0, contrast: 0, saturate: 0 },
  { key: 'sepia', label: '复古', tint: [0, 0, 0], gray: 0, sepia: 0.75, brightness: 0, contrast: 0, saturate: -10 },
  { key: 'cold', label: '冷调', tint: [-14, 0, 22], gray: 0, sepia: 0, brightness: 4, contrast: 0, saturate: 8 },
  { key: 'warm', label: '暖阳', tint: [20, 8, -14], gray: 0, sepia: 0, brightness: 0, contrast: 0, saturate: 16 },
  { key: 'contrast', label: '高对比', tint: [0, 0, 0], gray: 0, sepia: 0, brightness: 0, contrast: 38, saturate: 10 },
  { key: 'fade', label: '褪色', tint: [0, 0, 0], gray: 0, sepia: 0, brightness: 12, contrast: -26, saturate: -35 },
  { key: 'vivid', label: '鲜艳', tint: [0, 0, 0], gray: 0, sepia: 0, brightness: 0, contrast: 14, saturate: 42 },
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  const long = Math.max(c.width, c.height)
  previewSrc.value =
    long > 2000
      ? scaleTo(c, Math.round((c.width * 2000) / long), Math.round((c.height * 2000) / long))
      : c
  render()
}

function scaleTo(s: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const t = document.createElement('canvas')
  t.width = w
  t.height = h
  const ctx = t.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(s, 0, 0, w, h)
  return t
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** 单次遍历像素管线：tint/gray/sepia/brightness/contrast/saturate 全部一次循环完成 */
function applyPipeline(source: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const p = PRESETS.find((x) => x.key === preset.value) ?? PRESETS[0]!
  const t = document.createElement('canvas')
  t.width = source.width
  t.height = source.height
  const ctx = t.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  const active =
    p.key !== 'none' ||
    p.tint[0] !== 0 ||
    p.tint[1] !== 0 ||
    p.tint[2] !== 0
  if (!active || k === 0) return t
  const id = ctx.getImageData(0, 0, t.width, t.height)
  const d = id.data
  const dr = p.tint[0] * k
  const dg = p.tint[1] * k
  const db = p.tint[2] * k
  const grayK = p.gray * k
  const sepiaK = p.sepia * k
  const bt = (p.brightness * k * 255) / 100
  const cf = (259 * (p.contrast * k * 2.55 + 255)) / (255 * (259 - p.contrast * k * 2.55))
  const sat = 1 + (p.saturate * k) / 100
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]! + dr
    let g = d[i + 1]! + dg
    let b = d[i + 2]! + db
    if (grayK > 0) {
      const v = 0.299 * r + 0.587 * g + 0.114 * b
      r += (v - r) * grayK
      g += (v - g) * grayK
      b += (v - b) * grayK
    }
    if (sepiaK > 0) {
      const sr = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b)
      const sg = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b)
      const sb = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b)
      r += (sr - r) * sepiaK
      g += (sg - g) * sepiaK
      b += (sb - b) * sepiaK
    }
    if (bt !== 0) {
      r += bt
      g += bt
      b += bt
    }
    if (p.contrast !== 0) {
      r = cf * (r - 128) + 128
      g = cf * (g - 128) + 128
      b = cf * (b - 128) + 128
    }
    if (sat !== 1) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      r = lum + (r - lum) * sat
      g = lum + (g - lum) * sat
      b = lum + (b - lum) * sat
    }
    d[i] = clamp255(r)
    d[i + 1] = clamp255(g)
    d[i + 2] = clamp255(b)
  }
  ctx.putImageData(id, 0, 0)
  return t
}

function render() {
  if (!previewSrc.value) return
  const out = applyPipeline(previewSrc.value, strength.value / 100)
  base.value?.setOutput(preset.value === 'none' || strength.value === 0 ? null : out)
}

/** 导出全分辨率 */
async function produceFull(): Promise<Blob> {
  if (!src.value) throw new Error('尚未载入图片')
  const out = applyPipeline(src.value, strength.value / 100)
  return canvasToBlob(out, 'image/png')
}

let timer = 0
watch([preset, strength], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" :produce-blob="produceFull" @loaded="onLoaded">
    <div class="chips mt-2">
      <button v-for="p in PRESETS" :key="p.key" class="chip" :class="{ active: preset === p.key }" @click="preset = p.key">
        {{ p.label }}
      </button>
    </div>
    <div v-if="preset !== 'none'" class="strength mt-2">
      <span class="field-label">滤镜强度 {{ strength }}%{{ strength === 0 ? '（相当于原图）' : strength < 60 ? '（轻柔）' : '' }}</span>
      <input v-model.number="strength" type="range" min="0" max="100" step="5" />
    </div>
    <!-- 站内收口（P0 rx5）：手动微调不再重复造轮子，参数区与 adjust-brightness 同源 -->
    <div class="notice notice-info mt-2">
      想在滤镜之外手动微调亮度 / 对比度 / 饱和度？请使用
      <RouterLink to="/t/adjust-brightness" class="link">亮度对比度调节</RouterLink>
      工具（带图操作互不影响，本页专注一键滤镜与强度）。
    </div>
  </ImageToolBase>
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
  max-width: 420px;
}
.link {
  color: var(--accent-text);
  text-decoration: underline;
}
</style>
