/** 通用图片格式转换引擎 */
import { decodeToCanvas, canvasToBlob, MIME_EXT } from './imageEngine'

export type TargetMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/bmp' | 'image/x-icon'

export interface ConvertOptions {
  target: TargetMime
  quality?: number // jpeg/webp 用，0-1
  width?: number
  height?: number
  /** JPEG 导出时的背景色（透明区域填充） */
  background?: string
}

export async function convertImage(file: File | Blob, opts: ConvertOptions): Promise<Blob> {
  let canvas = await decodeToCanvas(file)
  if (opts.width || opts.height) {
    const w = opts.width ?? Math.round((canvas.height * (opts.width ?? 0)) / (canvas.width || 1))
    const h = opts.height ?? Math.round((canvas.width * (opts.height ?? 0)) / (canvas.height || 1))
    const c = document.createElement('canvas')
    c.width = opts.width ?? Math.round((canvas.width * (opts.height ?? canvas.height)) / canvas.height)
    c.height = opts.height ?? Math.round((canvas.height * (opts.width ?? canvas.width)) / canvas.width)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    if (opts.target === 'image/jpeg') {
      ctx.fillStyle = opts.background ?? '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
    }
    ctx.drawImage(canvas, 0, 0, c.width, c.height)
    canvas = c
  } else if (opts.target === 'image/jpeg') {
    // JPEG 无透明，铺白底
    const c = document.createElement('canvas')
    c.width = canvas.width
    c.height = canvas.height
    const ctx = c.getContext('2d')!
    ctx.fillStyle = opts.background ?? '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(canvas, 0, 0)
    canvas = c
  }
  if (opts.target === 'image/x-icon') {
    const { encodeIco } = await import('./imageEngine')
    return encodeIco(canvas, [16, 32, 48, 64, 128, 256])
  }
  if (opts.target === 'image/bmp') {
    return encodeBmp(canvas)
  }
  return canvasToBlob(canvas, opts.target, opts.quality)
}

/** 简易 BMP 编码（24 位，无透明） */
function encodeBmp(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width
  const h = canvas.height
  const rowSize = Math.floor((24 * w + 31) / 32) * 4
  const dataSize = rowSize * h
  const fileSize = 54 + dataSize
  const buf = new ArrayBuffer(fileSize)
  const v = new DataView(buf)
  // 文件头
  v.setUint8(0, 0x42); v.setUint8(1, 0x4d)
  v.setUint32(2, fileSize, true)
  v.setUint32(10, 54, true)
  // 信息头
  v.setUint32(14, 40, true)
  v.setInt32(18, w, true)
  v.setInt32(22, h, true)
  v.setUint16(26, 1, true)
  v.setUint16(28, 24, true)
  v.setUint32(34, dataSize, true)
  v.setInt32(38, 2835, true)
  v.setInt32(42, 2835, true)
  const px = new Uint8Array(buf, 54)
  const src = canvas.getContext('2d')!.getImageData(0, 0, w, h).data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((h - 1 - y) * w + x) * 4
      const di = y * rowSize + x * 3
      px[di] = src[si + 2]
      px[di + 1] = src[si + 1]
      px[di + 2] = src[si]
    }
  }
  return new Blob([buf], { type: 'image/bmp' })
}

export function extFor(mime: TargetMime): string {
  return MIME_EXT[mime] ?? 'png'
}
