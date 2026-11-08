<script setup lang="ts">
/** 长图拼接：多图按统一宽度/高度等比缩放，纵向或横向拼成一张长图（聊天记录拼接常用） */
import { computed, ref } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const files = ref<File[]>([])
const direction = ref<'vertical' | 'horizontal'>('vertical')
const gap = ref(0)
const bg = ref('#ffffff')
const maxWidth = ref(1080)
const format = ref<'image/png' | 'image/jpeg'>('image/png')
const running = ref(false)
const progress = ref(0)
const outBlob = ref<Blob | null>(null)
const outSize = ref('')

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

const onFiles = (list: File[]) => {
  files.value = list
  outBlob.value = null
}

/** 统一宽度等比缩放（纵向）或统一高度（横向） */
function fit(src: HTMLCanvasElement, target: number, vertical: boolean): HTMLCanvasElement {
  const ratio = vertical ? target / src.width : target / src.height
  if (ratio >= 1) return src
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(src.width * ratio))
  c.height = Math.max(1, Math.round(src.height * ratio))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

const run = async () => {
  if (files.value.length < 2) {
    toast.warn('请至少添加两张图片')
    return
  }
  running.value = true
  progress.value = 0
  outBlob.value = null
  try {
    const vertical = direction.value === 'vertical'
    const limit = Math.max(64, maxWidth.value)
    const canvases: HTMLCanvasElement[] = []
    for (let i = 0; i < files.value.length; i++) {
      const src = await decodeToCanvas(files.value[i])
      // 统一尺寸基准取「最适中的那张」，避免一张超大图把整体缩得太小
      canvases.push(src)
      progress.value = ((i + 1) / files.value.length) * 0.5
    }
    // 目标边长：所有图的中位数边长夹在 64..limit
    const sides = canvases.map((c) => (vertical ? c.width : c.height)).sort((a, b) => a - b)
    const median = sides[Math.floor(sides.length / 2)]
    const target = Math.min(limit, Math.max(64, median))
    const fitted = canvases.map((c) => fit(c, target, vertical))
    const g = Math.max(0, Math.round(gap.value))
    const totalW = vertical ? Math.max(...fitted.map((c) => c.width)) : fitted.reduce((s, c) => s + c.width, 0) + g * (fitted.length - 1)
    const totalH = vertical ? fitted.reduce((s, c) => s + c.height, 0) + g * (fitted.length - 1) : Math.max(...fitted.map((c) => c.height))
    if (totalW * totalH > 1e8) {
      toast.warn(`输出约 ${fmtSize(totalW * totalH * 4)} 内存，过长图可能超出部分手机 canvas 上限，建议分段拼接`)
    }
    const out = document.createElement('canvas')
    out.width = totalW
    out.height = totalH
    const ctx = out.getContext('2d')!
    if (format.value === 'image/jpeg' || bg.value !== 'transparent') {
      ctx.fillStyle = format.value === 'image/jpeg' ? '#ffffff' : bg.value
      ctx.fillRect(0, 0, totalW, totalH)
    }
    let pos = 0
    for (const c of fitted) {
      if (vertical) {
        ctx.drawImage(c, Math.round((totalW - c.width) / 2), pos)
        pos += c.height + g
      } else {
        ctx.drawImage(c, pos, Math.round((totalH - c.height) / 2))
        pos += c.width + g
      }
    }
    progress.value = 0.9
    outBlob.value = await canvasToBlob(out, format.value, 0.92)
    outSize.value = fmtSize(outBlob.value.size)
    progress.value = 1
    toast.ok(`已拼接 ${files.value.length} 张图片`)
  } catch (e) {
    toast.err((e as Error).message || '拼接失败，请检查图片是否有效')
  } finally {
    running.value = false
  }
}

const download = () => {
  if (!outBlob.value) return
  saveBlob(outBlob.value, `长图拼接.${format.value === 'image/png' ? 'png' : 'jpg'}`)
}

const hint = computed(() => `将拼接 ${files.value.length} 张 · ${direction.value === 'vertical' ? '纵向' : '横向'} · 目标${direction.value === 'vertical' ? '宽' : '高'}度统一`)
</script>

<template>
  <div>
    <FileDrop accept="image/*" :multiple="true" label="拖放两张或以上图片到此处，可调整顺序" hint="列表顺序即拼接顺序 · 全部本地处理" @files="onFiles" />

    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">拼接方向</span>
        <select v-model="direction" class="select" style="width: 120px">
          <option value="vertical">纵向（长图）</option>
          <option value="horizontal">横向</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">间距（px）</span>
        <input v-model.number="gap" type="number" min="0" max="200" class="input" style="width: 100px" />
      </label>
      <label class="opt">
        <span class="field-label">最大边长（px）</span>
        <input v-model.number="maxWidth" type="number" min="256" class="input" style="width: 120px" />
      </label>
      <label class="opt">
        <span class="field-label">背景色</span>
        <input v-model="bg" type="color" class="input" style="width: 56px; padding: 2px" />
      </label>
      <label class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="format" class="select" style="width: 130px">
          <option value="image/png">PNG（无损）</option>
          <option value="image/jpeg">JPG（更小）</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="running || files.length < 2" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Download v-else :size="16" /> 开始拼接
      </button>
    </div>
    <p v-if="files.length" class="muted small mt-1">{{ hint }}</p>

    <div v-if="running" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="outBlob" class="notice notice-ok mt-2">
      完成：{{ outSize }}（{{ outSize && files.length ? `${files.length} 张` : '' }}）
      <button class="btn btn-sm btn-primary" style="margin-left: auto" @click="download">
        <Download :size="14" /> 下载长图
      </button>
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
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
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
