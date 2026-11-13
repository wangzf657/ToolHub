<script setup lang="ts">
/**
 * 调整图片尺寸（UX1.0）：
 * - F-质量实时（rx1/P0）：导出行 PNG｜JPG｜WebP chips + 质量滑杆 + 防抖实时体积（localStorage 记忆）。
 * - 预设与百分比（rx3）：50%｜25%｜1920 宽｜1080 宽｜1080×1080 一键填入并联动锁比例。
 * - 体积对比徽章（rx4）：原 W×H · X KB → 新 W×H · Y KB（±Z%）。
 * - 阶梯降采样（rx5）：缩小 >2 倍时逐半降采样并叠加轻度锐化，边缘更清晰。
 * 预览/导出均全分辨率（缩放本身即降采样，预览随参数重算）。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import ExportBar from './ExportBar.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const fileBlob = ref<File | null>(null)
const width = ref(0)
const height = ref(0)
const lock = ref(true)
const mode = ref<'stretch' | 'fit' | 'cover'>('stretch')
const outSize = ref(0)
const outCanvas = shallowRef<HTMLCanvasElement | null>(null)

const MODES = [
  { v: 'stretch' as const, t: '拉伸' },
  { v: 'fit' as const, t: '适应' },
  { v: 'cover' as const, t: '裁满' },
]
const PRESETS = [
  { t: '50%', w: () => Math.round((src.value?.width ?? 0) * 0.5) },
  { t: '25%', w: () => Math.round((src.value?.width ?? 0) * 0.25) },
  { t: '1920 宽', w: () => 1920 },
  { t: '1080 宽', w: () => 1080 },
  { t: '1080×1080', w: () => 1080, square: true },
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  fileBlob.value = base.value?.file ?? null
  width.value = c.width
  height.value = c.height
  render()
}

let syncing = false
watch(width, (w) => {
  if (lock.value && src.value && !syncing && w > 0) {
    syncing = true
    height.value = Math.max(1, Math.round((w * src.value.height) / src.value.width))
    syncing = false
  }
})
watch(height, (h) => {
  if (lock.value && src.value && !syncing && h > 0) {
    syncing = true
    width.value = Math.max(1, Math.round((h * src.value.width) / src.value.height))
    syncing = false
  }
})

/** 阶梯降采样（rx5）：缩小比例 >2 倍时逐半缩，末档后叠加轻度锐化 */
function render(): HTMLCanvasElement | null {
  const s = src.value
  if (!s || !width.value || !height.value) return null
  const shrink = Math.max(s.width / width.value, s.height / height.value)
  let cur = s
  if (shrink > 2) {
    let w = s.width
    let h = s.height
    while (w / 2 >= width.value && h / 2 >= height.value && w > 2 && h > 2) {
      w = Math.max(1, Math.round(w / 2))
      h = Math.max(1, Math.round(h / 2))
      cur = applyOps(cur, [{ op: 'resize', width: w, height: h }])
    }
    cur = applyOps(cur, [
      { op: 'resize', width: width.value, height: height.value, mode: mode.value },
      { op: 'sharpen', amount: 12 },
    ])
  } else {
    cur = applyOps(cur, [{ op: 'resize', width: width.value, height: height.value, mode: mode.value }])
  }
  outCanvas.value = cur
  base.value?.setOutput(cur)
  return cur
}

function applyPreset(p: (typeof PRESETS)[number]) {
  width.value = Math.max(1, p.w())
  if (p.square) {
    lock.value = false
    height.value = 1080
  }
  render()
}

/** ExportBar 编码入口：按当前参数从原图重出（导出与预览一致） */
async function produce(mime: string, quality: number): Promise<Blob> {
  const c = outCanvas.value ?? render()
  if (!c) throw new Error('尚未载入图片')
  const { canvasToBlob } = await import('@/lib/imageEngine')
  return canvasToBlob(c, mime, quality)
}

const dirtyToken = computed(() => `${width.value}x${height.value}-${mode.value}`)
const srcKB = computed(() => (fileBlob.value ? fileBlob.value.size : 0))
const fmtKB = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const delta = computed(() => {
  if (!outSize.value || !srcKB.value) return ''
  const pct = Math.round((outSize.value / srcKB.value - 1) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
})

let timer = 0
watch([width, height, mode], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-resized" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">宽度（px）</span>
        <input v-model.number="width" type="number" min="1" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">高度（px）</span>
        <input v-model.number="height" type="number" min="1" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">缩放模式</span>
        <span class="row" style="flex-wrap: wrap">
          <button v-for="m in MODES" :key="m.v" class="chip" :class="{ active: mode === m.v }" @click="mode = m.v">
            {{ m.t }}
          </button>
        </span>
      </label>
      <label class="check" style="margin-top: 20px"><input v-model="lock" type="checkbox" /> 锁定宽高比</label>
    </div>

    <div class="row row-wrap mt-1" style="gap: 6px">
      <span class="muted small">预设：</span>
      <button v-for="p in PRESETS" :key="p.t" class="chip" @click="applyPreset(p)">{{ p.t }}</button>
    </div>

    <p v-if="src && outCanvas" class="badge mt-2">
      原 {{ src.width }}×{{ src.height }} · {{ fmtKB(srcKB) }}
      → 新 {{ outCanvas.width }}×{{ outCanvas.height }}<template v-if="outSize"> · {{ fmtKB(outSize) }}（{{ delta }}）</template>
    </p>

    <ExportBar
      class="mt-2"
      :produce="produce"
      :base-name="fileBlob ? fileBlob.name.replace(/\.[^.]+$/, '') : 'image'"
      :dirty-token="dirtyToken"
      @measured="(n) => (outSize = n)"
    />
    <p class="muted small mt-1">
      适应：完整放入目标画布（留白）；裁满：填满目标画布并居中裁切；拉伸：强制变形到目标尺寸。大幅缩小会自动逐级降采样并轻度锐化，边缘更清晰。
    </p>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.badge {
  font-size: 13px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 10px;
  display: inline-block;
}
</style>
