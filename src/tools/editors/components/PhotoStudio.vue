<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  SlidersHorizontal, Sparkles, Type as TypeIcon, Crop, Brush, Download, Loader2, RotateCcw, Plus, Trash2,
} from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { applyOps, canvasToBlob, fileToCanvas, type ImageOp } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 照片工作台：调整管线 + 滤镜 + 文字图层 + 裁剪 + 画笔涂抹 + 导出。
 * 状态：ops 管线 + 文字图层 + 涂抹层，任何变化防抖重渲染。
 */
interface TextLayer {
  id: number
  text: string
  size: number
  color: string
  x: number // 0-1 相对
  y: number
}

const toast = useToast()
const steps = ['打开照片', '调整 / 滤镜 / 文字', '导出成品']

const base = ref<HTMLCanvasElement | null>(null) // 当前底图（可能已裁剪）
const original = ref<HTMLCanvasElement | null>(null) // 原始底图
const paint = ref<HTMLCanvasElement | null>(null) // 涂抹层（与底图同尺寸）
const fileName = ref('photo')

const tab = ref<'adjust' | 'filter' | 'text' | 'crop' | 'brush' | 'export'>('adjust')
const tabs = [
  { v: 'adjust', label: '调整', icon: SlidersHorizontal },
  { v: 'filter', label: '滤镜', icon: Sparkles },
  { v: 'text', label: '文字', icon: TypeIcon },
  { v: 'crop', label: '裁剪', icon: Crop },
  { v: 'brush', label: '画笔', icon: Brush },
  { v: 'export', label: '导出', icon: Download },
] as const

// 调整参数
const brightness = ref(0)
const contrast = ref(0)
const saturate = ref(0)
const sharpen = ref(0)
const blur = ref(0)
// 滤镜
const filter = ref('none')
const filters: { v: string; label: string; ops: ImageOp[] }[] = [
  { v: 'none', label: '原图', ops: [] },
  { v: 'bw', label: '黑白', ops: [{ op: 'grayscale', intensity: 1 }] },
  { v: 'sepia', label: '怀旧', ops: [{ op: 'sepia', intensity: 0.7 }] },
  { v: 'vintage', label: '复古', ops: [{ op: 'sepia', intensity: 0.4 }, { op: 'saturate', value: -10 }, { op: 'contrast', value: 10 }] },
  { v: 'cool', label: '冷调', ops: [{ op: 'saturate', value: -15 }, { op: 'brightness', value: 5 }] },
  { v: 'warm', label: '暖调', ops: [{ op: 'sepia', intensity: 0.2 }, { op: 'saturate', value: 20 }] },
  { v: 'drama', label: '戏剧', ops: [{ op: 'contrast', value: 25 }, { op: 'saturate', value: -10 }] },
  { v: 'soft', label: '柔焦', ops: [{ op: 'blur', radius: 1 }, { op: 'brightness', value: 8 }] },
]
// 文字
const textLayers = ref<TextLayer[]>([])
const selectedText = ref<number | null>(null)
const placingText = ref(false)
// 裁剪
const cropRatio = ref('free')
const cropOptions = [
  { v: 'free', label: '自由（原比例）' },
  { v: '1', label: '1:1 方形' },
  { v: '4/3', label: '4:3' },
  { v: '3/2', label: '3:2' },
  { v: '16/9', label: '16:9' },
]
// 画笔
const brushColor = ref('#ff2d55')
const brushSize = ref(18)
const painting = ref(false)
// 导出
const outFormat = ref<'png' | 'jpeg' | 'webp'>('png')
const outQuality = ref(0.92)
const outName = ref('成品图')

const display = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
let renderTimer: number | null = null
let seq = 1

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    const c = await fileToCanvas(f)
    original.value = c
    base.value = c
    const p = document.createElement('canvas')
    p.width = c.width
    p.height = c.height
    paint.value = p
    fileName.value = f.name.replace(/\.[^.]+$/, '')
    outName.value = fileName.value
    resetEdits()
    render()
    toast.ok(`已载入 ${c.width}×${c.height}`)
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  } finally {
    loading.value = false
  }
}

const resetEdits = () => {
  brightness.value = 0
  contrast.value = 0
  saturate.value = 0
  sharpen.value = 0
  blur.value = 0
  filter.value = 'none'
  textLayers.value = []
  selectedText.value = null
  if (paint.value && base.value) {
    paint.value.width = base.value.width
    paint.value.height = base.value.height
  }
}

