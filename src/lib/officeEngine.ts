/** Office 文档引擎：docx/xlsx/pptx 读取与生成（懒加载） */

export interface SheetData {
  name: string
  header: string[]
  rows: string[][]
}

/** 读取 xlsx（多 sheet） */
export async function readXlsx(file: File | Blob): Promise<SheetData[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const out: SheetData[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
    if (!rows.length) continue
    const header = rows[0].map((h, i) => String(h ?? '').trim() || `列${i + 1}`)
    out.push({
      name,
      header,
      rows: rows.slice(1).map((r) => header.map((_, i) => String(r[i] ?? ''))),
    })
  }
  return out
}

/** 行数据 → xlsx（自动识别数字/日期） */
export async function rowsToXlsx(
  header: string[],
  rows: (string | number)[][],
  sheetName = 'Sheet1',
): Promise<Blob> {
  const XLSX = await import('xlsx')
  const aoa = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** 尝试把字符串识别为数字或保留字符串 */
export function smartCell(v: string): string | number {
  const t = v.trim()
  if (t === '') return ''
  if (/^-?\d+(\.\d+)?$/.test(t) && t.length < 16) return Number(t)
  return v
}

/** docx → HTML（mammoth） */
export async function docxToHtml(file: File | Blob): Promise<string> {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const r = await mammoth.convertToHtml({ arrayBuffer: buf })
  return r.value
}

/** 生成简单 docx（段落） */
export async function paragraphsToDocx(
  paragraphs: { text: string; heading?: 1 | 2 | 3 }[],
  meta: { title?: string; creator?: string } = {},
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const children = paragraphs.map((p) =>
    new Paragraph({
      text: p.text,
      heading: p.heading === 1 ? HeadingLevel.HEADING_1 : p.heading === 2 ? HeadingLevel.HEADING_2 : p.heading === 3 ? HeadingLevel.HEADING_3 : undefined,
      children: p.heading ? undefined : [new TextRun(p.text)],
    }),
  )
  const doc = new Document({
    creator: meta.creator ?? 'ToolHub',
    title: meta.title ?? '文档',
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}

/** pptx 每页一张图片幻灯片 */
export async function imagesToPptx(
  images: { blob: Blob; width?: number; height?: number }[],
  title = '演示文稿',
): Promise<Blob> {
  const PptxGenJS = await import('pptxgenjs')
  const pptx = new (PptxGenJS as unknown as { default: new () => { addSlide: () => { addImage: (o: unknown) => void }; defineLayout: (o: unknown) => void; layout: string; write: (o: { outputType: 'blob' }) => Promise<Blob>; title?: string } }).default()
  pptx.defineLayout({ name: 'W16x9', width: 13.33, height: 7.5 })
  pptx.layout = 'W16x9'
  pptx.title = title
  for (const img of images) {
    const b64 = await blobToBase64(img.blob)
    const slide = pptx.addSlide()
    slide.addImage({ data: b64, x: 0, y: 0, w: 13.33, h: 7.5 })
  }
  return pptx.write({ outputType: 'blob' })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.readAsDataURL(blob)
  })
}

/** HTML → PDF（jsPDF html 渲染，基础排版） */
export async function htmlToPdfBlob(html: string, opts: { title?: string; pageSize?: 'a4' | 'letter' } = {}): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: opts.pageSize ?? 'a4' })
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  // 文本化渲染：解析 HTML 提取块级文本
  const container = document.createElement('div')
  container.innerHTML = html
  const blocks = extractBlocks(container)
  let y = 40
  for (const b of blocks) {
    const size = b.level === 1 ? 20 : b.level === 2 ? 16 : 11
    const bold = b.level > 0
    const lines = doc.splitTextToSize(b.text, w - 80)
    for (const line of lines) {
      if (y > h - 40) {
        doc.addPage()
        y = 40
      }
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.text(line, 40, y)
      y += size * 1.5
    }
    y += 6
  }
  doc.setProperties({ title: opts.title ?? '', creator: 'ToolHub' })
  // 元数据契约：jsPDF 硬编码 Producer，改由 pdf-lib 重写（updateMetadata:false 防止被强制写回 pdf-lib）
  const { PDFDocument } = await import('@cantoo/pdf-lib')
  const pdf = await PDFDocument.load(await doc.output('arraybuffer'))
  pdf.setProducer('ToolHub')
  pdf.setCreator('ToolHub')
  return new Blob([await pdf.save({ updateMetadata: false } as never)], { type: 'application/pdf' })
}

interface Block {
  text: string
  level: number
}

function extractBlocks(root: HTMLElement): Block[] {
  const out: Block[] = []
  const walk = (el: Element, level: number) => {
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) {
        out.push({ text: child.textContent?.trim() ?? '', level: Number(tag[1]) })
      } else if (tag === 'p' || tag === 'li' || tag === 'blockquote') {
        const text = child.textContent?.trim()
        if (text) out.push({ text: (tag === 'li' ? '• ' : '') + text, level: 0 })
      } else if (tag === 'table') {
        for (const tr of child.querySelectorAll('tr')) {
          const cells = [...tr.querySelectorAll('th,td')].map((c) => c.textContent?.trim() ?? '')
          out.push({ text: cells.join('  |  '), level: 0 })
        }
      } else if (tag === 'pre' || tag === 'code') {
        out.push({ text: child.textContent?.trim() ?? '', level: 0 })
      } else {
        walk(child, level)
      }
    }
  }
  walk(root, 0)
  if (!out.length && root.textContent?.trim()) {
    out.push({ text: root.textContent.trim(), level: 0 })
  }
  return out
}

/** 行数据 → HTML 表格（用于 PDF） */
export function rowsToHtmlTable(header: string[], rows: string[][]): string {
  return `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
