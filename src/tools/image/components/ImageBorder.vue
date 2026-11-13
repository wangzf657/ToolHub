<script setup lang="ts">
/**
 * 图片加边框（UX1.0）：
 * - 双模式（rx1）：外扩框｜留白画布（目标比例 1:1/4:5 + 边距百分比 + 背景色，图居中）。
 * - 预设与色板（rx2）：宽度 5 档 chips + 6 色快选圆点。
 * - F-导出格式（rx3）：下载行 PNG｜JPG chips + 质量滑杆 + 实时体积（localStorage 记忆）。
 * - 宽度 0 防呆（rx5）：外扩框宽度为 0 时禁用下载并提示。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import ExportBar from './ExportBar.vue'
import { canvasToBlob } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const mode = ref<'expand' | 'canvas'>('expand')
const width = ref(12)
const color = ref('#ffffff')
const maxW = ref(200)
const ratio = ref(1) // 留白画布目标比例 宽/高
const margin = ref(10) // 百分比（每侧）

const WIDTH_PRESETS = [4, 8, 16, 32, 64]
const SWATCHES = ['#ffffff', '#000000', '#e74c3c', '#f1c40f', '#3498db', '#2ecc71']
const RATIOS = [
  { v: 1, t: '1:1' },
  { v: 4 / 5, t: '4:5' },
  { v: 3 / 4, t: '3:4' },
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  maxW.value = Math.max(10, Math.floor(Math.min(c.width, c.height) / 4))
  width.value = Math.min(12, maxW.value)
  render()
}

function render(): HTMLCanvasElement | null {
  const s = src.value
  if (!s) return null
  let out: HTMLCanvasElement
  if (mode.value === 'expand') {
    const bw = Math.max(0, Math.round(width.value))
    out = document.createElement('canvas')
    out.width = s.width + bw * 2
    out.height = s.height + bw * 2
    const ctx = out.getContext('2d')!
    ctx.fillStyle = color.value
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(s, bw, bw)
  } else {
    const r = ratio.value
    let cw: number
    let ch: number
    if (r >= 1) {
      cw = Math.max(s.width, s.height * r)
      ch = cw / r
    } else {
      ch = Math.max(s.height, s.width / r)
      cw = ch * r
    }
    out = document.createElement('canvas')
    out.width = Math.round(cw)
    out.height = Math.round(ch)
    const ctx = out.getContext('2d')!
    ctx.fillStyle = color.value
    ctx.fillRect(0, 0, out.width, out.height)
    // 图片缩至画布的 (1 - 2×margin%) 内接居中
    const k = Math.max(0, Math.min(0.9, 1 - (margin.value / 100) * 2))
    const bw = out.width * k
    const bh = out.height * k
    const sc = Math.min(bw / s.width, bh / s.height)
    const dw = s.width * sc
    const dh = s.height * sc
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(s, (out.width - dw) / 2, (out.height - dh) / 2, dw, dh)
  }
  base.value?.setOutput(out)
  return out
}

async function produce(mime: string, quality: number): Promise<Blob> {
  const c = render()
  if (!c) throw new Error('尚未载入图片')
  return canvasToBlob(c, mime, quality)
}

/** rx5：外扩框宽度为 0 时禁止导出 */
const blocked = computed(() => mode.value === 'expand' && width.value <= 0)

let timer = 0
const debouncedRender = () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
}
watch([width, color, ratio, margin, mode], debouncedRender)
</script>

<template>
  <ImageToolBase ref="base" suffix="-bordered" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">模式</span>
        <span class="row">
          <button class="chip" :class="{ active: mode === 'expand' }" @click="mode = 'expand'">外扩框</button>
          <button class="chip" :class="{ active: mode === 'canvas' }" @click="mode = 'canvas'">留白画布</button>
        </span>
      </label>

      <template v-if="mode === 'expand'">
        <div style="max-width: 340px; min-width: 220px">
          <span class="field-label">边框宽度：{{ width }} px</span>
          <input v-model.number="width" type="range" min="0" :max="maxW" step="1" />
          <div class="row" style="gap: 6px">
            <button v-for="p in WIDTH_PRESETS" :key="p" class="chip" :class="{ active: width === p }" @click="width = Math.min(p, maxW)">
              {{ p }}
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <label class="opt">
          <span class="field-label">目标比例</span>
          <span class="row">
            <button v-for="r in RATIOS" :key="r.t" class="chip" :class="{ active: ratio === r.v }" @click="ratio = r.v">{{ r.t }}</button>
          </span>
        </label>
        <div style="max-width: 300px; min-width: 200px">
          <span class="field-label">边距：{{ margin }}%（每侧）</span>
          <input v-model.number="margin" type="range" min="0" max="30" step="1" />
        </div>
      </template>

      <label class="opt">
        <span class="field-label">{{ mode === 'expand' ? '边框颜色' : '背景色' }}</span>
        <span class="row" style="gap: 6px">
          <button
            v-for="c in SWATCHES"
            :key="c"
            class="dot"
            :class="{ active: color === c }"
            :style="{ background: c }"
            :title="c"
            :aria-label="`选用颜色 ${c}`"
            @click="color = c"
          ></button>
          <input v-model="color" type="color" />
        </span>
      </label>
    </div>

    <p v-if="blocked" class="notice notice-warn mt-2">当前边框宽度为 0，输出与原图相同 —— 拖动滑杆添加边框后再下载。</p>
    <ExportBar
      class="mt-2"
      :formats="['png', 'jpg']"
      :produce="produce"
      :base-name="base?.file ? base.file.name.replace(/\.[^.]+$/, '') : 'image'"
      :dirty-token="`${mode}-${width}-${color}-${ratio}-${margin}`"
      :disabled="blocked"
      disabled-hint="拖动滑杆添加边框"
    />
    <p class="muted small mt-1">
      外扩框：四边对称加纯色边；留白画布：按目标比例铺背景色、图片等比居中（适合电商主图 1:1 / 社媒 4:5）。
    </p>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.dot {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--border-strong, var(--border));
  cursor: pointer;
  padding: 0;
}
.dot.active {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
