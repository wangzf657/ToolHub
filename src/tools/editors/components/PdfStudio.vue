<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Loader2, Download, RotateCw, Trash2, ArrowUp, ArrowDown, CheckSquare,
  Type as TypeIcon, PenTool, Droplets, Hash, FileText, X, Undo2, Redo2,
} from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import SignaturePad from './studio/SignaturePad.vue'
import { useUndoStack, installUndoKeys } from './studio/undoStack'
import { loadPdfLib, loadPdfJs, renderPageToCanvas, stampText, addPageNumbers, savePdf } from '@/lib/pdfEngine'
import { hasCJK, hexToRgb01, renderTextPng, stampPngs } from './studio/pdfText'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 工作台：页面管理（旋转/删除/排序/提取）+ 文字 + 签名 + 水印 + 页码。
 * 每次编辑即时生成中间 PDF，导出直接保存当前状态。
 */
const toast = useToast()
const file = ref<File | null>(null)
const work = ref<Blob | null>(null)
const pageCount = ref(0)
const thumbs = ref<string[]>([])
const cur = ref(0)
const checked = ref<number[]>([])
const busy = ref(false)
const mode = ref<'none' | 'text' | 'sign'>('none')
const previewStage = ref<HTMLDivElement | null>(null)
const sigRef = ref<InstanceType<typeof SignaturePad> | null>(null)

// 文字设置
const text = ref('')
const textSize = ref(14)
const textColor = ref('#c81e1e')
// 水印 / 页码
const wmText = ref('内部资料')
const wmBusy = ref(false)
// 待放置的签名 PNG
const pendingSign = ref<{ dataUrl: string; wPt: number; hPt: number } | null>(null)

const MAX_THUMBS = 200
const steps = ['打开 PDF 浏览缩略图', '删页/转页/排序/加内容', '导出新 PDF']

const state = computed(() => work.value ?? file.value)

/* ---------- rx1 撤销栈（快照式，上限 20 步，Ctrl+Z/Y + 界面按钮） ---------- */
const undoStack = useUndoStack<Blob>(20)
/** 每次变更前捕获当前文档快照 */
const capture = () => {
  const s = state.value
  if (s) undoStack.push(s)
}
const applySnapshot = async (blob: Blob) => {
  work.value = blob
  await refreshThumbs()
}
const doUndo = async () => {
  const cur = state.value
  if (!cur) return
  const prev = undoStack.undo(cur)
  if (!prev) return
  await applySnapshot(prev)
  toast.ok('已撤销上一步操作')
}
const doRedo = async () => {
  const cur = state.value
  if (!cur) return
  const next = undoStack.redo(cur)
  if (!next) return
  await applySnapshot(next)
  toast.ok('已重做')
}
let removeKeys: (() => void) | null = null
onMounted(() => {
  removeKeys = installUndoKeys(window, () => void doUndo(), () => void doRedo())
})
onBeforeUnmount(() => removeKeys?.())

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  if (!f.name.toLowerCase().endsWith('.pdf')) {
    toast.err('请选择 PDF 文件')
    return
  }
  file.value = f
  work.value = null
  cur.value = 0
  checked.value = []
  mode.value = 'none'
  pendingSign.value = null
  undoStack.reset()
  await refreshThumbs()
}

/** 重新生成全部缩略图（一次 pdfjs 会话，小尺寸 JPEG） */
const refreshThumbs = async () => {
  const src = state.value
  if (!src) return
  busy.value = true
  try {
    const pdfjs = await loadPdfJs()
    const doc = await pdfjs.getDocument({ data: await src.arrayBuffer() }).promise
    pageCount.value = doc.numPages
    const out: string[] = []
    for (let i = 0; i < Math.min(doc.numPages, MAX_THUMBS); i++) {
      const page = await doc.getPage(i + 1)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(0.4, 130 / base.width)
      const vp = page.getViewport({ scale })
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.floor(vp.width))
      c.height = Math.max(1, Math.floor(vp.height))
      await page.render({ canvasContext: c.getContext('2d')!, viewport: vp, canvas: c } as never).promise
      out.push(c.toDataURL('image/jpeg', 0.72))
    }
    thumbs.value = out
    if (cur.value >= doc.numPages) cur.value = Math.max(0, doc.numPages - 1)
    doc.destroy()
  } catch (e) {
    toast.err((e as Error).message || 'PDF 解析失败')
  } finally {
    busy.value = false
  }
}

