<script setup lang="ts">
/** 颜色转换器：任意格式自动识别 → HEX/RGB/HSL/OKLCH/CMYK 全量互转（手写公式，零依赖） */
import { computed, ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('#3b82f6')
const copied = ref('')

interface Rgba {
  r: number
  g: number
  b: number
  a?: number
}

/** 解析常见颜色写法，失败返回 null */
function parseColor(sRaw: string): Rgba | null {
  const s = sRaw.trim().toLowerCase()
  let m: RegExpMatchArray | null
  if ((m = s.match(/^#([0-9a-f]{3,8})$/))) {
    const h = m[1]
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split('').map((c) => parseInt(c + c, 16))
      return { r, g, b, a: h.length === 4 ? a : undefined }
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : undefined,
      }
    }
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/))) {
    const ch = (v: string) => (v.endsWith('%') ? Math.round((parseFloat(v) / 100) * 255) : Math.round(Number(v)))
    return { r: ch(m[1]), g: ch(m[2]), b: ch(m[3]), a: m[4] ? Number(m[4].endsWith('%') ? parseFloat(m[4]) / 100 : m[4]) : undefined }
  }
  if ((m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/))) {
    return hslToRgb(Number(m[1]) / 360, normPct(m[2]), normPct(m[3]), m[4] ? normPct(m[4]) : undefined)
  }
  if ((m = s.match(/^oklch\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+)(?:deg)?\s*\)$/))) {
    return oklchToRgb(normPct2(m[1]), normPct2(m[2]), Number(m[3]))
  }
  if ((m = s.match(/^cmyk\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)\s*\)$/))) {
    const c = normPct(m[1]), mg = normPct(m[2]), y = normPct(m[3]), k = normPct(m[4])
    const f = (v: number) => Math.round(255 * (1 - v) * (1 - k))
    return { r: f(c), g: f(mg), b: f(y) }
  }
  // 常用 CSS 关键字取色兜底
  const named = NAMED[s]
  if (named) return { r: parseInt(named.slice(0, 2), 16), g: parseInt(named.slice(2, 4), 16), b: parseInt(named.slice(4, 6), 16) }
  return null
}
const normPct = (v: string) => (v.endsWith('%') ? parseFloat(v) / 100 : Number(v) / 100)
const normPct2 = (v: string) => (v.endsWith('%') ? parseFloat(v) / 100 : Number(v))

function hslToRgb(h: number, s: number, l: number, a?: number): Rgba {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255), a }
}

