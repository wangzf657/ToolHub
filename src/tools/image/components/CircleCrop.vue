<script setup lang="ts">
/**
 * 圆形头像裁剪（UX1.0 五处方）：
 * - 可拖动圆框（rx1）：圆形选框可拖动、滚轮缩放，导出按选框取图（不再锁死居中）。
 * - 输出尺寸档（rx2）：原图短边｜256｜512｜1024。
 * - 带图接力（rx3）：说明改为按钮「先去裁剪主体」，当前图带入 crop-image。
 * - 中心准星（rx4）：拖动中显示十字参考线，松手 1s 后淡出。
 * - 小尺寸回看（rx5）：64/128px 缩略回看。
 */
import { nextTick, ref, shallowRef } from 'vue'
import { Download, Scissors } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import ExportBar from './ExportBar.vue'
import { handoffImage } from './handoff'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
/** 圆框状态：中心比例 + 直径占短边比例 */
const cx = ref(0.5)
const cy = ref(0.5)
const dr = ref(1)
const outSize = ref(0) // 0 = 原图短边
const dragging = ref(false)
const crossVisible = ref(true)
const result = shallowRef<HTMLCanvasElement | null>(null)

const SIZE_CHIPS = [
  { v: 0, t: '原图短边' },
  { v: 256, t: '256' },
  { v: 512, t: '512' },
  { v: 1024, t: '1024' },
]

let mounted: HTMLCanvasElement | null = null