/** 大图预览当前页 */
const renderPreview = async () => {
  const src = state.value
  if (!src || !previewStage.value) return
  try {
    const canvas = await renderPageToCanvas(src, Math.min(cur.value, pageCount.value - 1), 1.6)
    canvas.style.maxWidth = '100%'
    canvas.style.maxHeight = '70vh'
    previewStage.value.replaceChildren(canvas)
  } catch {
    /* 预览失败忽略 */
  }
}

watch([file, work, cur], () => nextTick(renderPreview), { immediate: true })

/** 对当前状态执行一次 pdf-lib 变更并保存为新的中间状态（统一走 savePdf，元数据 producer/creator=ToolHub） */
const mutate = async (fn: (doc: import('@cantoo/pdf-lib').PDFDocument) => void | Promise<void>) => {
  const src = state.value
  if (!src) return
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const doc = await PDFDocument.load(await src.arrayBuffer(), { ignoreEncryption: true })
    await fn(doc)
    work.value = await savePdf(doc)
    await refreshThumbs()
  } catch (e) {
    toast.err((e as Error).message || '操作失败')
  } finally {
    busy.value = false
  }
}

const rotatePage = (i: number) => {
  capture()
  void mutate(async (doc) => {
    const { degrees } = await loadPdfLib()
    const page = doc.getPage(i)
    const a = page.getRotation().angle
    page.setRotation(degrees((a + 90) % 360))
  })
}

const removePage = (i: number) => {
  if (pageCount.value <= 1) {
    toast.warn('至少需要保留一页')
    return
  }
  capture()
  checked.value = checked.value.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c))
  void mutate((doc) => {
    doc.removePage(i)
  })
}

const movePage = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= pageCount.value) return
  const order = Array.from({ length: pageCount.value }, (_, k) => k)
  ;[order[i], order[j]] = [order[j], order[i]]
  applyOrder(order)
}

// rx3 拖拽排序：缩略图 dragstart/dragover/drop → 换位重建页序
const dragIdx = ref(-1)
const onThumbDragStart = (i: number) => (dragIdx.value = i)
const onThumbDrop = (i: number) => {
  const from = dragIdx.value
  dragIdx.value = -1
  if (from < 0 || from === i) return
  const order = Array.from({ length: pageCount.value }, (_, k) => k)
  const [moved] = order.splice(from, 1)
  order.splice(i, 0, moved)
  applyOrder(order)
}

/** 按新页序重建文档，并同步当前页与勾选索引 */
const applyOrder = (order: number[]) => {
  capture()
  const oldCur = cur.value
  cur.value = order.indexOf(oldCur)
  checked.value = checked.value.map((c) => order.indexOf(c)).filter((c) => c >= 0)
  void mutate(async (doc) => {
    const pages = await doc.copyPages(doc, order)
    while (doc.getPageCount()) doc.removePage(0)
    pages.forEach((p) => doc.addPage(p))
  })
}

const toggleCheck = (i: number) => {
  if (checked.value.includes(i)) checked.value = checked.value.filter((c) => c !== i)
  else checked.value = [...checked.value, i].sort((a, b) => a - b)
}

/** 提取勾选页为独立 PDF（不影响当前编辑状态） */
const extractChecked = async () => {
  if (!checked.value.length) {
    toast.warn('请先在左侧勾选要提取的页面')
    return
  }
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const srcDoc = await PDFDocument.load(await state.value!.arrayBuffer(), { ignoreEncryption: true })
    const out = await PDFDocument.create()
    const pages = await out.copyPages(srcDoc, checked.value)
    pages.forEach((p) => out.addPage(p))
    saveBlob(await savePdf(out), '提取页.pdf')
    toast.ok(`已提取 ${checked.value.length} 页`)
  } catch (e) {
    toast.err((e as Error).message || '提取失败')
  } finally {
    busy.value = false
  }
}

