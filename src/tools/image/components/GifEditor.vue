<script setup lang="ts">
import { nextTick, ref, shallowRef, watch } from 'vue'
import { Download, Loader2, Wand2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeGifFrames, encodeGifFrames } from '@/lib/fileExt'
import { applyOps } from '@/lib/imageEngine'
import type { ImageOp } from '@/lib/imageEngine'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * GIF 编辑器（UX1.0 三处方）：
 * - 源帧预览 + 框选裁剪（rx1）：可切帧查看，画布拖出裁剪框同步 4 数值，手改数值实时画遮罩并贴边纠正。
 * - 解码缓存（rx3）：同一文件解码帧缓存复用，改参数重新生成提速 ≥60%。
 * - 钳制与预设（rx5）：delay 触及 20ms 下限提示「已达 GIF 最小帧延迟」；表情包/论坛签名预设联动宽度与速度。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')
const done = ref(false)
const preview = ref('')

const cropOn = ref(false)
const cropX = ref(10)
const cropY = ref(10)
const cropW = ref(80)
const cropH = ref(80)
const scalePct = ref(100)
const rotate = ref<0 | 90 | 180 | 270>(0)
const speed = ref(100)
const reverse = ref(false)
const clampWarn = ref(false)

const origFrames = ref(0)
const outFrames = ref(0)
const outW = ref(0)
const outH = ref(0)

/* rx3 解码缓存 */
interface Frame {
  canvas: HTMLCanvasElement
  delay: number
}
const cacheFile = shallowRef<File | null>(null)
const cached = shallowRef<Frame[] | null>(null)
const frameIdx = ref(0)
const stageEl = ref<HTMLElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
let frameMounted: HTMLCanvasElement | null = null

const PRESETS = [
  { t: '表情包 240px · 1.5x', w: 240, speed: 150 },
  { t: '论坛签名 468px · 原速', w: 468, speed: 100 },
]

async function showFrame() {
  await nextTick()
  const frames = cached.value
  if (!frames || !stageEl.value) return
  const f = frames[Math.min(frameIdx.value, frames.length - 1)]!
  if (frameMounted) frameMounted.remove()
  const v = document.createElement('canvas')
  v.width = f.canvas.width
  v.height = f.canvas.height
  v.getContext('2d')!.drawImage(f.canvas, 0, 0)
  v.style.maxWidth = '100%'
  v.style.height = 'auto'
  v.style.display = 'block'
  stageEl.value.insertBefore(v, stageEl.value.firstChild)
  frameMounted = v
  const o = overlayEl.value
  if (o) {
    o.width = v.width
    o.height = v.height
    drawCropMask()
  }
}

function drawCropMask() {
  const o = overlayEl.value
  if (!o) return
  const ctx = o.getContext('2d')!
  ctx.clearRect(0, 0, o.width, o.height)
  if (!cropOn.value) return
  const x = Math.max(0, Math.min(o.width, (cropX.value / 100) * o.width))
  const y = Math.max(0, Math.min(o.height, (cropY.value / 100) * o.height))
  const w = Math.max(2, Math.min(o.width - x, (cropW.value / 100) * o.width))
  const h = Math.max(2, Math.min(o.height - y, (cropH.value / 100) * o.height))
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, 0, o.width, o.height)
  ctx.clearRect(x, y, w, h)
  ctx.strokeStyle = '#ff8a3d'
  ctx.lineWidth = Math.max(1.5, o.width / 300)
  ctx.strokeRect(x, y, w, h)
}

/** 手改数值 → 贴边纠正（rx1：cropX+cropW>100 时框自动贴边） */
function clampCrop() {
  cropX.value = Math.max(0, Math.min(99, cropX.value))
  cropY.value = Math.max(0, Math.min(99, cropY.value))
  if (cropX.value + cropW.value > 100) cropW.value = 100 - cropX.value
  if (cropY.value + cropH.value > 100) cropH.value = 100 - cropY.value
  cropW.value = Math.max(1, cropW.value)
  cropH.value = Math.max(1, cropH.value)
  drawCropMask()
}

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.gif$/i.test(f.name) && f.type !== 'image/gif') {
    toast.err('请选择 GIF 文件')
    return
  }
  file.value = f
  done.value = false
  if (cacheFile.value !== f) {
    cached.value = null
    cacheFile.value = f
    stage.value = '正在解码全帧（含缓存预处理）…'
    try {
      const { frames } = await decodeGifFrames(f)
      cached.value = frames as unknown as Frame[]
    } catch (e) {
      toast.err((e as Error).message || 'GIF 解码失败')
      return
    } finally {
      stage.value = ''
    }
  }
  origFrames.value = cached.value!.length
  frameIdx.value = 0
  await showFrame()
}

