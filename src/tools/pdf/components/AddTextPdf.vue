<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Loader2, Undo2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import { loadPdfLib, renderPageToCanvas, toPdfBlob } from '@/lib/pdfEngine'
import { hasCJK, hexToRgb01, stampImageTexts, textToPng } from './cjkText'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 添加文字：翻页放置、多行 textarea、字体三选+加粗、撤销上一处。
 * 点击点=文字左下角（首行基线起点）；中文或 WinAnsi 编码失败时自动改走高清贴图。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const checked = ref<number[]>([])
const order = ref<PageEntry[]>([])
const text = ref('')
const fontSize = ref(14)
const color = ref('#111827')
const fontKey = ref<'Helvetica' | 'TimesRoman' | 'Courier'>('Helvetica')
const bold = ref(false)
const busy = ref(false)
const file = ref<File | Blob | null>(null)
const work = ref<Blob | null>(null)
const stage = ref<HTMLDivElement | null>(null)
const curPage = ref(0)

interface Placement {
  page: number
  x: number
  y: number
  text: string
}
const placements = ref<Placement[]>([])

const totalPages = () => base.value?.pageCount ?? order.value.length ?? 0

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  work.value = null
  checked.value = []
  placements.value = []
  curPage.value = 0
}

const goto = (p: number) => {
  const n = totalPages()
  if (!n) return
  curPage.value = Math.min(n - 1, Math.max(0, p))
  work.value = null
}
watch(checked, (c) => {
  if (c.length) curPage.value = c[0]!
})

const renderPreview = async () => {
  const src = work.value ?? file.value
  if (!src || !stage.value) return
  try {
    const canvas = await renderPageToCanvas(src, curPage.value, 1)
    canvas.style.maxWidth = '100%'
    stage.value.replaceChildren(canvas)
  } catch {
    /* 预览失败忽略 */
  }
}
watch([file, work, curPage, placements], renderPreview)

const onPick = (e: PointerEvent) => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  placements.value.push({
    page: curPage.value,
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    text: text.value,
  })
  void applyAll()
}

/** 从原件重建：逐条放置（撤销统一走这里）；单条 WinAnsi 编码失败自动贴图兜底 */
const rebuild = async () => {
  if (!file.value) return
  if (!placements.value.length) {
    work.value = null
    return
  }
  const { PDFDocument, StandardFonts, rgb: mkRgb } = await loadPdfLib()
  let doc = await PDFDocument.load(await file.value.arrayBuffer(), { ignoreEncryption: true })
  const rgb = hexToRgb01(color.value)
  const boldKey = bold.value ? 'Bold' : ''
  const fontName = `${fontKey.value}${boldKey}`
  for (const p of placements.value) {
    const page = doc.getPage(Math.min(p.page, doc.getPageCount() - 1))
    const { width, height } = page.getSize()
    if (hasCJK(p.text)) {
      const png = textToPng(p.text, { sizePt: fontSize.value, color: rgb })
      const mid = toPdfBlob(await doc.save({ useObjectStreams: false } as never))
      const blob = await stampImageTexts(mid, [
        { page: p.page, xPt: p.x * width, yPt: (1 - p.y) * height - png.hPt, png },
      ])
      doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
    } else {
      const font = await doc.embedFont(StandardFonts[fontName as keyof typeof StandardFonts])
      const lines = p.text.split('\n')
      let failed = false
      lines.forEach((line, li) => {
        try {
          page.drawText(line, {
            x: p.x * width,
            y: (1 - p.y) * height - fontSize.value - li * fontSize.value * 1.35,
            size: fontSize.value,
            font,
            color: mkRgb(rgb[0], rgb[1], rgb[2]),
          })
        } catch {
          failed = true
        }
      })
      if (failed) {
        // WinAnsi 编码失败兜底：整条改走贴图
        const png = textToPng(p.text, { sizePt: fontSize.value, color: rgb })
        const mid = toPdfBlob(await doc.save({ useObjectStreams: false } as never))
        const blob = await stampImageTexts(mid, [
          { page: p.page, xPt: p.x * width, yPt: (1 - p.y) * height - png.hPt, png },
        ])
        doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
        toast.ok('该内容含特殊符号，已自动改用高清贴图嵌入')
      }
    }
  }
  work.value = await doc.save({ useObjectStreams: false } as never).then((b) => new Blob([b as BlobPart], { type: 'application/pdf' }))
}

