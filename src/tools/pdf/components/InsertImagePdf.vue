<script setup lang="ts">
/** PDF 插入图片：页面预览上点击定位（图章/插图），支持逐页放置与透明 PNG */
import { ref, shallowRef } from 'vue'
import { ChevronLeft, ChevronRight, Loader2, MousePointerClick, Trash2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import { renderPageToCanvas, insertImagesAt } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const images = ref<File[]>([])
const imgsRef = ref<InstanceType<typeof FileDrop> | null>(null)

const pageIdx = ref(0)
const pageCount = ref(0)
const preview = shallowRef<HTMLCanvasElement | null>(null)
const previewBox = ref<HTMLElement | null>(null)
const busy = ref(false)
const rendering = ref(false)
const scalePct = ref(30)
const activeImg = ref(0)

interface Placement {
  image: File
  pageIndex: number
  xRatio: number
  yRatio: number
  scalePct: number
}
const placements = ref<Placement[]>([])

/** 渲染当前页预览 */
const renderPreview = async () => {
  const files = base.value?.files ?? []
  if (!files.length) return
  rendering.value = true
  try {
    const c = await renderPageToCanvas(files[0], pageIdx.value, 1.2)
    preview.value = c
    await new Promise((r) => setTimeout(r, 0))
    const stage = previewBox.value
    if (stage) {
      stage.innerHTML = ''
      c.style.width = '100%'
      c.style.height = 'auto'
      c.style.display = 'block'
      c.style.cursor = 'crosshair'
      stage.appendChild(c)
    }
  } catch (e) {
    toast.err((e as Error).message || '页面渲染失败')
  } finally {
    rendering.value = false
  }
}

const loadPages = async () => {
  pageCount.value = base.value?.pageCount ?? 0
  pageIdx.value = 0
  placements.value = []
  await renderPreview()
}

const go = async (d: number) => {
  const next = pageIdx.value + d
  if (next < 0 || next >= pageCount.value) return
  pageIdx.value = next
  await renderPreview()
}

/** 预览点击 → 记录一次放置（当前选中图片 + 当前页 + 点击比例） */
const onPreviewClick = (e: MouseEvent) => {
  const img = images.value[activeImg.value]
  if (!img) {
    toast.warn('请先添加图片')
    return
  }
  const target = e.target as HTMLCanvasElement
  const rect = target.getBoundingClientRect()
  const xRatio = (e.clientX - rect.left) / rect.width
  const yRatio = (e.clientY - rect.top) / rect.height
  placements.value.push({ image: img, pageIndex: pageIdx.value, xRatio, yRatio, scalePct: scalePct.value })
  toast.ok(`已放置（第 ${pageIdx.value + 1} 页 ${Math.round(xRatio * 100)}%,${Math.round(yRatio * 100)}%）`)
}

const removePlacement = (i: number) => {
  placements.value.splice(i, 1)
}

const run = async () => {
  const files = base.value?.files ?? []
  if (!files.length) return toast.warn('请先载入 PDF')
  if (!placements.value.length) return toast.warn('请在预览上点击至少一次放置图片')
  busy.value = true
  try {
    const blob = await insertImagesAt(files[0], placements.value.map((p) => ({ ...p })))
    saveBlob(blob, '插入图片.pdf')
    toast.ok(`已在 ${new Set(placements.value.map((p) => p.pageIndex)).size} 个页面插入 ${placements.value.length} 处图片`)
  } catch (e) {
    toast.err((e as Error).message || '插入失败，请确认 PDF 未加密')
  } finally {
    busy.value = false
  }
}

const onImages = (list: File[]) => {
  images.value = list
  activeImg.value = 0
}
const clearImages = () => {
  images.value = []
  imgsRef.value?.clear()
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="false" label="拖入 PDF 文件" @files="loadPages" />

    <div v-if="pageCount" class="mt-2">
      <div class="row row-wrap mb-2" style="gap: 14px; align-items: flex-end">
        <div class="opt" style="max-width: 380px">
          <span class="field-label">签名/插图素材（可多张）</span>
          <FileDrop ref="imgsRef" accept="image/*" :multiple="true" label="拖入图片（透明 PNG 可作图章）" hint="选中后点击右侧预览放置" @files="onImages" />
          <div v-if="images.length" class="row row-wrap mt-1" style="gap: 6px">
            <button
              v-for="(im, i) in images"
              :key="i"
              class="chip"
              :class="{ active: activeImg === i }"
              @click="activeImg = i"
            >{{ im.name.slice(0, 14) }}</button>
            <button class="btn btn-ghost btn-sm" @click="clearImages"><Trash2 :size="13" /> 清空</button>
          </div>
        </div>
        <label class="opt">
          <span class="field-label">图片宽度占页宽（%）</span>
          <input v-model.number="scalePct" type="number" min="2" max="100" class="input" style="width: 110px" />
        </label>
      </div>

      <div class="split">
        <div class="preview-pane">
          <div class="row" style="gap: 8px; margin-bottom: 8px">
            <button class="btn btn-soft btn-sm" :disabled="pageIdx <= 0" @click="go(-1)"><ChevronLeft :size="14" /></button>
            <span class="small muted">第 {{ pageIdx + 1 }} / {{ pageCount }} 页</span>
            <button class="btn btn-soft btn-sm" :disabled="pageIdx >= pageCount - 1" @click="go(1)"><ChevronRight :size="14" /></button>
            <MousePointerClick :size="14" class="muted" />
            <span class="small muted">点击页面放置当前选中的图片</span>
          </div>
          <div ref="previewBox" class="preview-stage" @click="onPreviewClick"></div>
        </div>

        <div class="list-pane">
          <span class="field-label">放置清单（{{ placements.length }}）</span>
          <div v-if="!placements.length" class="muted small mt-1">还没有放置记录：在预览上点一下即可添加。</div>
          <div v-for="(p, i) in placements" :key="i" class="p-row">
            <span class="small mono ellipsis">{{ p.image.name }}</span>
            <span class="small muted">第 {{ p.pageIndex + 1 }} 页 · {{ Math.round(p.xRatio * 100) }}%,{{ Math.round(p.yRatio * 100) }}% · {{ p.scalePct }}%</span>
            <button class="icon-btn" @click="removePlacement(i)"><Trash2 :size="13" /></button>
          </div>
        </div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy || !placements.length" @click="run">
          <Loader2 v-if="busy" :size="16" class="spin" /> 生成并下载
        </button>
        <span class="muted small">输出为副本，原 PDF 不受影响。</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.split {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
}
@media (max-width: 860px) {
  .split {
    grid-template-columns: 1fr;
  }
}
.preview-stage {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  min-height: 200px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
}
.list-pane {
  display: grid;
  gap: 6px;
  align-content: start;
}
.p-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.ellipsis {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  margin-left: auto;
}
.icon-btn:hover {
  color: var(--accent-text);
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
