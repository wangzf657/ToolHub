/**
 * 文件格式扩展库（零依赖，纯 DataView/pako 实现）：
 * - TTF/OTF（sfnt 容器）↔ WOFF 互转（自研 WOFF 1.0 容器，zlib deflate 单表压缩）
 * - sfnt/WOFF 头部信息解析（表列表、numGlyphs、unitsPerEm、name 表主要记录）
 * - ICO 目录头解析（列出内含图像帧尺寸）
 * 重依赖按需由调用方动态加载（pako 在转换函数内部 await import）。
 */

export interface SfntTableEntry {
  tag: string
  offset: number
  length: number
  checksum: number
}

export interface FontInfo {
  /** sfnt 版本（0x00010000 = TrueType，'OTTO' = CFF） */
  sfntVersion: string
  numTables: number
  numGlyphs: number
  unitsPerEm: number
  /** 表名列表（按标签排序） */
  tables: SfntTableEntry[]
  /** name 表主要记录（中文标注） */
  names: { id: number; label: string; value: string }[]
}

export interface IcoEntry {
  width: number
  height: number
  colorCount: number
  bitCount: number
  bytesInRes: number
  imageOffset: number
}

const tagStr = (b: DataView, off: number) => String.fromCharCode(b.getUint8(off), b.getUint8(off + 1), b.getUint8(off + 2), b.getUint8(off + 3))

/** 计算 sfnt 表校验和（spec：按 32 位大端累加） */
function tableChecksum(data: Uint8Array, offset: number, length: number): number {
  const dv = new DataView(data.buffer, data.byteOffset + offset, length)
  let sum = 0
  const n = Math.floor(length / 4)
  for (let i = 0; i < n * 4; i += 4) sum = (sum + dv.getUint32(i)) >>> 0
  if (length % 4) {
    let tail = 0
    for (let i = n * 4; i < length; i++) tail |= data[offset + i] << (24 - 8 * (i - n * 4))
    sum = (sum + tail) >>> 0
  }
  return sum
}

/** 解析 sfnt（TTF/OTF）文件目录 */
export function parseSfnt(bytes: Uint8Array): SfntTableEntry[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 12) throw new Error('字体文件过小或已损坏')
  const numTables = dv.getUint16(4)
  const out: SfntTableEntry[] = []
  for (let i = 0; i < numTables; i++) {
    const e = 12 + i * 16
    out.push({
      tag: tagStr(dv, e),
      checksum: dv.getUint32(e + 4),
      offset: dv.getUint32(e + 8),
      length: dv.getUint32(e + 12),
    })
  }
  return out
}

/** 解析 WOFF 文件目录（compLength = 0 处为原长度字段，见 WOFF 1.0 规范） */
export function parseWoffDir(bytes: Uint8Array): { flavor: string; tables: SfntTableEntry[]; meta: { major: number; minor: number } } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (dv.getUint32(0) !== 0x774f4646) throw new Error('不是有效的 WOFF 文件（缺少 wOFF 签名）')
  const flavor = tagStr(dv, 4)
  const numTables = dv.getUint16(12)
  const tables: SfntTableEntry[] = []
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20
    tables.push({
      tag: tagStr(dv, e),
      offset: dv.getUint32(e + 4),
      length: dv.getUint32(e + 8), // 压缩后长度（等于原长时表示未压缩）
      checksum: dv.getUint32(e + 16),
    })
    // origLength 在 e+12，压缩与否由 length < origLength 判断
    void dv.getUint32(e + 12)
  }
  return { flavor, tables, meta: { major: dv.getUint16(20), minor: dv.getUint16(22) } }
}

