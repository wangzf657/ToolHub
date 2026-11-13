<script setup lang="ts">
/**
 * 裁剪图片：拖拽选区 + 比例锁定 + 8 手柄调整/整体移动 + 三分参考线（UX1.0）。
 * 结果前置（P0）：确认裁剪后结果与下载按钮替换原编辑器位置，首屏无需滚动即可见。
 * 触屏：pointer 事件 + setPointerCapture + touch-action:none。几何逻辑见 cropSel.ts。
 */
import { ref, shallowRef, watch, nextTick } from 'vue'
import { Crop, RefreshCw, Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import { HANDLES, handlePts, hitHandle, cursorFor, clampSel, fitRatio, type Sel, type Hit } from './cropSel'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const stageResult = ref<HTMLElement | null>(null)
const ratio = ref(0)
const thirds = ref(false)
const sel = ref<Sel | null>(null)
const result = shallowRef<HTMLCanvasElement | null>(null)
const saving = ref(false)

const RATIOS = [
  { v: 0, t: '自由' }, { v: 1, t: '1:1' }, { v: 4 / 3, t: '4:3' }, { v: 3 / 4, t: '3:4' },
  { v: 16 / 9, t: '16:9' }, { v: 9 / 16, t: '9:16' }, { v: 3 / 2, t: '3:2' }, { v: 2 / 3, t: '2:3' },
]

/* 源图预览画布：进入编辑态（含从结果返回）都要重新挂载 */
let mountedView: HTMLCanvasElement | null = null
async function mountView() {
  await nextTick()
  if (mountedView) {
    mountedView.remove()
    mountedView = null
  }
  const c = src.value
  if (!c || !stage.value) return
  const v = document.createElement('canvas')
  v.width = c.width
  v.height = c.height
  v.getContext('2d')!.drawImage(c, 0, 0)
  stage.value.insertBefore(v, stage.value.firstChild)
  mountedView = v
  const o = overlayEl.value
  if (o) {
    o.width = c.width
    o.height = c.height
    drawOverlay()
  }
}
watch(src, mountView)

/* 结果画布挂载 */
let mountedResult: HTMLCanvasElement | null = null
watch(result, async (c) => {
  await nextTick()
  if (mountedResult) {
    mountedResult.remove()
    mountedResult = null
  }
  if (c && stageResult.value) {
    c.style.maxWidth = '100%'
    c.style.maxHeight = 'min(60vh, 640px)'
    c.style.width = 'auto'
    c.style.height = 'auto'
    c.style.display = 'block'
    c.style.margin = '0 auto'
    stageResult.value.appendChild(c)
    mountedResult = c
  }
})

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  try {
    src.value = await decodeToCanvas(files[0])
    file.value = files[0]
    sel.value = null
    result.value = null
    await mountView()
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function resetAll() {
  src.value = null
  result.value = null
  sel.value = null
  file.value = null
}

function drawOverlay() {
  const o = overlayEl.value
  if (!o) return
  const ctx = o.getContext('2d')!
  ctx.clearRect(0, 0, o.width, o.height)
  if (!sel.value) return
  const { x, y, w, h } = sel.value
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, o.width, o.height)
  ctx.clearRect(x, y, w, h)
  ctx.strokeStyle = '#4f7dff'
  ctx.lineWidth = Math.max(1.5, o.width / 400)
  ctx.strokeRect(x, y, w, h)
  if (thirds.value && w > 12 && h > 12) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(1, o.width / 800)
    ctx.setLineDash([6, 6])
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(x + (w * i) / 3, y)
      ctx.lineTo(x + (w * i) / 3, y + h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, y + (h * i) / 3)
      ctx.lineTo(x + w, y + (h * i) / 3)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }
  const hs = Math.max(6, o.width / 160)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#4f7dff'
  for (const [hx, hy] of handlePts(sel.value)) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs)
  }
}

function toImage(e: PointerEvent) {
  const o = overlayEl.value!
  const rect = o.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * o.width,
    y: ((e.clientY - rect.top) / rect.height) * o.height,
  }
}

/* ---- 选区交互状态 ---- */
let hit: Hit = null
let dragging = false
let dragStart: { x: number; y: number } | null = null
let selStart: Sel | null = null

function onDown(e: PointerEvent) {
  if (!overlayEl.value || !e.isPrimary) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const p = toImage(e)
  hit = hitHandle(sel.value, p, handleThr())
  dragStart = p
  selStart = sel.value ? { ...sel.value } : null
  dragging = true
  if (!hit) {
    sel.value = null
    result.value = null
  }
  drawOverlay()
}

function handleThr(): number {
  const o = overlayEl.value!
  return Math.max(8, (o.width / o.getBoundingClientRect().width) * 12)
}