const resetAll = () => {
  if (!original.value) return
  base.value = original.value
  resetEdits()
  render()
  toast.toast('已重置全部编辑')
}

const buildOps = (): ImageOp[] => {
  const ops: ImageOp[] = []
  if (brightness.value) ops.push({ op: 'brightness', value: brightness.value })
  if (contrast.value) ops.push({ op: 'contrast', value: contrast.value })
  if (saturate.value) ops.push({ op: 'saturate', value: saturate.value })
  if (sharpen.value) ops.push({ op: 'sharpen', amount: sharpen.value })
  if (blur.value) ops.push({ op: 'blur', radius: blur.value })
  const f = filters.find((x) => x.v === filter.value)
  if (f) ops.push(...f.ops)
  return ops
}

/** 全量渲染：底图 → ops → 涂抹 → 文字 → 显示画布 */
const render = () => {
  if (!base.value || !display.value) return
  let c = applyOps(base.value, buildOps())
  if (paint.value) {
    const ctx = c.getContext('2d')!
    ctx.drawImage(paint.value, 0, 0)
  }
  const ctx = c.getContext('2d')!
  for (const t of textLayers.value) {
    ctx.font = `${t.size}px 'PingFang SC','Microsoft YaHei',sans-serif`
    ctx.fillStyle = t.color
    ctx.textBaseline = 'top'
    ctx.fillText(t.text, t.x * c.width, t.y * c.height)
  }
  const d = display.value
  d.width = c.width
  d.height = c.height
  d.getContext('2d')!.drawImage(c, 0, 0)
}

const scheduleRender = () => {
  if (renderTimer) window.clearTimeout(renderTimer)
  renderTimer = window.setTimeout(render, 120)
}

/* ---------- 文字图层 ---------- */
const addText = () => {
  const id = seq++
  textLayers.value.push({ id, text: '双击编辑文字', size: 32, color: '#ffffff', x: 0.08, y: 0.08 })
  selectedText.value = id
  placingText.value = true
}

const removeText = (id: number) => {
  textLayers.value = textLayers.value.filter((t) => t.id !== id)
  if (selectedText.value === id) selectedText.value = null
  render()
}

const selectedLayer = computed(() => textLayers.value.find((t) => t.id === selectedText.value) ?? null)

const onStageClick = (e: PointerEvent) => {
  const d = display.value
  if (!d) return
  const r = d.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  if (placingText.value && selectedLayer.value) {
    selectedLayer.value.x = x
    selectedLayer.value.y = y
    placingText.value = false
    render()
  }
}

/* ---------- 裁剪 ---------- */
const applyCrop = () => {
  const b = base.value
  if (!b) return
  let ratio = b.width / b.height
  if (cropRatio.value !== 'free') {
    const [w, h] = cropRatio.value.split('/').map(Number)
    if (w > 0 && h > 0) ratio = w / h
  }
  let cw = b.width
  let ch = b.height
  if (cropRatio.value !== 'free') {
    if (b.width / b.height > ratio) cw = Math.round(b.height * ratio)
    else ch = Math.round(b.width / ratio)
  }
  const cx = Math.round((b.width - cw) / 2)
  const cy = Math.round((b.height - ch) / 2)
  const nb = document.createElement('canvas')
  nb.width = cw
  nb.height = ch
  nb.getContext('2d')!.drawImage(b, cx, cy, cw, ch, 0, 0, cw, ch)
  // 涂抹层与文字坐标同步裁剪
  if (paint.value) {
    const np = document.createElement('canvas')
    np.width = cw
    np.height = ch
    np.getContext('2d')!.drawImage(paint.value, cx, cy, cw, ch, 0, 0, cw, ch)
    paint.value = np
  }
  for (const t of textLayers.value) {
    t.x = Math.min(1, Math.max(0, (t.x * b.width - cx) / cw))
    t.y = Math.min(1, Math.max(0, (t.y * b.height - cy) / ch))
  }
  base.value = nb
  render()
  toast.ok(`已裁剪为 ${cw}×${ch}`)
}

/* ---------- 画笔 ---------- */
const toImgCoords = (e: PointerEvent): [number, number] | null => {
  const d = display.value
  if (!d) return null
  const r = d.getBoundingClientRect()
  return [((e.clientX - r.left) / r.width) * d.width, ((e.clientY - r.top) / r.height) * d.height]
}

