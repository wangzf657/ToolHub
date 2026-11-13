<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  SlidersHorizontal, Sparkles, Type as TypeIcon, Crop, Brush, Download, Loader2, RotateCcw, Plus, Trash2, Undo2, Redo2,
} from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import CropOverlay from './studio/CropOverlay.vue'
import { usePhotoUndo } from './studio/photoUndo'
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
// 滤镜（rx6：选中滤镜后出现强度滑条）
const filter = ref('none')
const filterIntensity = ref(1)
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

/** rx6 滤镜切换（入撤销栈） */
const setFilter = (v: string) => {
  if (filter.value === v) return
  capture()
  filter.value = v
  render()
  scheduleEstimate()
}

const display = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
let renderTimer: number | null = null
let seq = 1

// rx2 前后对比（按住显示原图）
const comparing = ref(false)
watch(comparing, () => render())

/* ---------- rx1 撤销栈（覆盖 裁剪/重置/滤镜/文字增删/涂抹·清除 五类，上限 20 步） ---------- */
const undo = usePhotoUndo({
  base: () => base.value,
  paint: () => paint.value,
  adj: () => [brightness.value, contrast.value, saturate.value, sharpen.value, blur.value],
  filter: () => filter.value,
  fi: () => filterIntensity.value,
  texts: () => textLayers.value,
  restore: (s) => {
    ;[brightness.value, contrast.value, saturate.value, sharpen.value, blur.value] = s.adj
    filter.value = s.filter
    filterIntensity.value = s.fi
    textLayers.value = s.texts.map((t) => ({ ...t }))
    base.value = s.base
    if (s.paint) {
      if (!paint.value) paint.value = document.createElement('canvas')
      paint.value.width = s.paint.width
      paint.value.height = s.paint.height
      paint.value.getContext('2d')!.clearRect(0, 0, paint.value.width, paint.value.height)
      paint.value.getContext('2d')!.drawImage(s.paint, 0, 0)
    }
    cropSel.value = null
    render()
  },
  toastOk: (m) => toast.ok(m),
})
const undoStack = undo.stack
const capture = undo.capture
const doUndo = undo.doUndo
const doRedo = undo.doRedo
onBeforeUnmount(undo.installKeys())
// rx5 裁剪选区与画布显示尺寸
const cropSel = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
const viewSize = ref({ w: 0, h: 0 })

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    const c = await fileToCanvas(f)
    original.value = c
    base.value = c
    undoStack.reset()
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
  capture()
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
  // rx6 滤镜强度：滤镜各参数按强度系数缩放（0~100%）
  const f = filters.find((x) => x.v === filter.value)
  if (f && filterIntensity.value < 1) {
    const k = filterIntensity.value
    ops.push(
      ...f.ops.map((o) => {
        const c2 = { ...o } as ImageOp & { intensity?: number; value?: number; radius?: number }
        if (c2.intensity !== undefined) c2.intensity = c2.intensity * k
        if (c2.value !== undefined) c2.value = Math.round(c2.value * k)
        if (c2.radius !== undefined) c2.radius = Math.max(0.2, c2.radius * k)
        return c2
      }),
    )
  } else if (f) {
    ops.push(...f.ops)
  }
  return ops
}

/** 全量渲染：底图 → ops → 涂抹 → 文字 → 显示画布（rx2 对比态直接显示未编辑原图） */
const render = () => {
  if (!base.value || !display.value) return
  const d = display.value
  const c = comparing.value && original.value ? original.value : applyOps(base.value, buildOps())
  if (!comparing.value && paint.value) {
    const ctx = c.getContext('2d')!
    ctx.drawImage(paint.value, 0, 0)
  }
  const ctx = c.getContext('2d')!
  if (!comparing.value) {
    for (const t of textLayers.value) {
      ctx.font = `${t.size}px 'PingFang SC','Microsoft YaHei',sans-serif`
      ctx.fillStyle = t.color
      ctx.textBaseline = 'top'
      ctx.fillText(t.text, t.x * c.width, t.y * c.height)
    }
  }
  d.width = c.width
  d.height = c.height
  d.getContext('2d')!.drawImage(c, 0, 0)
  // rx5 覆盖层需要显示尺寸
  window.setTimeout(() => {
    if (display.value) viewSize.value = { w: display.value.clientWidth, h: display.value.clientHeight }
  }, 0)
}

const scheduleRender = () => {
  if (renderTimer) window.clearTimeout(renderTimer)
  renderTimer = window.setTimeout(() => {
    render()
    scheduleEstimate()
  }, 120)
}

/* ---------- 文字图层 ---------- */
const addText = () => {
  capture()
  const id = seq++
  textLayers.value.push({ id, text: '双击编辑文字', size: 32, color: '#ffffff', x: 0.08, y: 0.08 })
  selectedText.value = id
  placingText.value = true
}

const removeText = (id: number) => {
  capture()
  textLayers.value = textLayers.value.filter((t) => t.id !== id)
  if (selectedText.value === id) selectedText.value = null
  render()
}