async function onFiles(list: File[]) {
  if (!list.length) {
    reset()
    return
  }
  try {
    src.value = await decodeToCanvas(list[0])
    file.value = list[0]
    cx.value = 0.5
    cy.value = 0.5
    dr.value = 1
    result.value = null
    await nextTick()
    if (mounted) mounted.remove()
    if (stage.value) {
      const v = document.createElement('canvas')
      v.width = src.value.width
      v.height = src.value.height
      v.getContext('2d')!.drawImage(src.value, 0, 0)
      v.style.maxWidth = '100%'
      v.style.height = 'auto'
      v.style.display = 'block'
      v.style.cursor = 'move'
      v.style.touchAction = 'none'
      stage.value.insertBefore(v, stage.value.firstChild)
      mounted = v
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function reset() {
  src.value = null
  file.value = null
  result.value = null
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

/* ---------- 圆框交互 ---------- */
let dragStart: { x: number; y: number; cx: number; cy: number } | null = null
function onDown(e: PointerEvent) {
  if (!mounted || !e.isPrimary) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const rect = mounted.getBoundingClientRect()
  dragStart = { x: e.clientX / rect.width, y: e.clientY / rect.height, cx: cx.value, cy: cy.value }
  dragging.value = true
  crossVisible.value = true
}
function onMove(e: PointerEvent) {
  if (!dragging.value || !dragStart || !mounted) return
  const rect = mounted.getBoundingClientRect()
  const dx = (e.clientX - dragStart.x * rect.width) / rect.width
  const dy = (e.clientY - dragStart.y * rect.height) / rect.height
  const half = (dr.value / 2) * (Math.min(mounted.width, mounted.height) / mounted.width)
  const halfY = (dr.value / 2) * (Math.min(mounted.width, mounted.height) / mounted.height)
  cx.value = Math.max(half, Math.min(1 - half, dragStart.cx + dx))
  cy.value = Math.max(halfY, Math.min(1 - halfY, dragStart.cy + dy))
}
function onUp() {
  dragging.value = false
  dragStart = null
  // rx4：松手 1s 后准星淡出
  setTimeout(() => {
    if (!dragging.value) crossVisible.value = false
  }, 1000)
}
function onWheel(e: WheelEvent) {
  if (!mounted) return
  e.preventDefault()
  const next = e.deltaY < 0 ? dr.value * 1.06 : dr.value / 1.06
  dr.value = Math.min(1, Math.max(0.1, Number(next.toFixed(3))))
}

/** 按当前选框裁圆（rx1），可指定输出尺寸（rx2） */
function cropCircle(): HTMLCanvasElement | null {
  const s = src.value
  if (!s) return null
  const short = Math.min(s.width, s.height)
  const d = dr.value * short
  const rx = cx.value * s.width
  const ry = cy.value * s.height
  const target = outSize.value > 0 ? outSize.value : Math.round(d)
  const out = document.createElement('canvas')
  out.width = target
  out.height = target
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.beginPath()
  ctx.arc(target / 2, target / 2, target / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(s, rx - d / 2, ry - d / 2, d, d, 0, 0, target, target)
  result.value = out
  return out
}

async function produce(mime: string, quality: number): Promise<Blob> {
  const c = cropCircle()
  if (!c) throw new Error('尚未载入图片')
  return canvasToBlob(c, mime, quality)
}

/** 小尺寸回看（rx5） */
function thumb(size: number): string {
  const r = result.value
  if (!r) return ''
  const t = document.createElement('canvas')
  t.width = size
  t.height = size
  t.getContext('2d')!.drawImage(r, 0, 0, size, size)
  return t.toDataURL('image/png')
}

function goCrop() {
  if (file.value) handoffImage(file.value)
  toast.ok('已带入裁剪工具')
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放头像图片到此处"
      hint="拖动圆框选好位置，滚轮缩放圆框大小，输出透明背景圆形 PNG"
      @files="onFiles"
    />
    <div v-else>
      <div ref="stage" class="stage mt-2" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @wheel="onWheel">
        <div
          class="circle-box"
          :style="{
            left: `${cx * 100}%`,
            top: `${cy * 100}%`,
            width: `${dr * Math.min(1, (src?.height ?? 1) / (src?.width ?? 1)) * 100}%`,
          }"
        >
          <span class="cross" :class="{ hide: !crossVisible }"></span>
        </div>
      </div>
      <p class="muted small mt-1">拖动圆框选择保留区，滚轮缩放圆框；虚线为准星参考线。</p>

      <div class="row row-wrap mt-1" style="gap: 8px">
        <span class="field-label">输出尺寸</span>
        <button v-for="c in SIZE_CHIPS" :key="c.v" class="chip" :class="{ active: outSize === c.v }" @click="outSize = c.v">
          {{ c.t }}
        </button>
        <span class="row" style="margin-left: auto; gap: 6px">
          <button class="btn btn-ghost btn-sm" @click="goCrop"><Scissors :size="14" /> 先去裁剪主体</button>
          <button class="btn btn-ghost btn-sm" @click="reset">换一张</button>
        </span>
      </div>

      <ExportBar
        class="mt-2"
        :produce="produce"
        :base-name="file ? file.name.replace(/\.[^.]+$/, '') : 'avatar'"
        :dirty-token="`${cx}-${cy}-${dr}-${outSize}`"
        button-text="下载圆形 PNG"
      />

      <div v-if="result" class="mini mt-2">
        <span class="field-label">小尺寸回看（头像实际观感）</span>
        <div class="mini-row">
          <img :src="thumb(64)" width="64" height="64" alt="64px 预览" />
          <img :src="thumb(128)" width="128" height="128" alt="128px 预览" />
          <span class="muted small">64px / 128px</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
  line-height: 0;
}
.circle-box {
  position: absolute;
  transform: translate(-50%, -50%);
  aspect-ratio: 1 / 1;
  border-radius: 999px;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
.cross::before,
.cross::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.8);
}
.cross::before {
  left: 50%;
  top: 20%;
  bottom: 20%;
  width: 1.5px;
  margin-left: -0.75px;
}
.cross::after {
  top: 50%;
  left: 20%;
  right: 20%;
  height: 1.5px;
  margin-top: -0.75px;
}
.cross {
  position: absolute;
  inset: 0;
  transition: opacity 0.6s ease;
}
.cross.hide {
  opacity: 0;
}
.mini-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px;
}
.mini-row img {
  border-radius: 999px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 10px 10px;
}
</style>