let lastPt: [number, number] | null = null

const brushDown = (e: PointerEvent) => {
  if (tab.value !== 'brush' || !paint.value) return
  painting.value = true
  lastPt = toImgCoords(e)
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

const brushMove = (e: PointerEvent) => {
  if (!painting.value || !paint.value || !display.value) return
  const pt = toImgCoords(e)
  if (!pt) return
  const ctx = paint.value.getContext('2d')!
  ctx.strokeStyle = brushColor.value
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastPt?.[0] ?? pt[0], lastPt?.[1] ?? pt[1])
  ctx.lineTo(pt[0], pt[1])
  ctx.stroke()
  lastPt = pt
  // 增量绘制到显示画布，避免全量重渲染
  const dctx = display.value.getContext('2d')!
  dctx.drawImage(paint.value, 0, 0)
}

const brushUp = () => {
  if (painting.value) {
    painting.value = false
    lastPt = null
  }
}

const clearPaint = () => {
  if (!paint.value || !base.value) return
  paint.value.getContext('2d')!.clearRect(0, 0, base.value.width, base.value.height)
  render()
}

/* ---------- 导出 ---------- */
const doExport = async () => {
  const d = display.value
  if (!d) {
    toast.warn('请先载入照片')
    return
  }
  try {
    const mime = `image/${outFormat.value}`
    const blob = await canvasToBlob(d, mime, outQuality.value)
    saveBlob(blob, `${outName.value}.${outFormat.value === 'jpeg' ? 'jpg' : outFormat.value}`)
    toast.ok('已导出')
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  }
}

onBeforeUnmount(() => {
  if (renderTimer) window.clearTimeout(renderTimer)
})
</script>

