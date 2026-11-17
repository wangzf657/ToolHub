/**
 * 数独 Word 打印（需求 R2.3）：题目卡导出 .docx——每页 1/2/4 题、题号与难度标注、可选答案页。
 * docx@^9 表格实现（宫线加粗、页面分页）；元数据 producer/creator=ToolHub；纯懒加载零首屏成本。
 */
import type { SudokuGrid } from './sudoku'

export interface SudokuPrintItem {
  puzzle: SudokuGrid
  /** 满盘答案（答案页用）；undefined 则不输出答案页该题 */
  solution?: SudokuGrid
  size: number
  /** 卡片标题，如「题 1 · 9 阶高级」 */
  label: string
}

export interface SudokuPrintOptions {
  /** 每页题数 1/2/4 */
  perPage: 1 | 2 | 4
  /** 附答案页 */
  withAnswers?: boolean
  /** 文档主标题（默认 数独练习题） */
  title?: string
}

/** 单元格边框：宫线/外框加粗、内线细 */
function cellBorders(r: number, c: number, size: number) {
  const box = size === 4 ? 2 : 3
  const thin = { style: 'single' as const, size: 4, color: '999999' }
  const thick = { style: 'single' as const, size: 16, color: '333333' }
  return {
    top: r % box === 0 ? thick : thin,
    bottom: (r + 1) % box === 0 || r === size - 1 ? thick : thin,
    left: c % box === 0 ? thick : thin,
    right: (c + 1) % box === 0 || c === size - 1 ? thick : thin,
  }
}

async function docxParts() {
  return import('docx')
}

/** 一张数独网格表（values 为题面或答案） */
async function gridTable(values: SudokuGrid, size: number, filled: boolean) {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign, BorderStyle } =
    await docxParts()
  const cellDxa = size === 4 ? 620 : 368 // 4 阶格更大（约 1.1cm / 0.65cm）
  const rows = []
  for (let r = 0; r < size; r++) {
    const cells = []
    for (let c = 0; c < size; c++) {
      const v = values[r * size + c]!
      const borders = cellBorders(r, c, size)
      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: v ? [new TextRun({ text: String(v), bold: !filled, size: size === 4 ? 28 : 22 })] : [],
            }),
          ],
          width: { size: cellDxa, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: borders.top.size, color: borders.top.color },
            bottom: { style: BorderStyle.SINGLE, size: borders.bottom.size, color: borders.bottom.color },
            left: { style: BorderStyle.SINGLE, size: borders.left.size, color: borders.left.color },
            right: { style: BorderStyle.SINGLE, size: borders.right.size, color: borders.right.color },
          },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: size === 4 ? 60 : 30, bottom: size === 4 ? 60 : 30, left: 0, right: 0 },
        }),
      )
    }
    rows.push(new TableRow({ children: cells, height: { value: cellDxa, rule: 'exact' } }))
  }
  return new Table({ rows, width: { size: cellDxa * size, type: WidthType.DXA }, alignment: AlignmentType.CENTER })
}

/** 题目卡（标签 + 网格） */
async function puzzleCard(item: SudokuPrintItem, filled: boolean) {
  const { Paragraph, TextRun, AlignmentType } = await docxParts()
  const grid = filled && item.solution ? item.solution : item.puzzle
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 60 },
      children: [new TextRun({ text: item.label, size: 20, color: '555555' })],
    }),
    await gridTable(grid, item.size, filled),
  ]
}

/** 把题目按 perPage 排成版面（1 题直排；2/4 题走 2 列布局表，卡内嵌网格表） */
async function layoutPage(items: SudokuPrintItem[], perPage: 1 | 2 | 4, filled: boolean) {
  const { Table, TableRow, TableCell, WidthType } = await docxParts()
  // 每张卡固定两元素 [标签段, 网格表]，扁平化后按 2 元素一组还原
  const cards = (await Promise.all(items.map((it) => puzzleCard(it, filled)))).flat()
  if (perPage === 1) return cards
  const cardAt = (k: number) => cards.slice(k * 2, k * 2 + 2)
  const padCard = (children: unknown[]) =>
    new TableCell({ children: children as never[], width: { size: 4600, type: WidthType.DXA } })
  const emptyCell = () => new TableCell({ children: [], width: { size: 4600, type: WidthType.DXA } })
  const rows = []
  for (let i = 0; i < items.length; i += 2) {
    const hasPair = i + 1 < items.length
    rows.push(
      new TableRow({
        children: hasPair ? [padCard(cardAt(i)), padCard(cardAt(i + 1))] : [padCard(cardAt(i)), emptyCell()],
      }),
    )
  }
  return [new Table({ rows, width: { size: 9200, type: WidthType.DXA } })]
}

/** 导出 .docx Blob */
export async function sudokuPuzzlesToDocx(items: SudokuPrintItem[], opts: SudokuPrintOptions): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak, HeadingLevel } = await docxParts()
  const title = opts.title ?? '数独练习题'
  const children: unknown[] = []
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `${title}（共 ${items.length} 题）`, bold: true, size: 32 })],
  })
  children.push(heading)
  const per = opts.perPage
  for (let i = 0; i < items.length; i += per) {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(...(await layoutPage(items.slice(i, i + per), per, false)))
  }
  if (opts.withAnswers) {
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '答案', bold: true, size: 32 })],
      }),
    )
    for (let i = 0; i < items.length; i += per) {
      if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(...(await layoutPage(items.slice(i, i + per), per, true)))
    }
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '由 百宝工具箱 ToolHub 生成 · toolhub', size: 16, color: '888888' })],
    }),
  )
  const doc = new Document({
    creator: 'ToolHub',
    title,
    sections: [{ children: children as never[] }],
  })
  return Packer.toBlob(doc)
}