/** 读取 sfnt 头信息（numGlyphs/unitsPerEm/name 表）；WOFF 输入请先经 woffToSfnt 解包 */
export function readFontInfo(bytes: Uint8Array): FontInfo {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ver = dv.getUint32(0)
  const sfntVersion = ver === 0x00010000 ? 'TrueType' : ver === 0x4f54544f ? 'CFF (OTTO)' : `未知（0x${ver.toString(16)}）`
  const tables = parseSfnt(bytes)
  const find = (tag: string) => tables.find((t) => t.tag === tag)
  let numGlyphs = 0
  let unitsPerEm = 1000
  const maxp = find('maxp')
  if (maxp) numGlyphs = dv.getUint16(maxp.offset + 4)
  const head = find('head')
  if (head) unitsPerEm = dv.getUint16(head.offset + 18)
  const names: FontInfo['names'] = []
  const name = find('name')
  if (name) {
    const count = dv.getUint16(name.offset + 2)
    const strOff = name.offset + dv.getUint16(name.offset + 4)
    const LABELS: Record<number, string> = {
      0: '版权', 1: '字体家族', 2: '子家族', 3: '唯一标识', 4: '全名', 5: '版本', 6: 'PostScript 名',
      7: '商标', 8: '制造商', 9: '设计师', 10: '描述', 11: '厂商链接', 12: '设计师链接', 13: '许可', 14: '许可链接',
    }
    for (let i = 0; i < count; i++) {
      const r = name.offset + 6 + i * 12
      const id = dv.getUint16(r + 6)
      const len = dv.getUint16(r + 8)
      const off = strOff + dv.getUint16(r + 10)
      if (!LABELS[id]) continue
      const platform = dv.getUint16(r)
      let value = ''
      try {
        if (platform === 3 || platform === 0) {
          // UTF-16BE（Windows / Unicode 平台）
          for (let k = 0; k < len; k += 2) value += String.fromCharCode(dv.getUint16(off + k))
        } else {
          for (let k = 0; k < len; k++) value += String.fromCharCode(dv.getUint8(off + k))
        }
      } catch {
        continue
      }
      if (value.trim()) names.push({ id, label: LABELS[id], value: value.trim() })
    }
  }
  return { sfntVersion, numTables: tables.length, numGlyphs, unitsPerEm, tables, names }
}

/**
 * TTF/OTF → WOFF：自研 WOFF 1.0 容器。
 * 每张表先 zlib deflate（pako），压缩无收益时原样存储；目录按标签升序（规范要求）。
 */
export async function sfntToWoff(bytes: Uint8Array): Promise<Uint8Array> {
  const { deflate } = await import('pako')
  const src = parseSfnt(bytes)
  if (!src.length) throw new Error('字体文件缺少表目录')
  const tables = [...src].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  // 逐表压缩
  const payload = tables.map((t) => {
    const raw = bytes.subarray(t.offset, t.offset + t.length)
    const comp = deflate(raw)
    const useComp = comp.length < raw.length
    return { tag: t.tag, checksum: t.checksum, origLength: raw.length, data: useComp ? comp : raw }
  })
  const dirSize = 44 + payload.length * 20
  let offset = dirSize
  const offsets = payload.map((t) => {
    const off = offset
    offset += t.data.length + (4 - (t.data.length % 4)) % 4 // 表数据 4 字节对齐
    return off
  })
  // totalSfntSize：还原后的 sfnt 总长（目录 + 各表按 4 对齐）
  const totalSfnt = 12 + payload.length * 16 + payload.reduce((s, t) => s + t.origLength + (4 - (t.origLength % 4)) % 4, 0)
  const out = new Uint8Array(offset)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x774f4646) // 'wOFF'
  dv.setUint32(4, bytes.length >= 4 ? new DataView(bytes.buffer, bytes.byteOffset).getUint32(0) : 0x00010000) // flavor
  dv.setUint32(8, out.length) // length
  dv.setUint16(12, payload.length)
  dv.setUint16(14, 0) // reserved
  dv.setUint32(16, totalSfnt)
  dv.setUint16(20, 1) // majorVersion
  dv.setUint16(22, 0) // minorVersion
  // meta/priv 块全部为 0（DataView 初始即 0，无需显式写）
  payload.forEach((t, i) => {
    const e = 44 + i * 20
    for (let k = 0; k < 4; k++) out[e + k] = t.tag.charCodeAt(k)
    dv.setUint32(e + 4, offsets[i])
    dv.setUint32(e + 8, t.data.length)
    dv.setUint32(e + 12, t.origLength)
    dv.setUint32(e + 16, t.checksum)
    out.set(t.data, offsets[i])
  })
  return out
}