<template>
  <div class="studio">
    <div class="steps row row-wrap">
      <span v-for="(s, i) in steps" :key="i" class="step"><b class="step-n">{{ i + 1 }}</b> {{ s }}<span v-if="i < steps.length - 1" class="step-arrow">→</span></span>
    </div>

    <FileDrop v-if="!base" accept="image/*" :multiple="false" label="拖放照片，或点击选择" @files="onFiles" />
    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解码图片…</div>

    <template v-if="base">
      <div class="layout">
        <!-- 左：工具 Tab -->
        <nav class="tool-col">
          <button v-for="t in tabs" :key="t.v" class="tool-btn" :class="{ active: tab === t.v }" @click="tab = t.v">
            <component :is="t.icon" :size="15" /> {{ t.label }}
          </button>
          <button class="tool-btn reset" @click="resetAll"><RotateCcw :size="15" /> 重置</button>
        </nav>

        <!-- 中：画布 -->
        <div class="canvas-col">
          <canvas
            ref="display"
            class="stage"
            @click="onStageClick"
            @pointerdown="brushDown"
            @pointermove="brushMove"
            @pointerup="brushUp"
            @pointerleave="brushUp"
          ></canvas>
          <p class="muted small center">{{ base.width }} × {{ base.height }}<span v-if="placingText"> · 点击画面定位文字</span><span v-else-if="tab === 'brush'"> · 在画面上涂抹</span></p>
        </div>

        <!-- 右：属性 -->
        <aside class="props">
          <template v-if="tab === 'adjust'">
            <label class="p-row">
              <span class="p-label">亮度 {{ brightness }}</span>
              <input v-model.number="brightness" type="range" min="-100" max="100" @input="scheduleRender" />
            </label>
            <label class="p-row">
              <span class="p-label">对比度 {{ contrast }}</span>
              <input v-model.number="contrast" type="range" min="-100" max="100" @input="scheduleRender" />
            </label>
            <label class="p-row">
              <span class="p-label">饱和度 {{ saturate }}</span>
              <input v-model.number="saturate" type="range" min="-100" max="100" @input="scheduleRender" />
            </label>
            <label class="p-row">
              <span class="p-label">锐化 {{ sharpen }}</span>
              <input v-model.number="sharpen" type="range" min="0" max="100" @input="scheduleRender" />
            </label>
            <label class="p-row">
              <span class="p-label">模糊 {{ blur }}px</span>
              <input v-model.number="blur" type="range" min="0" max="12" @input="scheduleRender" />
            </label>
          </template>
          <template v-else-if="tab === 'filter'">
            <div class="f-grid">
              <button v-for="f in filters" :key="f.v" class="f-btn" :class="{ active: filter === f.v }" @click="filter = f.v; render()">
                {{ f.label }}
              </button>
            </div>
          </template>
          <template v-else-if="tab === 'text'">
            <button class="btn btn-primary btn-sm" @click="addText"><Plus :size="14" /> 添加文字</button>
            <div v-for="t in textLayers" :key="t.id" class="layer" :class="{ sel: selectedText === t.id }" @click="selectedText = t.id">
              <input v-model="t.text" class="input" placeholder="文字内容" @input="render" />
              <div class="row" style="gap: 6px">
                <input v-model.number="t.size" type="number" min="8" max="400" class="input" style="width: 72px" title="字号 px" @input="render" />
                <input v-model="t.color" type="color" @input="render" />
                <button class="mini danger" title="删除图层" @click="removeText(t.id)"><Trash2 :size="12" /></button>
              </div>
              <div class="row small muted" style="gap: 6px">
                X <input v-model.number="t.x" type="number" min="0" max="1" step="0.01" class="input" style="width: 70px" @input="render" />
                Y <input v-model.number="t.y" type="number" min="0" max="1" step="0.01" class="input" style="width: 70px" @input="render" />
              </div>
              <button v-if="selectedText === t.id" class="btn btn-ghost btn-sm" @click="placingText = true">点击画面重新定位</button>
            </div>
            <p v-if="!textLayers.length" class="muted small">还没有文字图层。</p>
          </template>
          <template v-else-if="tab === 'crop'">
            <label class="p-row">
              <span class="p-label">比例</span>
              <select v-model="cropRatio" class="select">
                <option v-for="o in cropOptions" :key="o.v" :value="o.v">{{ o.label }}</option>
              </select>
            </label>
            <button class="btn btn-primary btn-sm" @click="applyCrop">应用裁剪（居中最大区域）</button>
          </template>
          <template v-else-if="tab === 'brush'">
            <label class="p-row">
              <span class="p-label">颜色</span>
              <input v-model="brushColor" type="color" />
            </label>
            <label class="p-row">
              <span class="p-label">粗细 {{ brushSize }}px</span>
              <input v-model.number="brushSize" type="range" min="2" max="80" />
            </label>
            <button class="btn btn-ghost btn-sm" @click="clearPaint">清除涂抹</button>
          </template>
          <template v-else>
            <label class="p-row">
              <span class="p-label">格式</span>
              <select v-model="outFormat" class="select">
                <option value="png">PNG（无损）</option>
                <option value="jpeg">JPG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <label v-if="outFormat !== 'png'" class="p-row">
              <span class="p-label">质量 {{ Math.round(outQuality * 100) }}%</span>
              <input v-model.number="outQuality" type="range" min="0.3" max="1" step="0.02" />
            </label>
            <label class="p-row">
              <span class="p-label">文件名</span>
              <input v-model="outName" class="input" />
            </label>
            <button class="btn btn-primary btn-sm" @click="doExport"><Download :size="14" /> 导出图片</button>
          </template>
        </aside>
      </div>
    </template>
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
.steps {
  gap: 14px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-2);
}
.step-n {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
}
.step-arrow {
  color: var(--text-3);
  margin-left: 8px;
}
.layout {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 250px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.tool-col {
  display: grid;
  gap: 6px;
}
.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: none;
  color: var(--text-2);
  font-size: 13.5px;
  cursor: pointer;
}
.tool-btn:hover {
  border-color: var(--accent);
}
.tool-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.tool-btn.reset {
  color: var(--warn);
  border-color: color-mix(in srgb, var(--warn) 35%, transparent);
}
.canvas-col {
  min-width: 0;
}
.stage {
  width: 100%;
  max-height: 68vh;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    repeating-conic-gradient(color-mix(in srgb, var(--text-3) 8%, transparent) 0 25%, transparent 0 50%) 0 0 / 20px 20px;
  cursor: crosshair;
}
.center {
  text-align: center;
}
.props {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  display: grid;
  gap: 12px;
  align-content: start;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
}
.p-row {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.p-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}
.f-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.f-btn {
  padding: 9px 6px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: none;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}
.f-btn:hover {
  border-color: var(--accent);
}
.f-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.layer {
  display: grid;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
}
.layer.sel {
  border-color: var(--accent);
}
.mini {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
}
.mini.danger:hover {
  border-color: var(--err);
  color: var(--err);
}
</style>
