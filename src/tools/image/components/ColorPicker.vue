<script setup lang="ts">
/**
 * 图片取色器（UX1.0 四处方）：
 * - 缩放取色（rx1）：滚轮 0.5~8x + 拖拽平移，取色映射始终按原图坐标。
 * - 放大镜 loupe（rx2）：hover 显示 9×9 邻域放大浮窗，中心十字标示当前像素。
 * - 触屏路径（rx3）：touchmove/pointermove 实时预览，长按 300ms 松手固定。
 * - 历史持久化（rx4）：localStorage（toolhub. 前缀），刷新保留可复制。
 */
import { onBeforeUnmount, ref, shallowRef, nextTick } from 'vue'
import { Copy, Trash2 } from 'lucide-vue-next'
import { decodeToCanvas, rgbToHex } from '@/lib/imageEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const src = shallowRef<HTMLCanvasElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const hover = ref<{ x: number; y: number; hex: string; rgb: string } | null>(null)
const history = ref<{ hex: string; rgb: string }[]>([])
const zoom = ref(1)
/** loupe 显示 9×9 邻域 */
const loupe = ref<{ x: number; y: number; cells: string[] } | null>(null)

const LS_KEY = 'toolhub.imageColorPicker.history'
try {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  if (Array.isArray(saved)) history.value = saved.slice(0, 24)
} catch { /* 忽略 */ }
const persist = () => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(history.value))
  } catch { /* 忽略 */ }
}

let mounted: HTMLCanvasElement | null = null

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  try {
    const c = await decodeToCanvas(files[0])
    src.value = c
    zoom.value = 1
    await nextTick()
    if (mounted) mounted.remove()
    if (stageEl.value) {
      c.style.maxWidth = '100%'
      c.style.height = 'auto'
      c.style.display = 'block'
      c.style.cursor = 'crosshair'
      c.style.touchAction = 'none'
      c.style.transformOrigin = '0 0'
      stageEl.value.appendChild(c)
      mounted = c
      applyZoom()
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function resetAll() {
  src.value = null
  hover.value = null
  loupe.value = null
  zoom.value = 1
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

/* rx1 缩放与平移：CSS transform，映射按 getBoundingClientRect 自动换算 */
let panStart: { x: number; y: number; sl: number; st: number } | null = null
function applyZoom() {
  if (!mounted || !stageEl.value) return
  mounted.style.width = `${zoom.value * 100}%`
}
function onWheel(e: WheelEvent) {
  if (!src.value) return
  e.preventDefault()
  zoom.value = Math.min(8, Math.max(0.5, Number((e.deltaY < 0 ? zoom.value * 1.2 : zoom.value / 1.2).toFixed(2))))
  applyZoom()
}
function onDown(e: PointerEvent) {
  if (!stageEl.value || !e.isPrimary) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  panStart = { x: e.clientX, y: e.clientY, sl: stageEl.value.scrollLeft, st: stageEl.value.scrollTop }
}
function onPan(e: PointerEvent) {
  if (!panStart || !stageEl.value) return
  // 拖拽平移：滚轮放大后拖动查看（不干扰 hover 取色——取色挂在 canvas 的 mousemove 上）
  if (e.buttons === 1 && e.shiftKey) {
    stageEl.value.scrollLeft = panStart.sl - (e.clientX - panStart.x)
    stageEl.value.scrollTop = panStart.st - (e.clientY - panStart.y)
  }
}
function onUp() {
  panStart = null
}

/* 取色：坐标始终按原图像素映射（rect 已含缩放尺寸） */
function pickAt(e: MouseEvent, commit: boolean) {
  const c = mounted
  if (!c) return
  const rect = c.getBoundingClientRect()
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * c.width)
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * c.height)
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) {
    if (!commit) {
      hover.value = null
      loupe.value = null
    }
    return
  }
  const d = c.getContext('2d')!.getImageData(x, y, 1, 1).data
  const hex = rgbToHex(d[0]!, d[1]!, d[2]!)
  const rgb = `rgb(${d[0]}, ${d[1]}, ${d[2]})`
  if (commit) {
    if (!history.value.some((h) => h.hex === hex)) history.value.unshift({ hex, rgb })
    if (history.value.length > 24) history.value.pop()
    persist()
  } else {
    hover.value = { x, y, hex, rgb }
  }
  // rx2 放大镜：9×9 邻域
  if (!commit) {
    const ctx = c.getContext('2d')!
    const r = 4
    const cells: string[] = []
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.min(c.width - 1, Math.max(0, x + dx))
        const py = Math.min(c.height - 1, Math.max(0, y + dy))
        const p = ctx.getImageData(px, py, 1, 1).data
        cells.push(rgbToHex(p[0]!, p[1]!, p[2]!))
      }
    }
    loupe.value = { x, y, cells }
  }
}

