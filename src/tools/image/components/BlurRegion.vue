<script setup lang="ts">
/**
 * 图片区域打码（UX1.0）：
 * - Pointer 化框选（rx1，已落地）：pointer 事件 + 捕获 + touch-action:none。
 * - 强度滑杆（rx2）：模糊 5~40px / 像素化 4~40 块，默认自动（按区域尺寸）。
 * - 画布缩放（rx3）：Ctrl+滚轮 100%~400%，空格+拖移，坐标换算无偏差。
 * - 涂黑建议（rx4）：像素化小区域（<120×40px）提示可复原，一键转涂黑。
 * - 区域微调（rx5）：点击已选区域出现四角手柄，拖拽改尺寸/位置（几何逻辑复用 cropSel.ts）。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Undo2, Trash2, X, Download, Loader2 } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import { composite, type Region, type RMode } from './maskComposite'
import { HANDLES, hitHandle, clampSel, type Sel, type Hit } from './cropSel'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const work = shallowRef<HTMLCanvasElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const mode = ref<RMode>('blur')
const strength = ref(0) // 0 = 自动
const regions = ref<Region[]>([])
const outFormat = ref<'image/png' | 'image/jpeg'>('image/png')
const saving = ref(false)
const stage = ref<HTMLElement | null>(null)
const suggest = ref<Region | null>(null) // rx4 涂黑建议
const zoom = ref(1)
let spaceHeld = false

const MODE_LABEL: Record<RMode, string> = { blur: '模糊', pixel: '像素化', black: '涂黑' }

let mounted: HTMLCanvasElement | null = null
watch(work, (c) => {
  if (mounted) {
    mounted.remove()
    mounted = null
  }
  if (c && stage.value) {
    c.style.maxWidth = '100%'
    c.style.display = 'block'
    stage.value.insertBefore(c, stage.value.firstChild)
    mounted = c
  }
})

function applyZoom() {
  if (mounted) mounted.style.width = `${zoom.value * 100}%`
}
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey || !src.value) return
  e.preventDefault()
  zoom.value = Math.min(4, Math.max(1, Number((e.deltaY < 0 ? zoom.value * 1.2 : zoom.value / 1.2).toFixed(3))))
  applyZoom()
}
const onKey = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return
  if (e.code === 'Space') {
    spaceHeld = e.type === 'keydown'
    e.preventDefault()
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKey)
})

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  try {
    src.value = await decodeToCanvas(files[0])
    file.value = files[0]
    regions.value = []
    selected.value = -1
    zoom.value = 1
    await nextTick()
    renderWork()
    const o = overlayEl.value
    if (o) {
      o.width = src.value.width
      o.height = src.value.height
      drawOverlay()
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function resetAll() {
  src.value = null
  work.value = null
  file.value = null
  regions.value = []
  selected.value = -1
}

function drawOverlay() {
  const o = overlayEl.value
  if (!o) return
  const ctx = o.getContext('2d')!
  ctx.clearRect(0, 0, o.width, o.height)
  ctx.lineWidth = Math.max(1.5, o.width / 400)
  regions.value.forEach((r, i) => {
    ctx.strokeStyle = i === selected.value ? '#ff8a3d' : '#4f7dff'
    ctx.setLineDash([8, 6])
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    if (i === selected.value) {
      // rx5：四角手柄
      const hs = Math.max(6, o.width / 160)
      ctx.setLineDash([])
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#ff8a3d'
      for (const [hx, hy] of [
        [r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h],
        [r.x + r.w / 2, r.y], [r.x + r.w, r.y + r.h / 2], [r.x + r.w / 2, r.y + r.h], [r.x, r.y + r.h / 2],
      ]) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs)
      }
    }
  })
  if (tempRect) {
    ctx.strokeStyle = '#ff5566'
    ctx.strokeRect(tempRect.x, tempRect.y, tempRect.w, tempRect.h)
  }
}

function renderWork() {
  if (!src.value) return
  work.value = composite(src.value, regions.value, strength.value)
}

/* ---------- 指针交互：空格拖移 / 区域选中手柄 / 新画区域 ---------- */
function toImage(e: PointerEvent): { x: number; y: number } {
  const o = overlayEl.value!
  const rect = o.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * o.width,
    y: ((e.clientY - rect.top) / rect.height) * o.height,
  }
}
function handleThr(): number {
  const o = overlayEl.value!
  return Math.max(8, (o.width / o.getBoundingClientRect().width) * 12)
}

