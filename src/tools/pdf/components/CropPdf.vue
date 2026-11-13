<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Loader2, Wand2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfLib, parsePageSpec, renderPageToCanvas } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 裁边：遮罩可视化 + 翻页预览 + 白边自动检测 + 对称/预设 + 页范围（组件级 setCropBox） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const top = ref(5)
const right = ref(5)
const bottom = ref(5)
const left = ref(5)
const symV = ref(false)
const symH = ref(false)
const rangeSpec = ref('')
const busy = ref(false)
const previewBox = ref<HTMLDivElement | null>(null)
const file = ref<File | Blob | null>(null)
const curPage = ref(0)
const pageCount = ref(0)
const previewUrl = ref('')

const onFiles = (list: File[]) => {
  file.value = list[0] ?? null
  curPage.value = 0
  void renderPreview()
}

const go = async (d: number) => {
  const next = curPage.value + d
  if (next < 0 || next >= pageCount.value) return
  curPage.value = next
  await renderPreview()
}

const renderPreview = async () => {
  if (!file.value) {
    previewUrl.value = ''
    return
  }
  try {
    const canvas = await renderPageToCanvas(file.value, curPage.value, 1)
    previewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
    if (!pageCount.value) pageCount.value = base.value?.pageCount ?? 0
  } catch {
    /* 预览失败忽略 */
  }
}

watch([top, right, bottom, left], () => void renderPreview())

/** 自动检测白边：扫描当前页四周非白像素边界，写入滑杆 */
const autoDetect = async () => {
  if (!file.value) return
  try {
    const canvas = await renderPageToCanvas(file.value, curPage.value, 1)
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const d = ctx.getImageData(0, 0, W, H).data
    const isWhite = (x: number, y: number) => {
      const k = (y * W + x) * 4
      return d[k]! > 242 && d[k + 1]! > 242 && d[k + 2]! > 242
    }
    let t = 0
    for (; t < H; t++) {
      let hit = false
      for (let x = 0; x < W; x += 3) if (!isWhite(x, t)) { hit = true; break }
      if (hit) break
    }
    let b = 0
    for (; b < H; b++) {
      let hit = false
      for (let x = 0; x < W; x += 3) if (!isWhite(x, H - 1 - b)) { hit = true; break }
      if (hit) break
    }
    let l = 0
    for (; l < W; l++) {
      let hit = false
      for (let y = 0; y < H; y += 3) if (!isWhite(l, y)) { hit = true; break }
      if (hit) break
    }
    let r = 0
    for (; r < W; r++) {
      let hit = false
      for (let y = 0; y < H; y += 3) if (!isWhite(W - 1 - r, y)) { hit = true; break }
      if (hit) break
    }
    top.value = Math.min(40, Math.round((t / H) * 100))
    bottom.value = Math.min(40, Math.round((b / H) * 100))
    left.value = Math.min(40, Math.round((l / W) * 100))
    right.value = Math.min(40, Math.round((r / W) * 100))
    toast.ok(`已按第 ${curPage.value + 1} 页内容边界填入四边比例`)
  } catch {
    toast.err('白边检测失败')
  }
}

/** 预设：去白边（检测）/ 去装订边（左侧多裁 8%） */
const presetBinding = () => {
  left.value = Math.min(40, left.value + 8)
  toast.ok('已按「去装订边」预设：左侧额外裁掉 8%')
}

/** 组件级裁剪：仅范围内页改 CropBox */
const run = async () => {
  if (!file.value) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (top.value + bottom.value >= 90 || left.value + right.value >= 90) {
    toast.warn('裁剪比例过大，上下（或左右）合计需小于 90%')
    return
  }
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const doc = await PDFDocument.load(await file.value.arrayBuffer(), { ignoreEncryption: true })
    const pages = doc.getPages()
    const targets = rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, pages.length) : pages.map((_, i) => i)
    if (!targets.length) {
      toast.warn(`页范围「${rangeSpec.value}」没有匹配到任何页（共 ${pages.length} 页）`)
      return
    }
    for (const i of targets) {
      const page = pages[i]!
      const { width, height } = page.getSize()
      const x = (left.value / 100) * width
      const y = (bottom.value / 100) * height
      const w = width - ((left.value + right.value) / 100) * width
      const h = height - ((top.value + bottom.value) / 100) * height
      if (w > 0 && h > 0) page.setCropBox(x, y, w, h)
    }
    doc.setProducer('ToolHub')
    if (!doc.getCreator()) doc.setCreator('ToolHub')
    const blob = new Blob([await doc.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
    saveBlob(blob, '裁边后.pdf')
    toast.ok(`已对 ${targets.length} / ${pages.length} 页写入裁边`)
  } catch (e) {
    toast.err((e as Error).message || '裁剪失败')
  } finally {
    busy.value = false
  }
}

