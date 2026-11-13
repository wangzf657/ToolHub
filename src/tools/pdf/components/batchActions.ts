/**
 * 批量动作引擎（组件级，lib 只读）：旋转 / 灰度 / 中文水印等批处理动作实现。
 * 全部单文件单函数、失败可隔离。
 */
import { loadPdfLib, loadPdfJs } from '@/lib/pdfEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { hasCJK, hexToRgb01, stampPngs, textToPng, type PngStampItem } from './cjkText'

/** 批量旋转（单次 load/save，相对角度） */
export async function batchRotate(file: File | Blob, deg: 90 | 180 | 270): Promise<Blob> {
  const { PDFDocument, degrees } = await loadPdfLib()
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  for (const page of doc.getPages()) {
    const cur = page.getRotation().angle ?? 0
    page.setRotation(degrees((cur + deg) % 360))
  }
  doc.setProducer('ToolHub')
  if (!doc.getCreator()) doc.setCreator('ToolHub')
  return new Blob([await doc.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
}

/** 批量灰度化（逐页渲染灰化重建，≤100 页） */
export async function batchGrayscale(file: File | Blob, quality = 0.85, onProgress?: (p: number) => void): Promise<Blob> {
  const pdfjs = await loadPdfJs()
  const doc0 = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  if (doc0.numPages > 100) throw new Error(`该文件 ${doc0.numPages} 页，超过灰度化 100 页上限`)
  const jpgs: Blob[] = []
  try {
    for (let i = 1; i <= doc0.numPages; i++) {
      const page = await doc0.getPage(i)
      const viewport = page.getViewport({ scale: 2 })
      const c = document.createElement('canvas')
      c.width = Math.floor(viewport.width)
      c.height = Math.floor(viewport.height)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
      const id = ctx.getImageData(0, 0, c.width, c.height)
      const d = id.data
      for (let k = 0; k < d.length; k += 4) {
        const v = (0.299 * d[k]! + 0.587 * d[k + 1]! + 0.114 * d[k + 2]!) | 0
        d[k] = d[k + 1] = d[k + 2] = v
      }
      ctx.putImageData(id, 0, 0)
      jpgs.push(await canvasToBlob(c, 'image/jpeg', quality))
      onProgress?.(i / doc0.numPages)
    }
  } finally {
    doc0.destroy()
  }
  const { PDFDocument } = await loadPdfLib()
  const out = await PDFDocument.create()
  for (const p of jpgs) {
    const img = await out.embedJpg(new Uint8Array(await p.arrayBuffer()))
    const page = out.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  }
  out.setProducer('ToolHub')
  out.setCreator('ToolHub')
  return new Blob([await out.save({ updateMetadata: false } as never) as BlobPart], { type: 'application/pdf' })
}

export type WmPos = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** 批量水印（中文走贴图；西文单枚不斜排走原生文字） */
export async function batchWatermark(
  file: File | Blob,
  opts: { text: string; color: string; opacity: number; rotate: boolean; position: WmPos; fontSize: number },
): Promise<Blob> {
  if (hasCJK(opts.text) || opts.rotate || opts.position !== 'center') {
    const { PDFDocument } = await loadPdfLib()
    const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const rgb = hexToRgb01(opts.color)
    const png = textToPng(opts.text, { sizePt: opts.fontSize, color: rgb, opacity: opts.opacity })
    const items: PngStampItem[] = []
    probe.getPages().forEach((page, i) => {
      const { width: W, height: H } = page.getSize()
      let x = (W - png.wPt) / 2
      let y = (H - png.hPt) / 2
      if (!opts.rotate) {
        x = opts.position.includes('left') ? 40 : opts.position.includes('right') ? W - png.wPt - 40 : x
        y = opts.position.includes('top') ? H - png.hPt - 40 : opts.position.includes('bottom') ? 40 : y
      } else {
        x = (W - png.wPt / Math.SQRT2) / 2
        y = (H - png.hPt / Math.SQRT2) / 2
      }
      items.push({ page: i, xPt: x, yPt: y, dataUrl: png.dataUrl, wPt: png.wPt, hPt: png.hPt, rotateDeg: opts.rotate ? 45 : 0, opacity: 1 })
    })
    return await stampPngs(file, items)
  }
  const { stampText } = await import('@/lib/pdfEngine')
  return await stampText(file, {
    text: opts.text,
    color: hexToRgb01(opts.color),
    opacity: opts.opacity,
    rotate: false,
    fontSize: opts.fontSize,
  })
}

/** 批量页眉页脚（简单：页眉文字 + 页脚页码，中/西文通用贴图） */
export async function batchHeaderFooter(
  file: File | Blob,
  opts: { header?: string; footer?: string; fontSize: number; withPageNumber: boolean },
): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const probe = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const items: PngStampItem[] = []
  const color: [number, number, number] = [0.35, 0.38, 0.45]
  probe.getPages().forEach((page, i) => {
    const { width: W, height: H } = page.getSize()
    const num = opts.withPageNumber ? ` · ${i + 1}` : ''
    const m = 28
    if (opts.header) {
      const png = textToPng(opts.header + (opts.withPageNumber ? '' : num), { sizePt: opts.fontSize, color })
      items.push({ page: i, xPt: (W - png.wPt) / 2, yPt: H - m - png.hPt, dataUrl: png.dataUrl, wPt: png.wPt, hPt: png.hPt })
    }
    if (opts.footer) {
      const png = textToPng(opts.footer + num, { sizePt: opts.fontSize, color })
      items.push({ page: i, xPt: (W - png.wPt) / 2, yPt: m, dataUrl: png.dataUrl, wPt: png.wPt, hPt: png.hPt })
    }
  })
  if (!items.length) throw new Error('请至少填写页眉或页脚')
  return await stampPngs(file, items)
}
