<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Loader2, Undo2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import SignPad from './SignPad.vue'
import { loadPdfLib, renderPageToCanvas, savePdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 签名：手绘签名 → 翻页/点缩略图选页 → 点击放置（放置即见半透明轮廓）→ 多签名/撤销 → 下载。
 * 支持记住签名（localStorage）与「手写签名板」一键交接（toolhub.sig.handoff）。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const pad = ref<InstanceType<typeof SignPad> | null>(null)
const checked = ref<number[]>([])
const order = ref<PageEntry[]>([])
const inkColor = ref('#1a2233')
const inkWidth = ref(3)
const sigW = ref(30) // 签名宽度占页宽百分比
const busy = ref(false)
const file = ref<File | Blob | null>(null)
const work = ref<Blob | null>(null) // 已叠加签名的工作副本
const previewBox = ref<HTMLDivElement | null>(null)
const sigDataUrl = ref('')
const curPage = ref(0)
const remember = ref(true)
const handoffNote = ref(false)

interface Placement {
  page: number
  x: number
  y: number
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

/** 页码切换器：放置跟随当前页，不再依赖勾选 */
const goto = (p: number) => {
  const n = totalPages()
  if (!n) return
  curPage.value = Math.min(n - 1, Math.max(0, p))
}
watch(checked, (c) => {
  if (c.length) curPage.value = c[0]!
})

const renderPreview = async () => {
  if (!work.value || !previewBox.value) return
  try {
    const canvas = await renderPageToCanvas(work.value, curPage.value, 1)
    canvas.style.maxWidth = '100%'
    previewBox.value.replaceChildren(canvas)
  } catch {
    /* 忽略预览错误 */
  }
}
watch([work, curPage, placements], renderPreview)

/** 在预览上点击选择放置点 */
const onPick = (e: MouseEvent) => {
  const box = previewBox.value
  if (!box) return
  const canvas = box.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先等待页面预览加载完成')
    return
  }
  const r = canvas.getBoundingClientRect()
  const p = {
    page: curPage.value,
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  }
  placements.value = [...placements.value, p]
  void applyPlacement(p)
}

/** 从原件重建：按 placements 逐个贴签名（撤销/多签名统一走这里） */
const rebuild = async () => {
  if (!file.value) return
  if (!placements.value.length) {
    work.value = null
    return
  }
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await file.value.arrayBuffer(), { ignoreEncryption: true })
  const png = await doc.embedPng(sigDataUrl.value)
  for (const p of placements.value) {
    const page = doc.getPage(Math.min(p.page, doc.getPageCount() - 1))
    const { width, height } = page.getSize()
    const w = (sigW.value / 100) * width
    const h = png.height * (w / png.width)
    // 点击点=签名中心（与 insert-image 口径一致），坐标翻转并夹在页面内
    const x = Math.max(0, Math.min(width - w, p.x * width - w / 2))
    const y = Math.max(0, Math.min(height - h, (1 - p.y) * height - h / 2))
    page.drawImage(png, { x, y, width: w, height: h })
  }
  work.value = await savePdf(doc)
}

const applyPlacement = async (p: Placement) => {
  if (!prepareSignature()) {
    // 无签名时撤回该点位
    placements.value = placements.value.filter((q) => q !== p)
    toast.warn('请先在签名板上手写签名')
    return
  }
  busy.value = true
  try {
    await rebuild()
    toast.ok('签名已放置，可继续放置多个签名或下载')
  } catch (e) {
    placements.value = placements.value.filter((q) => q !== p)
    toast.err((e as Error).message || '签名失败')
  } finally {
    busy.value = false
  }
}

const undoLast = () => {
  if (!placements.value.length) {
    toast.warn('没有可撤销的签名')
    return
  }
  placements.value = placements.value.slice(0, -1)
  void rebuild()
  toast.ok('已撤销上一处签名')
}

/** 签名可用时先取到 dataURL（板上有签名或已载入交接/记忆签名） */
const prepareSignature = () => {
  if (!pad.value) return false
  if (pad.value.isEmpty()) return false
  sigDataUrl.value = pad.value.toDataURL()
  return true
}

const download = () => {
  if (!work.value) {
    toast.warn('还没有放置任何签名')
    return
  }
  saveBlob(work.value, '签名后.pdf')
}

/* ---------- 记住签名 / 签名板交接 ---------- */
const SIG_KEY = 'toolhub.sig.remember'
const HANDOFF_KEY = 'toolhub.sig.handoff'

