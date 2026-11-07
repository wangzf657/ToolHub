<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { stampText, type PageSpec } from '@/lib/pdfEngine'
import { hasCJK, hexToRgb01, stampImageTexts, textToPng } from './cjkText'
import { loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 文字水印 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const text = ref('机密')
const fontSize = ref(48)
const color = ref('#9aa2b1')
const opacity = ref(0.25)
const rotate = ref(true)
const position = ref('center')
const pages = ref('') // 空 = 全部页
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!text.value.trim()) {
    toast.warn('请输入水印文字')
    return
  }
  busy.value = true
  try {
    const rgb = hexToRgb01(color.value)
    let blob: Blob
    if (hasCJK(text.value)) {
      // 中文水印：贴图方案（支持 45° 斜排）
      const { PDFDocument } = await loadPdfLib()
      const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const size = probe.getPage(0).getSize()
      const png = textToPng(text.value, { sizePt: fontSize.value, color: rgb, opacity: opacity.value })
      const targets = pages.value.trim()
        ? pages.value.split(/[,，\s]+/).filter(Boolean).map((s) => parseInt(s) - 1).filter((n) => n >= 0 && n < probe.getPageCount())
        : probe.getPageIndices()
      const items: Parameters<typeof stampImageTexts>[1] = targets.map((page) => {
        const rot = rotate.value ? 45 : 0
        let x = (size.width - png.wPt) / 2
        let y = (size.height - png.hPt) / 2
        if (!rotate.value) {
          const m = 40
          x = position.value.includes('left') ? m : position.value.includes('right') ? size.width - png.wPt - m : x
          y = position.value.includes('top') ? size.height - png.hPt - m : position.value.includes('bottom') ? m : y
        } else {
          // 旋转 45° 后视觉居中（近似）
          x = (size.width - png.wPt / Math.SQRT2) / 2
          y = (size.height - png.hPt / Math.SQRT2) / 2
        }
        return { page, xPt: x, yPt: y, png, rotateDeg: rot }
      })
      blob = await stampImageTexts(file, items)
    } else {
      blob = await stampText(file, {
        text: text.value,
        fontSize: fontSize.value,
        color: rgb,
        opacity: opacity.value,
        rotate: rotate.value,
        position: position.value as 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
        pages: (pages.value.trim() || undefined) as PageSpec | undefined,
      })
    }
    saveBlob(blob, '加水印.pdf')
    toast.ok('水印已添加')
  } catch (e) {
    toast.err((e as Error).message || '添加水印失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">水印文字</span>
        <input v-model="text" class="input" placeholder="如：机密 / 草稿 / 内部资料" />
      </div>
      <div>
        <span class="field-label">字号（pt）</span>
        <input v-model.number="fontSize" type="number" class="input" min="12" max="120" />
      </div>
      <div>
        <span class="field-label">颜色</span>
        <input v-model="color" type="color" class="input color" />
      </div>
      <div>
        <span class="field-label">不透明度：{{ Math.round(opacity * 100) }}%</span>
        <input v-model.number="opacity" type="range" class="range" min="0.05" max="0.8" step="0.05" />
      </div>
      <div>
        <span class="field-label">排版</span>
        <label class="check"><input v-model="rotate" type="checkbox" /> 45° 斜排（不勾选则按位置平铺一次）</label>
      </div>
      <div v-if="!rotate">
        <span class="field-label">位置</span>
        <select v-model="position" class="select">
          <option value="center">居中</option>
          <option value="top-left">左上</option>
          <option value="top-right">右上</option>
          <option value="bottom-left">左下</option>
          <option value="bottom-right">右下</option>
        </select>
      </div>
      <div class="span2">
        <span class="field-label">指定页（留空 = 全部页）</span>
        <input v-model="pages" class="input" placeholder="如 2-5,8" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 添加水印并下载
      </button>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
.color {
  height: 34px;
  padding: 2px;
}
.span2 {
  grid-column: span 2;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
