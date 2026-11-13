<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { parsePageSpec, renderPageToCanvas } from '@/lib/pdfEngine'
import { hasCJK, stampImageTexts, textToPng, type ImageTextItem } from './cjkText'
import { addHeaderFooter, loadPdfLib } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 页眉页脚：三段式（左/中/右）+ 首页实时预览 + 页范围 + 自定义输出名 */
type SlotKind = 'none' | 'text' | 'page' | 'date'
interface Slot {
  kind: SlotKind
  text: string
}

const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const fontSize = ref(10)
const rangeSpec = ref('')
const outName = ref('加页眉页脚')
const busy = ref(false)

const header = ref<Slot[]>([
  { kind: 'none', text: '' },
  { kind: 'none', text: '' },
  { kind: 'none', text: '' },
])
const footer = ref<Slot[]>([
  { kind: 'none', text: '' },
  { kind: 'none', text: '' },
  { kind: 'none', text: '' },
])

const posNames = ['左', '中', '右']
const kindLabel: Record<SlotKind, string> = { none: '无', text: '自定义文字', page: '页码', date: '日期' }

/* ---------- 首页实时预览：渲染一次 + 文字层 300ms 防抖叠加 ---------- */
const previewUrl = ref('')
const previewSize = ref<{ w: number; h: number } | null>(null)

const renderPreview = async () => {
  const file = base.value?.files[0]
  if (!file) {
    previewUrl.value = ''
    previewSize.value = null
    return
  }
  try {
    const canvas = await renderPageToCanvas(file, 0, 1.2)
    previewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
    previewSize.value = { w: canvas.width, h: canvas.height }
  } catch {
    previewUrl.value = ''
  }
}

watch(() => base.value?.files[0], renderPreview, { immediate: true })

/** 解析某个内容位在第 i 页的实际文字（0 基页索引） */
const resolveSlot = (s: Slot, i: number, total: number): string => {
  if (s.kind === 'none') return ''
  if (s.kind === 'page') return String(i + 1)
  if (s.kind === 'date') {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return s.text
}

const hasContent = () => [...header.value, ...footer.value].some((s) => s.kind !== 'none')

/** 是否全部为「中位自定义文字」且不含中文 → 走引擎原生路径（文字可选中） */
const nativeEligible = () => {
  const all = [...header.value, ...footer.value]
  const used = all.filter((s) => s.kind !== 'none')
  return (
    used.length > 0 &&
    used.every((s) => s.kind === 'text') &&
    header.value[1].kind === 'text' &&
    footer.value[1].kind === 'text' &&
    !used.some((s) => hasCJK(s.text)) &&
    (!rangeSpec.value.trim() || rangeSpec.value.trim().toLowerCase() === 'all')
  )
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!hasContent()) {
    toast.warn('请至少为页眉或页脚选择一个内容位')
    return
  }
  busy.value = true
  try {
    const { PDFDocument } = await loadPdfLib()
    const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const sizes = probe.getPages().map((p) => p.getSize())
    const total = sizes.length
    const targets = rangeSpec.value.trim() ? parsePageSpec(rangeSpec.value, total) : Array.from({ length: total }, (_, i) => i)
    if (!targets.length) {
      toast.warn(`页范围「${rangeSpec.value}」没有匹配到任何页（文档共 ${total} 页）`)
      return
    }

    if (nativeEligible()) {
      const blob = await addHeaderFooter(file, {
        header: header.value[1].text || undefined,
        footer: footer.value[1].text || undefined,
        fontSize: fontSize.value,
      })
      saveBlob(blob, `${outName.value.trim() || '加页眉页脚'}.pdf`)
      toast.ok('页眉页脚已添加')
      return
    }

    // 通用路径：Canvas 贴图（支持中文、左/右/中、页码与日期）
    const m = 28
    const items: Parameters<typeof stampImageTexts>[1] = []
    const color: [number, number, number] = [0.35, 0.38, 0.45]
    for (const i of targets) {
      const { width: W, height: H } = sizes[i]
      for (const [slots, isHeader] of [
        [header.value, true],
        [footer.value, false],
      ] as [Slot[], boolean][]) {
        slots.forEach((s, pos) => {
          const text = resolveSlot(s, i, total)
          if (!text.trim()) return
          const png = textToPng(text, { sizePt: fontSize.value, color })
          const xPt = pos === 0 ? m : pos === 2 ? W - png.wPt - m : (W - png.wPt) / 2
          const yPt = isHeader ? H - m - png.hPt : m
          items.push({ page: i, xPt, yPt, png } as ImageTextItem)
        })
      }
    }
    const blob = await stampImageTexts(file, items)
    saveBlob(blob, `${outName.value.trim() || '加页眉页脚'}.pdf`)
    toast.ok(`页眉页脚已添加（应用 ${targets.length} / ${total} 页）`)
  } catch (e) {
    toast.err((e as Error).message || '添加失败')
  } finally {
    busy.value = false
  }
}

