<script setup lang="ts">
/** PDF 插入图片：点击预览放置（点击点=图片中心），ghost 拖动微调、透明度、成品回读；预览舞台见 InsertPreviewStage */
import { onBeforeUnmount, ref } from 'vue'
import { Loader2, Trash2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import InsertPreviewStage, { type GhostPlacement } from './InsertPreviewStage.vue'
import { renderPageToBlob } from '@/lib/pdfEngine'
import { applyPlacements } from './insertPlacements'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

interface Placement extends GhostPlacement {}

const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const images = ref<File[]>([])
const imgsRef = ref<InstanceType<typeof FileDrop> | null>(null)
const pageIdx = ref(0)
const pageCount = ref(0)
const busy = ref(false)
const scalePct = ref(30)
const opacity = ref(100)
const activeImg = ref(0)
const result = ref<{ blob: Blob; url: string } | null>(null)
const placements = ref<Placement[]>([])

const loadPages = () => {
  pageCount.value = base.value?.pageCount ?? 0
  pageIdx.value = 0
  placements.value = []
  clearResult()
}

const go = (d: number) => {
  const next = pageIdx.value + d
  if (next < 0 || next >= pageCount.value) return
  pageIdx.value = next
}

/** 预览点击 → 记录一次放置（点击点=图片中心） */
const onPick = (e: PointerEvent) => {
  const img = images.value[activeImg.value]
  if (!img) {
    toast.warn('请先添加图片')
    return
  }
  const target = e.target as HTMLElement
  if (!(target instanceof HTMLCanvasElement)) return
  const rect = target.getBoundingClientRect()
  const xRatio = (e.clientX - rect.left) / rect.width
  const yRatio = (e.clientY - rect.top) / rect.height
  placements.value.push({
    image: img,
    pageIndex: pageIdx.value,
    xRatio,
    yRatio,
    scalePct: scalePct.value,
    opacity: opacity.value / 100,
  })
  toast.ok(`已放置（第 ${pageIdx.value + 1} 页 ${Math.round(xRatio * 100)}%,${Math.round(yRatio * 100)}%），可拖动轮廓微调`)
}

/** ghost 拖动 → 更新放置比例 */
const onGhostMove = (index: number, x: number, y: number) => {
  const p = placements.value[index]
  if (!p) return
  p.xRatio = x
  p.yRatio = y
}

const removePlacement = (i: number) => placements.value.splice(i, 1)

const clearResult = () => {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}

const run = async () => {
  const files = base.value?.files ?? []
  if (!files.length) return toast.warn('请先载入 PDF')
  if (!placements.value.length) return toast.warn('请在预览上点击至少一次放置图片')
  busy.value = true
  try {
    const out = await applyPlacements(files[0], placements.value.map((p) => ({ ...p })))
    // 成品回读：渲染输出首个放置页为图片预览
    const jpg = await renderPageToBlob(out, placements.value[0]!.pageIndex, { format: 'image/jpeg', quality: 0.85, scale: 1.2 })
    clearResult()
    result.value = { blob: out, url: URL.createObjectURL(jpg) }
    toast.ok(`已在 ${new Set(placements.value.map((p) => p.pageIndex)).size} 个页面插入 ${placements.value.length} 处图片`)
  } catch (e) {
    toast.err((e as Error).message || '插入失败，请确认 PDF 未加密')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (result.value) saveBlob(result.value.blob, '插入图片.pdf')
}

const onImages = (list: File[]) => {
  images.value = list
  activeImg.value = 0
}
const clearImages = () => {
  images.value = []
  imgsRef.value?.clear()
}
onBeforeUnmount(clearResult)
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
            <button v-for="(im, i) in images" :key="i" class="chip" :class="{ active: activeImg === i }" @click="activeImg = i">{{ im.name.slice(0, 14) }}</button>
            <button class="btn btn-ghost btn-sm" @click="clearImages"><Trash2 :size="13" /> 清空</button>
          </div>
        </div>
        <label class="opt">
          <span class="field-label">图片宽度占页宽（%）</span>
          <input v-model.number="scalePct" type="number" min="2" max="100" class="input" style="width: 110px" />
        </label>
        <label class="opt">
          <span class="field-label">不透明度：{{ opacity }}%</span>
          <input v-model.number="opacity" type="range" class="range" min="10" max="100" step="5" style="width: 140px" />
        </label>
      </div>

      <div class="split">
        <InsertPreviewStage
          :file="base?.files[0] ?? null"
          :page-idx="pageIdx"
          :page-count="pageCount"
          :placements="placements"
          @go="go"
          @pick="onPick"
          @ghost-move="onGhostMove"
        />

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

      <!-- 成品回读：下载前先看到图片已落在页面上 -->
      <div v-if="result" class="mt-2 result-card">
        <img :src="result.url" alt="成品首页预览" class="result-img" />
        <div class="row row-wrap mt-1">
          <button class="btn btn-primary" @click="download">下载副本</button>
          <span class="small muted">上方为输出副本第 {{ placements[0]!.pageIndex + 1 }} 页预览（透明 PNG 不铺白底）</span>
        </div>
      </div>
      <div v-else class="row mt-2">
        <button class="btn btn-primary" :disabled="busy || !placements.length" @click="run">
          <Loader2 v-if="busy" :size="16" class="spin" /> 生成并下载
        </button>
        <span class="muted small">输出为副本，原 PDF 不受影响。</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt { display: grid; gap: 4px; }
.range { width: 100%; }
.split { display: grid; grid-template-columns: 1fr 300px; gap: 16px; }
@media (max-width: 860px) { .split { grid-template-columns: 1fr; } }
.list-pane { display: grid; gap: 6px; align-content: start; }
.p-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; }
.ellipsis { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icon-btn { border: none; background: transparent; color: var(--text-3); cursor: pointer; margin-left: auto; }
.icon-btn:hover { color: var(--accent-text); }
.result-card { border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: grid; gap: 8px; justify-items: start; }
.result-img { max-width: 420px; max-height: min(60vh, 560px); border: 1px solid var(--border); border-radius: 8px; background: #fff; }
.chip { border: 1px solid var(--border); background: none; color: var(--text-2); border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.chip.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-text); }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
