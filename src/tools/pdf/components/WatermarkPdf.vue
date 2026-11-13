<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { parsePageSpec, type PageSpec, stampText } from '@/lib/pdfEngine'
import { decodeToCanvas } from '@/lib/imageEngine'
import { hasCJK, hexToRgb01, stampPngs, textToPng, type PngStampItem } from './cjkText'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 水印：文字/图片、单枚（可 45° 斜排，位置解耦）/平铺、页范围（parsePageSpec 口径） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const kind = ref<'text' | 'image'>('text')
const text = ref('机密')
const fontSize = ref(48)
const color = ref('#9aa2b1')
const opacity = ref(0.25)
const layout = ref<'single' | 'tile'>('single')
const rotate = ref(false)
const position = ref('center')
const tileCols = ref(3)
const tileRows = ref(4)
const imgFile = ref<File | null>(null)
const imgScale = ref(50) // 图片水印缩放百分比
const pages = ref('') // 空 = 全部页
const outName = ref('加水印')
const busy = ref(false)

const onImage = (list: FileList | null) => {
  imgFile.value = list?.[0] ?? null
}

/** 位置 → 象限中心（比例坐标），旋转时围绕图章原点转 45° 后求中心回退 */
const quadrant = (pos: string, W: number, H: number) => ({
  x: pos.includes('left') ? W * 0.25 : pos.includes('right') ? W * 0.75 : W * 0.5,
  y: pos.includes('top') ? H * 0.75 : pos.includes('bottom') ? H * 0.25 : H * 0.5,
})

/** 生成文字图章 PNG（透明底） */
const textStamp = (t: string): { dataUrl: string; wPt: number; hPt: number } => {
  const rgb = hexToRgb01(color.value)
  const png = textToPng(t, { sizePt: fontSize.value, color: rgb, opacity: opacity.value })
  return { dataUrl: png.dataUrl, wPt: png.wPt, hPt: png.hPt }
}

/** 生成图片图章（图片按 96dpi 换算 pt 后乘缩放比） */
const imageStamp = async (): Promise<{ dataUrl: string; wPt: number; hPt: number }> => {
  if (!imgFile.value) throw new Error('请先选择水印图片')
  const canvas = await decodeToCanvas(imgFile.value)
  const dataUrl = canvas.toDataURL('image/png')
  const wPt = (canvas.width * 72) / 96 / (imgScale.value / 100)
  const hPt = (canvas.height * 72) / 96 / (imgScale.value / 100)
  return { dataUrl, wPt, hPt }
}