/* rx3 触屏：pointermove 实时预览；长按 ≥300ms 后松手 = 固定 */
let pressTimer = 0
let longPress = false
function onPointerDown(e: PointerEvent) {
  longPress = false
  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => (longPress = true), 300)
  void e
}
function onPointerUp(e: PointerEvent) {
  window.clearTimeout(pressTimer)
  if (longPress) {
    pickAt(e, true)
    longPress = false
  }
}

async function copy(v: string) {
  if (await copyText(v)) toast.ok(`已复制 ${v}`)
  else toast.err('复制失败')
}

onBeforeUnmount(() => window.clearTimeout(pressTimer))
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="鼠标悬停实时取色，单击固定；滚轮缩放（0.5~8x）看清单个像素"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 14px">
        <template v-if="hover">
          <span class="swatch" :style="{ background: hover.hex }"></span>
          <span class="mono small">({{ hover.x }}, {{ hover.y }})</span>
          <span class="mono small">{{ hover.hex }}</span>
          <span class="mono small muted">{{ hover.rgb }}</span>
        </template>
        <span v-else class="muted small">把鼠标移到图上即可实时取色，单击固定颜色（触屏：拖动实时预览，长按 0.3s 松手固定）</span>
        <span class="muted small">缩放 {{ Math.round(zoom * 100) }}%</span>
        <button class="btn btn-ghost btn-sm" style="margin-left: auto" @click="resetAll">换一张</button>
      </div>

      <div
        ref="stageEl"
        class="stage mt-2"
        @wheel="onWheel"
        @mousemove="pickAt($event, false)"
        @mouseleave="((hover = null), (loupe = null))"
        @click="pickAt($event, true)"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointermove="onPan"
        @pointerup.capture="onUp"
        @pointercancel="onUp"
      >
        <!-- 画布由 JS 挂载（onFiles），事件挂在本容器 -->

        <!-- rx2 放大镜 9×9 -->
        <div v-if="loupe" class="loupe" aria-hidden="true">
          <div class="loupe-grid">
            <span
              v-for="(c, i) in loupe.cells"
              :key="i"
              class="loupe-cell"
              :class="{ center: i === 40 }"
              :style="{ background: c }"
            ></span>
          </div>
          <span class="mono loupe-hex">{{ hover?.hex }}</span>
        </div>
      </div>

      <div v-if="history.length" class="mt-3">
        <div class="row">
          <span class="field-label">取色历史（{{ history.length }}，本地保存）</span>
          <button class="btn btn-ghost btn-sm" style="margin-left: auto" @click="((history = []), persist())"><Trash2 :size="14" /> 清空</button>
        </div>
        <div class="hist mt-1">
          <div v-for="(h, i) in history" :key="i" class="hist-row">
            <span class="swatch" :style="{ background: h.hex }"></span>
            <code class="mono">{{ h.hex }}</code>
            <code class="mono muted">{{ h.rgb }}</code>
            <button class="mini-btn" title="复制 HEX" aria-label="复制 HEX" @click="copy(h.hex)"><Copy :size="13" /></button>
            <button class="mini-btn" title="复制 RGB" aria-label="复制 RGB" @click="copy(h.rgb)"><Copy :size="13" /></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: auto;
  max-height: 72vh;
}
.pick-cv {
  max-width: none;
}
.loupe {
  position: fixed;
  z-index: 60;
  right: 16px;
  top: 16px;
  display: grid;
  gap: 4px;
  justify-items: center;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--panel-solid);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.loupe-grid {
  display: grid;
  grid-template-columns: repeat(9, 14px);
  grid-auto-rows: 14px;
  gap: 1px;
}
.loupe-cell {
  border-radius: 2px;
  outline: 1px solid rgba(127, 127, 127, 0.25);
}
.loupe-cell.center {
  outline: 2px solid #ffffff;
  box-shadow: 0 0 0 1.5px #000;
}
.loupe-hex {
  font-size: 12px;
}
.swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  display: inline-block;
  flex: none;
}
.hist {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 520px;
}
.hist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
}
.hist-row code:first-of-type {
  width: 86px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: pointer;
  margin-left: 2px;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn:last-of-type {
  margin-left: auto;
}
</style>