const applyAll = async () => {
  if (!text.value) {
    placements.value = placements.value.slice(0, -1)
    toast.warn('请输入要添加的文字')
    return
  }
  if (!file.value) return
  busy.value = true
  try {
    await rebuild()
    toast.ok('文字已放置，可换页继续添加或下载')
  } catch (e) {
    placements.value = placements.value.slice(0, -1)
    toast.err((e as Error).message || '添加文字失败')
  } finally {
    busy.value = false
  }
}

const undoLast = () => {
  if (!placements.value.length) {
    toast.warn('没有可撤销的文字')
    return
  }
  placements.value = placements.value.slice(0, -1)
  void rebuild()
}

const download = () => {
  if (!work.value) {
    toast.warn('还没有添加任何文字')
    return
  }
  saveBlob(work.value, '添加文字后.pdf')
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div v-if="file" class="grid-2 mt-2">
      <div>
        <p class="field-label mb-2">选择页面（当前第 {{ curPage + 1 }} / {{ totalPages() || '—' }} 页）</p>
        <PageThumbs v-model:checked="checked" v-model:order="order" :file="file" :selectable="true" :movable="false" :rotatable="false" />
        <div class="row mt-2">
          <button class="btn btn-ghost btn-sm" :disabled="curPage <= 0" @click="goto(curPage - 1)"><ChevronLeft :size="14" /> 上一页</button>
          <button class="btn btn-ghost btn-sm" :disabled="curPage >= totalPages() - 1" @click="goto(curPage + 1)">下一页 <ChevronRight :size="14" /></button>
        </div>
        <div class="mt-2">
          <span class="field-label">文字内容（Enter 换行）</span>
          <textarea v-model="text" class="textarea" rows="2" placeholder="如：已核验 / 2024-05-01 补记"></textarea>
        </div>
        <div class="grid-2 mt-2">
          <div>
            <span class="field-label">字号（pt）</span>
            <input v-model.number="fontSize" type="number" class="input" min="6" max="72" />
          </div>
          <div>
            <span class="field-label">颜色</span>
            <input v-model="color" type="color" class="input color" />
          </div>
          <div>
            <span class="field-label">字体</span>
            <select v-model="fontKey" class="select">
              <option value="Helvetica">黑体式（Helvetica）</option>
              <option value="TimesRoman">衬线（Times）</option>
              <option value="Courier">等宽（Courier）</option>
            </select>
          </div>
          <div>
            <span class="field-label">加粗</span>
            <label class="check mt-1"><input v-model="bold" type="checkbox" /> 粗体</label>
          </div>
        </div>
      </div>
      <div>
        <p class="field-label mb-2">点击预览选择放置位置</p>
        <div class="stage" @pointerdown="onPick">
          <div ref="stage" class="holder"></div>
        </div>
        <p class="small muted mt-1">点击点 = 文字左下角（首行基线起点）；放置后立即回读预览</p>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <span v-if="busy" class="row small muted"><Loader2 :size="14" class="spinner" /> 正在写入…</span>
      <button class="btn btn-ghost" :disabled="!placements.length || busy" @click="undoLast"><Undo2 :size="15" /> 撤销上一处文字</button>
      <button class="btn btn-soft" :disabled="!work" @click="download">下载成品 PDF</button>
      <span v-if="placements.length" class="small muted">已放置 {{ placements.length }} 处</span>
    </div>

    <p class="notice notice-info mt-2 small">
      含中文的文字将以高清图片形式嵌入（PDF 内置西文字体不支持中文）；特殊符号（如 ↑）编码失败时自动改用贴图。坐标按页面实际尺寸换算，翻页后放置跟随当前页。
    </p>
  </div>
</template>

<style scoped>
.color {
  height: 34px;
  padding: 2px;
}
.stage {
  display: flex;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 6px;
  min-height: 240px;
  background: var(--bg-soft);
  touch-action: none;
  cursor: crosshair;
}
.holder {
  position: relative;
  display: inline-block;
  line-height: 0;
  max-width: 100%;
}
.holder :deep(canvas) {
  max-width: 100%;
  height: auto;
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
