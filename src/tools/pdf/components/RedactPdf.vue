<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Loader2, Undo2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import PageThumbs, { type PageEntry } from './PageThumbs.vue'
import { blackenRegions, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

interface Box {
  page: number
  x: number
  y: number
  w: number
  h: number
}

/** PDF 黑条遮盖：翻页画框 + 框列表单删 + 应用到全部页 + 生成回读 + 1.5x/2x 精度缩放 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const checked = ref<number[]>([])
const order = ref<PageEntry[]>([])
const boxes = ref<Box[]>([])
const busy = ref(false)
const file = ref<File | Blob | null>(null)
const work = ref<Blob | null>(null)
const workPreviewUrl = ref('')
const stage = ref<HTMLDivElement | null>(null)
const drawing = ref<Box | null>(null)
const curPage = ref(0)
const zoom = ref<1 | 1.5 | 2>(1)

const totalPages = () => base.value?.pageCount ?? order.value.length ?? 0

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  work.value = null
  workPreviewUrl.value = ''
  checked.value = []
  boxes.value = []
  curPage.value = 0
}

const goto = (p: number) => {
  const n = totalPages()
  if (!n) return
  curPage.value = Math.min(n - 1, Math.max(0, p))
  work.value = null
  workPreviewUrl.value = ''
}
watch(checked, (c) => {
  if (c.length) {
    curPage.value = c[0]!
    work.value = null
  }
})

const renderPreview = async () => {
  if (!file.value || !stage.value) return
  try {
    const canvas = await renderPageToCanvas(file.value, curPage.value, zoom.value)
    canvas.style.maxWidth = zoom.value === 1 ? '100%' : 'none'
    stage.value.replaceChildren(canvas)
  } catch {
    /* 预览失败忽略 */
  }
}
watch([file, curPage, zoom], renderPreview)

const pageBoxes = () => boxes.value.filter((b) => b.page === curPage.value)

/* 拖拽画框 */
let startX = 0
let startY = 0
const onDown = (e: PointerEvent) => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  startX = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  startY = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  drawing.value = { page: curPage.value, x: startX, y: startY, w: 0, h: 0 }
  stage.value?.setPointerCapture(e.pointerId)
}
const onMove = (e: PointerEvent) => {
  if (!drawing.value) return
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  const cx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const cy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  drawing.value = {
    page: curPage.value,
    x: Math.min(startX, cx),
    y: Math.min(startY, cy),
    w: Math.abs(cx - startX),
    h: Math.abs(cy - startY),
  }
}
const onUp = () => {
  const d = drawing.value
  drawing.value = null
  if (!d || d.w < 0.01 || d.h < 0.01) return
  boxes.value.push(d)
}

const undo = () => boxes.value.pop()
const clearPage = () => (boxes.value = boxes.value.filter((b) => b.page !== curPage.value))
const removeBox = (i: number) => boxes.value.splice(i, 1)