/* ---------- 预览点击放置 ---------- */
const pickPos = (e: PointerEvent): [number, number] | null => {
  const canvas = previewStage.value?.querySelector('canvas')
  if (!canvas) return null
  const r = canvas.getBoundingClientRect()
  return [
    Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  ]
}

const onPageClick = async (e: PointerEvent) => {
  if (mode.value === 'none' || busy.value) return
  capture()
  const pos = pickPos(e)
  if (!pos) return
  const src = state.value
  if (!src) return
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const probe = await PDFDocument.load(await src.arrayBuffer(), { ignoreEncryption: true })
    const page = probe.getPage(Math.min(cur.value, probe.getPageCount() - 1))
    const { width, height } = page.getSize()
    if (mode.value === 'text') {
      if (!text.value.trim()) {
        toast.warn('请先输入要添加的文字')
        return
      }
      const png = renderTextPng(text.value, { sizePt: textSize.value, color: hexToRgb01(textColor.value) })
      const blob = await stampPngs(src, [
        { page: cur.value, xPt: pos[0] * width, yPt: (1 - pos[1]) * height - png.hPt, ...png },
      ])
      work.value = blob
      await refreshThumbs()
      toast.ok('文字已放置，可继续添加')
    } else if (mode.value === 'sign' && pendingSign.value) {
      const wPt = Math.min(160, width / 3)
      const hPt = (wPt * pendingSign.value.hPt) / pendingSign.value.wPt
      const blob = await stampPngs(src, [
        { page: cur.value, xPt: pos[0] * width, yPt: (1 - pos[1]) * height - hPt, ...pendingSign.value, wPt, hPt },
      ])
      work.value = blob
      pendingSign.value = null
      mode.value = 'none'
      await refreshThumbs()
      toast.ok('签名已放置')
    }
  } catch (err) {
    toast.err((err as Error).message || '放置失败')
  } finally {
    busy.value = false
  }
}

/** 开始签名流程 */
const startSign = () => {
  const dataUrl = sigRef.value?.exportPng()
  if (!dataUrl) {
    toast.warn('请先在签名板写下签名')
    return
  }
  const img = new Image()
  img.onload = () => {
    pendingSign.value = { dataUrl, wPt: img.width, hPt: img.height }
    mode.value = 'sign'
    toast.toast('请在右侧页面预览上点击放置签名')
  }
  img.src = dataUrl
}

/* ---------- 快捷操作 ---------- */
const addWm = async () => {
  if (!state.value) return
  if (!wmText.value.trim()) {
    toast.warn('请输入水印文字')
    return
  }
  capture()
  wmBusy.value = true
  try {
    if (hasCJK(wmText.value)) {
      // 中文水印：canvas 贴图，45° 居中
      const png = renderTextPng(wmText.value, { sizePt: 42, color: [0.55, 0.55, 0.6], opacity: 0.28 })
      const { PDFDocument } = await loadPdfLib()
      const probe = await PDFDocument.load(await state.value.arrayBuffer(), { ignoreEncryption: true })
      const placed = probe.getPages().map((p, i) => {
        const { width, height } = p.getSize()
        return {
          page: i,
          xPt: (width - png.wPt / Math.SQRT2) / 2,
          yPt: (height - png.hPt) / 2.4,
          ...png,
          rotateDeg: 45,
        }
      })
      work.value = await stampPngs(state.value, placed)
    } else {
      work.value = await stampText(state.value, { text: wmText.value, opacity: 0.18, rotate: true })
    }
    await refreshThumbs()
    toast.ok('水印已添加')
  } catch (e) {
    toast.err((e as Error).message || '添加水印失败')
  } finally {
    wmBusy.value = false
  }
}

