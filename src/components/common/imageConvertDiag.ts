/**
 * imgcvt 家族诊断辅助（ImageConvertTool 专用纯函数，无副作用）：
 * 解码器识别 / 动图与多页检测 / 32 位 BMP 预警 / 体积膨胀建议。
 * 处方来源：docs/优化文档/图片工具/png-to-jpg.md 等家族档案
 * （解码器加载提示 / 动图首帧披露 / GIF 帧数 / TIFF 页数 / 体积膨胀预警）。
 */

/** 结果列表行（主目标与 WebP 副本共用；srcFile 供单张调质量重转） */
export interface ResultItem {
  id: number
  name: string
  blob: Blob
  url: string
  srcSize: number
  ok: boolean
  err?: string
  /** 输出格式标签（PNG / JPG / WEBP），双目标时用于分组 */
  fmt: string
  /** 是否主目标产物（副 WebP 副本不提供调质量重转） */
  main: boolean
  /** 源文件引用（重转用；失败卡片也保留） */
  srcFile?: File
}

/** 拖入文件后的预检提示（kind 仅用于决定 info/warn 配色） */
export interface PickNotice {
  kind: 'decoder' | 'animated' | 'pages' | 'bmp32' | 'avif-cap'
  lines: string[]
  link?: { to: string; label: string }
}

/** 取小写扩展名（不含点） */
export function extOf(name: string): string {
  return (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()
}

/** 常见图片 MIME → 扩展名（MIME 回退命名用） */
const MIME_EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
}
export function extOfMime(mime: string): string {
  return MIME_EXT_MAP[mime] ?? 'png'
}

/** 需要懒加载解码器的输入格式（heic2any 约 1.5MB / utif 约 100KB） */
export function decoderOf(ext: string): { key: string; label: string; size: string } | null {
  if (ext === 'heic' || ext === 'heif') return { key: 'heic', label: 'HEIC', size: '约 1.5MB' }
  if (ext === 'tif' || ext === 'tiff') return { key: 'tiff', label: 'TIFF', size: '约 100KB' }
  return null
}

/** 读取文件头部字节（探测用，上限 512KB 防大文件全量读入） */
async function readHead(file: File, n: number): Promise<Uint8Array> {
  const size = Math.min(file.size, n)
  return new Uint8Array(await file.slice(0, size).arrayBuffer())
}

/** 跳过 GIF 子块串（长度 0 表示结束），返回下一个块起始偏移 */
function skipSubBlocks(b: Uint8Array, i: number): number {
  let guard = 0
  while (i < b.length && guard++ < 1_000_000) {
    const len = b[i]!
    i += 1 + len
    if (len === 0) break
  }
  return i
}

/** 解析 GIF 帧数（图像描述符 0x2C 计数；解析失败返回 0） */
export function gifFrameCount(b: Uint8Array): number {
  if (b.length < 14 || b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return 0 // "GIF"
  const flags = b[10]!
  let i = 13
  if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1)) // 全局颜色表
  let frames = 0
  let guard = 0
  while (i < b.length && guard++ < 1_000_000) {
    const block = b[i]!
    if (block === 0x3b) break // 结束块
    if (block === 0x21) {
      i = skipSubBlocks(b, i + 2) // 扩展块：标签 + 子块串
    } else if (block === 0x2c) {
      frames++
      const f = b[i + 9]!
      i += 10
      if (f & 0x80) i += 3 * (1 << ((f & 7) + 1)) // 局部颜色表
      i++ // LZW 最小码长
      i = skipSubBlocks(b, i)
    } else {
      break // 未知块：放弃解析（返回已计数部分）
    }
  }
  return frames
}

/** WebP 是否为动图（VP8X 动画位或 ANIM 块） */
export function isAnimatedWebp(b: Uint8Array): boolean {
  if (b.length < 16) return false
  const riff = String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!)
  const webp = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!)
  if (riff !== 'RIFF' || webp !== 'WEBP') return false
  let i = 12
  let guard = 0
  while (i + 8 <= b.length && guard++ < 64) {
    const tag = String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!)
    const size = b[i + 4]! | (b[i + 5]! << 8) | (b[i + 6]! << 16) | (b[i + 7]! << 24)
    if (tag === 'ANIM') return true
    if (tag === 'VP8X' && i + 9 <= b.length) return (b[i + 8]! & 0x02) !== 0 // 动画标志位
    i += 8 + size + (size % 2) // RIFF 块按偶数对齐
  }
  return false
}

/** TIFF 页数（沿 IFD 链计数；解析失败返回 0） */
export function tiffPageCount(b: Uint8Array): number {
  const le = b[0] === 0x49 && b[1] === 0x49 // "II" 小端
  const be = b[0] === 0x4d && b[1] === 0x4d // "MM" 大端
  if ((!le && !be) || b.length < 8) return 0
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let off = v.getUint32(4, le!)
  let pages = 0
  const seen = new Set<number>()
  while (off > 0 && off + 2 <= b.length && !seen.has(off) && pages < 1024) {
    seen.add(off)
    const entries = v.getUint16(off, le!)
    pages++
    if (off + 2 + entries * 12 + 4 > b.length) break // 头部截断：返回已计数页
    off = v.getUint32(off + 2 + entries * 12, le!)
  }
  return pages
}

