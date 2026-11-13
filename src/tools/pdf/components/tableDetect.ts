/**
 * PDF 表格行检测（组件级，lib 只读）：按 x 坐标聚类切列，空格切列为兜底。
 * 逐页提取文本项坐标 → 按行分组（y 聚类）→ 列界 = 相邻项间距突变。
 */

export interface PageTable {
  rows: string[][]
  /** 坐标聚类判定为表格的行 */
  tableRows: string[][]
  /** 被丢弃的单列非表格行数 */
  dropped: number
}

interface TextItemX {
  str: string
  x: number
  y: number
  w: number
}

/** 从一页文本项构建行列（含坐标） */
export async function extractPageTable(doc: import('pdfjs-dist').PDFDocumentProxy, pageIndex: number, minCols: number): Promise<PageTable> {
  const page = await doc.getPage(pageIndex + 1)
  const tc = await page.getTextContent()
  const items: TextItemX[] = []
  for (const it of tc.items as { str?: string; transform?: number[]; width?: number }[]) {
    if (it.str === undefined || !it.str.trim()) continue
    items.push({ str: it.str, x: it.transform?.[4] ?? 0, y: it.transform?.[5] ?? 0, w: it.width ?? 0 })
  }
  // 按 y 聚类成行（容差 3pt）
  items.sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: TextItemX[][] = []
  for (const it of items) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last[0]!.y - it.y) <= 3) last.push(it)
    else rows.push([it])
  }
  const outRows: string[][] = []
  const tableRows: string[][] = []
  let dropped = 0
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x)
    const cells = clusterRow(row)
    if (cells.length >= minCols) {
      tableRows.push(cells)
      outRows.push(cells)
    } else if (cells.length === 1 && cells[0]!.trim()) {
      dropped++
    }
  }
  return { rows: outRows, tableRows, dropped }
}

/** 行内按 x 间距聚类切列：间距 > max(8, 3×中位间距) 即断列 */
function clusterRow(row: TextItemX[]): string[] {
  if (row.length === 1) return [row[0]!.str]
  const gaps: number[] = []
  for (let i = 1; i < row.length; i++) {
    const prev = row[i - 1]!
    const cur = row[i]!
    gaps.push(Math.max(0, cur.x - (prev.x + prev.w)))
  }
  const sorted = [...gaps].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  const threshold = Math.max(8, median * 3)
  const cells: string[] = []
  let buf = row[0]!.str
  for (let i = 1; i < row.length; i++) {
    const prev = row[i - 1]!
    const cur = row[i]!
    if (cur.x - (prev.x + prev.w) > threshold) {
      cells.push(buf.trim())
      buf = cur.str
    } else {
      buf += (/\s$/.test(buf) || /^\s/.test(cur.str) ? '' : '') + cur.str
    }
  }
  cells.push(buf.trim())
  // 聚类失效（全部挤成一列）时空格切列兜底
  if (cells.length === 1 && /\t| {2,}/.test(cells[0]!)) {
    return cells[0]!.split(/\t| {2,}/).map((s) => s.trim()).filter(Boolean)
  }
  return cells.filter((c) => c !== '')
}

/** 数值识别：千分位清理 + 数字转换（可计算单元格） */
export function smartCellNum(v: string): string | number {
  const t = v.trim().replace(/[,，\s]/g, '').replace(/[¥$￥]/g, '')
  if (t !== '' && /^-?\d+(\.\d+)?$/.test(t) && t.length < 16) return Number(t)
  return v.trim()
}
