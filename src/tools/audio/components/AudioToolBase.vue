<script setup lang="ts">
/**
 * 音频工具基础组件（本目录共享）：
 * FileDrop(audio/*) → decodeAudio 解码（进度提示）→ 元信息条（时长/声道/采样率）→
 * 可交互波形（点击定位播放头 / 拖拽选区，选区变化 emit select）→ 选项插槽。
 * 子组件通过 expose 的 buffer / file / meta / selection / playPreview / stopPreview 操作，
 * setBusy 显示处理中状态，reload 重新解码。
 */
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { FileAudio, Loader2, Play, RotateCcw, Square } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeAudio, waveformCanvas } from '@/lib/audioEngine'
import { fmtTime, sizeLabel } from './shared'
import { useToast } from '@/composables/useToast'

withDefaults(defineProps<{ showWave?: boolean }>(), { showWave: true })

const emit = defineEmits<{ loaded: [buffer: AudioBuffer, file: File]; clear: []; select: [start: number, end: number] }>()
const toast = useToast()

const loading = ref(false)
const busy = ref(false)
const file = ref<File | null>(null)
const buffer = shallowRef<AudioBuffer | null>(null)
const meta = ref<{ duration: number; channels: number; sampleRate: number } | null>(null)
const waveStage = ref<HTMLElement | null>(null)

/* ---------- 加载与解码 ---------- */

/** 加载并解码音频文件（供文件选择与外部复用） */
async function loadFile(f: File) {
  loading.value = true
  stopPreview()
  try {
    const buf = await decodeAudio(f)
    buffer.value = buf
    file.value = f
    meta.value = { duration: buf.duration, channels: buf.numberOfChannels, sampleRate: buf.sampleRate }
    selection.value = null
    playhead.value = 0
    emit('loaded', buf, f)
  } catch (e) {
    toast.err((e as Error).message || '音频解码失败：浏览器不支持该格式，请先转成 WAV / MP3 再试')
    resetAll()
  } finally {
    loading.value = false
  }
}

function onFiles(files: File[]) {
  if (!files.length) resetAll()
  else void loadFile(files[0])
}

function resetAll() {
  stopPreview()
  buffer.value = null
  file.value = null
  meta.value = null
  selection.value = null
  emit('clear')
}

/** 子组件标记「处理中」状态（显示忙提示条） */
function setBusy(v: boolean) {
  busy.value = v
}

/** 重新解码当前文件 */
async function reload() {
  if (file.value) await loadFile(file.value)
}

/* ---------- 波形：底图一次绘制，选区/播放头叠加层轻量重绘 ---------- */

let baseCanvas: HTMLCanvasElement | null = null
let viewCanvas: HTMLCanvasElement | null = null
let ro: ResizeObserver | null = null
/** 选区（秒）；null 表示整段 */
const selection = ref<{ start: number; end: number } | null>(null)
/** 播放头位置（秒） */
const playhead = ref(0)
const playing = ref(false)

function drawWave() {
  const buf = buffer.value
  const stage = waveStage.value
  if (!buf || !stage) return
  const w = Math.max(280, stage.clientWidth)
  if (!baseCanvas || baseCanvas.width !== w) {
    baseCanvas = waveformCanvas(buf, w, 110, '#818cf8')
  }
  if (!viewCanvas) {
    viewCanvas = document.createElement('canvas')
    viewCanvas.style.maxWidth = '100%'
    viewCanvas.style.display = 'block'
    viewCanvas.style.cursor = 'crosshair'
    viewCanvas.style.touchAction = 'none'
    stage.replaceChildren(viewCanvas)
  }
  viewCanvas.width = baseCanvas.width
  viewCanvas.height = baseCanvas.height
  const ctx = viewCanvas.getContext('2d')!
  ctx.drawImage(baseCanvas, 0, 0)
  const H = viewCanvas.height
  const dur = buf.duration || 1
  // 选区高亮（半透明遮罩留亮窗）
  const sel = selection.value
  if (sel) {
    const x1 = (Math.min(sel.start, sel.end) / dur) * w
    const x2 = (Math.max(sel.start, sel.end) / dur) * w
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, x1, H)
    ctx.fillRect(x2, 0, w - x2, H)
    ctx.fillStyle = 'rgba(129,140,248,0.18)'
    ctx.fillRect(x1, 0, x2 - x1, H)
  }
  // 播放头
  const px = (playhead.value / dur) * w
  ctx.fillStyle = '#f97316'
  ctx.fillRect(Math.max(0, Math.min(w - 2, px)), 0, 2, H)
}

