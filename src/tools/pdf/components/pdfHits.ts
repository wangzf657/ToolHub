/**
 * PDF 文本命中定位与覆盖：查找替换 / 深度脱敏共用。
 * 坐标为页面比例（0-1），y 自页顶起（与 blackenRegions 约定一致）。
 * 说明：位置按文本项内「字符占比」估算，复杂排版可能存在少量偏移。
 */
import { savePdf, loadPdfJs, loadPdfLib } from '@/lib/pdfEngine'
import { hasCJK, textToPng } from './cjkText'

export interface TextHit {
  /** 0 基页索引 */
  page: number
  x: number
  y: number
  w: number
  h: number
  /** 命中的文本 */
  text: string
}

/** 定位每一处正则命中 */
export async function locateHits(
  file: File | Blob,
  pattern: RegExp,
  onProgress?: (done: number, total: number) => void,
  opts: { /** 跨项匹配：相邻文本项按行拼接后匹配（跨行手机号/分段词） */ joinLines?: boolean } = {},
): Promise<TextHit[]> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const hits: TextHit[] = []
  try {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      const tc = await page.getTextContent()
      const items = (tc.items as { str?: string; transform?: number[]; width?: number; height?: number }[])
        .filter((it) => it.str && it.transform && it.width && it.height)
        .map((it) => ({ str: it.str as string, transform: it.transform as number[], width: it.width as number, height: it.height as number }))
      if (opts.joinLines) {
        hits.push(...locateHitsJoined(items, re, i - 1, vp.width, vp.height))
      } else {
        for (const item of items) {
          re.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = re.exec(item.str!))) {
            const leftFrac = m.index / item.str!.length
            const wFrac = m[0].length / item.str!.length
            const x = (item.transform![4] + leftFrac * item.width!) / vp.width
            const w = (wFrac * item.width!) / vp.width
            // transform[5] 为基线 y（左下原点），框高按字体高度向上取
            const yTop = 1 - (item.transform![5] + item.height!) / vp.height
            hits.push({ page: i - 1, x, y: yTop, w, h: (item.height! * 1.15) / vp.height, text: m[0] })
            if (m.index === re.lastIndex) re.lastIndex++
          }
        }
      }
      onProgress?.(i, doc.numPages)
    }
  } finally {
    doc.destroy()
  }
  return hits
}

/** 跨项匹配：同 y 行内按 x 排序拼接，命中区间映射回文本项并取并集框 */
function locateHitsJoined(
  items: { str: string; transform: number[]; width: number; height: number }[],
  re: RegExp,
  pageIdx: number,
  vpW: number,
  vpH: number,
): TextHit[] {
  // 按 y 聚类成行（容差 3pt）
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])
  const lines: typeof sorted[] = []
  for (const it of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last[0].transform[5] - it.transform[5]) <= 3) last.push(it)
    else lines.push([it])
  }
  const out: TextHit[] = []
  for (const line of lines) {
    line.sort((a, b) => a.transform[4] - b.transform[4])
    let joined = ''
    const map: { start: number; item: (typeof line)[number] }[] = []
    for (const it of line) {
      map.push({ start: joined.length, item: it })
      joined += it.str
    }
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(joined))) {
      const s = m.index
      const e = m.index + m[0].length
      // 覆盖到的文本项并集框
      const covered = map.filter((p, idx) => {
        const end = p.start + p.item.str.length
        const nextStart = idx + 1 < map.length ? map[idx + 1]!.start : end
        return s < nextStart && e > p.start
      })
      if (!covered.length) {
        if (m.index === re.lastIndex) re.lastIndex++
        continue
      }
      const first = covered[0]!
      const lastIt = covered[covered.length - 1]!
      const x0 =
        (first.item.transform[4]! + (first.start < s ? ((s - first.start) / first.item.str.length) * first.item.width : 0)) / vpW
      const endInLast = e - lastIt.start
      const x1 =
        (lastIt.item.transform[4]! + Math.min(1, endInLast / lastIt.item.str.length) * lastIt.item.width) / vpW
      const yTop = 1 - Math.max(...covered.map((c) => c.item.transform[5]! + c.item.height)) / vpH
      const hMax = Math.max(...covered.map((c) => c.item.height)) * 1.15
      out.push({ page: pageIdx, x: x0, y: yTop, w: Math.max(0, x1 - x0), h: hMax / vpH, text: m[0] ?? '' })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  return out
}

export interface OverlayOpts {
  /** 覆盖颜色（比例 RGB）；默认黑条 */
  color?: [number, number, number]
  /** 覆盖后写入的替换词（空串 = 纯覆盖）；中文自动贴图 */
  replacement?: string
  /** 替换词颜色，默认深灰 */
  replaceColor?: [number, number, number]
}

/** 在命中位置画覆盖条，可同时写入替换词，返回新 PDF */
export async function overlayHits(
  file: File | Blob,
  hits: TextHit[],
  opts: OverlayOpts = {},
): Promise<Blob> {
  const { PDFDocument, rgb, StandardFonts } = await loadPdfLib()
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const color = opts.color ?? [0, 0, 0]
  const byPage = new Map<number, TextHit[]>()
  for (const h of hits) {
    const list = byPage.get(h.page) ?? []
    list.push(h)
    byPage.set(h.page, list)
  }
  const font = opts.replacement && !hasCJK(opts.replacement)
    ? await doc.embedFont(StandardFonts.HelveticaBold)
    : null
  for (const [pageIdx, list] of byPage) {
    const page = doc.getPage(Math.min(pageIdx, doc.getPageCount() - 1))
    const { width, height } = page.getSize()
    for (const h of list) {
      page.drawRectangle({
        x: h.x * width,
        y: (1 - h.y - h.h) * height,
        width: h.w * width,
        height: h.h * height,
        color: rgb(color[0], color[1], color[2]),
      })
    }
    const rep = opts.replacement
    if (rep) {
      const sizePt = Math.max(4, list[0].h * height * 0.78)
      if (hasCJK(rep)) {
        const png = textToPng(rep, { sizePt, color: opts.replaceColor ?? [0.12, 0.12, 0.14] })
        const img = await doc.embedPng(png.dataUrl)
        for (const h of list) {
          page.drawImage(img, {
            x: h.x * width,
            y: (1 - h.y - h.h) * height + (h.h * height - png.hPt) / 2,
            width: png.wPt,
            height: png.hPt,
          })
        }
      } else if (font) {
        for (const h of list) {
          page.drawText(rep, {
            x: h.x * width,
            y: (1 - h.y - h.h) * height + h.h * height * 0.22,
            size: sizePt,
            font,
            color: rgb(...(opts.replaceColor ?? [0.12, 0.12, 0.14])),
          })
        }
      }
    }
  }
  return await savePdf(doc)
}
