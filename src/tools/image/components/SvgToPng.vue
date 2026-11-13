<script setup lang="ts">
/**
 * SVG 转 PNG（UX1.0 四处方）：
 * - 倍率预设（rx1）：1x/2x/3x 一键 = 原始宽 × 倍数并立即重栅格。
 * - 宽度上限（rx2）：>16384 禁用下载并红色提示（浏览器画布上限）。
 * - 1:1 核对（rx3）：适配 / 1:1 切换，1:1 时容器内滚动。
 * - 背景填充（rx5）：透明 / 白色 / 自定义色。
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeSvg, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const raw = shallowRef<HTMLCanvasElement | null>(null)
const baseW = ref(0)
const width = ref(1024)
const stage = ref<HTMLElement | null>(null)
const running = ref(false)
const fitMode = ref<'fit' | '1:1'>('fit')
const bgMode = ref<'transparent' | 'white' | 'custom'>('transparent')
const bgColor = ref('#ffffff')

const overLimit = computed(() => width.value > 16384)

/** 按背景选项合成展示/导出画布 */
function composed(): HTMLCanvasElement | null {
  const r = raw.value
  if (!r) return null
  if (bgMode.value === 'transparent') return r
  const c = document.createElement('canvas')
  c.width = r.width
  c.height = r.height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bgMode.value === 'white' ? '#ffffff' : bgColor.value
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(r, 0, 0)
  return c
}

async function rasterize() {
  if (!file.value) return
  running.value = true
  try {
    const c = await decodeSvg(file.value, Math.max(16, width.value || 1024))
    raw.value = c
  } catch (e) {
    toast.err((e as Error).message || 'SVG 解析失败')
  } finally {
    running.value = false
  }
}

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    raw.value = null
    return
  }
  file.value = files[0]
  await rasterize()
  // 原始宽 = 首次栅格化宽 ÷ 2（decodeSvg 默认 2 倍）
  if (raw.value && !baseW.value) {
    baseW.value = Math.round(raw.value.width / 2)
    width.value = Math.min(16384, Math.max(16, Math.round(baseW.value * 2)))
  }
}

let mounted: HTMLCanvasElement | null = null
watch([raw, bgMode, bgColor, fitMode], () => {
  const c = composed()
  if (mounted) {
    mounted.remove()
    mounted = null
  }
  if (c && stage.value) {
    if (fitMode.value === '1:1') {
      c.style.maxWidth = 'none'
      c.style.width = `${c.width}px`
    } else {
      c.style.maxWidth = '100%'
      c.style.width = 'auto'
    }
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

function setScale(n: number) {
  if (!baseW.value) return
  width.value = Math.min(16384, Math.max(16, Math.round(baseW.value * n)))
  window.clearTimeout(timer)
  timer = window.setTimeout(rasterize, 100)
}

async function download() {
  const c = composed()
  if (!c || !file.value || overLimit.value) return
  try {
    const blob = await canvasToBlob(c, 'image/png')
    saveBlob(blob, `${baseName(file.value.name)}-${c.width}w.png`)
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
      <div class="row row-wrap mt-1" style="gap: 14px">
        <label class="opt">
          <span class="field-label">输出宽度（px）</span>
          <input v-model.number="width" type="number" min="16" max="16384" step="64" class="input" style="width: 130px" />
        </label>
        <div class="opt">
          <span class="field-label">倍率</span>
          <div class="row" style="gap: 6px">
            <button v-for="n in [1, 2, 3]" :key="n" class="chip" @click="setScale(n)">{{ n }}x</button>
          </div>
        </div>
        <div class="opt">
          <span class="field-label">背景</span>
          <div class="row" style="gap: 6px">
            <button class="chip" :class="{ active: bgMode === 'transparent' }" @click="bgMode = 'transparent'">透明</button>
            <button class="chip" :class="{ active: bgMode === 'white' }" @click="bgMode = 'white'">白色</button>
            <button class="chip" :class="{ active: bgMode === 'custom' }" @click="bgMode = 'custom'">自定义</button>
            <input v-if="bgMode === 'custom'" v-model="bgColor" type="color" />
          </div>
        </div>
        <span v-if="raw" class="muted small">输出尺寸：{{ raw.width }} × {{ raw.height }} px</span>
        <button class="btn btn-ghost btn-sm" @click="((file = null), (raw = null), (baseW = 0))">换一个文件</button>
      </div>

      <p v-if="overLimit" class="small mt-1" style="color: var(--err, #e5484d)">
        宽度超出浏览器画布上限（16384px），请降低输出宽度。
      </p>

      <div class="row row-wrap mt-1" style="gap: 8px">
        <button class="chip" :class="{ active: fitMode === 'fit' }" @click="fitMode = 'fit'">适配</button>
        <button class="chip" :class="{ active: fitMode === '1:1' }" @click="fitMode = '1:1'">1:1（滚动查看原始像素）</button>
      </div>

      <div v-if="running" class="bt-loading mt-1"><Loader2 :size="18" class="spin" /> 正在栅格化…</div>
      <div v-show="raw" ref="stage" class="bt-stage mt-1" :class="{ scrollable: fitMode === '1:1' }"></div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="!raw || overLimit" @click="download"><Download :size="16" /> 下载 PNG</button>
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
.bt-stage.scrollable {
  overflow: auto;
  max-height: 72vh;
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
