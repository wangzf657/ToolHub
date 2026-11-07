/**
 * PDF 工作台的文字/图片叠加方案：
 * pdf-lib 的 StandardFonts（WinAnsi）无法编码中文，含中文的叠加文字
 * 改为「Canvas 渲染 → 透明 PNG → embedPng 贴图」；签名图片同理。
 */
import { toPdfBlob, loadPdfLib } from '@/lib/pdfEngine'

export function hasCJK(s: string): boolean {
  return /[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/.test(s)
}

/** hex 颜色 → 0-1 RGB 三元组 */
export function hexToRgb01(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.replace(/./g, (c) => c + c) : m
  const n = parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export interface TextPng {
  dataUrl: string
  /** PDF pt 尺寸（4x 超采样换算） */
  wPt: number
  hPt: number
}

/** 把文本渲染为透明 PNG（含换行），尺寸按 PDF pt 计 */
export function renderTextPng(
  text: string,
  opts: { sizePt: number; color?: [number, number, number]; opacity?: number; bold?: boolean },
): TextPng {
  const SS = 4
  const fontPx = Math.max(8, opts.sizePt) * SS
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = `${opts.bold ? '600 ' : ''}${fontPx}px 'PingFang SC','Microsoft YaHei',sans-serif`
  ctx.font = font
  const lines = text.split('\n')
  const wMax = Math.max(1, ...lines.map((l) => ctx.measureText(l).width))
  const lineH = fontPx * 1.3
  c.width = Math.ceil(wMax) + 4
  c.height = Math.ceil(lineH * lines.length) + 4
  ctx.font = font
  const col = opts.color ?? [0.1, 0.1, 0.12]
  ctx.fillStyle = `rgba(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)},${opts.opacity ?? 1})`
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, 2, 2 + i * lineH))
  return { dataUrl: c.toDataURL('image/png'), wPt: c.width / SS, hPt: c.height / SS }
}

export interface PngStamp {
  /** 0 基页索引 */
  page: number
  /** PDF 坐标（pt，左下原点） */
  xPt: number
  yPt: number
  dataUrl: string
  wPt: number
  hPt: number
  opacity?: number
  rotateDeg?: number
}

/** 把一组 PNG 贴图写入 PDF（同文件只加载一次） */
export async function stampPngs(file: File | Blob, items: PngStamp[]): Promise<Blob> {
  const { PDFDocument, degrees } = await loadPdfLib()
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const cache = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>()
  for (const it of items) {
    let img = cache.get(it.dataUrl)
    if (!img) {
      img = await doc.embedPng(it.dataUrl)
      cache.set(it.dataUrl, img)
    }
    const page = doc.getPage(Math.min(it.page, doc.getPageCount() - 1))
    page.drawImage(img, {
      x: it.xPt,
      y: it.yPt,
      width: it.wPt,
      height: it.hPt,
      opacity: it.opacity ?? 1,
      rotate: degrees(it.rotateDeg ?? 0),
    })
  }
  return toPdfBlob(await doc.save())
}