/* 对称联动 */
watch(top, (v) => symV.value && (bottom.value = v))
watch(bottom, (v) => symV.value && (top.value = v))
watch(left, (v) => symH.value && (right.value = v))
watch(right, (v) => symH.value && (left.value = v))
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div v-if="file" class="grid-2 mt-2">
      <div>
        <div class="mb-2">
          <span class="field-label">上边裁掉：{{ top }}%</span>
          <input v-model.number="top" type="range" class="range" min="0" max="40" step="1" />
        </div>
        <div class="mb-2">
          <span class="field-label">右边裁掉：{{ right }}%</span>
          <input v-model.number="right" type="range" class="range" min="0" max="40" step="1" />
        </div>
        <div class="mb-2">
          <span class="field-label">下边裁掉：{{ bottom }}%</span>
          <input v-model.number="bottom" type="range" class="range" min="0" max="40" step="1" />
        </div>
        <div class="mb-2">
          <span class="field-label">左边裁掉：{{ left }}%</span>
          <input v-model.number="left" type="range" class="range" min="0" max="40" step="1" />
        </div>
        <label class="check"><input v-model="symV" type="checkbox" /> 上下对称（联动）</label>
        <label class="check"><input v-model="symH" type="checkbox" /> 左右对称（联动）</label>
        <div class="row row-wrap mt-2" style="gap: 8px">
          <button class="btn btn-soft btn-sm" @click="autoDetect"><Wand2 :size="14" /> 自动检测白边</button>
          <button class="btn btn-ghost btn-sm" @click="presetBinding">去装订边预设</button>
        </div>
      </div>
      <div>
        <p class="field-label mb-2">
          第 {{ curPage + 1 }} / {{ pageCount }} 页预览（遮罩外为裁掉区域，虚线为保留边框）
          <button class="btn btn-ghost btn-sm" style="margin-left: 6px" :disabled="curPage <= 0" @click="go(-1)"><ChevronLeft :size="14" /></button>
          <button class="btn btn-ghost btn-sm" :disabled="curPage >= pageCount - 1" @click="go(1)"><ChevronRight :size="14" /></button>
        </p>
        <div class="preview">
          <div v-if="previewUrl" class="mask-holder">
            <img :src="previewUrl" alt="页面预览" />
            <div class="ov" :style="{ top: 0, left: 0, right: 0, height: top + '%' }"></div>
            <div class="ov" :style="{ bottom: 0, left: 0, right: 0, height: bottom + '%' }"></div>
            <div class="ov" :style="{ left: 0, top: top + '%', height: 100 - top - bottom + '%', width: left + '%' }"></div>
            <div class="ov" :style="{ right: 0, top: top + '%', height: 100 - top - bottom + '%', width: right + '%' }"></div>
            <div class="retained" :style="{ top: top + '%', right: right + '%', bottom: bottom + '%', left: left + '%' }"></div>
          </div>
          <span v-else class="small muted">正在渲染预览…</span>
        </div>
        <div class="mt-2">
          <span class="field-label">应用页范围（空 = 全部页）</span>
          <input v-model="rangeSpec" type="text" class="input" placeholder="如 1-3,7" />
        </div>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 裁边并下载
      </button>
      <span class="small muted">裁边写入页面 CropBox，内容不丢失，仅改变显示/打印范围；自动检测按当前预览页计算</span>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
.preview {
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 6px;
  min-height: 200px;
  display: grid;
  place-items: center;
  background: var(--bg-soft);
}
.mask-holder {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
}
.mask-holder img {
  max-width: 100%;
  height: auto;
  display: block;
}
/* 裁掉区域：四条半透明遮罩带（能隐约看到被裁内容轮廓） */
.ov {
  position: absolute;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.retained {
  position: absolute;
  border: 1.5px dashed var(--accent);
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