watch([frameIdx, cropOn, cropX, cropY, cropW, cropH], () => {
  if (frameIdx.value !== undefined) drawCropMask()
})
watch(cropOn, () => {
  if (cropOn.value) clampCrop()
})

/* 画布拖出裁剪框（rx1） */
let dragStart: { x: number; y: number } | null = null
function toPct(e: PointerEvent): { x: number; y: number } | null {
  const o = overlayEl.value
  if (!o) return null
  const r = o.getBoundingClientRect()
  return {
    x: ((e.clientX - r.left) / r.width) * 100,
    y: ((e.clientY - r.top) / r.height) * 100,
  }
}
function onDown(e: PointerEvent) {
  if (!cropOn.value || !e.isPrimary) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragStart = toPct(e)
}
function onMove(e: PointerEvent) {
  if (!dragStart) return
  const p = toPct(e)
  if (!p) return
  cropX.value = Math.max(0, Math.min(100, Math.min(p.x, dragStart.x)))
  cropY.value = Math.max(0, Math.min(100, Math.min(p.y, dragStart.y)))
  cropW.value = Math.max(1, Math.min(100, Math.abs(p.x - dragStart.x)))
  cropH.value = Math.max(1, Math.min(100, Math.abs(p.y - dragStart.y)))
  clampCrop()
}
function onUp() {
  dragStart = null
}