/**
 * WOFF → TTF（sfnt）：逐表 inflate 重排为标准 sfnt 目录，
 * 并按规范重算 head.checkSumAdjustment。
 */
export async function woffToSfnt(bytes: Uint8Array): Promise<Uint8Array> {
  const { inflate } = await import('pako')
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (dv.getUint32(0) !== 0x774f4646) throw new Error('不是有效的 WOFF 文件（缺少 wOFF 签名）')
  const flavor = dv.getUint32(4)
  const numTables = dv.getUint16(12)
  interface Entry { tag: string; checksum: number; origLength: number; data: Uint8Array }
  const entries: Entry[] = []
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20
    const tag = tagStr(dv, e)
    const off = dv.getUint32(e + 4)
    const compLength = dv.getUint32(e + 8)
    const origLength = dv.getUint32(e + 12)
    const checksum = dv.getUint32(e + 16)
    const raw = bytes.subarray(off, off + compLength)
    const data = compLength < origLength ? inflate(raw) : raw
    if (data.length !== origLength) throw new Error(`表 ${tag} 解压长度不符（可能已损坏）`)
    entries.push({ tag, checksum, origLength, data })
  }
  entries.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  // sfnt 目录参数
  const pow = Math.floor(Math.log2(numTables))
  const entrySelector = pow
  const searchRange = (pow + 1) * 16
  const rangeShift = numTables * 16 - searchRange
  const dirSize = 12 + numTables * 16
  let off = dirSize
  const placed = entries.map((t) => {
    const start = off
    off += t.origLength + (4 - (t.origLength % 4)) % 4
    return { ...t, start }
  })
  const out = new Uint8Array(off)
  const ov = new DataView(out.buffer)
  ov.setUint32(0, flavor)
  ov.setUint16(4, numTables)
  ov.setUint16(6, searchRange)
  ov.setUint16(8, entrySelector)
  ov.setUint16(10, rangeShift)
  placed.forEach((t, i) => {
    const e = 12 + i * 16
    for (let k = 0; k < 4; k++) out[e + k] = t.tag.charCodeAt(k)
    ov.setUint32(e + 4, t.checksum)
    ov.setUint32(e + 8, t.start)
    ov.setUint32(e + 12, t.origLength)
    out.set(t.data, t.start)
  })
  // 重算 checkSumAdjustment：整个字体按 32 位累加（adjustment 字段按 0 计），adjustment = 0xB1B0AFBA - sum
  const head = placed.find((t) => t.tag === 'head')
  if (head && head.origLength >= 12) {
    const adjOff = head.start + 8
    ov.setUint32(adjOff, 0)
    let sum = 0
    const n4 = Math.floor(out.length / 4) * 4
    for (let i = 0; i < n4; i += 4) sum = (sum + ov.getUint32(i)) >>> 0
    if (out.length % 4) {
      let tail = 0
      for (let i = n4; i < out.length; i++) tail |= out[i] << (24 - 8 * (i - n4))
      sum = (sum + tail) >>> 0
    }
    ov.setUint32(adjOff, (0xb1b0afba - sum) >>> 0)
  }
  return out
}