const selected = ref(-1)
let hit: Hit = null
let dragStart: { x: number; y: number } | null = null
let selStart: Sel | null = null
let panStart: { x: number; y: number; l: number; t: number } | null = null
let tempRect: Region | null = null
let dragKind: '' | 'region' | 'new' | 'pan' = ''

function onDown(e: PointerEvent) {
  if (!overlayEl.value || !e.isPrimary) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const p = toImage(e)
  if (spaceHeld || e.button === 1) {
    // rx3：空格 + 拖移
    dragKind = 'pan'
    panStart = { x: e.clientX, y: e.clientY, l: stage.value!.scrollLeft, t: stage.value!.scrollTop }
    return
  }
  dragStart = p
  if (selected.value >= 0) {
    const r = regions.value[selected.value]!
    hit = hitHandle({ x: r.x, y: r.y, w: r.w, h: r.h }, p, handleThr())
  } else hit = null
  if (hit) {
    dragKind = 'region'
    selStart = { x: regions.value[selected.value]!.x, y: regions.value[selected.value]!.y, w: regions.value[selected.value]!.w, h: regions.value[selected.value]!.h }
  } else {
    // 点到其他区域 → 选中；空白 → 新画
    const idx = regions.value.findIndex((r) => p.x > r.x - 6 && p.x < r.x + r.w + 6 && p.y > r.y - 6 && p.y < r.y + r.h + 6)
    if (idx >= 0) {
      selected.value = idx
      hit = 'move'
      dragKind = 'region'
      const r = regions.value[idx]!
      selStart = { x: r.x, y: r.y, w: r.w, h: r.h }
    } else {
      selected.value = -1
      dragKind = 'new'
      tempRect = null
    }
  }
  drawOverlay()
}