const selectedLayer = computed(() => textLayers.value.find((t) => t.id === selectedText.value) ?? null)

const onStageClick = (e: PointerEvent) => {
  // rx4 拖拽结束时忽略紧随的 click，避免覆盖拖拽结果
  if (justDragged.value) {
    justDragged.value = false
    return
  }
  const d = display.value
  if (!d) return
  const r = d.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  if (placingText.value && selectedLayer.value) {
    selectedLayer.value.x = Math.round(x * 100) / 100
    selectedLayer.value.y = Math.round(y * 100) / 100
    placingText.value = false
    render()
  }
}

/* ---------- rx4 文字图层画布拖拽 ---------- */
const textDrag = ref<{ id: number; offX: number; offY: number } | null>(null)
const justDragged = ref(false)

const hitText = (ix: number, iy: number) => {
  const d = display.value!
  const ctx = d.getContext('2d')!
  for (let i = textLayers.value.length - 1; i >= 0; i--) {
    const t = textLayers.value[i]
    ctx.font = `${t.size}px 'PingFang SC','Microsoft YaHei',sans-serif`
    const w = ctx.measureText(t.text).width
    const h = t.size * 1.25
    const x0 = t.x * d.width
    const y0 = t.y * d.height
    if (ix >= x0 - 6 && ix <= x0 + w + 6 && iy >= y0 - 6 && iy <= y0 + h + 6) return t
  }
  return null
}

const stageDown = (e: PointerEvent) => {
  justDragged.value = false
  if (tab.value === 'brush') return brushDown(e)
  if (tab.value === 'text' && !placingText.value && display.value) {
    const d = display.value
    const r = d.getBoundingClientRect()
    const ix = ((e.clientX - r.left) / r.width) * d.width
    const iy = ((e.clientY - r.top) / r.height) * d.height
    const t = hitText(ix, iy)
    if (t) {
      selectedText.value = t.id
      textDrag.value = { id: t.id, offX: ix - t.x * d.width, offY: iy - t.y * d.height }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    }
  }
}

const stageMove = (e: PointerEvent) => {
  if (textDrag.value && display.value) {
    const d = display.value
    const t = textLayers.value.find((l) => l.id === textDrag.value!.id)
    if (!t) return
    const r = d.getBoundingClientRect()
    const ix = ((e.clientX - r.left) / r.width) * d.width
    const iy = ((e.clientY - r.top) / r.height) * d.height
    t.x = Math.round(Math.max(0, Math.min(1, (ix - textDrag.value.offX) / d.width)) * 100) / 100
    t.y = Math.round(Math.max(0, Math.min(1, (iy - textDrag.value.offY) / d.height)) * 100) / 100
    render()
    return
  }
  if (tab.value === 'brush') brushMove(e)
}

const stageUp = () => {
  if (textDrag.value) {
    textDrag.value = null
    justDragged.value = true
    return
  }
  brushUp()
}

/* ---------- rx5 自由裁剪（选区由 CropOverlay 维护） ---------- */
const applyCrop = () => {
  const b = base.value
  if (!b) return
  capture()
  const s = cropSel.value
  const cw = Math.max(1, Math.round((s?.x1 ?? b.width) - (s?.x0 ?? 0)))
  const ch = Math.max(1, Math.round((s?.y1 ?? b.height) - (s?.y0 ?? 0)))
  const cx = Math.round(s?.x0 ?? 0)
  const cy = Math.round(s?.y0 ?? 0)
  if (cw >= b.width && ch >= b.height) {
    toast.warn('选区已覆盖全图，拖出更小区域后再应用')
    return
  }
  const nb = document.createElement('canvas')
  nb.width = cw
  nb.height = ch
  nb.getContext('2d')!.drawImage(b, cx, cy, cw, ch, 0, 0, cw, ch)
  // 涂抹层与文字坐标同步换算到新底图
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
  cropSel.value = null
  render()
  toast.ok(`已按选区裁剪为 ${cw}×${ch}`)
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
    capture() // 一笔涂抹入撤销栈
  }
}

const clearPaint = () => {
  if (!paint.value || !base.value) return
  capture()
  paint.value.getContext('2d')!.clearRect(0, 0, base.value.width, base.value.height)
  render()
}