/** sRGB → OKLCH（CSS Color 4 矩阵） */
function rgbToOklch({ r, g, b }: Rgba): { l: number; c: number; h: number } {
  const f = (v: number) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  const R = f(r), G = f(g), B = f(b)
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B
  const cube = (v: number) => Math.cbrt(v)
  const L = 0.2104542553 * cube(l) + 0.793617785 * cube(m) - 0.0040720468 * cube(s)
  const A = 1.9779984951 * cube(l) - 2.428592205 * cube(m) + 0.4505937099 * cube(s)
  const B2 = 0.0259040371 * cube(l) + 0.7827717662 * cube(m) - 0.808675766 * cube(s)
  const c = Math.sqrt(A * A + B2 * B2)
  let h = (Math.atan2(B2, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h }
}

function oklchToRgb(l: number, c: number, hDeg: number): Rgba {
  const hr = (hDeg * Math.PI) / 180
  const A = c * Math.cos(hr)
  const B2 = c * Math.sin(hr)
  const cubeL = l + 0.3963377774 * A + 0.2158037573 * B2
  const cubeM = l - 0.1055613458 * A - 0.0638541728 * B2
  const cubeS = l - 0.0894841775 * A - 1.291485548 * B2
  const L3 = cubeL ** 3, M3 = cubeM ** 3, S3 = cubeS ** 3
  const R = 4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3
  const G = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3
  const B = -0.0041960865 * L3 - 0.7034186147 * M3 + 1.707614701 * S3
  const f = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
  return { r: Math.round(f(R) * 255), g: Math.round(f(G) * 255), b: Math.round(f(B) * 255) }
}

const NAMED: Record<string, string> = {
  black: '000000', white: 'ffffff', red: 'ff0000', green: '008000', blue: '0000ff',
  yellow: 'ffff00', orange: 'ffa500', purple: '800080', gray: '808080', grey: '808080',
  pink: 'ffc0cb', brown: 'a52a2a', cyan: '00ffff', magenta: 'ff00ff', navy: '000080',
  teal: '008080', silver: 'c0c0c0', gold: 'ffd700',
}

const parsed = computed(() => parseColor(input.value))

const hexOf = (c: Rgba) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
function rgbToHsl({ r, g, b }: Rgba) {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

const outputs = computed(() => {
  const c = parsed.value
  if (!c) return []
  const hsl = rgbToHsl(c)
  const ok = rgbToOklch(c)
  const k = 1 - Math.max(c.r, c.g, c.b) / 255
  const cmyk = k >= 1 ? [0, 0, 0, 1] : [(1 - c.r / 255 - k) / (1 - k), (1 - c.g / 255 - k) / (1 - k), (1 - c.b / 255 - k) / (1 - k), k]
  const a = c.a !== undefined ? c.a : 1
  return [
    { label: 'HEX', value: hexOf(c).toUpperCase() },
    { label: 'RGB', value: `rgb(${c.r}, ${c.g}, ${c.b})` },
    { label: 'HSL', value: `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)` },
    { label: 'OKLCH', value: `oklch(${ok.l.toFixed(3)} ${ok.c.toFixed(3)} ${Math.round(ok.h)})` },
    { label: 'CMYK', value: `cmyk(${Math.round(cmyk[0] * 100)}%, ${Math.round(cmyk[1] * 100)}%, ${Math.round(cmyk[2] * 100)}%, ${Math.round(cmyk[3] * 100)}%)` },
    { label: 'RGBA（含透明度）', value: `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(a).toFixed(2)})` },
  ]
})

const doCopy = async (v: string, label: string) => {
  const okFlag = await navigator.clipboard.writeText(v).then(() => true).catch(() => false)
  if (okFlag) {
    copied.value = label
    toast.ok(`已复制 ${label}`)
    setTimeout(() => (copied.value = ''), 1200)
  } else toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 8px">
      <input v-model="input" class="input mono" style="width: 320px" spellcheck="false" placeholder="#3b82f6 / rgb(59,130,246) / hsl(217,91%,60%) / oklch(0.62 0.17 259)" />
      <span v-if="parsed" class="swatch" :style="{ background: hexOf(parsed) }"></span>
      <span v-else class="notice notice-err" style="flex: 1">无法识别颜色，支持 HEX / rgb() / hsl() / oklch() / cmyk() / 常用英文色名</span>
    </div>

    <div v-if="outputs.length" class="rows">
      <div v-for="o in outputs" :key="o.label" class="crow">
        <span class="clabel">{{ o.label }}</span>
        <code class="cval mono">{{ o.value }}</code>
        <button class="icon-btn" :title="`复制 ${o.label}`" @click="doCopy(o.value, o.label)">
          <Check v-if="copied === o.label" :size="14" class="copied" />
          <Copy v-else :size="14" />
        </button>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">OKLCH 按 CSS Color 4 标准矩阵换算（感知均匀，适合配色系统）；CMYK 为屏幕近似值，印刷请以专色系统为准。</p>
  </div>
</template>

<style scoped>
.swatch {
  width: 44px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  flex: none;
}
.rows {
  display: grid;
  gap: 8px;
}
.crow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.clabel {
  font-size: 12.5px;
  color: var(--text-2);
  width: 130px;
  flex: none;
}
.cval {
  flex: 1;
  font-size: 14px;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  padding: 4px;
}
.icon-btn:hover {
  color: var(--accent-text);
}
.copied {
  color: var(--accent-text);
}
</style>
