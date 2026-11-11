<script setup lang="ts">
/** 图片区域打码：框选区域 → 模糊 / 像素化 / 涂黑，可连续框选、撤销、导出 */
import { ref, shallowRef, watch, nextTick } from 'vue'
import { Undo2, Trash2, X, Download, Loader2 } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob, applyOps } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

type Mode = 'blur' | 'pixel' | 'black'
interface Region { x: number; y: number; w: number; h: number; mode: Mode }

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const work = shallowRef<HTMLCanvasElement | null>(null) // 已应用打码的结果
const overlayEl = ref<HTMLCanvasElement | null>(null) // 参考线覆盖层
const mode = ref<Mode>('blur')
const regions = ref<Region[]>([])
const dragging = ref(false)
const dragStart = ref<{ x: number; y: number } | null>(null)
const tempRect = ref<Region | null>(null)
const outFormat = ref<'image/png' | 'image/jpeg'>('image/png')
const saving = ref(false)
const stage = ref<HTMLElement | null>(null)

const MODE_LABEL: Record<Mode, string> = { blur: '模糊', pixel: '像素化', black: '涂黑' }

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

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  try {
    src.value = await decodeToCanvas(files[0])
    file.value = files[0]
    regions.value = []
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
}

function drawOverlay() {
  const o = overlayEl.value
  if (!o) return
  const ctx = o.getContext('2d')!
  ctx.clearRect(0, 0, o.width, o.height)
  ctx.lineWidth = Math.max(1.5, o.width / 400)
  for (const r of regions.value) {
    ctx.strokeStyle = '#4f7dff'
    ctx.setLineDash([8, 6])
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  }
  if (tempRect.value) {
    ctx.strokeStyle = '#ff5566'
    ctx.strokeRect(tempRect.value.x, tempRect.value.y, tempRect.value.w, tempRect.value.h)
  }
}

/** 每次都从原图重新合成，避免叠加失真 */
function renderWork() {
  const c = src.value
  if (!c) return
  const out = document.createElement('canvas')
  out.width = c.width
  out.height = c.height
  const octx = out.getContext('2d')!
  octx.drawImage(c, 0, 0)
  for (const r of regions.value) {
    const rw = Math.round(r.w)
    const rh = Math.round(r.h)
    if (rw < 2 || rh < 2) continue
    if (r.mode === 'black') {
      octx.fillStyle = '#111111'
      octx.fillRect(r.x, r.y, rw, rh)
      continue
    }
    const region = document.createElement('canvas')
    region.width = rw
    region.height = rh
    region.getContext('2d')!.drawImage(c, r.x, r.y, rw, rh, 0, 0, rw, rh)
    if (r.mode === 'blur') {
      const t = document.createElement('canvas')
      t.width = rw
      t.height = rh
      const tctx = t.getContext('2d')!
      tctx.filter = `blur(${Math.max(5, Math.round(Math.min(rw, rh) / 5))}px)`
      tctx.drawImage(region, 0, 0)
      octx.drawImage(t, r.x, r.y)
    } else {
      const px = applyOps(region, [{ op: 'pixelate', size: Math.max(6, Math.round(Math.min(rw, rh) / 6)) }])
      octx.drawImage(px, r.x, r.y)
    }
  }
  work.value = out
}

/* ---------- 指针框选（鼠标/触摸/笔通用，坐标换算到图像坐标） ---------- */
function toImage(e: PointerEvent): { x: number; y: number } {
  const o = overlayEl.value!
  const rect = o.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * o.width,
    y: ((e.clientY - rect.top) / rect.height) * o.height,
  }
}

function onDown(e: PointerEvent) {
  // 只响应主指针：触屏多指/笔+手并用时不误重置拖拽起点
  if (!overlayEl.value || !e.isPrimary) return
  e.preventDefault()
  // 捕获指针：手指/笔拖出画布仍持续跟踪，松开自动释放（触屏拖拽不再触发页面滚动）
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragging.value = true
  dragStart.value = toImage(e)
  tempRect.value = null
}
function onMove(e: PointerEvent) {
  if (!dragging.value || !dragStart.value || !e.isPrimary) return
  const p = toImage(e)
  tempRect.value = {
    x: Math.min(p.x, dragStart.value.x),
    y: Math.min(p.y, dragStart.value.y),
    w: Math.abs(p.x - dragStart.value.x),
    h: Math.abs(p.y - dragStart.value.y),
    mode: mode.value,
  }
  drawOverlay()
}
function onUp() {
  if (!dragging.value) return
  dragging.value = false
  const r = tempRect.value
  tempRect.value = null
  if (r && r.w > 6 && r.h > 6) {
    regions.value.push(r)
    renderWork()
  }
  drawOverlay()
}

const undoLast = () => {
  regions.value.pop()
  renderWork()
  drawOverlay()
}
const clearAll = () => {
  regions.value = []
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

watch(mode, drawOverlay)
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="在图片上拖拽框选需要打码的区域"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 8px">
        <button v-for="(l, k) in MODE_LABEL" :key="k" class="chip" :class="{ active: mode === k }" @click="mode = k as Mode">
          {{ l }}
        </button>
        <span class="row" style="margin-left: auto; gap: 6px">
          <button class="btn btn-ghost btn-sm" :disabled="!regions.length" @click="undoLast"><Undo2 :size="14" /> 撤销上一步</button>
          <button class="btn btn-ghost btn-sm" :disabled="!regions.length" @click="clearAll"><Trash2 :size="14" /> 清空区域</button>
          <button class="btn btn-ghost btn-sm" @click="resetAll"><X :size="14" /> 换一张</button>
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

      <div v-if="regions.length" class="mt-2 region-list">
        <span v-for="(r, i) in regions" :key="i" class="badge badge-plain">
          #{{ i + 1 }} {{ MODE_LABEL[r.mode] }} {{ Math.round(r.w) }} × {{ Math.round(r.h) }} px
          <button class="mini-x" title="删除" aria-label="删除" @click="(regions.splice(i, 1), renderWork(), drawOverlay())"><X :size="11" /></button>
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
