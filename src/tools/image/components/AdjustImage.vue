<script setup lang="ts">
/**
 * 图片调整基座（grayscale-image / invert-image / adjust-brightness 三个 slug 共用）：
 * - 主参数置顶（UX1.0 P0）：黑白化首屏第一杆=黑白强度、反相第一杆=反相强度，其余收进「微调」折叠区。
 * - 默认即生效：黑白化/反相载入图片后主参数自动置 100，300ms 内出全黑白/负片预览。
 * - 亮度直方图（adjust-brightness）：随参数刷新，右缘可见削顶。
 * - 预览降采样：预览用 ≤2000px 副本实时渲染，导出走原图全分辨率（produceBlob）。
 */
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Undo2 } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps, canvasToBlob, type ImageOp } from '@/lib/imageEngine'

const route = useRoute()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
/** 预览副本（≤2000px），大图拖杆不卡 */
const previewSrc = shallowRef<HTMLCanvasElement | null>(null)
const histo = ref<HTMLCanvasElement | null>(null)

type Key = 'brightness' | 'contrast' | 'saturate' | 'gray' | 'invert'
const values = reactive<Record<Key, number>>({ brightness: 0, contrast: 0, saturate: 0, gray: 0, invert: 0 })

const mode = computed<'grayscale' | 'invert' | 'adjust'>(() => {
  const s = String(route.params.slug || '')
  if (s === 'grayscale-image') return 'grayscale'
  if (s === 'invert-image') return 'invert'
  return 'adjust'
})

const SLIDERS: { key: Key; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: '亮度', min: -100, max: 100 },
  { key: 'contrast', label: '对比度', min: -100, max: 100 },
  { key: 'saturate', label: '饱和度', min: -100, max: 100 },
  { key: 'gray', label: '黑白强度', min: 0, max: 100 },
  { key: 'invert', label: '反相强度', min: 0, max: 100 },
]
const primaryKey = computed<Key>(() => (mode.value === 'grayscale' ? 'gray' : mode.value === 'invert' ? 'invert' : 'brightness'))
const primary = computed(() => SLIDERS.find((s) => s.key === primaryKey.value)!)
const secondary = computed(() => SLIDERS.filter((s) => s.key !== primaryKey.value))
const tuneSummary = computed(() => `${secondary.value.map((s) => s.label).join(' / ')}（当前默认值）`)

/** 反相预设档位（invert-image 处方 4） */
function preset(kind: 'neg' | 'cross') {
  if (kind === 'neg') {
    values.invert = 100
    values.gray = 0
  } else {
    values.invert = 100
    values.gray = 100
  }
  render()
}

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  // 预览副本：长边 ≤2000px
  const long = Math.max(c.width, c.height)
  if (long > 2000) {
    const r = 2000 / long
    previewSrc.value = applyOps(c, [{ op: 'resize', width: Math.round(c.width * r), height: Math.round(c.height * r) }])
  } else {
    previewSrc.value = c
  }
  // 默认即生效：黑白化载入即全黑白、反相载入即负片
  values.gray = mode.value === 'grayscale' ? 100 : 0
  values.invert = mode.value === 'invert' ? 100 : 0
  render()
}

function buildOps(): ImageOp[] {
  const ops: ImageOp[] = []
  if (values.brightness !== 0) ops.push({ op: 'brightness', value: values.brightness })
  if (values.contrast !== 0) ops.push({ op: 'contrast', value: values.contrast })
  if (values.saturate !== 0) ops.push({ op: 'saturate', value: values.saturate })
  if (values.gray > 0) ops.push({ op: 'grayscale', intensity: values.gray / 100 })
  if (values.invert > 0) ops.push({ op: 'invert', intensity: values.invert / 100 })
  return ops
}

function render() {
  if (!previewSrc.value) return
  const ops = buildOps()
  const out = ops.length ? applyOps(previewSrc.value, ops) : null
  base.value?.setOutput(out)
  drawHisto(out ?? previewSrc.value)
}

/** 亮度直方图（adjust-brightness 处方 2）：480px 缩样统计亮度，随参数刷新 */
function drawHisto(c: HTMLCanvasElement) {
  if (mode.value !== 'adjust' || !histo.value) return
  const t = document.createElement('canvas')
  t.width = 240
  t.height = Math.max(1, Math.round((c.height / c.width) * 240))
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height)
  const d = t.getContext('2d')!.getImageData(0, 0, t.width, t.height).data
  const bins = new Array<number>(256).fill(0)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) continue
    bins[Math.min(255, Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]))]++
  }
  const max = Math.max(...bins, 1)
  const ctx = histo.value.getContext('2d')!
  const W = (histo.value.width = 480)
  const H = (histo.value.height = 120)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = getComputedStyle(histo.value).color || '#888'
  const bw = W / 256
  for (let i = 0; i < 256; i++) {
    const h = (bins[i]! / max) * (H - 4)
    ctx.fillRect(i * bw, H - h, Math.max(1, bw - 0.5), h)
  }
}

/** 导出走原图全分辨率（预览降采样不影响导出画质） */
async function produceFull(): Promise<Blob> {
  if (!src.value) throw new Error('尚未载入图片')
  const ops = buildOps()
  const out = ops.length ? applyOps(src.value, ops) : src.value
  return canvasToBlob(out, 'image/png')
}

function resetAll() {
  for (const k of Object.keys(values) as Key[]) values[k] = 0
  render()
}

let timer = 0
watch(values, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
watch(mode, () => resetAll())
</script>

<template>
  <ImageToolBase ref="base" :produce-blob="produceFull" @loaded="onLoaded">
    <div v-if="mode === 'adjust'" class="histo-wrap mt-2">
      <span class="field-label">亮度直方图（随参数实时刷新）</span>
      <canvas ref="histo" class="histo" aria-label="亮度直方图"></canvas>
    </div>
    <div class="sliders mt-2">
      <label>
        <span class="field-label">{{ primary.label }} {{ values[primaryKey] }}{{ primaryKey === 'brightness' || primaryKey === 'contrast' ? '' : '%' }}</span>
        <input v-model.number="values[primaryKey]" type="range" :min="primary.min" :max="primary.max" />
      </label>
      <details class="tune">
        <summary>微调：{{ tuneSummary }}</summary>
        <label v-for="s in secondary" :key="s.key">
          <span class="field-label">{{ s.label }} {{ values[s.key] }}{{ s.key === 'brightness' || s.key === 'contrast' ? '' : '%' }}</span>
          <input v-model.number="values[s.key]" type="range" :min="s.min" :max="s.max" />
        </label>
      </details>
    </div>
    <div class="row row-wrap mt-1">
      <button v-if="mode === 'invert'" class="chip" @click="preset('neg')">标准负片</button>
      <button v-if="mode === 'invert'" class="chip" @click="preset('cross')">正片负冲（黑白+反相）</button>
      <button class="btn btn-ghost btn-sm" @click="resetAll"><Undo2 :size="14" /> 重置全部滑杆</button>
      <span class="muted small">
        {{ mode === 'adjust' ? '黑白 / 反相在「微调」中，拖到 0 即保持原色' : '拖动主滑杆即时预览，导出保持原图分辨率' }}
      </span>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.histo-wrap {
  display: grid;
  gap: 4px;
  max-width: 480px;
}
.histo {
  width: 100%;
  height: 120px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-solid);
}
.sliders {
  display: grid;
  gap: 10px;
  max-width: 480px;
}
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
.tune label {
  display: grid;
  gap: 4px;
  margin-top: 10px;
}
</style>
