<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { loadPdfJs, loadPdfLib } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

/**
 * PDF 转 Markdown：字号判级（正文众数基准，≥1.5x → H1、1.2~1.5x → H2，正则兜底）+
 * 列表嵌套（x 缩进）+ 图片占位注释 + 三项开关 + 源码/预览双 Tab。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const md = ref('')
const tab = ref<'code' | 'preview'>('code')
const previewHtml = ref('')
const optPageMark = ref(true)
const optTable = ref(true)
const optUpperHead = ref(true)

interface MdLine {
  text: string
  size: number
  x: number
  /** 行 y 基线（内部聚合用） */
  _y?: number
}

const isCJK = (s: string) => (s.match(/[\u4e00-\u9fff]/g) ?? []).length > s.replace(/\s/g, '').length / 2
const joiner = (lines: string[]) => (isCJK(lines.join('')) ? '' : ' ')

const gfmTable = (rows: string[][]): string => {
  const cols = Math.max(...rows.map((r) => r.length))
  const norm = rows.map((r) => [...r, ...Array(Math.max(0, cols - r.length)).fill('')])
  const head = `| ${norm[0].join(' | ')} |`
  const sep = `| ${Array(cols).fill('---').join(' | ')} |`
  const body = norm.slice(1).map((r) => `| ${r.join(' | ')} |`)
  return [head, sep, ...body].join('\n')
}