/** 45° 旋转（绕图章原点）后，使图章中心落在象限中心/格子中心的落点 */
const centeredOrigin = (stamp: { wPt: number; hPt: number }, cx: number, cy: number, deg: number) => {
  if (!deg) return { x: cx - stamp.wPt / 2, y: cy - stamp.hPt / 2 }
  const r = (deg * Math.PI) / 180
  const ox = (stamp.wPt * Math.cos(r) - stamp.hPt * Math.sin(r)) / 2
  const oy = (stamp.wPt * Math.sin(r) + stamp.hPt * Math.cos(r)) / 2
  return { x: cx - ox, y: cy - oy }
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (kind.value === 'text' && !text.value.trim()) {
    toast.warn('请输入水印文字')
    return
  }
  if (kind.value === 'image' && !imgFile.value) {
    toast.warn('请先选择水印图片')
    return
  }
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLibSafe()
    const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const total = probe.getPageCount()
    const targets = pages.value.trim() ? parsePageSpec(pages.value, total) : Array.from({ length: total }, (_, i) => i)
    if (!targets.length) {
      toast.warn(`指定页「${pages.value}」没有匹配到任何页（文档共 ${total} 页）`)
      return
    }

    // 纯 ASCII + 单枚不旋转 + 无平铺 → 引擎原生文字路径（可选、可检索）
    if (kind.value === 'text' && layout.value === 'single' && !rotate.value && !hasCJK(text.value) && opacity.value >= 0.05) {
      const blob = await stampText(file, {
        text: text.value,
        fontSize: fontSize.value,
        color: hexToRgb01(color.value),
        opacity: opacity.value,
        rotate: false,
        position: position.value as 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
        pages: (pages.value.trim() || undefined) as PageSpec | undefined,
      })
      saveBlob(blob, `${outName.value.trim() || '加水印'}.pdf`)
      toast.ok(`水印已添加（${targets.length} / ${total} 页）`)
      return
    }

    const stamp = kind.value === 'text' ? textStamp(text.value) : await imageStamp()
    const deg = rotate.value ? 45 : 0
    const items: PngStampItem[] = []
    for (const page of targets) {
      const { width: W, height: H } = probe.getPage(page).getSize()
      if (layout.value === 'single') {
        const q = quadrant(position.value, W, H)
        const o = centeredOrigin(stamp, q.x, q.y, deg)
        items.push({ page, xPt: o.x, yPt: o.y, ...stamp, rotateDeg: deg, opacity: 1 })
      } else {
        const cols = Math.max(1, Math.floor(tileCols.value))
        const rows = Math.max(1, Math.floor(tileRows.value))
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cx = ((c + 0.5) * W) / cols
            const cy = ((r + 0.5) * H) / rows
            const o = centeredOrigin(stamp, cx, cy, deg)
            items.push({ page, xPt: o.x, yPt: o.y, ...stamp, rotateDeg: deg, opacity: 1 })
          }
        }
      }
    }
    const blob = await stampPngs(file, items)
    saveBlob(blob, `${outName.value.trim() || '加水印'}.pdf`)
    toast.ok(
      layout.value === 'tile'
        ? `水印已添加：${targets.length} 页 × ${tileCols.value}×${tileRows.value} 平铺`
        : `水印已添加（${targets.length} / ${total} 页）`,
    )
  } catch (e) {
    toast.err((e as Error).message || '添加水印失败')
  } finally {
    busy.value = false
  }
}

const loadPdfLibSafe = () => import('@/lib/pdfEngine').then((m) => m.loadPdfLib())
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">水印类型</span>
        <select v-model="kind" class="select">
          <option value="text">文字水印</option>
          <option value="image">图片水印（logo）</option>
        </select>
      </div>
      <template v-if="kind === 'text'">
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
      </template>
      <template v-else>
        <div class="span2">
          <span class="field-label">水印图片（PNG 透明底最佳）</span>
          <input type="file" accept="image/*" class="input" @change="onImage(($event.target as HTMLInputElement).files)" />
        </div>
        <div>
          <span class="field-label">缩放：{{ imgScale }}%</span>
          <input v-model.number="imgScale" type="range" class="range" min="5" max="100" step="5" />
        </div>
        <div>
          <span class="field-label">不透明度</span>
          <input v-model.number="opacity" type="range" class="range" min="0.05" max="0.8" step="0.05" />
        </div>
      </template>
      <div>
        <span class="field-label">排版</span>
        <select v-model="layout" class="select">
          <option value="single">单枚</option>
          <option value="tile">平铺（N×M）</option>
        </select>
      </div>
      <div v-if="layout === 'single'">
        <span class="field-label">位置</span>
        <select v-model="position" class="select">
          <option value="center">居中</option>
          <option value="top-left">左上</option>
          <option value="top-right">右上</option>
          <option value="bottom-left">左下</option>
          <option value="bottom-right">右下</option>
        </select>
      </div>
      <div v-else class="row" style="gap: 8px">
        <span><span class="field-label">列</span><input v-model.number="tileCols" type="number" class="input" min="1" max="10" /></span>
        <span><span class="field-label">行</span><input v-model.number="tileRows" type="number" class="input" min="1" max="12" /></span>
      </div>
      <div>
        <span class="field-label">斜排</span>
        <label class="check"><input v-model="rotate" type="checkbox" /> 45° 斜排（位置仍然生效）</label>
      </div>
      <div>
        <span class="field-label">指定页（留空 = 全部页）</span>
        <input v-model="pages" class="input" placeholder="如 2-5,8" />
      </div>
      <div>
        <span class="field-label">输出文件名</span>
        <input v-model="outName" class="input" placeholder="加水印" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 添加水印并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      纯 ASCII 文字单枚平放时为可选中原生文字；中文/斜排/平铺/图片水印以高清透明贴图嵌入（图片按 96dpi 换算 PDF 尺寸再乘缩放比）。
    </p>
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