const restoreSig = () => {
  if (!pad.value) return
  const handoff = localStorage.getItem(HANDOFF_KEY)
  if (handoff) {
    pad.value.load(handoff)
    localStorage.removeItem(HANDOFF_KEY)
    handoffNote.value = true
    return
  }
  if (remember.value) {
    const saved = localStorage.getItem(SIG_KEY)
    if (saved) pad.value.load(saved)
  }
}
onMounted(() => {
  // 等签名板挂载完成后回填（交接优先于记忆签名）
  setTimeout(restoreSig, 0)
})
watch(() => pad.value, () => setTimeout(restoreSig, 0))

/** 放置成功后按开关记忆签名 */
watch(work, (w) => {
  if (w && remember.value && sigDataUrl.value) {
    try {
      localStorage.setItem(SIG_KEY, sigDataUrl.value)
    } catch {
      /* 隐私模式/超限时静默放弃 */
    }
  }
})
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <p v-if="handoffNote" class="notice notice-ok mt-2 small">已自动载入来自「手写签名板」的签名，可直接点击页面放置。</p>

    <div v-if="file" class="grid-2 mt-2">
      <div>
        <p class="field-label mb-2">1 · 手写签名</p>
        <SignPad ref="pad" v-model:color="inkColor" v-model:width="inkWidth" />
        <div class="grid-2 mt-2">
          <div>
            <span class="field-label">笔迹颜色</span>
            <input v-model="inkColor" type="color" class="input color" />
          </div>
          <div>
            <span class="field-label">笔迹粗细：{{ inkWidth }}</span>
            <input v-model.number="inkWidth" type="range" class="range" min="1" max="8" step="1" />
          </div>
        </div>
        <p class="field-label mt-2">3 · 签名宽度占页宽：{{ sigW }}%</p>
        <input v-model.number="sigW" type="range" class="range" min="8" max="70" step="1" />
        <label class="check mt-1"><input v-model="remember" type="checkbox" /> 记住签名（仅保存在本机浏览器，下次自动载入）</label>
      </div>
      <div>
        <p class="field-label mb-2">2 · 选择页面并点击放置位置（当前第 {{ curPage + 1 }} / {{ totalPages() || '—' }} 页）</p>
        <PageThumbs v-model:checked="checked" v-model:order="order" :file="file" :selectable="true" :movable="false" :rotatable="false" />
        <div class="row row-wrap mt-2" style="align-items: center">
          <button class="btn btn-ghost btn-sm" :disabled="curPage <= 0" @click="goto(curPage - 1)"><ChevronLeft :size="14" /> 上一页</button>
          <button class="btn btn-ghost btn-sm" :disabled="curPage >= totalPages() - 1" @click="goto(curPage + 1)">下一页 <ChevronRight :size="14" /></button>
        </div>
        <div class="preview mt-2" @click="onPick">
          <div ref="previewBox" class="canvas-holder">
            <!-- 放置即预览：半透明签名轮廓按 sigW 比例实时叠加 -->
            <template v-if="sigDataUrl">
              <img
                v-for="(p, i) in placements"
                :key="i"
                v-show="p.page === curPage"
                :src="sigDataUrl"
                class="ghost"
                :style="{ left: p.x * 100 + '%', top: p.y * 100 + '%', width: sigW + '%' }"
                alt=""
              />
            </template>
          </div>
        </div>
        <p class="small muted mt-1">点击页面选择放置位置（点击点=签名中心），放置后立即看到签名轮廓；可切页继续放置</p>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <span v-if="busy" class="row small muted"><Loader2 :size="14" class="spinner" /> 正在写入签名…</span>
      <button class="btn btn-ghost" :disabled="!placements.length || busy" @click="undoLast"><Undo2 :size="15" /> 撤销上一处签名</button>
      <button class="btn btn-soft" :disabled="!work" @click="download">下载签名后 PDF</button>
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
.preview {
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 6px;
  min-height: 220px;
  display: flex;
  justify-content: center;
  background: var(--bg-soft);
  cursor: crosshair;
}
.canvas-holder {
  position: relative;
  display: inline-block;
  line-height: 0;
  max-width: 100%;
}
.canvas-holder :deep(canvas) {
  max-width: 100%;
  height: auto;
}
.ghost {
  position: absolute;
  opacity: 0.55;
  pointer-events: none;
  transform: translate(-50%, -50%);
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
