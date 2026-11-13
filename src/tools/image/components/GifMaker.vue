<script setup lang="ts">
/**
 * GIF 动图制作（UX1.0）：
 * - 拖拽排序（rx2/F-缩略图排序）：帧条 DnD 换位并同步 FileDrop 列表，↑↓ 按钮保留（触屏兜底）。
 * - 循环设置（rx3）：无限循环（默认）/播放 1 次/播放 N 次，透传 NETSCAPE 循环扩展。
 * - 逐帧延迟（rx4）：每格独立延迟输入（初始=全局值），全局滑杆改为「应用到全部」。
 * - 确认制（rx5）：生成后仅出预览，「下载 GIF」显式触发，不再自动下载。
 */
import { ref, shallowRef } from 'vue'
import { Loader2, Download, Trash2 } from 'lucide-vue-next'
import { decodeToCanvas } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const dropRef = ref<InstanceType<typeof FileDrop> | null>(null)
const files = ref<File[]>([])
interface Frame {
  cv: HTMLCanvasElement
  url: string
  delay: number
}
const frames = shallowRef<Frame[]>([])
const delay = ref(200)
const repeat = ref('inf') // inf | once | N（数字字符串）
const repeatN = ref(2)
const outWidth = ref(480)
const running = ref(false)
const progress = ref(0)
const outBlob = shallowRef<Blob | null>(null)
const outUrl = ref('')
let dragIdx = -1

async function loadAll(list: File[]) {
  files.value = list
  if (!list.length) {
    frames.value = []
    outBlob.value = null
    if (outUrl.value) URL.revokeObjectURL(outUrl.value)
    outUrl.value = ''
    return
  }
  const arr: Frame[] = []
  try {
    for (let i = 0; i < list.length; i++) {
      const cv = await decodeToCanvas(list[i]!)
      // 复用已有帧的延迟设置（追加时保持旧值）
      const prev = frames.value[i]
      arr.push({ cv, url: cv.toDataURL('image/png'), delay: prev?.delay ?? delay.value })
    }
    frames.value = arr
    outWidth.value = Math.min(480, arr[0]!.cv.width)
  } catch (e) {
    toast.err((e as Error).message || '有图片解码失败')
  }
}

/** 重排：帧条与 FileDrop 列表同步 */
function reorder(from: number, to: number) {
  if (from === to || to < 0 || to >= frames.value.length) return
  const arr = [...frames.value]
  const [m] = arr.splice(from, 1)
  arr.splice(to, 0, m!)
  frames.value = arr
  const fs = [...files.value]
  const [mf] = fs.splice(from, 1)
  fs.splice(to, 0, mf!)
  files.value = fs
  if (dropRef.value) dropRef.value.files = fs
}

function onDropAt(to: number) {
  if (dragIdx >= 0) reorder(dragIdx, to)
  dragIdx = -1
}

/** 编码（本地 gifenc）：支持逐帧延迟与循环次数（repeat<0 不写循环扩展=播放一次；repeat 仅首帧生效） */
async function encode(scaled: HTMLCanvasElement[], delays: number[], repeatValue: number): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const enc = GIFEncoder()
  // gifenc 实际支持 repeat 选项（src/env.d.ts 声明未覆盖），此处本地放宽类型
  const writeFrame = enc.writeFrame as (i: Uint8Array, w: number, h: number, o: Record<string, unknown>) => void
  const w = scaled[0]!.width
  const h = scaled[0]!.height
  for (let i = 0; i < scaled.length; i++) {
    const ctx = scaled[i]!.getContext('2d')!
    const id = ctx.getImageData(0, 0, w, h)
    const palette = quantize(id.data, 256)
    const index = applyPalette(id.data, palette)
    writeFrame(index, w, h, { palette, delay: delays[i] ?? 200, repeat: i === 0 ? repeatValue : undefined })
  }
  enc.finish()
  return new Blob([enc.bytes()], { type: 'image/gif' })
}

async function make() {
  if (frames.value.length < 2) {
    toast.warn('请至少选择两张图片')
    return
  }
  running.value = true
  progress.value = 0
  try {
    const first = frames.value[0]!.cv
    const w = Math.max(16, Math.round(outWidth.value || first.width))
    const h = Math.max(1, Math.round((w * first.height) / first.width))
    const scaled = frames.value.map((f) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(f.cv, 0, 0, w, h)
      return c
    })
    const rv = repeat.value === 'inf' ? 0 : repeat.value === 'once' ? -1 : Math.max(0, repeatN.value - 1)
    const delays = frames.value.map((f) => f.delay)
    const blob = await encode(scaled, delays, rv)
    // UX1.0 rx5 确认制：只生成预览，不自动下载
    if (outUrl.value) URL.revokeObjectURL(outUrl.value)
    outBlob.value = blob
    outUrl.value = URL.createObjectURL(blob)
    progress.value = 100
    toast.ok(`GIF 已生成（${(blob.size / 1024).toFixed(0)} KB），请预览后点击下载`)
  } catch (e) {
    toast.err((e as Error).message || 'GIF 编码失败')
  } finally {
    running.value = false
  }
}

