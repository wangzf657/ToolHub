<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfJs } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 转 Word：组件级逐页提取（带进度）→ 字号判级（≥1.5× 正文 → 标题1，1.2~1.5× → 标题2）→
 * 表格行降级为 docx Table → 先预览前 10 段确认再下载；产物名跟随源文件。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const withTitles = ref(true)
const busy = ref(false)
const progressLabel = ref('')
const stat = ref('')
/** 扫描结果（预览确认后落盘） */
const blocks = ref<{ text: string; heading?: 1 | 2; table?: string[][] }[]>([])
const paraCount = ref(0)

const isCJK = (s: string) => {
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk > s.replace(/\s/g, '').length / 2
}

interface RawLine {
  text: string
  size: number
  cells: string[]
  /** 行 y 基线（行聚合内部用） */
  _y?: number
}

/** 逐页提取行（文本+字号+切列），带进度 */
const extractLines = async (file: File, onP: (done: number, total: number) => void): Promise<RawLine[][]> => {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: RawLine[][] = []
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      type Item = { str: string; x: number; y: number; size: number }
      const items: Item[] = []
      for (const raw of tc.items as { str?: string; transform?: number[] }[]) {
        if (raw.str === undefined || !raw.str.trim() || !raw.transform) continue
        items.push({ str: raw.str, x: raw.transform[4]!, y: raw.transform[5]!, size: Math.abs(raw.transform[3]!) || 12 })
      }
      items.sort((a, b) => b.y - a.y || a.x - b.x)
      const lines: RawLine[] = []
      for (const it of items) {
        const last = lines[lines.length - 1]
        if (last && last._y !== undefined && Math.abs(it.y - last._y) <= 3) {
          last.text += it.str
          last.size = Math.max(last.size, it.size)
          last.cells.push(it.str)
        } else {
          lines.push({ text: it.str, size: it.size, cells: [it.str], _y: it.y })
        }
      }
      pages.push(lines)
      onP(i, doc.numPages)
    }
  } finally {
    doc.destroy()
  }
  return pages
}

/** 行数组 → 段落/标题/表格块（字号判级 + 表格降级） */
const buildBlocks = (pages: RawLine[][]): { text: string; heading?: 1 | 2; table?: string[][] }[] => {
  const sizes = pages.flat().map((l) => l.size)
  const freq = new Map<number, number>()
  for (const s of sizes) freq.set(s, (freq.get(s) ?? 0) + 1)
  const baseSize = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12
  const out: { text: string; heading?: 1 | 2; table?: string[][] }[] = []
  pages.forEach((lines, pageNo) => {
    if (withTitles.value) out.push({ text: `第 ${pageNo + 1} 页`, heading: 2 })
    let para: string[] = []
    let table: string[][] = []
    const flushPara = () => {
      if (para.length) {
        out.push({ text: para.join(isCJK(para.join('')) ? '' : ' ') })
        para = []
      }
    }
    const flushTable = () => {
      if (table.length >= 2) out.push({ text: '', table })
      else if (table.length === 1) para.push(table[0]!.join('  '))
      table = []
    }
    for (const l of lines) {
      const t = l.text.trim()
      if (!t) {
        flushPara()
        flushTable()
        continue
      }
      const ratio = l.size / baseSize
      if (ratio >= 1.5 && t.length < 80) {
        flushPara()
        flushTable()
        out.push({ text: t, heading: 1 })
        continue
      }
      if (ratio >= 1.2 && ratio < 1.5 && t.length < 80) {
        flushPara()
        flushTable()
        out.push({ text: t, heading: 2 })
        continue
      }
      // 表格行：x 聚类后 ≥2 列（以切列单元格去重近似，避免贴图行误判）
      const cells = [...new Set(l.cells.map((c) => c.trim()).filter(Boolean))]
      if (cells.length >= 2) {
        flushPara()
        table.push(cells)
        continue
      }
      flushTable()
      para.push(t)
    }
    flushPara()
    flushTable()
  })
  return out
}