const addNums = async () => {
  if (!state.value) return
  capture()
  wmBusy.value = true
  try {
    work.value = await addPageNumbers(state.value, { format: '{n} / {total}' })
    await refreshThumbs()
    toast.ok('页码已添加')
  } catch (e) {
    toast.err((e as Error).message || '添加页码失败')
  } finally {
    wmBusy.value = false
  }
}

const exportPdf = () => {
  if (!state.value) {
    toast.warn('请先打开一个 PDF')
    return
  }
  saveBlob(state.value, '编辑后.pdf')
  toast.ok('已导出当前编辑状态')
}
</script>

<template>
  <div class="studio">
    <div class="steps row row-wrap">
      <span v-for="(s, i) in steps" :key="i" class="step"><b class="step-n">{{ i + 1 }}</b> {{ s }}<span v-if="i < steps.length - 1" class="step-arrow">→</span></span>
    </div>

    <FileDrop v-if="!file" accept=".pdf" :multiple="false" label="拖放 PDF 文件，或点击选择" @files="onFiles" />

    <template v-else>
      <div class="toolbar row row-wrap">
        <div class="text-form row row-wrap">
          <TypeIcon :size="15" class="muted" />
          <input v-model="text" class="input" style="width: 150px" placeholder="要添加的文字" />
          <input v-model.number="textSize" type="number" min="8" max="72" class="input" style="width: 66px" title="字号 pt" />
          <input v-model="textColor" type="color" title="文字颜色" />
          <button class="btn btn-sm" :class="{ primary: mode === 'text' }" @click="mode = 'text'">点击页面放置</button>
        </div>
        <button class="btn btn-sm" :class="{ primary: mode === 'sign' }" @click="startSign">
          <PenTool :size="14" /> 手绘签名
        </button>
        <div class="row" style="gap: 6px">
          <input v-model="wmText" class="input" style="width: 120px" placeholder="水印文字" />
          <button class="btn btn-sm" :disabled="wmBusy" @click="addWm"><Droplets :size="14" /> 水印</button>
          <button class="btn btn-sm" :disabled="wmBusy" @click="addNums"><Hash :size="14" /> 页码</button>
        </div>
        <button class="btn btn-sm" @click="extractChecked"><CheckSquare :size="14" /> 提取勾选页（{{ checked.length }}）</button>
        <div class="row" style="gap: 6px">
          <button class="btn btn-sm" :disabled="!undoStack.canUndo.value" title="Ctrl+Z" @click="doUndo"><Undo2 :size="14" /> 撤销</button>
          <button class="btn btn-sm" :disabled="!undoStack.canRedo.value" title="Ctrl+Y" @click="doRedo"><Redo2 :size="14" /> 重做</button>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="exportPdf"><Download :size="14" /> 导出 PDF</button>
      </div>

      <!-- rx6 签名板改为浮层抽屉：打开时不挤压/跳动主布局 -->
      <Teleport to="body">
        <div v-if="mode === 'sign'" class="sign-drawer">
          <div class="sd-head">
            <b>手绘签名</b>
            <button class="mini" title="关闭签名板" aria-label="关闭签名板" @click="mode = 'none'"><X :size="13" /></button>
          </div>
          <SignaturePad ref="sigRef" />
          <p class="muted small">写好后点上方「手绘签名」生成印章，再到页面预览点击放置。</p>
        </div>
      </Teleport>

      <div class="layout mt-2">
        <aside class="pages">
          <div v-if="pageCount > MAX_THUMBS" class="notice notice-info small">
            缩略图墙已渲染前 {{ MAX_THUMBS }} 页（共 {{ pageCount }} 页）；页码/水印/导出仍覆盖全部页面。
          </div>
          <div
            v-for="(t, i) in thumbs"
            :key="i"
            class="page-item"
            :class="{ active: i === cur, dragging: dragIdx === i }"
            draggable="true"
            @click="cur = i"
            @dragstart="onThumbDragStart(i)"
            @dragover.prevent
            @drop.prevent="onThumbDrop(i)"
          >
            <span class="pnum">{{ i + 1 }}</span>
            <img :src="t" class="thumb" :alt="`第 ${i + 1} 页`" />
            <div class="pacts">
              <button class="mini" title="旋转" aria-label="旋转" @click.stop="rotatePage(i)"><RotateCw :size="12" /></button>
              <button class="mini" title="上移" aria-label="上移" @click.stop="movePage(i, -1)"><ArrowUp :size="12" /></button>
              <button class="mini" title="下移" aria-label="下移" @click.stop="movePage(i, 1)"><ArrowDown :size="12" /></button>
              <button class="mini danger" title="删除" aria-label="删除" @click.stop="removePage(i)"><Trash2 :size="12" /></button>
              <label class="mini check" title="勾选提取" @click.stop>
                <input type="checkbox" :checked="checked.includes(i)" @change="toggleCheck(i)" />
              </label>
            </div>
          </div>
        </aside>

        <main class="preview">
          <div v-if="mode !== 'none'" class="notice notice-info small mb-2">
            {{ mode === 'text' ? '已进入文字放置模式：在页面预览上点击选择位置（该点为文字顶部附近）。' : '已进入签名放置模式：在页面预览上点击放置。' }}
            <button class="btn btn-ghost btn-sm" style="margin-left: auto" @click="mode = 'none'">取消</button>
          </div>
          <div class="preview-wrap">
            <div ref="previewStage" class="preview-stage" :class="{ picking: mode !== 'none' }" @click="onPageClick"></div>
            <!-- rx4 就近 busy：预览区左上角叠加 spinner 徽标 -->
            <div v-if="busy" class="busy-badge"><Loader2 :size="14" class="spin" /> 处理中…</div>
          </div>
          <p class="muted small center">第 {{ cur + 1 }} / {{ pageCount }} 页</p>
        </main>
      </div>
      <p class="muted small mt-2"><FileText :size="12" style="vertical-align: -2px" /> 每次编辑都会即时保存为中间状态，「导出 PDF」直接保存当前状态。</p>
    </template>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.steps {
  gap: 14px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-2);
}
.step-n {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
}
.step-arrow {
  color: var(--text-3);
  margin-left: 8px;
}
.toolbar {
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
}
.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
/* rx6 签名板浮层：不挤压主布局 */
.sign-drawer {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 60;
  width: min(420px, calc(100vw - 36px));
  border: 1px solid var(--border-strong, var(--border));
  border-radius: 14px;
  background: var(--panel-solid);
  box-shadow: 0 18px 50px rgb(0 0 0 / 0.28);
  padding: 12px 14px;
  display: grid;
  gap: 8px;
}
.sd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13.5px;
}
.preview-wrap {
  position: relative;
}
.busy-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-solid) 85%, transparent);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-2);
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.12);
}
.page-item.dragging {
  opacity: 0.55;
  outline: 1.5px dashed var(--accent);
}
.layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.pages {
  display: grid;
  gap: 10px;
  max-height: 74vh;
  overflow: auto;
  padding: 4px;
}
.page-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  cursor: pointer;
  position: relative;
  display: grid;
  gap: 6px;
}
.page-item.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.pnum {
  font-size: 11.5px;
  color: var(--text-3);
  font-weight: 600;
}
.thumb {
  width: 100%;
  border-radius: 6px;
  display: block;
  border: 1px solid var(--border);
}
.pacts {
  display: flex;
  gap: 4px;
  align-items: center;
}
.mini {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  width: 24px;
  height: 22px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}
.mini:hover {
  border-color: var(--accent);
  color: var(--text);
}
.mini.danger:hover {
  border-color: var(--err);
  color: var(--err);
}
.mini.check {
  cursor: pointer;
}
.mini.check input {
  width: 13px;
  height: 13px;
}
.preview-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: auto;
  padding: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  text-align: center;
}
.preview-stage.picking {
  cursor: crosshair;
}
.center {
  text-align: center;
}
</style>
