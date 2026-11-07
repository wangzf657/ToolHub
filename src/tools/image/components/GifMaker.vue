<script setup lang="ts">
/** GIF 动图制作：多图串帧、帧延迟可调、统一缩放，gifenc 本地编码 */
import { ref, shallowRef } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeToCanvas, encodeGif } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const files = ref<File[]>([])
const frames = shallowRef<HTMLCanvasElement[]>([])
const delay = ref(200)
const outWidth = ref(480)
const running = ref(false)
const progress = ref(0)
const outBlob = shallowRef<Blob | null>(null)

async function loadAll(list: File[]) {
  if (!list.length) {
    frames.value = []
    outBlob.value = null
    return
  }
  const arr: HTMLCanvasElement[] = []
  try {
    for (const f of list) arr.push(await decodeToCanvas(f))
    frames.value = arr
    outWidth.value = Math.min(480, arr[0].width)
  } catch (e) {
    toast.err((e as Error).message || '有图片解码失败')
  }
}

async function make() {
  if (frames.value.length < 2) {
    toast.warn('请至少选择两张图片')
    return
  }
  running.value = true
  progress.value = 0
  try {
    // 统一缩放：以首帧宽高比为基准
    const first = frames.value[0]
    const w = Math.max(16, Math.round(outWidth.value || first.width))
    const h = Math.max(1, Math.round((w * first.height) / first.width))
    const scaled = frames.value.map((f) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(f, 0, 0, w, h)
      return c
    })
    const blob = await encodeGif(scaled, delay.value, (p) => (progress.value = Math.round(p * 100)))
    outBlob.value = blob
    saveBlob(blob, 'animation.gif')
    toast.ok(`GIF 生成完成：${(blob.size / 1024).toFixed(0)} KB`)
  } catch (e) {
    toast.err((e as Error).message || 'GIF 编码失败')
  } finally {
    running.value = false
  }
}

function download() {
  if (outBlob.value) saveBlob(outBlob.value, 'animation.gif')
}
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="true"
      label="拖放一组图片到此处（按顺序组成动画帧）"
      hint="在文件列表里用 ↑ ↓ 调整帧顺序"
      @files="(f) => ((files = f), loadAll(f))"
    />

    <div class="row row-wrap mt-2" style="gap: 24px">
      <div style="min-width: 220px">
        <span class="field-label">每帧延迟：{{ delay }} ms</span>
        <input v-model.number="delay" type="range" min="50" max="1000" step="10" />
      </div>
      <label class="opt">
        <span class="field-label">输出宽度（px）</span>
        <input v-model.number="outWidth" type="number" min="16" class="input" style="width: 120px" />
      </label>
      <button class="btn btn-primary" :disabled="running || frames.length < 2" @click="make">
        <Loader2 v-if="running" :size="16" class="spin" /><Download v-else :size="16" /> 生成 GIF
      </button>
    </div>

    <div v-if="frames.length" class="muted small mt-1">
      已加载 {{ frames.length }} 帧 · 首帧 {{ frames[0].width }} × {{ frames[0].height }}，全部帧将统一缩放到同一尺寸
    </div>

    <div v-if="running" class="progress mt-2">
      <div class="progress-bar" :style="{ width: progress + '%' }"></div>
    </div>
    <div v-if="outBlob && !running" class="notice notice-ok mt-2">
      已生成 GIF（{{ (outBlob.size / 1024).toFixed(0) }} KB）
      <button class="btn btn-sm btn-primary" style="margin-left: auto" @click="download"><Download :size="14" /> 再下载一次</button>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
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
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