/* ---------- 波形交互：点击定位播放头，拖拽选择区间 ---------- */

let dragging = false
let dragStartT = 0
let dragMoved = false

const timeAt = (ev: PointerEvent): number => {
  const stage = waveStage.value
  const buf = buffer.value
  if (!stage || !buf) return 0
  const rect = stage.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left))
  return (x / rect.width) * buf.duration
}

function onPointerDown(ev: PointerEvent) {
  if (!buffer.value) return
  ;(ev.target as HTMLElement).setPointerCapture(ev.pointerId)
  dragging = true
  dragMoved = false
  dragStartT = timeAt(ev)
}

function onPointerMove(ev: PointerEvent) {
  if (!dragging || !buffer.value) return
  const t = timeAt(ev)
  if (Math.abs(t - dragStartT) > 0.05) dragMoved = true
  if (dragMoved) {
    selection.value = { start: Math.min(dragStartT, t), end: Math.max(dragStartT, t) }
    drawWave()
  }
}

function onPointerUp() {
  if (!dragging || !buffer.value) return
  dragging = false
  if (dragMoved) {
    // 拖拽完成 → 通知子工具同步选区（拖反了自动扶正）
    const sel = selection.value
    if (sel && sel.end - sel.start < 0.05) {
      selection.value = null
    } else if (sel) {
      emit('select', sel.start, sel.end)
    }
  } else {
    // 单击 → 定位播放头并清除选区
    selection.value = null
    playhead.value = dragStartT
  }
  drawWave()
}

/* ---------- 统一试听句柄：播放选区或整段，可停、防叠播、播放头动画 ---------- */

let audioCtx: AudioContext | null = null
let srcNode: AudioBufferSourceNode | null = null
let rafId = 0
let playStartedAt = 0
let playOffset = 0

/** 播放选区（无选区则整段），再次调用前自动停止上一段（防叠播） */
function playPreview() {
  const buf = buffer.value
  if (!buf) return
  stopPreview()
  audioCtx = audioCtx ?? new AudioContext()
  void audioCtx.resume()
  const sel = selection.value
  const from = sel ? Math.min(sel.start, sel.end) : playhead.value >= buf.duration - 0.05 ? 0 : playhead.value
  const to = sel ? Math.max(sel.start, sel.end) : buf.duration
  if (to - from <= 0.02) return
  const node = audioCtx.createBufferSource()
  node.buffer = buf
  node.connect(audioCtx.destination)
  const when = audioCtx.currentTime + 0.02
  node.start(when, from, to - from)
  node.onended = () => {
    if (srcNode === node) {
      playing.value = false
      playhead.value = to
      cancelAnimationFrame(rafId)
      drawWave()
    }
  }
  srcNode = node
  playing.value = true
  playStartedAt = when
  playOffset = from
  const tick = () => {
    if (audioCtx && srcNode === node) {
      playhead.value = playOffset + Math.max(0, audioCtx.currentTime - playStartedAt)
      drawWave()
      rafId = requestAnimationFrame(tick)
    }
  }
  rafId = requestAnimationFrame(tick)
}

