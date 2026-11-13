/**
 * PDF 内嵌图片提取（组件级，lib 只读）：在引擎逻辑基础上补
 * - CMYK 原始流 → RGB 正确转换（引擎按 RGBA 直塞导致色偏）
 * - 解码失败计数（诚实披露）
 * - 内容 hash 去重（同一 XObject 多处引用只保留一份）
 * - 最小尺寸过滤
 */
import { loadPdfLib } from '@/lib/pdfEngine'
import { canvasToBlob } from '@/lib/imageEngine'

export interface ExtractedImage {
  name: string
  blob: Blob
  /** 内容指纹（去重用） */
  hash: string
  width: number
  height: number
  /** 同一内容出现的引用次数 */
  refs: number
  cmyk: boolean
}

/** 快速内容指纹：长度 + 首尾 4KB 累加和（够检出同一 XObject 重复） */
function contentHash(bytes: Uint8Array): string {
  let h = bytes.length
  const step = Math.max(1, Math.floor(bytes.length / 4096))
  for (let i = 0; i < bytes.length; i += step) h = (h * 31 + bytes[i]!) | 0
  return `${bytes.length}-${h >>> 0}`
}

function cmykToCanvas(data: Uint8Array, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const id = ctx.createImageData(w, h)
  for (let i = 0, j = 0; i < w * h * 4 && j + 3 < id.data.length; i += 4, j += 4) {
    const cN = data[i]! / 255
    const mN = data[i + 1]! / 255
    const yN = data[i + 2]! / 255
    const kN = data[i + 3]! / 255
    id.data[j] = Math.round(255 * (1 - cN) * (1 - kN))
    id.data[j + 1] = Math.round(255 * (1 - mN) * (1 - kN))
    id.data[j + 2] = Math.round(255 * (1 - yN) * (1 - kN))
    id.data[j + 3] = 255
  }
  ctx.putImageData(id, 0, 0)
  return c
}

function rawToCanvas(data: Uint8Array, w: number, h: number, bpc: number, csName: string): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const id = ctx.createImageData(w, h)
  if (csName && /CMYK/i.test(csName) && data.length === w * h * 4) {
    return cmykToCanvas(data, w, h)
  }
  if (data.length === w * h * 4) {
    id.data.set(data)
    ctx.putImageData(id, 0, 0)
    return c
  }
  if (data.length === w * h * 3 || (csName && /RGB/i.test(csName))) {
    for (let i = 0, j = 0; i < w * h * 3 && j < id.data.length; i += 3, j += 4) {
      id.data[j] = data[i]!
      id.data[j + 1] = data[i + 1]!
      id.data[j + 2] = data[i + 2]!
      id.data[j + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
    return c
  }
  if (data.length === w * h && bpc === 8) {
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      id.data[j] = id.data[j + 1] = id.data[j + 2] = data[i]!
      id.data[j + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
    return c
  }
  if (data.length === w * h && bpc === 1) {
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      const v = (data[i >> 3]! >> (7 - (i & 7))) & 1 ? 0 : 255
      id.data[j] = id.data[j + 1] = id.data[j + 2] = v
      id.data[j + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
    return c
  }
  return null
}

export interface ExtractOptions {
  /** 过滤小于该尺寸（宽或高）的图，0 = 不过滤 */
  minSize: number
  onProgress?: (p: number) => void
}

export interface ExtractSummary {
  images: ExtractedImage[]
  /** 解码失败（如 JPEG2000 等不支持编码）跳过数 */
  failed: number
  cmykCount: number
}

export async function extractImagesCore(file: File | Blob, opts: ExtractOptions): Promise<ExtractSummary> {
  const { PDFDocument, PDFRawStream, PDFName, decodePDFRawStream } = await loadPdfLib()
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const byHash = new Map<string, ExtractedImage>()
  let idx = 0
  let failed = 0
  let cmykCount = 0
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i)
    const resources = page.node.Resources()
    if (!resources) continue
    const xobjDict = resources.lookup(PDFName.of('XObject'))
    if (!xobjDict) continue
    const entries = (xobjDict as { entries?: () => [string, unknown][] }).entries?.() ?? []
    for (const [, ref] of entries) {
      const obj = (ref as { lookup?: () => unknown })?.lookup?.()
      if (!(obj instanceof PDFRawStream)) continue
      const dict = obj.dict
      const w = Number(dict.lookup(PDFName.of('Width')) ?? 0)
      const h = Number(dict.lookup(PDFName.of('Height')) ?? 0)
      const filter = dict.lookup(PDFName.of('Filter'))
      const filterName = filter instanceof PDFName ? filter.asString() : Array.isArray(filter) ? String(filter) : ''
      const bpc = Number(dict.lookup(PDFName.of('BitsPerComponent')) ?? 8)
      const cs = dict.lookup(PDFName.of('ColorSpace'))
      const csName = cs instanceof PDFName ? cs.asString() : ''
      if (!w || !h) continue
      if (opts.minSize > 0 && (w < opts.minSize || h < opts.minSize)) continue
      try {
        let hash = ''
        if (String(filterName).includes('DCT')) {
          hash = contentHash(obj.contents as Uint8Array)
          const seen = byHash.get(hash)
          if (seen) {
            seen.refs++
            continue
          }
          byHash.set(hash, {
            name: `图片-${++idx}.jpg`,
            blob: new Blob([obj.contents as BlobPart], { type: 'image/jpeg' }),
            hash,
            width: w,
            height: h,
            refs: 1,
            cmyk: /CMYK/i.test(csName),
          })
          if (/CMYK/i.test(csName)) cmykCount++
          continue
        }
        let data: Uint8Array
        try {
          data = decodePDFRawStream(obj).decode()
        } catch {
          data = obj.contents
        }
        hash = contentHash(data)
        const seen = byHash.get(hash)
        if (seen) {
          seen.refs++
          continue
        }
        const canvas = rawToCanvas(data, w, h, bpc, csName)
        if (canvas) {
          if (/CMYK/i.test(csName)) cmykCount++
          byHash.set(hash, {
            name: `图片-${++idx}.png`,
            blob: await canvasToBlob(canvas, 'image/png'),
            hash,
            width: w,
            height: h,
            refs: 1,
            cmyk: /CMYK/i.test(csName),
          })
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
    opts.onProgress?.((i + 1) / doc.getPageCount())
  }
  return { images: [...byHash.values()], failed, cmykCount }
}
