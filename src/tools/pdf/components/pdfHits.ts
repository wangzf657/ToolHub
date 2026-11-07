/**
 * PDF 文本命中定位与覆盖：查找替换 / 深度脱敏共用。
 * 坐标为页面比例（0-1），y 自页顶起（与 blackenRegions 约定一致）。
 * 说明：位置按文本项内「字符占比」估算，复杂排版可能存在少量偏移。
 */
import { loadPdfJs, loadPdfLib } from '@/lib/pdfEngine'
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
  onProgress?: (p: number) => void,
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
      for (const raw of tc.items) {
        const item = raw as { str?: string; transform?: number[]; width?: number; height?: number }
        if (!item.str || !item.transform || !item.width || !item.height) continue
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(item.str))) {
          const leftFrac = m.index / item.str.length
          const wFrac = m[0].length / item.str.length
          const x = (item.transform[4] + leftFrac * item.width) / vp.width
          const w = (wFrac * item.width) / vp.width
          // transform[5] 为基线 y（左下原点），框高按字体高度向上取
          const yTop = 1 - (item.transform[5] + item.height) / vp.height
          hits.push({ page: i - 1, x, y: yTop, w, h: (item.height * 1.15) / vp.height, text: m[0] })
          if (m.index === re.lastIndex) re.lastIndex++
        }
      }
      onProgress?.(i / doc.numPages)
    }
  } finally {
    doc.destroy()
  }
  return hits
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
  return doc.save() as unknown as Blob
}
