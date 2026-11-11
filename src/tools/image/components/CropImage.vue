<script setup lang="ts">
/** 裁剪图片：拖拽选区 + 比例锁定（自由/1:1/4:3/16:9）+ 显示选区像素坐标 */
import { ref, shallowRef, watch, nextTick } from 'vue'
import { Crop, RefreshCw, Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const ratio = ref(0) // 0 = 自由，其余为 宽/高
const sel = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const result = shallowRef<HTMLCanvasElement | null>(null)
const dragging = ref(false)
const start = ref<{ x: number; y: number } | null>(null)
const saving = ref(false)

const RATIOS = [
  { v: 0, t: '自由' },
  { v: 1, t: '1:1' },
  { v: 4 / 3, t: '4:3' },
  { v: 16 / 9, t: '16:9' },
]

/* 原图预览画布与结果画布都由 JS 创建后挂载 */
let mountedView: HTMLCanvasElement | null = null
watch(src, async (c) => {
  await nextTick()
  if (mountedView) {
    mountedView.remove()
    mountedView = null
  }
  if (!c || !stage.value) return
  const v = document.createElement('canvas')
  v.width = c.width
  v.height = c.height
  v.getContext('2d')!.drawImage(c, 0, 0)
  stage.value.insertBefore(v, stage.value.firstChild)
  mountedView = v
})

let mountedResult: HTMLCanvasElement | null = null
watch(result, async (c) => {
  await nextTick()
  const el = stageResult.value
  if (mountedResult) {
    mountedResult.remove()
    mountedResult = null
  }
  if (c && el) {
    c.style.maxWidth = '100%'
    c.style.height = 'auto'
    c.style.display = 'block'
    c.style.margin = '0 auto'
    el.appendChild(c)
    mountedResult = c
  }
})

const stageResult = ref<HTMLElement | null>(null)

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
    await nextTick()
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
}

function toImage(e: PointerEvent) {
  const o = overlayEl.value!
  const rect = o.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * o.width,
    y: ((e.clientY - rect.top) / rect.height) * o.height,
  }
}

function onDown(e: PointerEvent) {
  // 只响应主指针：触屏多指/笔+手并用时不误重置选区
  if (!overlayEl.value || !e.isPrimary) return
  e.preventDefault()
  // 捕获指针：手指/笔拖出画布仍持续跟踪，松开自动释放（触屏拖拽不再触发页面滚动）
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragging.value = true
  start.value = toImage(e)
  sel.value = null
  result.value = null
  drawOverlay()
}

function onMove(e: PointerEvent) {
  if (!dragging.value || !start.value || !src.value || !e.isPrimary) return
  const p = toImage(e)
  let x = Math.max(0, Math.min(Math.min(p.x, start.value.x), src.value.width))
  let y = Math.max(0, Math.min(Math.min(p.y, start.value.y), src.value.height))
  let w = Math.min(Math.abs(p.x - start.value.x), src.value.width - x)
  let h = Math.min(Math.abs(p.y - start.value.y), src.value.height - y)
  if (ratio.value > 0 && w > 0 && h > 0) {
    if (w / h > ratio.value) w = h * ratio.value
    else h = w / ratio.value
  }
  sel.value = { x, y, w, h }
  drawOverlay()
}

function onUp() {
  dragging.value = false
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
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="在图片上拖拽出裁剪区域，支持比例锁定"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 8px">
        <button v-for="r in RATIOS" :key="r.t" class="chip" :class="{ active: ratio === r.v }" @click="ratio = r.v">
          {{ r.t }}
        </button>
        <span class="row" style="margin-left: auto; gap: 6px">
          <button class="btn btn-ghost btn-sm" @click="((sel = null), (result = null), drawOverlay())">
            <RefreshCw :size="14" /> 重新框选
          </button>
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
        <template v-if="sel">选区：X {{ Math.round(sel.x) }}，Y {{ Math.round(sel.y) }}，宽 {{ Math.round(sel.w) }}，高 {{ Math.round(sel.h) }} px</template>
        <template v-else>在图上按住拖拽即可框选（支持鼠标、触摸与手写笔）</template>
      </p>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="confirmCrop"><Crop :size="16" /> 确认裁剪</button>
      </div>

      <div v-if="result" class="mt-3">
        <div class="field-label">裁剪结果（{{ result.width }} × {{ result.height }} px）</div>
        <div ref="stageResult" class="result-stage mt-1"></div>
        <div class="row mt-2">
          <button class="btn btn-primary" :disabled="saving" @click="download"><Download :size="16" /> 下载 PNG</button>
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
  /* 触屏拖拽框选时禁止浏览器默认滚动/缩放手势 */
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