/* ---------- 导出 ---------- */
// rx8 预估体积：选格式/调质量/编辑后 300ms 实时估算（canvasToBlob 即得）
const estSize = ref<number | null>(null)
let estTimer: number | null = null
const scheduleEstimate = () => {
  if (estTimer) window.clearTimeout(estTimer)
  estTimer = window.setTimeout(async () => {
    const d = display.value
    if (!d) return
    try {
      const blob = await canvasToBlob(d, `image/${outFormat.value}`, outQuality.value)
      estSize.value = blob.size
    } catch {
      estSize.value = null
    }
  }, 300)
}
watch([outFormat, outQuality], scheduleEstimate)
watch(tab, () => {
  if (tab.value === 'export') scheduleEstimate()
})

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`)

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
    toast.ok(`已导出（实际 ${fmtSize(blob.size)}）`)
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
          <!-- rx1 撤销/重做（Ctrl+Z / Ctrl+Y，栈深 20） -->
          <div class="row" style="gap: 6px">
            <button class="tool-btn" style="flex: 1" :disabled="!undoStack.canUndo.value" title="Ctrl+Z" @click="doUndo"><Undo2 :size="14" /> 撤销</button>
            <button class="tool-btn" style="flex: 1" :disabled="!undoStack.canRedo.value" title="Ctrl+Y" @click="doRedo"><Redo2 :size="14" /> 重做</button>
          </div>
          <button class="tool-btn reset" @click="resetAll"><RotateCcw :size="15" /> 重置</button>
        </nav>

        <!-- 中：画布 -->
        <div class="canvas-col">
          <div class="canvas-wrap">
            <canvas
              ref="display"
              class="stage"
              :class="{ 'crop-mode': tab === 'crop' }"
              @click="onStageClick"
              @pointerdown="stageDown"
              @pointermove="stageMove"
              @pointerup="stageUp"
              @pointerleave="stageUp"
            ></canvas>
            <!-- rx5 自由裁剪选区层 -->
            <CropOverlay
              v-if="tab === 'crop' && viewSize.w"
              :img-w="base.width"
              :img-h="base.height"
              :view-w="viewSize.w"
              :view-h="viewSize.h"
              :ratio="cropRatio"
              @change="cropSel = $event"
            />
            <!-- rx2 前后对比按钮：按住显示未编辑原图 -->
            <button
              class="cmp-btn"
              :class="{ on: comparing }"
              title="按住查看未编辑原图，松开恢复"
              @pointerdown.prevent="comparing = true"
              @pointerup="comparing = false"
              @pointerleave="comparing = false"
              @pointercancel="comparing = false"
            >
              {{ comparing ? '原图' : '对比' }}
            </button>
          </div>
          <p class="muted small center">
            {{ base.width }} × {{ base.height }}<span v-if="placingText"> · 点击画面定位文字</span><span v-else-if="tab === 'brush'"> · 在画面上涂抹</span><span v-else-if="tab === 'crop'"> · 在画面上拖出选区，四角手柄可调，选区内拖动可移位</span><span v-else-if="tab === 'text'"> · 选中文字后可直接在画面上拖动</span>
          </p>
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
              <button v-for="f in filters" :key="f.v" class="f-btn" :class="{ active: filter === f.v }" @click="setFilter(f.v)">
                {{ f.label }}
              </button>
            </div>
            <!-- rx6 滤镜强度 -->
            <label v-if="filter !== 'none'" class="p-row">
              <span class="p-label">强度 {{ Math.round(filterIntensity * 100) }}%</span>
              <input v-model.number="filterIntensity" type="range" min="0" max="1" step="0.05" @input="render" />
            </label>
            <p v-if="filter !== 'none'" class="muted small">强度越低滤镜效果越弱，导出结果与预览一致。</p>
          </template>
          <template v-else-if="tab === 'text'">
            <button class="btn btn-primary btn-sm" @click="addText"><Plus :size="14" /> 添加文字</button>
            <div v-for="t in textLayers" :key="t.id" class="layer" :class="{ sel: selectedText === t.id }" @click="selectedText = t.id">
              <input v-model="t.text" class="input" placeholder="文字内容" @input="render" />
              <div class="row" style="gap: 6px">
                <input v-model.number="t.size" type="number" min="8" max="400" class="input" style="width: 72px" title="字号 px" @input="render" />
                <input v-model="t.color" type="color" @input="render" />
                <button class="mini danger" title="删除图层" aria-label="删除图层" @click="removeText(t.id)"><Trash2 :size="12" /></button>
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
              <span class="p-label">比例锁定</span>
              <select v-model="cropRatio" class="select">
                <option v-for="o in cropOptions" :key="o.v" :value="o.v">{{ o.label }}</option>
              </select>
            </label>
            <button class="btn btn-primary btn-sm" @click="applyCrop">应用选区裁剪</button>
            <p class="muted small">在画布上拖出任意位置的选区（支持偏左上等非居中区域）；应用后涂抹与文字坐标自动换算。</p>
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
            <!-- rx8 预估体积 -->
            <div v-if="estSize" class="p-row est">预估体积 ≈ <b>{{ fmtSize(estSize) }}</b><span class="muted small">（随格式/质量实时更新，导出为同一编码）</span></div>
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
.canvas-wrap {
  position: relative;
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
  display: block;
}
.stage.crop-mode {
  cursor: default;
}
.cmp-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 6;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel-solid) 88%, transparent);
  color: var(--text-2);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;
}
.cmp-btn.on {
  border-color: var(--accent);
  color: var(--accent-text);
}
.est {
  font-size: 13px;
  color: var(--text-2);
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