/** 解析 ICO 目录头（ICONDIR + ICONDIRENTRY 数组） */
export function parseIcoDirectory(bytes: Uint8Array): IcoEntry[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 6 || dv.getUint16(2) !== 1) throw new Error('不是有效的 ICO 文件（缺少图标目录头）')
  const count = dv.getUint16(4)
  const out: IcoEntry[] = []
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16
    if (e + 16 > bytes.length) break
    out.push({
      width: dv.getUint8(e) || 256,
      height: dv.getUint8(e + 1) || 256,
      colorCount: dv.getUint8(e + 2),
      bitCount: dv.getUint16(e + 6),
      bytesInRes: dv.getUint32(e + 8),
      imageOffset: dv.getUint32(e + 12),
    })
  }
  return out
}

/* ---------------- GIF 帧解码（gifuct-js，disposal 合成） ---------------- */

/** 解码合成后的完整 GIF 帧 */
export interface GifDecodedFrame {
  canvas: HTMLCanvasElement
  /** 帧延迟（毫秒） */
  delay: number
}

/**
 * 解码 GIF 为完整帧序列（gifuct-js patch 按 disposal 规则合成到整帧画布）。
 * gif-compressor / gif-editor 共用此管线。
 */
export async function decodeGifFrames(file: File | Blob): Promise<{ width: number; height: number; frames: GifDecodedFrame[] }> {
  const { parseGIF, decompressFrames } = await import('gifuct-js')
  const buf = await file.arrayBuffer()
  const gif = parseGIF(buf)
  const raw = decompressFrames(gif, true)
  if (!raw.length) throw new Error('GIF 中没有可解码的帧')
  const canvas = document.createElement('canvas')
  canvas.width = gif.lsd.width
  canvas.height = gif.lsd.height
  const ctx = canvas.getContext('2d')!
  const frames: GifDecodedFrame[] = []
  for (const fr of raw) {
    // disposal 2/3：绘制 patch 前清空目标区
    if (fr.disposalType === 2 || fr.disposalType === 3) {
      ctx.clearRect(fr.dims.left, fr.dims.top, fr.dims.width, fr.dims.height)
    }
    const img = new ImageData(new Uint8ClampedArray(fr.patch), fr.dims.width, fr.dims.height)
    ctx.putImageData(img, fr.dims.left, fr.dims.top)
    const snap = document.createElement('canvas')
    snap.width = gif.lsd.width
    snap.height = gif.lsd.height
    snap.getContext('2d')!.drawImage(canvas, 0, 0)
    frames.push({ canvas: snap, delay: fr.delay || 100 })
  }
  return { width: gif.lsd.width, height: gif.lsd.height, frames }
}

/* ---------------- GIF 编码（gifenc，含透明度支持） ---------------- */

/** gifenc 的最小 API 面（env.d.ts 的声明未含透明度参数，这里用完整形状做模块强转） */
export interface GifencApi {
  GIFEncoder: () => {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette?: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number; dispose?: number; repeat?: number; first?: boolean },
    ) => void
    finish: () => void
    bytes: () => Uint8Array
    reset: () => void
  }
  quantize: (data: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }) => number[][]
  applyPalette: (data: Uint8Array | Uint8ClampedArray, palette: number[][], format?: 'rgb565' | 'rgb444' | 'rgba4444') => Uint8Array
}

/**
 * 把帧序列编码为 GIF（rgba4444 量化保留透明区域）。
 * gif-compressor / gif-editor 共用；canvases 尺寸需一致。
 */
export async function encodeGifFrames(
  frames: { canvas: HTMLCanvasElement; delay: number }[],
  opts: { colors?: number; repeat?: number } = {},
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const mod = (await import('gifenc')) as unknown as GifencApi
  const enc = mod.GIFEncoder()
  const w = frames[0].canvas.width
  const h = frames[0].canvas.height
  const colors = opts.colors ?? 256
  for (let i = 0; i < frames.length; i++) {
    const ctx = frames[i].canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, w, h).data
    const palette = mod.quantize(data, colors, { format: 'rgba4444' })
    const index = mod.applyPalette(data, palette, 'rgba4444')
    enc.writeFrame(index, w, h, {
      palette,
      delay: Math.max(20, Math.round(frames[i].delay)),
      transparent: true,
      transparentIndex: 0,
      repeat: i === 0 ? (opts.repeat ?? 0) : undefined,
    })
    onProgress?.((i + 1) / frames.length)
  }
  enc.finish()
  return new Blob([enc.bytes() as BlobPart], { type: 'image/gif' })
}