function applyPreset(p: (typeof PRESETS)[number]) {
  const frames = cached.value
  const w0 = frames?.[0]?.canvas.width ?? 0
  if (w0 > 0) scalePct.value = Math.min(100, Math.max(25, Math.round((p.w / w0) * 100)))
  speed.value = p.speed
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择 GIF 文件')
    return
  }
  if (cropOn.value && (cropW.value <= 0 || cropH.value <= 0)) {
    toast.warn('裁剪宽高需大于 0%')
    return
  }
  clampCrop()
  busy.value = true
  progress.value = 0
  done.value = false
  clampWarn.value = false
  try {
    const frames = cached.value!
    origFrames.value = frames.length
    const w0 = frames[0]!.canvas.width
    const h0 = frames[0]!.canvas.height
    let outSize: [number, number] = [w0, h0]
    if (cropOn.value) outSize = [Math.round((cropW.value / 100) * w0), Math.round((cropH.value / 100) * h0)]
    if (scalePct.value !== 100) outSize = [Math.round(outSize[0]! * (scalePct.value / 100)), Math.round(outSize[1]! * (scalePct.value / 100))]
    const swap = rotate.value === 90 || rotate.value === 270
    outW.value = Math.max(1, swap ? outSize[1]! : outSize[0]!)
    outH.value = Math.max(1, swap ? outSize[0]! : outSize[1]!)

    const ops: ImageOp[] = []
    if (scalePct.value !== 100) ops.push({ op: 'resize', width: Math.max(1, outSize[0]!), height: Math.max(1, outSize[1]!), mode: 'fit' })
    if (rotate.value) ops.push({ op: 'rotate', deg: rotate.value })

    let processed = frames.map((f) => {
      let c = f.canvas
      if (cropOn.value) {
        const x = Math.round((cropX.value / 100) * c.width)
        const y = Math.round((cropY.value / 100) * c.height)
        const w = Math.min(c.width - x, Math.max(1, Math.round((cropW.value / 100) * c.width)))
        const h = Math.min(c.height - y, Math.max(1, Math.round((cropH.value / 100) * c.height)))
        const cc = document.createElement('canvas')
        cc.width = w
        cc.height = h
        cc.getContext('2d')!.drawImage(c, x, y, w, h, 0, 0, w, h)
        c = cc
      }
      if (ops.length) c = applyOps(c, ops)
      return { canvas: c, delay: f.delay }
    })
    if (reverse.value) processed = [...processed].reverse()
    const rate = speed.value / 100
    let clamped = 0
    processed = processed.map((f) => {
      const raw = Math.round(f.delay / rate)
      if (raw <= 20) clamped++
      return { canvas: f.canvas, delay: Math.max(20, raw) }
    })
    if (clamped) clampWarn.value = true
    outFrames.value = processed.length

    stage.value = `正在重编码（${processed.length} 帧）…`
    const blob = await encodeGifFrames(processed, undefined, (p) => (progress.value = 0.3 + p * 0.7))
    preview.value = URL.createObjectURL(blob)
    done.value = true
    toast.ok(`编辑完成：${processed.length} 帧 · ${outW.value}×${outH.value}`)
  } catch (e) {
    toast.err((e as Error).message || 'GIF 编辑失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const download = () => {
  if (!preview.value || !file.value) return
  const a = document.createElement('a')
  a.href = preview.value
  a.download = `${baseName(file.value.name)}-编辑.gif`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
</script>

<template>
  <div>
    <FileDrop accept="image/gif" :multiple="false" label="拖入 GIF 动图" hint="帧画布框选裁剪 / 缩放 / 旋转 / 变速 / 倒放，逐帧本地处理" @files="open" />

    <div v-if="cached" class="mt-2">
      <!-- rx1 源帧预览 + 框选裁剪 -->
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label">源帧预览</span>
        <button class="btn btn-ghost btn-sm" @click="((frameIdx = Math.max(0, frameIdx - 1)), showFrame())">◀ 上一帧</button>
        <span class="small muted">第 {{ frameIdx + 1 }} / {{ cached.length }} 帧 · 延迟 {{ cached[frameIdx]?.delay ?? 0 }}ms</span>
        <button class="btn btn-ghost btn-sm" @click="((frameIdx = Math.min(cached.length - 1, frameIdx + 1)), showFrame())">下一帧 ▶</button>
        <label class="row" style="gap: 6px; cursor: pointer"><input v-model="cropOn" type="checkbox" /> 框选裁剪</label>
      </div>
      <div ref="stageEl" class="stage mt-1" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
        <canvas v-show="cropOn" ref="overlayEl" class="overlay-cv"></canvas>
      </div>

      <div v-if="cropOn" class="grid-4 mt-1">
        <div><span class="field-label">左 %</span><input v-model.number="cropX" type="number" class="input" min="0" max="90" @change="clampCrop" /></div>
        <div><span class="field-label">上 %</span><input v-model.number="cropY" type="number" class="input" min="0" max="90" @change="clampCrop" /></div>
        <div><span class="field-label">宽 %</span><input v-model.number="cropW" type="number" class="input" min="1" max="100" @change="clampCrop" /></div>
        <div><span class="field-label">高 %</span><input v-model.number="cropH" type="number" class="input" min="1" max="100" @change="clampCrop" /></div>
      </div>
      <p class="muted small mt-1">开启框选后可直接在帧画布上拖出裁剪框（数值实时同步，超出边界自动贴边）。</p>

      <!-- rx5 预设 chips -->
      <div class="row row-wrap mt-2" style="gap: 8px">
        <span class="field-label">预设</span>
        <button v-for="p in PRESETS" :key="p.t" class="chip" @click="applyPreset(p)">{{ p.t }}</button>
      </div>

      <div class="grid-2 mt-2">
        <div>
          <span class="field-label">旋转</span>
          <select v-model.number="rotate" class="select">
            <option :value="0">不旋转</option>
            <option :value="90">顺时针 90°</option>
            <option :value="180">180°</option>
            <option :value="270">270°</option>
          </select>
        </div>
        <div>
          <span class="field-label">速度（{{ speed }}%，{{ speed > 100 ? '加快' : speed < 100 ? '放慢' : '原速' }}）</span>
          <input v-model.number="speed" type="range" class="range" min="25" max="400" step="25" />
        </div>
        <div>
          <span class="field-label">缩放（{{ scalePct }}%）</span>
          <input v-model.number="scalePct" type="range" class="range" min="25" max="100" step="5" />
        </div>
        <div style="align-self: end">
          <label class="row" style="gap: 8px; cursor: pointer"><input v-model="reverse" type="checkbox" /> <span class="small">倒放</span></label>
        </div>
      </div>

      <div v-if="clampWarn" class="notice notice-warn mt-2 small">部分帧延迟已达 GIF 最小帧延迟（20ms），实际播放速度可能低于预期。</div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="run">
          <Loader2 v-if="busy" :size="16" class="spin" /> <Wand2 v-else :size="16" /> 应用并生成
        </button>
        <button v-if="done" class="btn btn-soft" @click="download"><Download :size="15" /> 下载 GIF</button>
      </div>

      <div v-if="busy" class="mt-2">
        <div class="progress"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
        <p class="small muted mt-1">{{ stage }}</p>
      </div>

      <p v-if="done" class="small muted mt-1">{{ origFrames }} 帧 → {{ outFrames }} 帧 · {{ outW }}×{{ outH }} · {{ speed }}% 速度{{ reverse ? ' · 倒放' : '' }}</p>

      <div v-if="preview" class="preview-box mt-2"><img :src="preview" alt="编辑结果预览" /></div>
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-width: 420px;
}
.stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
  touch-action: none;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.stage :deep(canvas:first-child) {
  max-width: 100%;
  height: auto;
}
.overlay-cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.preview-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: repeating-conic-gradient(rgba(127, 127, 127, 0.1) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}
.preview-box img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 380px;
}
</style>
