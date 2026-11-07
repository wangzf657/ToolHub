<script setup lang="ts">
/** 瑕疵修补笔：点击瑕疵点，用周围环形像素均值自然修复（小笔刷点按式） */
import { ref, shallowRef, nextTick } from 'vue'
import { Download, Undo2 } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const work = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const radius = ref(9)
const history = shallowRef<ImageData[]>([])

let mounted: HTMLCanvasElement | null = null

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  try {
    const c = await decodeToCanvas(files[0])
    file.value = files[0]
    const w = document.createElement('canvas')
    w.width = c.width
    w.height = c.height
    w.getContext('2d')!.drawImage(c, 0, 0)
    work.value = w
    history.value = []
    await nextTick()
    if (mounted) mounted.remove()
    if (stage.value) {
      w.style.maxWidth = '100%'
      w.style.height = 'auto'
      w.style.display = 'block'
      w.style.cursor = 'crosshair'
      stage.value.appendChild(w)
      mounted = w
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function resetAll() {
  work.value = null
  file.value = null
  history.value = []
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

function heal(e: MouseEvent) {
  const c = work.value
  if (!c) return
  history.value = [...history.value.slice(-7), c.getContext('2d')!.getImageData(0, 0, c.width, c.height)]
  const rect = c.getBoundingClientRect()
  const cx = ((e.clientX - rect.left) / rect.width) * c.width
  const cy = ((e.clientY - rect.top) / rect.height) * c.height
  const r = radius.value
  const W = c.width
  const H = c.height
  const ctx = c.getContext('2d')!
  const id = ctx.getImageData(0, 0, W, H)
  const d = id.data
  // 环形采样（半径 r+3 到 r*1.9）取平均色
  let sr = 0, sg = 0, sb = 0, n = 0
  const r0 = r + 3
  const r1 = r * 1.9
  for (let y = Math.max(0, cy - r1) | 0; y <= Math.min(H - 1, cy + r1); y++) {
    for (let x = Math.max(0, cx - r1) | 0; x <= Math.min(W - 1, cx + r1); x++) {
      const dist = Math.hypot(x - cx, y - cy)
      if (dist < r0 || dist > r1) continue
      const i = ((y | 0) * W + (x | 0)) * 4
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++
    }
  }
  if (!n) return
  const ar = sr / n, ag = sg / n, ab = sb / n
  // 圆形区域填充均值色（略加透明渐变让边缘更自然）
  for (let y = Math.max(0, cy - r) | 0; y <= Math.min(H - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r) | 0; x <= Math.min(W - 1, cx + r); x++) {
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > r) continue
      const i = ((y | 0) * W + (x | 0)) * 4
      const k = dist > r * 0.75 ? 0.55 : 1 // 边缘 25% 半透明过渡
      d[i] = d[i] * (1 - k) + ar * k
      d[i + 1] = d[i + 1] * (1 - k) + ag * k
      d[i + 2] = d[i + 2] * (1 - k) + ab * k
    }
  }
  ctx.putImageData(id, 0, 0)
}

function undo() {
  const c = work.value
  const snap = history.value[history.value.length - 1]
  if (!c || !snap) return
  c.getContext('2d')!.putImageData(snap, 0, 0)
  history.value = history.value.slice(0, -1)
}

async function download() {
  if (!work.value || !file.value) return
  const blob = await canvasToBlob(work.value, 'image/png')
  saveBlob(blob, `${baseName(file.value.name)}-fixed.png`)
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!work"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="点按痘印 / 灰尘 / 划痕即可用周围肤色补上"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 14px">
        <div style="min-width: 220px">
          <span class="field-label">修复半径：{{ radius }} px</span>
          <input v-model.number="radius" type="range" min="4" max="40" step="1" />
        </div>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length" @click="undo"><Undo2 :size="14" /> 撤销</button>
        <button class="btn btn-ghost btn-sm" @click="resetAll">换一张</button>
      </div>

      <div ref="stage" class="stage mt-2" @click="heal"></div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="download"><Download :size="16" /> 下载结果 PNG</button>
        <span class="muted small">小瑕疵用小半径逐个点；修复半径应略大于瑕疵本身</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
}
</style>
