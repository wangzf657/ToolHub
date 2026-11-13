/**
 * PPTX 压缩引擎辅助（组件级，lib 只读）：解 zip → 重压缩 ppt/media 图片 → 清理未引用媒体 → 重打包。
 * 同时提供抽样预估（不落盘）与首对画质对比样本。
 */
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'

export interface MediaEntry {
  /** zip 内完整路径 */
  path: string
  /** 文件名（rels 引用键） */
  base: string
  blob: Blob
  isPng: boolean
}

export interface CompressResult {
  out: Blob
  before: number
  after: number
  imgs: number
  removed: number
  /** PNG 字节占媒体总字节的比重（0~1） */
  pngShare: number
  /** 首对画质对比样本（原图 | 重编码后），无则 null */
  sample: { before: Blob; after: Blob } | null
}

/** 是否含透明像素（有透明保持 PNG，不透明转 JPG 体积小得多） */
export function hasAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < data.length; i += 4 * 17) {
    if (data[i]! < 255) return true
  }
  return false
}

/** 读取 zip 并收集被引用/全部媒体（未引用媒体另列） */
export async function openPptx(file: File | Blob) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = Object.keys(zip.files)
  const referenced = new Set<string>()
  for (const n of names) {
    if (!n.endsWith('.rels')) continue
    const text = await zip.files[n].async('string')
    for (const m of text.matchAll(/Target="[^"]*media\/([^"?]+)"/g)) referenced.add(m[1])
  }
  const mediaPaths = names.filter((n) => /^ppt\/media\/.+\.(png|jpe?g)$/i.test(n) && zip.files[n] && !zip.files[n].dir)
  return { zip, names, referenced, mediaPaths }
}

/** 按最大边长降采样画布（返回新画布或原画布） */
export function fitCanvas(canvas: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  if (!maxEdge) return canvas
  const long = Math.max(canvas.width, canvas.height)
  if (long <= maxEdge) return canvas
  const k = maxEdge / long
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(canvas.width * k))
  c.height = Math.max(1, Math.round(canvas.height * k))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, c.width, c.height)
  return c
}

/** 重编码单张媒体：返回压缩后的 Blob（无收益返回 null） */
export async function recompress(entry: MediaEntry, quality: number, maxEdge: number): Promise<Blob | null> {
  const canvas0 = await decodeToCanvas(entry.blob)
  const canvas = fitCanvas(canvas0, maxEdge)
  if (hasAlpha(canvas0)) {
    // 含透明：保持 PNG（可叠加降采样，透明信息不丢）
    const png = await canvasToBlob(canvas, 'image/png')
    return png.size < entry.blob.size * 0.95 ? png : null
  }
  const jpg = await canvasToBlob(canvas, 'image/jpeg', Math.min(0.95, Math.max(0.4, quality / 100)))
  return jpg.size < entry.blob.size * 0.95 ? jpg : null
}

/** 完整压缩流水线 */
export async function compressPptx(
  file: File | Blob,
  opts: { quality: number; maxEdge: number; onProgress?: (p: number) => void },
): Promise<CompressResult> {
  const { zip, referenced, mediaPaths } = await openPptx(file)
  let idx = 0
  let removed = 0
  let pngBytes = 0
  let totalBytes = 0
  let sample: CompressResult['sample'] = null
  for (const p of mediaPaths) {
    idx++
    opts.onProgress?.(idx / Math.max(1, mediaPaths.length))
    const base = p.split('/').pop() ?? p
    const blob = await zip.files[p].async('blob')
    const isPng = /\.png$/i.test(p)
    totalBytes += blob.size
    if (isPng) pngBytes += blob.size
    if (!referenced.has(base)) {
      zip.remove(p)
      removed++
      continue
    }
    try {
      const entry: MediaEntry = { path: p, base, blob, isPng }
      const candidate = await recompress(entry, opts.quality, opts.maxEdge)
      if (candidate) {
        if (!sample) sample = { before: blob, after: candidate }
        zip.file(p, candidate)
      }
    } catch {
      // 单图失败不阻断整体（保留原图）
    }
  }
  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return {
    out,
    before: file.size,
    after: out.size,
    imgs: mediaPaths.length,
    removed,
    pngShare: totalBytes ? pngBytes / totalBytes : 0,
    sample,
  }
}

/** 抽样预估：取体积最大的若干张媒体图试算重编码收益，按字节占比外推 */
export async function estimateSavings(
  file: File | Blob,
  opts: { quality: number; maxEdge: number },
): Promise<{ pct: number; pngShare: number; sampled: number }> {
  const { zip, referenced, mediaPaths } = await openPptx(file)
  const entries: { path: string; base: string; size: number; isPng: boolean }[] = []
  let pngBytes = 0
  let totalBytes = 0
  for (const p of mediaPaths) {
    const size = (zip.files[p] as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    const isPng = /\.png$/i.test(p)
    totalBytes += size
    if (isPng) pngBytes += size
    entries.push({ path: p, base: p.split('/').pop() ?? p, size, isPng })
  }
  entries.sort((a, b) => b.size - a.size)
  const tops = entries.filter((e) => referenced.has(e.base)).slice(0, 10)
  let savedSampled = 0
  let bytesSampled = 0
  let sampled = 0
  for (const e of tops) {
    try {
      const blob = await zip.files[e.path].async('blob')
      const candidate = await recompress({ path: e.path, base: e.base, blob, isPng: e.isPng }, opts.quality, opts.maxEdge)
      savedSampled += Math.max(0, blob.size - (candidate?.size ?? blob.size))
      bytesSampled += blob.size
      sampled++
    } catch {
      /* 跳过解不开的图 */
    }
  }
  // 未抽样媒体按同等比例外推；未引用媒体按 100% 移除计
  const unreferencedBytes = entries.filter((e) => !referenced.has(e.base)).reduce((a, e) => a + e.size, 0)
  const ratio = bytesSampled ? savedSampled / bytesSampled : 0
  const est = totalBytes ? (ratio * totalBytes + unreferencedBytes) / totalBytes : 0
  return { pct: Math.round(est * 100), pngShare: totalBytes ? pngBytes / totalBytes : 0, sampled }
}
