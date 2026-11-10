<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, Type } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadImage, canvasToBlob } from '@/lib/imageEngine'
import { floodFillCutout } from '@/lib/utilExt'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 文字藏于主体后：色键抠出前景 → 三层合成（背景 + 文字 + 前景遮挡） */
const toast = useToast()

const imgUrl = ref('')
const busy = ref(false)
const text = ref('HELLO')
const fontSize = ref(96)
const fgCanvas = ref<HTMLCanvasElement | null>(null)
const bgCanvas = ref<HTMLCanvasElement | null>(null)
const tolerance = ref(30)
const stageRef = ref<HTMLCanvasElement | null>(null)

const W = 720
const H = 480

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!f.type.startsWith('image/')) return toast.warn('请拖入图片')
  busy.value = true
  try {
    const img = await loadImage(f)
    // 统一到舞台尺寸（cover 裁切）
    const base = document.createElement('canvas')
    base.width = W
    base.height = H
    const g = base.getContext('2d')!
    const scale = Math.max(W / img.width, H / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
    bgCanvas.value = base
    fgCanvas.value = floodFillCutout(base, tolerance.value)
    imgUrl.value = base.toDataURL()
    compose()
    toast.ok('已抠出前景主体，调节容差或文字后导出')
  } catch (e) {
    toast.err(`处理失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const compose = () => {
  const cv = stageRef.value
  if (!cv || !bgCanvas.value || !fgCanvas.value) return
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  // 1) 背景层（原图）
  g.drawImage(bgCanvas.value, 0, 0)
  // 2) 文字层（居中，白色粗字）
  g.fillStyle = '#ffffff'
  g.font = `900 ${fontSize.value}px 'Arial Black',sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const lines = text.value.split('\n')
  lines.forEach((ln, i) => {
    g.fillText(ln, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fontSize.value * 1.1)
  })
  // 3) 前景主体层（有 alpha，遮挡文字）
  g.drawImage(fgCanvas.value, 0, 0)
}

const setTolerance = () => {
  if (!bgCanvas.value) return
  busy.value = true
  setTimeout(() => {
    try {
      fgCanvas.value = floodFillCutout(bgCanvas.value!, tolerance.value)
      compose()
    } finally {
      busy.value = false
    }
  }, 30)
}

const exportPng = () => {
  const cv = stageRef.value
  if (!cv || !bgCanvas.value) return toast.warn('请先上传图片')
  cv.toBlob(async (b: Blob | null) => {
    if (!b) return
    saveBlob(b, '文字藏于主体后.png')
    toast.ok('已导出 PNG')
    void canvasToBlob
  }, 'image/png')
}
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept="image/*" label="拖入一张主体清晰的图片（人像/物品与背景色差大效果最好）" hint="色键抠图本地完成，无需下载模型" @files="onFiles" />

    <div v-if="imgUrl" class="mt-2">
      <div class="opts-panel">
        <div class="row wrap gap">
          <span class="field-label">文字</span>
          <input v-model="text" class="input" style="width: 180px" @input="compose" />
          <span class="field-label">字号</span>
          <input v-model.number="fontSize" type="number" class="input slim" min="40" max="200" @change="compose" />
          <span class="field-label">抠图容差</span>
          <input v-model.number="tolerance" type="range" min="8" max="80" style="width: 120px" @change="setTolerance" />
          <span class="hint">{{ tolerance }}</span>
          <button class="btn btn-primary btn-sm" :disabled="busy" @click="exportPng"><Download :size="14" /> 导出 PNG</button>
        </div>
        <p class="hint mt-1"><Type :size="12" style="vertical-align: -2px" /> 原理：色键 flood-fill 抠出前景（与「智能抠图」同款算法，无需模型）→ 白色大字置于背景与前景之间，文字就被主体「挡住」了。背景与主体颜色接近时适当调大容差。</p>
      </div>
      <canvas ref="stageRef" class="stage mt-2"></canvas>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 74px; }
.stage { width: 100%; max-width: 720px; display: block; margin: 0 auto; border: 1px solid var(--border); border-radius: 12px; }
.hint { font-size: 12px; color: var(--muted); }
</style>