/** 单页行数组 → Markdown（字号判级 + 嵌套列表 + 表格） */
function linesToMd(lines: MdLine[], imgCount: number, pageNo: number): string {
  const sizes = lines.map((l) => l.size)
  const freq = new Map<number, number>()
  for (const s of sizes) freq.set(s, (freq.get(s) ?? 0) + 1)
  const baseSize = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12
  const minX = Math.min(...lines.map((l) => l.x))
  const avgW = lines.reduce((a, l) => a + l.text.length, 0) ? lines.reduce((a, l) => a + l.x - minX, 0) / lines.length : 0
  const out: string[] = []
  let para: string[] = []
  let table: string[][] = []
  const flushPara = () => {
    if (para.length) {
      out.push(para.join(joiner(para)))
      out.push('')
      para = []
    }
  }
  const flushTable = () => {
    if (optTable.value && table.length >= 2) {
      out.push(gfmTable(table))
      out.push('')
    } else if (table.length) {
      para.push(...table.map((r) => r.join('  ')))
    }
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
      out.push('# ' + t, '')
      continue
    }
    if (ratio >= 1.2 && ratio < 1.5 && t.length < 80) {
      flushPara()
      flushTable()
      out.push('## ' + t, '')
      continue
    }
    if (/^[-•·*]\s+/.test(t)) {
      flushPara()
      flushTable()
      // 嵌套层级：按 x 缩进（相对页首行，约 12pt 一级）
      const indent = Math.max(0, Math.min(2, Math.round((l.x - minX) / 12)))
      out.push((indent ? '  '.repeat(indent) : '') + '- ' + t.replace(/^[-•·*]\s+/, ''))
      continue
    }
    const cells = t.split(/\t| {2,}/).map((c) => c.trim()).filter(Boolean)
    if (optTable.value && cells.length >= 2) {
      flushPara()
      table.push(cells)
      continue
    }
    flushTable()
    if (/^第[一二三四五六七八九十百千\d]+[章节篇部分][\s、.．]/.test(t) && t.length < 50) {
      flushPara()
      out.push('## ' + t, '')
      continue
    }
    if (optUpperHead.value && /^[A-Z0-9][A-Z0-9 &,.:'\/\-]{2,60}$/.test(t) && /[A-Z]{2,}/.test(t)) {
      flushPara()
      out.push('## ' + t, '')
      continue
    }
    para.push(t)
  }
  flushPara()
  flushTable()
  void imgCount
  void pageNo
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 统计每页内嵌图片数（XObject /Image 子类型） */
const countPageImages = async (doc: import('@cantoo/pdf-lib').PDFDocument, pageIdx: number): Promise<number> => {
  try {
    const { PDFName } = await loadPdfLib()
    const page = doc.getPage(pageIdx)
    const res = page.node.Resources()
    if (!res) return 0
    const xobj = res.lookup(PDFName.of('XObject')) as { entries?: () => [string, unknown][] } | undefined
    if (!xobj) return 0
    let n = 0
    for (const [, ref] of xobj.entries?.() ?? []) {
      const obj = (ref as { lookup?: () => unknown }).lookup?.()
      const dict = (obj as { dict?: { lookup?: (n: unknown) => unknown } })?.dict
      const st = dict?.lookup?.(PDFName.of('Subtype'))
      if (st && typeof (st as { asString?: () => string }).asString === 'function' && /Image/.test((st as { asString: () => string }).asString())) n++
    }
    return n
  } catch {
    return 0
  }
}

const renderPreview = async () => {
  const { marked } = await import('marked')
  previewHtml.value = String(await marked.parse(md.value, { async: true }))
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  md.value = ''
  try {
    const pdfjs = await loadPdfJs()
    const doc0 = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const { PDFDocument } = await loadPdfLib()
    const doc1 = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const parts: string[] = []
    for (let i = 0; i < doc0.numPages; i++) {
      const page = await doc0.getPage(i + 1)
      const tc = await page.getTextContent()
      const vp = page.getViewport({ scale: 1 })
      // 行聚合（y 3pt 容差），行字号取行内最大
      type Item = { str: string; x: number; y: number; size: number }
      const items: Item[] = []
      for (const raw of tc.items as { str?: string; transform?: number[] }[]) {
        if (raw.str === undefined || !raw.str.trim() || !raw.transform) continue
        const size = Math.abs(raw.transform[3]!) || 12
        items.push({ str: raw.str, x: raw.transform[4]!, y: raw.transform[5]!, size })
      }
      items.sort((a, b) => b.y - a.y || a.x - b.x)
      const lines: MdLine[] = []
      for (const it of items) {
        const last = lines[lines.length - 1]
        if (last && last._y !== undefined && Math.abs(it.y - last._y) <= 3) {
          last.text += it.str
          last.size = Math.max(last.size, it.size)
        } else {
          lines.push({ text: it.str, size: it.size, x: it.x, _y: it.y })
        }
      }
      void vp
      const imgCount = await countPageImages(doc1, i)
      if (doc0.numPages > 1 && optPageMark.value) parts.push(`<!-- 第 ${i + 1} 页 -->`)
      const frag = linesToMd(lines, imgCount, i)
      if (frag) parts.push(frag)
      if (imgCount > 0) parts.push(`<!-- 图：本页含 ${imgCount} 张图片 -->`)
    }
    await doc0.destroy()
    md.value = parts.join('\n\n')
    if (!md.value.replace(/<!--[^>]*-->/g, '').trim()) {
      toast.warn('未提取到文本：该 PDF 可能是扫描图片，无文本层')
    } else {
      toast.ok('Markdown 已生成')
      await renderPreview()
    }
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (md = '')" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">转换选项</span>
        <label class="check"><input v-model="optPageMark" type="checkbox" /> 分页注释</label>
        <label class="check"><input v-model="optTable" type="checkbox" /> 表格识别</label>
        <label class="check"><input v-model="optUpperHead" type="checkbox" /> 全大写标题识别</label>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 Markdown
      </button>
      <span class="small muted">含图片的页面生成图片占位注释；列表按 x 缩进判层级</span>
    </div>

    <template v-if="md">
      <div class="tabs row mt-2">
        <button class="btn btn-sm" :class="tab === 'code' ? 'btn-primary' : 'btn-ghost'" @click="tab = 'code'">源码</button>
        <button class="btn btn-sm" :class="tab === 'preview' ? 'btn-primary' : 'btn-ghost'" @click="((tab = 'preview'), md && !previewHtml && renderPreview())">预览</button>
      </div>
      <ResultBox v-if="tab === 'code'" v-model="md" title="Markdown 结果" :readonly="true" download="md" :min-height="'300px'" class="mt-2" />
      <div v-else class="md-preview mt-2" v-html="previewHtml"></div>
    </template>

    <p class="notice notice-info mt-2 small">
      转换规则：行字号 ≥ 正文众数 1.5 倍判 H1、1.2~1.5 倍判 H2（中文「第 X 章/节」与全大写西文短行兜底）；空行分段、段内行合并；「- / •」开头转列表（x 缩进判二级）；同行 2 个以上空格分列且连续 ≥2 行时转 GFM 表格。启发式转换，请人工校对标题层级。
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
.tabs {
  gap: 8px;
}
.md-preview {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  height: max(300px, calc(100dvh - 420px));
  overflow: auto;
  background: var(--panel);
  font-size: 14px;
  line-height: 1.7;
}
.md-preview :deep(h1) { font-size: 1.5em; margin: 0.6em 0 0.4em; }
.md-preview :deep(h2) { font-size: 1.28em; margin: 0.6em 0 0.4em; }
.md-preview :deep(table) { border-collapse: collapse; }
.md-preview :deep(td),
.md-preview :deep(th) {
  border: 1px solid var(--border);
  padding: 4px 10px;
}
</style>
