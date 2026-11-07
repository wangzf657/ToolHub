<script setup lang="ts">
/** 配色方案提取：主色组（按占比）+ 鲜艳色组（按饱和度排序），点击复制 HEX */
import { ref } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { paletteFrom, hexToRgb } from '@/lib/imageEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

interface Swatch { hex: string; ratio: number; sat: number }

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const main = ref<Swatch[]>([])
const vivid = ref<Swatch[]>([])

/** HSL 饱和度（0-1），用于鲜艳组排序 */
function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * l - 1) || 1)
}

/** 亮度判断：决定色块上的文字用深色还是浅色 */
function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b > 168
}

function onLoaded(c: HTMLCanvasElement) {
  const top = paletteFrom(c, 8).map((s) => ({ ...s, sat: saturation(s.hex) }))
  main.value = [...top].sort((a, b) => b.ratio - a.ratio)
  vivid.value = [...top].filter((s) => s.sat > 0.2).sort((a, b) => b.sat - a.sat).slice(0, 5)
}

async function copy(hex: string) {
  if (await copyText(hex)) toast.ok(`已复制 ${hex}`)
  else toast.err('复制失败')
}
</script>

<template>
  <ImageToolBase ref="base" :downloadable="false" suffix="-palette" @loaded="onLoaded">
    <div v-if="main.length" class="mt-3">
      <div class="field-label">主色（按占比）</div>
      <div class="pal mt-1">
        <button v-for="s in main" :key="'m' + s.hex" class="pal-cell" :style="{ background: s.hex }" :title="`点击复制 ${s.hex}`" :aria-label="`点击复制 ${s.hex}`" @click="copy(s.hex)">
          <span class="pal-ratio">{{ (s.ratio * 100).toFixed(1) }}%</span>
          <span class="pal-hex" :class="{ light: isLight(s.hex) }">{{ s.hex }}</span>
        </button>
      </div>
    </div>
    <div v-if="vivid.length" class="mt-3">
      <div class="field-label">鲜艳点缀色（按饱和度）</div>
      <div class="pal mt-1">
        <button v-for="s in vivid" :key="'v' + s.hex" class="pal-cell" :style="{ background: s.hex }" :title="`点击复制 ${s.hex}`" :aria-label="`点击复制 ${s.hex}`" @click="copy(s.hex)">
          <span class="pal-hex" :class="{ light: isLight(s.hex) }">{{ s.hex }}</span>
        </button>
      </div>
    </div>
    <p class="muted small mt-2">基于色桶聚合统计提取主色，点击色块复制 HEX。</p>
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
.pal-hex {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: rgba(0, 0, 0, 0.78);
}
.pal-hex.light {
  color: rgba(255, 255, 255, 0.9);
}
</style>