function stopPreview() {
  cancelAnimationFrame(rafId)
  if (srcNode) {
    try {
      srcNode.onended = null
      srcNode.stop()
    } catch {
      /* 已结束的节点忽略 */
    }
    srcNode = null
  }
  playing.value = false
}

/** 外部工具也可直接播放指定区间（如试听处理结果前先回放原片段） */
function playRange(from: number, to: number) {
  const buf = buffer.value
  if (!buf) return
  playhead.value = Math.max(0, Math.min(from, buf.duration))
  selection.value = { start: Math.max(0, from), end: Math.min(to, buf.duration) }
  drawWave()
  playPreview()
}

onBeforeUnmount(() => {
  stopPreview()
  ro?.disconnect()
  void audioCtx?.close()
})

watch(buffer, () => {
  baseCanvas = null // 新文件需重绘底图（宽度相同也不能复用旧波形）
  requestAnimationFrame(drawWave)
  stopPreview()
}, { flush: 'post' })
watch(waveStage, (el) => {
  ro?.disconnect()
  ro = null
  viewCanvas = null
  if (el) {
    ro = new ResizeObserver(() => drawWave())
    ro.observe(el)
  }
})

defineExpose({ buffer, file, meta, selection, playhead, setBusy, reload, loadFile, playPreview, stopPreview, playRange, reset: resetAll })
</script>

<template>
  <div>
    <FileDrop
      v-if="!buffer && !loading"
      accept="audio/*"
      :multiple="false"
      label="拖放音频到此处，或点击选择"
      hint="支持 WAV / MP3 / OGG / M4A / FLAC 等浏览器可解码格式 · 全部本地处理"
      @files="onFiles"
    />
    <div v-else>
      <div v-if="loading" class="at-loading"><Loader2 :size="18" class="spin" /> 正在解码音频…</div>
      <template v-else>
        <div class="at-meta">
          <span class="name" :title="file?.name"><FileAudio :size="15" /> {{ file?.name ?? '未命名' }}</span>
          <span v-if="file">· {{ sizeLabel(file.size) }}</span>
          <template v-if="meta">
            <span>时长 {{ fmtTime(meta.duration) }}</span>
            <span>声道 {{ meta.channels === 1 ? '单声道' : meta.channels === 2 ? '立体声' : `${meta.channels} 声道` }}</span>
            <span>采样率 {{ (meta.sampleRate / 1000).toFixed(1) }} kHz</span>
          </template>
          <span v-if="selection" class="sel-tag">选区 {{ fmtTime(selection.start) }} – {{ fmtTime(selection.end) }}</span>
        </div>
        <div v-show="buffer" class="at-wave">
          <div
            ref="waveStage"
            class="wave-stage"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          ></div>
          <div class="wave-tip">点击定位播放头 · 拖拽选择区间 · 空白双击清除选区</div>
          <div class="row mt-1">
            <button class="btn btn-soft btn-sm" :disabled="!buffer" @click="playing ? stopPreview() : playPreview()">
              <Square v-if="playing" :size="14" /> 停止试听
              <template v-if="!playing"><Play :size="14" /> 试听{{ selection ? '选区' : '' }}</template>
            </button>
            <button
              v-if="selection"
              class="btn btn-ghost btn-sm"
              @click="selection = null; drawWave()"
            >
              清除选区
            </button>
          </div>
        </div>
        <div v-if="busy" class="at-busy"><Loader2 :size="14" class="spin" /> 正在处理，请稍候…</div>
        <slot />
        <div class="row mt-2">
          <button class="btn btn-ghost btn-sm" @click="resetAll"><RotateCcw :size="14" /> 换一个文件</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.at-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 13px;
  color: var(--text-2);
}
.name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text);
}
.sel-tag {
  color: var(--accent-text);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
.at-wave {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
  overflow: hidden;
}
.wave-stage {
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}
.wave-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.at-busy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 13.5px;
}
.at-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px 0;
  color: var(--text-2);
  font-size: 14px;
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
