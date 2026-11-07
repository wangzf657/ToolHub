<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import { appendTextAt, loadPdfLib, renderPageToCanvas } from '@/lib/pdfEngine'
import { hasCJK, hexToRgb01, stampImageTexts, textToPng } from './cjkText'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 添加文字：点击页面放置文字；中文自动以高清贴图嵌入 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const checked = ref<number[]>([])
const order = ref<PageEntry[]>([])
const text = ref('')
const fontSize = ref(14)
const color = ref('#111827')
const busy = ref(false)
const file = ref<File | Blob | null>(null)
const work = ref<Blob | null>(null)
const stage = ref<HTMLDivElement | null>(null)
const placed = ref<{ x: number; y: number } | null>(null)

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  work.value = null
  checked.value = []
  placed.value = null
}

const activePage = () => (checked.value.length ? checked.value[0] : 0)

const renderPreview = async () => {
  const src = work.value ?? file.value
  if (!src || !stage.value) return
  try {
    const canvas = await renderPageToCanvas(src, activePage(), 1)
    canvas.style.maxWidth = '100%'
    stage.value.replaceChildren(canvas)
  } catch {
    /* 预览失败忽略 */
  }
}

watch([file, work, checked], renderPreview)

const onPick = (e: PointerEvent) => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  placed.value = {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  }
}

const apply = async () => {
  const source = work.value ?? file.value
  if (!source) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!text.value) {
    toast.warn('请输入要添加的文字')
    return
  }
  if (!placed.value) {
    toast.warn('请先在页面预览上点击选择文字位置（该点为文字左上角附近）')
    return
  }
  busy.value = true
  try {
    const rgb = hexToRgb01(color.value)
    let blob: Blob
    if (hasCJK(text.value)) {
      // 中文：StandardFonts 不支持，用 canvas 贴图
      const png = textToPng(text.value, { sizePt: fontSize.value, color: rgb })
      // 需要页面实际尺寸：用 pdf-lib 直接读
      const { PDFDocument } = await loadPdfLib()
      const probe = await PDFDocument.load(await source.arrayBuffer(), { ignoreEncryption: true })
      const { width, height } = probe.getPage(Math.min(activePage(), probe.getPageCount() - 1)).getSize()
      blob = await stampImageTexts(source, [
        {
          page: activePage(),
          xPt: placed.value.x * width,
          yPt: (1 - placed.value.y) * height - png.hPt,
          png,
        },
      ])
    } else {
      const { PDFDocument } = await loadPdfLib()
      const probe = await PDFDocument.load(await source.arrayBuffer(), { ignoreEncryption: true })
      const { width, height } = probe.getPage(Math.min(activePage(), probe.getPageCount() - 1)).getSize()
      blob = await appendTextAt(
        source,
        activePage(),
        placed.value.x * width,
        (1 - placed.value.y) * height - fontSize.value,
        text.value,
        { size: fontSize.value, color: rgb },
      )
    }
    work.value = blob
    toast.ok('文字已放置，可继续添加或下载')
  } catch (e) {
    toast.err((e as Error).message || '添加文字失败')
  } finally {
    busy.value = false
  }
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
        <PageThumbs v-model:checked="checked" v-model:order="order" :file="file" :selectable="true" :movable="false" :rotatable="false" />
        <div class="mt-2">
          <span class="field-label">文字内容</span>
          <input v-model="text" class="input" placeholder="如：已核验 / 2024-05-01 补记" />
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
        </div>
      </div>
      <div>
        <p class="field-label mb-2">点击预览选择放置位置</p>
        <div class="stage" @pointerdown="onPick">
          <div ref="stage" class="holder">
            <span v-if="placed" class="dot" :style="{ left: placed.x * 100 + '%', top: placed.y * 100 + '%' }"></span>
          </div>
        </div>
        <p class="small muted mt-1">点击点 ≈ 文字左上角；预览会随放置实时更新</p>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="apply">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 放置文字
      </button>
      <button class="btn btn-soft" :disabled="!work" @click="download">下载成品 PDF</button>
      <span v-if="work" class="small muted">已放置成功，可换页继续放置（叠加保留）</span>
    </div>

    <p class="notice notice-info mt-2 small">
      含中文的文字将以高清图片形式嵌入（PDF 内置西文字体不支持中文）；坐标按页面实际尺寸换算，多页文档请先在缩略图选中目标页。
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
.dot {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  pointer-events: none;
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