/* ---------- 预览叠加层坐标（百分比） ---------- */
const overlayStyle = (slots: Slot[], isHeader: boolean) => (i: number) => {
  const size = previewSize.value
  if (!size) return null
  const s = slots[i]
  const text = resolveSlot(s, 0, 1)
  if (!text.trim()) return null
  const left = i === 0 ? '3%' : i === 2 ? 'auto' : '50%'
  const right = i === 2 ? '3%' : 'auto'
  return {
    left,
    right,
    top: isHeader ? '10px' : 'auto',
    bottom: isHeader ? 'auto' : '10px',
    transform: i === 1 ? 'translateX(-50%)' : 'none',
    fontSize: `${(fontSize.value * size.w) / 595}px`,
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div v-if="previewUrl" class="preview-wrap mt-2">
      <img :src="previewUrl" alt="首页预览" class="preview-img" />
      <template v-if="previewSize">
        <span
          v-for="(s, i) in 3"
          :key="'h' + i"
          class="ov-text"
          :style="overlayStyle(header, true)(i) ?? {}"
          >{{ header[i].kind === 'page' ? '1' : header[i].kind === 'date' ? '2026-01-01' : header[i].text }}</span
        >
        <span
          v-for="(s, i) in 3"
          :key="'f' + i"
          class="ov-text"
          :style="overlayStyle(footer, false)(i) ?? {}"
          >{{ footer[i].kind === 'page' ? '1' : footer[i].kind === 'date' ? '2026-01-01' : footer[i].text }}</span
        >
      </template>
    </div>
    <p v-else-if="base?.files.length" class="small muted mt-2">正在生成首页预览…</p>

    <div class="hf-grid mt-2">
      <template v-for="(slots, band) in [header, footer]" :key="band">
        <div v-for="(s, i) in slots" :key="band + i" class="hf-cell">
          <span class="field-label">{{ band === 0 ? '页眉' : '页脚' }}·{{ posNames[i] }}</span>
          <select v-model="s.kind" class="select">
            <option v-for="(lb, k) in kindLabel" :key="k" :value="k">{{ lb }}</option>
          </select>
          <input v-if="s.kind === 'text'" v-model="s.text" type="text" class="input" placeholder="自定义文字" />
        </div>
      </template>
      <div>
        <span class="field-label">字号（pt）</span>
        <input v-model.number="fontSize" type="number" class="input" min="6" max="24" />
      </div>
      <div>
        <span class="field-label">应用页范围（空 = 全部）</span>
        <input v-model="rangeSpec" type="text" class="input" placeholder="如 2-10（可跳过首页）" />
      </div>
      <div>
        <span class="field-label">输出文件名</span>
        <input v-model="outName" type="text" class="input" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 添加并下载
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      六个内容位独立设置：左/中/右互不重叠；含中文或页码/日期时自动以高清贴图方式嵌入（左/右对齐按 28pt 边距）。预览为首页示意，实际位置以导出为准。
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.preview-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.preview-img {
  max-width: min(100%, 520px);
  max-height: 60vh;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  display: block;
}
.ov-text {
  position: absolute;
  color: rgba(90, 96, 110, 0.85);
  pointer-events: none;
  white-space: nowrap;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-shadow: 0 0 2px #fff;
}
.hf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.hf-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}
</style>