function download() {
  if (outBlob.value) saveBlob(outBlob.value, 'animation.gif')
}

function applyDelayToAll() {
  frames.value = frames.value.map((f) => ({ ...f, delay: delay.value }))
}
</script>

<template>
  <div>
    <FileDrop
      ref="dropRef"
      accept="image/*"
      :multiple="true"
      label="拖放一组图片到此处（按顺序组成动画帧）"
      hint="下方帧条可拖拽换位，每帧可单独设延迟"
      @files="loadAll"
    />

    <div class="row row-wrap mt-2" style="gap: 18px">
      <div style="min-width: 200px">
        <span class="field-label">默认每帧延迟：{{ delay }} ms</span>
        <input v-model.number="delay" type="range" min="20" max="1000" step="10" />
        <button class="btn btn-ghost btn-sm" @click="applyDelayToAll">应用到全部帧</button>
      </div>
      <label class="opt">
        <span class="field-label">循环设置</span>
        <select v-model="repeat" class="select" style="width: 130px">
          <option value="inf">无限循环（默认）</option>
          <option value="once">播放 1 次</option>
          <option value="n">播放 N 次</option>
        </select>
        <input v-if="repeat === 'n'" v-model.number="repeatN" type="number" min="2" max="100" class="input" style="width: 90px; margin-top: 4px" />
      </label>
      <label class="opt">
        <span class="field-label">输出宽度（px）</span>
        <input v-model.number="outWidth" type="number" min="16" class="input" style="width: 120px" />
      </label>
      <button class="btn btn-primary" :disabled="running || frames.length < 2" @click="make" style="align-self: flex-end">
        <Loader2 v-if="running" :size="16" class="spin" /><Download v-else :size="16" /> 生成预览
      </button>
    </div>

    <!-- 帧条：缩略图 + 拖拽排序 + 逐帧延迟 -->
    <div v-if="frames.length" class="strip mt-2">
      <div class="muted small" style="padding: 4px 8px 0">
        已加载 {{ frames.length }} 帧 · 首帧 {{ frames[0].cv.width }} × {{ frames[0].cv.height }} · 拖动缩略图换位
      </div>
      <div class="strip-row">
        <div v-for="(f, i) in frames" :key="f.url + i" class="cell" draggable="true" @dragstart="dragIdx = i" @dragover.prevent @drop.prevent="onDropAt(i)">
          <img :src="f.url" :alt="`第 ${i + 1} 帧`" />
          <span class="idx">{{ i + 1 }}</span>
          <span class="cell-ops">
            <button class="mini-btn" title="上移" @click="reorder(i, i - 1)">↑</button>
            <button class="mini-btn" title="下移" @click="reorder(i, i + 1)">↓</button>
            <button class="mini-btn" title="移除该帧" @click="((frames = frames.filter((_, j) => j !== i)), (files = files.filter((_, j) => j !== i)), dropRef && (dropRef.files = files))">
              <Trash2 :size="12" />
            </button>
          </span>
          <input v-model.number="f.delay" type="number" min="20" step="10" class="input cell-delay" :title="`第 ${i + 1} 帧延迟（ms）`" />
        </div>
      </div>
    </div>

    <div v-if="running" class="progress mt-2">
      <div class="progress-bar" :style="{ width: progress + '%' }"></div>
    </div>
    <!-- 预览先行：生成后页内播放，确认后下载 -->
    <div v-if="outUrl && !running" class="preview mt-2">
      <img :src="outUrl" alt="GIF 预览" class="pv-img" />
      <div class="row mt-1">
        <button class="btn btn-primary" @click="download"><Download :size="15" /> 下载 GIF（{{ (outBlob!.size / 1024).toFixed(0) }} KB）</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.strip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px;
}
.cell {
  position: relative;
  flex: none;
  width: 96px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  cursor: grab;
}
.cell img {
  width: 100%;
  height: 64px;
  object-fit: contain;
  pointer-events: none;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 10px 10px;
  border-radius: 6px;
}
.idx {
  position: absolute;
  top: 6px;
  left: 6px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 10.5px;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 6px;
}
.cell-ops {
  display: flex;
  gap: 3px;
  margin-top: 3px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  width: 22px;
  height: 20px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 11px;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.cell-delay {
  width: 100%;
  margin-top: 3px;
  font-size: 12px;
  padding: 3px 6px;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.2s ease;
}
.preview {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.pv-img {
  max-width: 100%;
  max-height: min(50vh, 520px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 8px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
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