/** 把当前页的全部框复制到所有页 */
const applyToAll = () => {
  const cur = pageBoxes()
  if (!cur.length) {
    toast.warn('本页还没有画框')
    return
  }
  const n = totalPages()
  for (let p = 0; p < n; p++) {
    if (p === curPage.value) continue
    for (const b of cur) boxes.value.push({ ...b, page: p })
  }
  toast.ok(`已把本页 ${cur.length} 个框应用到全部 ${n} 页（共 ${boxes.value.length} 个框）`)
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!boxes.value.length) {
    toast.warn('请先在预览上拖拽画出遮盖区域')
    return
  }
  busy.value = true
  try {
    const blob = await blackenRegions(file.value, boxes.value)
    work.value = blob
    // 生成回读：渲染输出文件首个画框页
    const firstPage = Math.min(...boxes.value.map((b) => b.page))
    const canvas = await renderPageToCanvas(blob, firstPage, 1)
    workPreviewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
    saveBlob(blob, '遮盖后.pdf')
    toast.ok(`已烧录 ${boxes.value.length} 处遮盖黑条（黑条已写入页面内容，见回读预览）`)
  } catch (e) {
    toast.err((e as Error).message || '遮盖失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <p v-if="file" class="small muted mt-1">
      翻页后在预览上<b>按住拖拽</b>画出黑条（当前第 {{ curPage + 1 }} / {{ totalPages() || '—' }} 页）；2x 缩放可精确框选身份证号等小字。
    </p>

    <PageThumbs v-if="file" v-model:checked="checked" v-model:order="order" :file="file" :selectable="true" :movable="false" :rotatable="false" class="mt-2" />

    <div class="row row-wrap mt-2" style="align-items: center">
      <button class="btn btn-ghost btn-sm" :disabled="curPage <= 0" @click="goto(curPage - 1)"><ChevronLeft :size="14" /> 上一页</button>
      <button class="btn btn-ghost btn-sm" :disabled="curPage >= totalPages() - 1" @click="goto(curPage + 1)">下一页 <ChevronRight :size="14" /></button>
      <label class="check small" style="margin-left: 8px">
        预览缩放
        <select v-model.number="zoom" class="select" style="width: 90px">
          <option :value="1">1x</option>
          <option :value="1.5">1.5x</option>
          <option :value="2">2x</option>
        </select>
      </label>
    </div>

    <div class="stage mt-2" :class="{ zoomed: zoom > 1 }" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
      <div ref="stage" class="holder">
        <div
          v-for="(b, i) in [...pageBoxes(), ...(drawing ? [drawing] : [])]"
          :key="i"
          class="blackbox"
          :style="{ left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' }"
        ></div>
      </div>
    </div>

    <div class="split mt-2">
      <div class="row row-wrap" style="align-items: flex-start">
        <div style="min-width: 220px">
          <div class="row row-wrap">
            <button class="btn btn-primary" :disabled="busy || !file || !boxes.length" @click="run">
              <Loader2 v-if="busy" :size="16" class="spinner" /> 生成遮盖 PDF
            </button>
            <button class="btn btn-ghost" :disabled="!boxes.length" @click="undo"><Undo2 :size="14" /> 撤销上一个</button>
            <button class="btn btn-ghost" :disabled="!pageBoxes().length" @click="clearPage">清空本页</button>
            <button class="btn btn-soft" :disabled="!pageBoxes().length || !file" @click="applyToAll">将本页框应用到全部页</button>
          </div>
          <p class="small muted mt-1">当前 {{ boxes.length }} 个遮盖区域</p>
          <img v-if="workPreviewUrl" :src="workPreviewUrl" alt="生成回读预览" class="work-preview mt-2" />
          <p v-if="workPreviewUrl" class="small muted">上方为输出文件回读预览（黑条已烧录进页面内容，非覆盖层）</p>
        </div>
      </div>
      <div class="box-list">
        <span class="field-label">框列表（{{ boxes.length }}）</span>
        <div v-if="!boxes.length" class="small muted mt-1">还没有遮盖框。</div>
        <div v-for="(b, i) in boxes" :key="i" class="box-row">
          <span class="small">第 {{ b.page + 1 }} 页 · ({{ Math.round(b.x * 100) }},{{ Math.round(b.y * 100) }}) {{ Math.round(b.w * 100) }}×{{ Math.round(b.h * 100) }}%</span>
          <button class="icon-btn" title="删除此框" @click="removeBox(i)">✕</button>
        </div>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      注意：黑条只是「画上去的覆盖」，底层文字仍然存在于 PDF 中（复制/搜索可见）。若需彻底移除敏感信息，请使用配套的「PDF 深度脱敏」，或生成遮盖后用「压缩 PDF」栅格化销毁文字层。
    </p>
  </div>
</template>

<style scoped>
.stage {
  display: flex;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 6px;
  background: var(--bg-soft);
  touch-action: none;
  cursor: crosshair;
  overflow: auto;
}
.stage.zoomed {
  justify-content: flex-start;
}
.holder {
  position: relative;
  display: inline-block;
  line-height: 0;
}
.stage:not(.zoomed) .holder {
  max-width: 100%;
}
.holder :deep(canvas) {
  height: auto;
  display: block;
}
.blackbox {
  position: absolute;
  background: #000;
  opacity: 0.85;
  pointer-events: none;
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
.box-list {
  display: grid;
  gap: 6px;
  align-content: start;
  max-height: 360px;
  overflow: auto;
}
.box-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12.5px;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  margin-left: auto;
}
.icon-btn:hover {
  color: var(--err);
}
.work-preview {
  max-width: 360px;
  max-height: 50vh;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
.spinner { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
