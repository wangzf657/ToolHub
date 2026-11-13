/**
 * PDF 插入图片落盘引擎（组件级，lib 只读）：把放置清单贴入 PDF。
 * 点击点=图片中心；支持透明度；统一 ToolHub 元数据契约。
 */
import { loadPdfLib, savePdf } from '@/lib/pdfEngine'
import { decodeToCanvas } from '@/lib/imageEngine'

export interface PlacementSpec {
  image: File
  pageIndex: number
  xRatio: number
  yRatio: number
  scalePct: number
  opacity: number
}

export async function applyPlacements(file: File | Blob, placements: PlacementSpec[]): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const pngCache = new Map<File, Awaited<ReturnType<typeof doc.embedPng>>>()
  for (const p of placements) {
    let png = pngCache.get(p.image)
    if (!png) {
      const canvas = await decodeToCanvas(p.image)
      const bytes = new Uint8Array(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer())
      png = await doc.embedPng(bytes)
      pngCache.set(p.image, png)
    }
    const pages = doc.getPages()
    const page = pages[Math.min(p.pageIndex, pages.length - 1)]
    const w = (page.getWidth() * Math.max(1, Math.min(100, p.scalePct))) / 100
    const h = (png.height / png.width) * w
    const x = Math.max(0, Math.min(page.getWidth() - w, p.xRatio * page.getWidth() - w / 2))
    const y = Math.max(0, Math.min(page.getHeight() - h, (1 - p.yRatio) * page.getHeight() - h / 2))
    page.drawImage(png, { x, y, width: w, height: h, opacity: Math.max(0, Math.min(1, p.opacity)) })
  }
  return await savePdf(doc)
}