/* ---------------- EPUB 反向打包（TXT/Markdown → EPUB，jszip OCF 结构） ---------------- */

export interface EpubChapter {
  title: string
  paragraphs: string[]
}

/** 按中文章节（第X章/卷/回…）或 Markdown 标题（# …）把正文切分为章节 */
export function splitChapters(text: string): EpubChapter[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const re = /^(#{1,6}\s+.+|第\s*[0-9０-９一二三四五六七八九十百千万零两]+\s*[章节卷回部集话篇].*|\d+[.、]\s*\S.*)$/
  const chapters: EpubChapter[] = []
  let cur: EpubChapter | null = null
  const flush = () => {
    if (cur && (cur.paragraphs.length || cur.title)) chapters.push(cur)
  }
  for (const line of lines) {
    const t = line.trim()
    if (re.test(t) && t.length < 60) {
      flush()
      cur = { title: t.replace(/^#{1,6}\s+/, ''), paragraphs: [] }
    } else if (cur) {
      if (t) cur.paragraphs.push(t)
    } else if (t) {
      // 标题前的引导文字作为「开头」章节
      cur = { title: '开头', paragraphs: [t] }
    }
  }
  flush()
  if (!chapters.length) chapters.push({ title: '正文', paragraphs: lines.map((l) => l.trim()).filter(Boolean) })
  return chapters
}

/** 用 jszip 按 EPUB OCF 结构手工打包（mimetype 不压缩首条），返回 .epub Blob */
export async function buildEpub(chapters: EpubChapter[], title: string, author = 'ToolHub'): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // mimetype 必须为第一条且不压缩
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  )
  const xhtml = (c: EpubChapter, i: number) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(c.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><h2>${esc(c.title)}</h2>
${c.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</body></html>`
  chapters.forEach((c, i) => {
    zip.file(`OEBPS/chapter-${String(i + 1).padStart(3, '0')}.xhtml`, xhtml(c, i))
  })
  zip.file('OEBPS/style.css', 'body{font-family:serif;line-height:1.7;margin:1em}h2{margin:.6em 0}p{text-indent:2em;margin:.4em 0}')
  const manifest = chapters
    .map((_, i) => `<item id="ch${i + 1}" href="chapter-${String(i + 1).padStart(3, '0')}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n    ')
  const spine = chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('\n    ')
  const navList = chapters
    .map((c, i) => `<navPoint id="nav${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(c.title)}</text></navLabel><content src="chapter-${String(i + 1).padStart(3, '0')}.xhtml"/></navPoint>`)
    .join('\n    ')
  const now = new Date().toISOString().slice(0, 10)
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${esc(title)}</dc:title><dc:creator opf:role="aut">${esc(author)}</dc:creator>
    <dc:language>zh-CN</dc:language><dc:identifier id="bookid">urn:uuid:toolhub-${Date.now()}</dc:identifier>
    <meta name="generator" content="ToolHub"/><dc:date>${now}</dc:date>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${manifest}
  </manifest>
  <spine toc="ncx">
    <itemref idref="nav" linear="no"/>
    ${spine}
  </spine>
</package>`,
  )
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head>
<body><nav epub:type="toc" id="toc"><h1>目录</h1><ol>
    ${chapters.map((c, i) => `<li><a href="chapter-${String(i + 1).padStart(3, '0')}.xhtml">${esc(c.title)}</a></li>`).join('\n    ')}
</ol></nav></body></html>`,
  )
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:toolhub-${Date.now()}"/></head>
  <docTitle><text>${esc(title)}</text></docTitle>
  <navMap>
    ${navList}
  </navMap>
</ncx>`,
  )
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' })
}