/** BMP 位深（32 位含 alpha 通道时预警；非 BMP 返回 null） */
export function bmpBitDepth(b: Uint8Array): number | null {
  if (b.length < 30 || b[0] !== 0x42 || b[1] !== 0x4d) return null // "BM"
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(28, true)
}

/**
 * 拖入文件预检：解码器预告 / 动图首帧披露 / TIFF 多页 / 32 位 BMP / AVIF 能力说明。
 * 同类提示按文件聚合，动图明细最多列 3 条防刷屏。
 */
export async function analyzePicked(files: File[]): Promise<PickNotice[]> {
  const notices: PickNotice[] = []
  const decoders = new Map<string, { label: string; size: string }>()
  const animLines: string[] = []
  let hasGifMulti = false
  let avifSeen = false
  for (const f of files.slice(0, 50)) {
    const ext = extOf(f.name)
    const dec = decoderOf(ext)
    if (dec) decoders.set(dec.key, { label: dec.label, size: dec.size })
    try {
      if (ext === 'gif') {
        const frames = gifFrameCount(await readHead(f, 512 * 1024))
        if (frames > 1) {
          hasGifMulti = true
          if (animLines.length < 3) animLines.push(`「${f.name}」为动图（含 ${frames} 帧），本次仅导出第 1 帧`)
        }
      } else if (ext === 'webp') {
        if (isAnimatedWebp(await readHead(f, 64 * 1024))) {
          if (animLines.length < 3) animLines.push(`「${f.name}」为动图 WebP，本次仅导出首帧`)
        }
      } else if (ext === 'tif' || ext === 'tiff') {
        const pages = tiffPageCount(await readHead(f, 256 * 1024))
        if (pages > 1 && animLines.length < 3) animLines.push(`「${f.name}」含 ${pages} 页，本次仅转换第 1 页`)
      } else if (ext === 'bmp') {
        const depth = bmpBitDepth(await readHead(f, 64))
        if (depth === 32) notices.push({ kind: 'bmp32', lines: [`「${f.name}」为 32 位 BMP（含透明通道），个别浏览器解码透明区可能异常，请以输出结果为准`] })
      } else if (ext === 'avif') {
        avifSeen = true
      }
    } catch {
      /* 单个文件预检失败不打断整体（转换阶段会给出具体报错） */
    }
  }
  if (animLines.length) {
    notices.push({
      kind: 'animated',
      lines: animLines,
      link: hasGifMulti ? { to: '/t/gif-frame-extractor', label: '需要全部帧？用 GIF 逐帧提取' } : undefined,
    })
  }
  for (const { label, size } of decoders.values()) {
    notices.push({ kind: 'decoder', lines: [`检测到 ${label} 输入：首次转换需加载解码器（${size}），期间会有短暂等待…`] })
  }
  if (avifSeen) {
    notices.push({ kind: 'avif-cap', lines: ['AVIF 解码依赖浏览器原生支持（Chrome 85+ / Firefox 93+ / Safari 16.1+），若转换失败请先升级浏览器'] })
  }
  return notices
}

/** 体积膨胀建议（目标格式 × 源格式给出改用方案，可带站内跳转） */
export function growthSuggest(targetMime: string, srcExts: string[]): { text: string; link?: string } {
  if (targetMime === 'image/png') {
    if (srcExts.includes('heic') || srcExts.includes('heif')) {
      return { text: 'PNG 为无损格式，照片源体积会显著增大；仅存档/分享建议改转 JPG', link: '/t/heic-to-jpg' }
    }
    if (srcExts.includes('jpg') || srcExts.includes('jpeg')) {
      return { text: 'PNG 为无损格式，照片类体积会显著增大；减小体积建议改转 WebP', link: '/t/jpg-to-webp' }
    }
    if (srcExts.includes('avif')) {
      return { text: 'PNG 为无损格式，AVIF 源体积会显著增大；减小体积建议改转 JPG', link: '/t/avif-to-jpg' }
    }
    if (srcExts.includes('webp')) {
      return { text: 'PNG 为无损格式体积会增大；若非兼容刚需（老软件打不开），建议保留 WebP' }
    }
    return { text: 'PNG 为无损格式，输出体积可能大于源文件；照片类建议改用 JPG/WebP' }
  }
  if (targetMime === 'image/x-icon') {
    return { text: 'ICO 内嵌多尺寸位图，体积偏大属正常；仅需单一尺寸可改用 PNG' }
  }
  if (targetMime === 'image/webp') {
    return { text: '可调低质量滑条重转（或关闭无损档）再对比体积' }
  }
  return { text: '可调低质量滑条重转，或勾选「同时输出 WebP」对比体积' }
}