const scan = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  blocks.value = []
  stat.value = ''
  try {
    const pages = await extractLines(file, (d, t) => (progressLabel.value = `正在提取第 ${d} / ${t} 页`))
    const b = buildBlocks(pages)
    blocks.value = b.filter((x) => x.text || x.table)
    paraCount.value = b.filter((x) => !x.table).length
    if (!paraCount.value) {
      toast.warn('未能提取到文本：该 PDF 可能是扫描图片，请先使用「扫描件 OCR 可搜索化」')
      return
    }
    stat.value = `共 ${paraCount.value} 个段落 · ${b.filter((x) => x.table).length} 个表格块（预览确认后下载）`
    toast.ok('扫描完成，请预览前 10 段后下载')
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
    progressLabel.value = ''
  }
}

/** 生成 docx（表格行降级为真实 Table） */
const download = async () => {
  if (!blocks.value.length) return
  busy.value = true
  stat.value = '正在生成 .docx…'
  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = await import('docx')
    const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = []
    for (const b of blocks.value) {
      if (b.table) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: b.table.map(
              (r) =>
                new TableRow({
                  children: r.map((c) => new TableCell({ children: [new Paragraph({ text: c })] })),
                }),
            ),
          }),
        )
        children.push(new Paragraph({ text: '' }))
      } else {
        const heading = b.heading === 1 ? HeadingLevel.HEADING_1 : b.heading === 2 ? HeadingLevel.HEADING_2 : undefined
        children.push(new Paragraph({ text: b.text, heading, children: b.heading ? undefined : [new TextRun(b.text)] }))
      }
    }
    const doc = new Document({ creator: 'ToolHub', title: 'PDF 转 Word', sections: [{ children }] })
    const blob = await Packer.toBlob(doc)
    const name = (base.value?.files[0]?.name ?? '文档').replace(/\.pdf$/i, '') + '.docx'
    saveBlob(blob, name)
    toast.ok(`Word 文档已生成：${name}`)
    stat.value = '已下载'
  } catch (e) {
    toast.err((e as Error).message || '生成失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => ((blocks = []), (stat = ''))" />

    <div class="row row-wrap mt-2">
      <label class="check"><input v-model="withTitles" type="checkbox" /> 每页前插入「第 n 页」标题</label>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="scan">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 扫描并预览
      </button>
      <button v-if="blocks.length" class="btn btn-soft" :disabled="busy" @click="download"><Download :size="15" /> 确认并下载 .docx</button>
      <span v-if="progressLabel" class="small muted">{{ progressLabel }}</span>
      <span v-else-if="stat" class="small muted">{{ stat }}</span>
    </div>

    <div v-if="blocks.length" class="preview mt-2">
      <p class="field-label mb-1">段落重组预览（前 10 块 / 共 {{ blocks.length }} 块）</p>
      <div v-for="(b, i) in blocks.slice(0, 10)" :key="i" class="pv-block">
        <template v-if="b.table">
          <table class="pv-table"><tr v-for="(r, ri) in b.table" :key="ri"><td v-for="(c, ci) in r" :key="ci">{{ c }}</td></tr></table>
        </template>
        <p v-else :class="{ 'pv-h1': b.heading === 1, 'pv-h2': b.heading === 2 }">{{ b.text }}</p>
      </div>
      <p class="small muted mt-1">标题判级：字号 ≥ 正文众数 1.5× → 标题1；1.2~1.5× → 标题2；表格行降级为真实 Word 表格。</p>
    </div>

    <p class="notice notice-info mt-2 small">
      本工具提取 PDF 文本层并按段落重组，排版样式不会 1:1 还原；扫描图片型 PDF 无法提取文字。产物名跟随源文件（如 报告.pdf → 报告.docx）。
    </p>
  </div>
</template>

<style scoped>
.spinner { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.preview {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  max-height: max(360px, calc(100dvh - 460px));
  overflow: auto;
}
.pv-block { margin-bottom: 6px; }
.pv-h1 { font-size: 16px; font-weight: 700; margin: 8px 0 2px; }
.pv-h2 { font-size: 14px; font-weight: 600; color: var(--accent-text); margin: 6px 0 2px; }
.pv-table { border-collapse: collapse; font-size: 12px; margin: 6px 0; }
.pv-table td { border: 1px solid var(--border); padding: 3px 8px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