function onMove(e: PointerEvent) {
  if (dragKind === 'pan' && panStart) {
    stage.value!.scrollLeft = panStart.l - (e.clientX - panStart.x)
    stage.value!.scrollTop = panStart.t - (e.clientY - panStart.y)
    return
  }
  if (!dragStart || !e.isPrimary) return
  const p = toImage(e)
  if (dragKind === 'new') {
    tempRect = {
      x: Math.min(p.x, dragStart.x),
      y: Math.min(p.y, dragStart.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
      mode: mode.value,
    }
    drawOverlay()
    return
  }
  if (dragKind === 'region' && selStart && selected.value >= 0) {
    const r = regions.value[selected.value]!
    const s: Sel = { ...selStart }
    if (hit === 'move') {
      s.x = Math.max(0, Math.min(selStart.x + (p.x - dragStart.x), src.value!.width - s.w))
      s.y = Math.max(0, Math.min(selStart.y + (p.y - dragStart.y), src.value!.height - s.h))
    } else {
      const h = HANDLES.find((x) => x.k === hit)!
      const x1 = h.dx === 0 ? Math.max(0, Math.min(p.x, selStart.x + selStart.w - 4)) : selStart.x
      const x2 = h.dx === 1 ? Math.min(src.value!.width, Math.max(p.x, selStart.x + 4)) : selStart.x + selStart.w
      const y1 = h.dy === 0 ? Math.max(0, Math.min(p.y, selStart.y + selStart.h - 4)) : selStart.y
      const y2 = h.dy === 1 ? Math.min(src.value!.height, Math.max(p.y, selStart.y + 4)) : selStart.y + selStart.h
      s.x = x1
      s.y = y1
      s.w = x2 - x1
      s.h = y2 - y1
    }
    clampSel(s, src.value!.width, src.value!.height)
    Object.assign(r, s)
    drawOverlay()
  }
}

function onUp() {
  if (dragKind === 'pan') {
    dragKind = ''
    return
  }
  if (dragKind === 'new') {
    const r = tempRect
    tempRect = null
    if (r && r.w > 6 && r.h > 6) {
      regions.value.push(r)
      // rx4：像素化小区域提示
      if (r.mode === 'pixel' && r.w < 120 && r.h < 40) suggest.value = r
      renderWork()
    }
  } else if (dragKind === 'region') {
    renderWork()
  }
  dragKind = ''
  drawOverlay()
}

/** rx4：一键把建议区域改为涂黑 */
function applyBlack() {
  if (suggest.value) {
    const r = regions.value.find((x) => x === suggest.value)
    if (r) r.mode = 'black'
    suggest.value = null
    renderWork()
    drawOverlay()
  }
}

const undoLast = () => {
  regions.value.pop()
  selected.value = -1
  renderWork()
  drawOverlay()
}
const clearAll = () => {
  regions.value = []
  selected.value = -1
  suggest.value = null
  renderWork()
  drawOverlay()
}

async function download() {
  if (!work.value || !file.value) return
  saving.value = true
  try {
    const blob = await canvasToBlob(work.value, outFormat.value, 0.92)
    const ext = outFormat.value === 'image/png' ? 'png' : 'jpg'
    saveBlob(blob, `${baseName(file.value.name)}-masked.${ext}`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    saving.value = false
  }
}

watch([mode, strength], () => {
  renderWork()
  drawOverlay()
})
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="在图片上拖拽框选需要打码的区域；点击已选区域可拖手柄微调"
      @files="onFiles"
    />
    <div v-else>
      <!-- rx4 涂黑建议 -->
      <div v-if="suggest" class="notice notice-warn mt-1" style="display: flex; align-items: center; gap: 10px">
        小面积文字像素化可能被复原，建议改用涂黑。
        <button class="btn btn-soft btn-sm" @click="applyBlack">改用涂黑</button>
        <button class="btn btn-ghost btn-sm" @click="suggest = null">忽略</button>
      </div>

      <div class="row row-wrap mt-1" style="gap: 8px">
        <button v-for="(l, k) in MODE_LABEL" :key="k" class="chip" :class="{ active: mode === k }" @click="mode = k as RMode">
          {{ l }}
        </button>
        <span class="row" style="gap: 8px">
          <span class="field-label">强度：{{ strength === 0 ? '自动' : strength + (mode === 'blur' ? 'px' : '块') }}</span>
          <input v-model.number="strength" type="range" min="0" max="40" step="1" style="width: 120px" />
        </span>
        <span class="row" style="margin-left: auto; gap: 6px">
          <button class="btn btn-ghost btn-sm" :disabled="!regions.length" @click="undoLast"><Undo2 :size="14" /> 撤销上一步</button>
          <button class="btn btn-ghost btn-sm" :disabled="!regions.length" @click="clearAll"><Trash2 :size="14" /> 清空区域</button>
          <button class="btn btn-ghost btn-sm" @click="resetAll"><X :size="14" /> 换一张</button>
        </span>
      </div>

      <div class="stage-wrap mt-2" @wheel="onWheel">
        <div ref="stage" class="stage">
          <canvas
            v-show="src"
            ref="overlayEl"
            class="overlay-cv"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointerleave="onUp"
            @pointercancel="onUp"
          ></canvas>
        </div>
      </div>
      <p class="muted small mt-1">Ctrl+滚轮缩放（100%~400%），按住空格拖移画布；点击已选区域拖四角手柄微调大小与位置。</p>

      <div v-if="regions.length" class="mt-2 region-list">
        <span v-for="(r, i) in regions" :key="i" class="badge badge-plain">
          #{{ i + 1 }} {{ MODE_LABEL[r.mode] }} {{ Math.round(r.w) }} × {{ Math.round(r.h) }} px
          <button class="mini-x" title="删除" aria-label="删除" @click="(regions.splice(i, 1), (selected = -1), renderWork(), drawOverlay())"><X :size="11" /></button>
        </span>
      </div>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" :disabled="saving || !work" @click="download">
          <Loader2 v-if="saving" :size="16" class="spin" /><Download v-else :size="16" /> 下载结果
        </button>
        <select v-model="outFormat" class="select" style="width: 130px">
          <option value="image/png">PNG 格式</option>
          <option value="image/jpeg">JPG 格式</option>
        </select>
        <span class="muted small">虚线框仅为参考线，不会出现在导出图中</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-wrap {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
  max-height: 72vh;
}
.stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
  touch-action: none;
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
.region-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mini-x {
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
  display: inline-flex;
  margin-left: 4px;
  padding: 0;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
