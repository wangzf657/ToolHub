<script setup lang="ts">
/** SVG 转 PNG：按指定像素宽度栅格化，任意倍率不失真 */
import { ref, shallowRef, watch } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeSvg, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const width = ref(1024)
const stage = ref<HTMLElement | null>(null)
const running = ref(false)

let mounted: HTMLCanvasElement | null = null

async function rasterize() {
  if (!file.value) return
  running.value = true
  try {
    const c = await decodeSvg(file.value, Math.max(16, width.value || 1024))
    canvas.value = c
  } catch (e) {
    toast.err((e as Error).message || 'SVG 解析失败')
  } finally {
    running.value = false
  }
}

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    canvas.value = null
    return
  }
  file.value = files[0]
  await rasterize()
}

watch(canvas, (c) => {
  if (mounted) {
    mounted.remove()
    mounted = null
  }
  if (c && stage.value) {
    c.style.maxWidth = '100%'
    c.style.height = 'auto'
    c.style.display = 'block'
    c.style.margin = '0 auto'
    stage.value.appendChild(c)
    mounted = c
  }
})

let timer = 0
watch(width, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(rasterize, 150)
})

async function download() {
  if (!canvas.value || !file.value) return
  try {
    const blob = await canvasToBlob(canvas.value, 'image/png')
    saveBlob(blob, `${baseName(file.value.name)}-${canvas.value.width}w.png`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  }
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!file"
      accept=".svg,image/svg+xml"
      :multiple="false"
      label="拖放 SVG 文件到此处"
      hint="矢量图按指定宽度栅格化，输出高清 PNG"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 18px">
        <label class="opt">
          <span class="field-label">输出宽度（px）</span>
          <input v-model.number="width" type="number" min="16" step="64" class="input" style="width: 130px" />
        </label>
        <span v-if="canvas" class="muted small">输出尺寸：{{ canvas.width }} × {{ canvas.height }} px</span>
        <button class="btn btn-ghost btn-sm" @click="((file = null), (canvas = null))">换一个文件</button>
      </div>
      <div v-if="running" class="bt-loading mt-1"><Loader2 :size="18" class="spin" /> 正在栅格化…</div>
      <div v-show="canvas" ref="stage" class="bt-stage mt-1"></div>
      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="!canvas" @click="download"><Download :size="16" /> 下载 PNG</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.bt-stage {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
  overflow: hidden;
}
.bt-loading {
  display: flex;
  align-items: center;
  gap: 8px;
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