function onMove(e: PointerEvent) {
  if (!src.value || !e.isPrimary) return
  const p = toImage(e)
  const c = src.value
  if (!dragging) {
    overlayEl.value!.style.cursor = cursorFor(hitHandle(sel.value, p, handleThr()))
    return
  }
  if (!hit || !selStart || !dragStart) {
    // 新画选区
    const x = Math.max(0, Math.min(p.x, dragStart!.x))
    const y = Math.max(0, Math.min(p.y, dragStart!.y))
    sel.value = { x, y, w: Math.abs(p.x - dragStart!.x), h: Math.abs(p.y - dragStart!.y) }
    fitRatio(sel.value, ratio.value, c.width, c.height)
  } else if (hit === 'move') {
    const dx = p.x - dragStart.x
    const dy = p.y - dragStart.y
    sel.value = {
      x: Math.max(0, Math.min(selStart.x + dx, c.width - selStart.w)),
      y: Math.max(0, Math.min(selStart.y + dy, c.height - selStart.h)),
      w: selStart.w,
      h: selStart.h,
    }
  } else {
    // 手柄调整：以对边/对角为锚点，比例约束后回补锚点侧
    const h = HANDLES.find((x) => x.k === hit)!
    const x1 = h.dx === 0 ? Math.max(0, Math.min(p.x, selStart.x + selStart.w - 4)) : selStart.x
    const x2 = h.dx === 1 ? Math.min(c.width, Math.max(p.x, selStart.x + 4)) : selStart.x + selStart.w
    const y1 = h.dy === 0 ? Math.max(0, Math.min(p.y, selStart.y + selStart.h - 4)) : selStart.y
    const y2 = h.dy === 1 ? Math.min(c.height, Math.max(p.y, selStart.y + 4)) : selStart.y + selStart.h
    const s: Sel = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
    const rw = s.w
    const rh = s.h
    fitRatio(s, ratio.value, c.width, c.height)
    if (ratio.value > 0) {
      if (h.dx === 0) s.x = x1 + rw - s.w
      if (h.dy === 0) s.y = y1 + rh - s.h
      if (h.dx === 0.5) s.x = selStart.x + selStart.w / 2 - s.w / 2
      if (h.dy === 0.5) s.y = selStart.y + selStart.h / 2 - s.h / 2
      clampSel(s, c.width, c.height)
    }
    sel.value = s
  }
  drawOverlay()
}

function onUp() {
  dragging = false
  hit = null
  dragStart = null
  selStart = null
}

function confirmCrop() {
  const s = sel.value
  const c = src.value
  if (!c || !s || s.w < 4 || s.h < 4) {
    toast.warn('请先拖拽出一个有效选区')
    return
  }
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(s.w))
  out.height = Math.max(1, Math.round(s.h))
  out.getContext('2d')!.drawImage(c, s.x, s.y, out.width, out.height, 0, 0, out.width, out.height)
  result.value = out
}

async function download() {
  if (!result.value || !file.value) return
  saving.value = true
  try {
    const blob = await canvasToBlob(result.value, 'image/png')
    saveBlob(blob, `${baseName(file.value.name)}-cropped.png`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    saving.value = false
  }
}

function applyRatioChip(v: number) {
  ratio.value = v
  if (sel.value) {
    fitRatio(sel.value, v, src.value!.width, src.value!.height)
    drawOverlay()
  }
}

/** 返回编辑态：重挂源图画布与覆盖层 */
async function backToEdit() {
  result.value = null
  await mountView()
}

async function reselect() {
  sel.value = null
  result.value = null
  await mountView()
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="在图片上拖拽出裁剪区域，支持比例锁定与手柄微调"
      @files="onFiles"
    />
    <div v-else>
      <template v-if="!result">
        <div class="row row-wrap mt-1" style="gap: 8px">
          <button v-for="r in RATIOS" :key="r.t" class="chip" :class="{ active: ratio === r.v }" @click="applyRatioChip(r.v)">
            {{ r.t }}
          </button>
          <label class="check"><input v-model="thirds" type="checkbox" @change="drawOverlay" /> 三分参考线</label>
          <span class="row" style="margin-left: auto; gap: 6px">
            <button class="btn btn-ghost btn-sm" @click="reselect"><RefreshCw :size="14" /> 重新框选</button>
            <button class="btn btn-ghost btn-sm" @click="resetAll">换一张</button>
          </span>
        </div>

        <div class="stage-wrap mt-2">
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

        <p class="muted small mt-1">
          <template v-if="sel">选区：X {{ Math.round(sel.x) }}，Y {{ Math.round(sel.y) }}，宽 {{ Math.round(sel.w) }}，高 {{ Math.round(sel.h) }} px · 拖手柄改尺寸，拖内部移动</template>
          <template v-else>在图上按住拖拽即可框选（支持鼠标、触摸与手写笔）</template>
        </p>

        <div class="row mt-2">
          <button class="btn btn-primary" @click="confirmCrop"><Crop :size="16" /> 确认裁剪</button>
        </div>
      </template>

      <!-- 结果前置（P0）：替换编辑器位置，首屏即可下载 -->
      <div v-else>
        <div class="field-label">裁剪结果（{{ result.width }} × {{ result.height }} px）</div>
        <div ref="stageResult" class="result-stage mt-1"></div>
        <div class="row mt-2">
          <button class="btn btn-primary" :disabled="saving" @click="download"><Download :size="16" /> 下载 PNG</button>
          <button class="btn btn-ghost" @click="backToEdit">返回调整选区</button>
        </div>
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
.result-stage {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
}
</style>
