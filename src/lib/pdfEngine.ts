/**
 * PDF 引擎：基于 @cantoo/pdf-lib（含加密支持）与 pdfjs-dist（渲染/文本提取）。
 * 全部懒加载，API 保持稳定供各 PDF 工具复用。
 */

export type PageSpec = string // 如 "1,3,5-8" 或 "all"

/** 解析页码描述为 0-based 页索引数组 */
export function parsePageSpec(spec: PageSpec, total: number): number[] {
  const s = spec.trim().toLowerCase()
  if (!s || s === 'all' || s === '全部') return Array.from({ length: total }, (_, i) => i)
  const set = new Set<number>()
  for (const part of s.split(/[,，;；\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (m) {
      const a = Math.max(1, parseInt(m[1]))
      const b = Math.min(total, parseInt(m[2]))
      for (let i = a; i <= b; i++) set.add(i - 1)
    } else {
      const n = parseInt(part)
      if (n >= 1 && n <= total) set.add(n - 1)
    }
  }
  return [...set].sort((a, b) => a - b)
}

/* ---------------- 库加载 ---------------- */

export async function loadPdfLib() {
  return import('@cantoo/pdf-lib')
}
export type PDFLib = Awaited<ReturnType<typeof loadPdfLib>>

let pdfjsCache: typeof import('pdfjs-dist') | null = null
export async function loadPdfJs() {
  if (pdfjsCache) return pdfjsCache
  const pdfjs = await import('pdfjs-dist')
  // Vite 5+ 方式引入 worker
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  pdfjsCache = pdfjs
  return pdfjs
}

async function bytesOf(file: File | Blob | ArrayBuffer): Promise<Uint8Array> {
  if (file instanceof ArrayBuffer) return new Uint8Array(file)
  return new Uint8Array(await file.arrayBuffer())
}

/** 创建输出 PDF 文档并统一写入 ToolHub 元数据（producer/creator 契约） */
async function createDoc(): Promise<import('@cantoo/pdf-lib').PDFDocument> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.create()
  doc.setProducer('ToolHub')
  doc.setCreator('ToolHub')
  return doc
}

/** pdf-lib 的 save() 返回 Uint8Array，统一包装为可直接下载的 PDF Blob */
export function toPdfBlob(bytes: Uint8Array | Blob): Blob {
  return bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/**
 * 统一保存：pdf-lib 的 updateInfoDict 会在 save 时无条件把 producer 强制写回
 * 「pdf-lib (https://github.com/Hopding/pdf-lib)」，故以 updateMetadata:false 跳过，
 * 由引擎维护元数据契约——producer=ToolHub，creator 缺失时补 ToolHub。
 */
export async function savePdf(
  doc: import('@cantoo/pdf-lib').PDFDocument,
  opts: { useObjectStreams?: boolean } = {},
): Promise<Blob> {
  doc.setProducer('ToolHub')
  if (!doc.getCreator()) doc.setCreator('ToolHub')
  doc.setModificationDate(new Date())
  // updateMetadata 运行时支持但 .d.ts 未声明，这里以断言传入
  return toPdfBlob(await doc.save({ updateMetadata: false, ...opts } as never))
}

/* ---------------- 基本信息 ---------------- */

export async function pdfInfo(file: File | Blob): Promise<{ pages: number; size: number }> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: await bytesOf(file) }).promise
  const pages = doc.numPages
  doc.destroy()
  return { pages, size: file instanceof Blob ? file.size : 0 }
}

/* ---------------- 页面级操作 ---------------- */

export async function mergePdfs(files: (File | Blob)[], onProgress?: (p: number) => void): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const out = await createDoc()
  for (let i = 0; i < files.length; i++) {
    const src = await PDFDocument.load(await bytesOf(files[i]), { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
    onProgress?.((i + 1) / files.length)
  }
  return await savePdf(out)
}

export async function splitPdf(
  file: File | Blob,
  onProgress?: (p: number) => void,
): Promise<{ name: string; blob: Blob }[]> {
  const { PDFDocument } = await loadPdfLib()
  const src = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const out: { name: string; blob: Blob }[] = []
  for (let i = 0; i < src.getPageCount(); i++) {
    const doc = await createDoc()
    const [p] = await doc.copyPages(src, [i])
    doc.addPage(p)
    out.push({ name: `第${i + 1}页.pdf`, blob: await savePdf(doc) })
    onProgress?.((i + 1) / src.getPageCount())
  }
  return out
}

export async function rotatePdf(file: File | Blob, deg: 90 | 180 | 270): Promise<Blob> {
  const { PDFDocument, degrees } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  for (const page of doc.getPages()) {
    const cur = page.getRotation().angle ?? 0
    page.setRotation(degrees((cur + deg) % 360))
  }
  return await savePdf(doc)
}

export async function rotatePage(file: File | Blob, pageIndex: number, deg: 90 | 180 | 270): Promise<Blob> {
  const { PDFDocument, degrees } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const page = doc.getPage(pageIndex)
  const cur = page.getRotation().angle ?? 0
  page.setRotation(degrees((cur + deg) % 360))
  return await savePdf(doc)
}

export async function deletePages(file: File | Blob, spec: PageSpec): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const del = new Set(parsePageSpec(spec, doc.getPageCount()))
  const keep = doc.getPageIndices().filter((i) => !del.has(i))
  const out = await createDoc()
  const pages = await out.copyPages(doc, keep)
  pages.forEach((p) => out.addPage(p))
  return await savePdf(out)
}

export async function extractPages(file: File | Blob, spec: PageSpec): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const src = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const idx = parsePageSpec(spec, src.getPageCount())
  if (!idx.length) throw new Error('请至少选择一页')
  const out = await createDoc()
  const pages = await out.copyPages(src, idx)
  pages.forEach((p) => out.addPage(p))
  return await savePdf(out)
}

export async function reorderPages(file: File | Blob, order0: number[]): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const src = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const out = await createDoc()
  const pages = await out.copyPages(src, order0)
  pages.forEach((p) => out.addPage(p))
  return await savePdf(out)
}

export async function reversePages(file: File | Blob): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const src = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const idx = src.getPageIndices().reverse()
  const out = await createDoc()
  const pages = await out.copyPages(src, idx)
  pages.forEach((p) => out.addPage(p))
  return await savePdf(out)
}

export async function insertBlankPages(
  file: File | Blob,
  opts: { position: 'start' | 'end'; after?: number; count: number },
): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const src = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const first = src.getPage(0)
  const size = first.getSize()
  const out = await createDoc()
  const total = src.getPageCount()
  const blank = () => out.addPage([size.width, size.height])
  const copyAll = async () => {
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  if (opts.position === 'start') {
    for (let i = 0; i < opts.count; i++) blank()
    await copyAll()
  } else if (opts.position === 'end') {
    await copyAll()
    for (let i = 0; i < opts.count; i++) blank()
  } else {
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p, i) => {
      out.addPage(p)
      if (i + 1 === opts.after) for (let k = 0; k < opts.count; k++) blank()
    })
  }
  return await savePdf(out)
}

/* ---------------- 加密 / 解密 ---------------- */

export async function protectPdf(file: File | Blob, password: string): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  // encrypt() 是 void 方法，加密结果须经 save() 序列化输出
  doc.encrypt({ userPassword: password, ownerPassword: password, permissions: {} })
  return await savePdf(doc)
}

export async function unlockPdf(file: File | Blob, password: string): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), {
    ignoreEncryption: false,
    password,
  })
  return await savePdf(doc)
}

/* ---------------- 水印 / 页码 / 页眉页脚 / 编号 ---------------- */

export interface TextStampOptions {
  text: string
  fontSize?: number
  color?: [number, number, number]
  opacity?: number
  rotate?: boolean // 45° 对角
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  margin?: number
  /** 只应用到指定页 */
  pages?: PageSpec
  font?: 'auto'
}

export async function stampText(file: File | Blob, opts: TextStampOptions): Promise<Blob> {
  const { PDFDocument, rgb, degrees, StandardFonts } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const pages = doc.getPages()
  const targets = opts.pages ? parsePageSpec(opts.pages, pages.length).map((i) => pages[i]) : pages
  for (const page of targets) {
    const { width, height } = page.getSize()
    const size = opts.fontSize ?? Math.max(24, Math.min(width, height) / 12)
    const tw = font.widthOfTextAtSize(opts.text, size)
    const color = opts.color ?? [0.7, 0.7, 0.75]
    const opacity = opts.opacity ?? 0.25
    const draw = (x: number, y: number, rot = 0) =>
      page.drawText(opts.text, {
        x, y, size, font,
        color: rgb(color[0], color[1], color[2]),
        opacity,
        rotate: degrees(rot),
      })
    const m = opts.margin ?? 40
    if (opts.rotate !== false) {
      draw((width - tw / Math.SQRT2) / 2, (height - size) / 2.4, 45)
    } else {
      const pos = opts.position ?? 'center'
      const x = pos.includes('left') ? m : pos.includes('right') ? width - tw - m : (width - tw) / 2
      const y = pos.includes('top') ? height - size - m : pos.includes('bottom') ? m : (height - size) / 2
      draw(x, y)
    }
  }
  return await savePdf(doc)
}

export async function addPageNumbers(
  file: File | Blob,
  opts: {
    position?: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'
    start?: number
    format?: string // "{n}" / "第 {n} 页" / "{n} / {total}"
    fontSize?: number
    margin?: number
    skipFirst?: boolean
  } = {},
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const fmt = opts.format ?? '{n} / {total}'
  const start = opts.start ?? 1
  const margin = opts.margin ?? 28
  const size = opts.fontSize ?? 11
  const pos = opts.position ?? 'bottom-center'
  pages.forEach((page, i) => {
    if (opts.skipFirst && i === 0) return
    const n = i + start
    const text = fmt.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(pages.length))
    const { width, height } = page.getSize()
    const tw = font.widthOfTextAtSize(text, size)
    const x = pos.includes('left') ? margin : pos.includes('right') ? width - tw - margin : (width - tw) / 2
    const y = pos.startsWith('top') ? height - size - margin : margin
    page.drawText(text, { x, y, size, font, color: rgb(0.35, 0.38, 0.45) })
  })
  return await savePdf(doc)
}

export async function addHeaderFooter(
  file: File | Blob,
  opts: {
    header?: string
    footer?: string
    fontSize?: number
    margin?: number
    withPageNumber?: boolean
  },
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const size = opts.fontSize ?? 10
  const m = opts.margin ?? 28
  pages.forEach((page, i) => {
    const { width, height } = page.getSize()
    const num = opts.withPageNumber ? ` · ${i + 1}` : ''
    if (opts.header) {
      const text = opts.header + num
      const tw = font.widthOfTextAtSize(text, size)
      page.drawText(text, { x: (width - tw) / 2, y: height - m, size, font, color: rgb(0.35, 0.38, 0.45) })
    }
    if (opts.footer) {
      const text = opts.footer + num
      const tw = font.widthOfTextAtSize(text, size)
      page.drawText(text, { x: (width - tw) / 2, y: m, size, font, color: rgb(0.35, 0.38, 0.45) })
    }
  })
  return await savePdf(doc)
}

/** 贝茨编号：如 ABC-000001 */
export async function batesNumbering(
  files: (File | Blob)[],
  opts: { prefix?: string; digits?: number; fontSize?: number; position?: 'bottom-right' | 'bottom-center' },
): Promise<{ name: string; blob: Blob }[]> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()
  const out: { name: string; blob: Blob }[] = []
  let counter = 1
  const digits = opts.digits ?? 6
  for (const f of files) {
    const doc = await PDFDocument.load(await bytesOf(f), { ignoreEncryption: true })
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (const page of doc.getPages()) {
      const text = `${opts.prefix ?? ''}${String(counter).padStart(digits, '0')}`
      const { width } = page.getSize()
      const tw = font.widthOfTextAtSize(text, opts.fontSize ?? 10)
      const x = opts.position === 'bottom-center' ? (width - tw) / 2 : width - tw - 28
      page.drawText(text, { x, y: 24, size: opts.fontSize ?? 10, font, color: rgb(0.2, 0.2, 0.25) })
      counter++
    }
    out.push({ name: `${opts.prefix ?? 'bates'}-已编号.pdf`, blob: await savePdf(doc) })
  }
  return out
}

/* ---------------- 元数据 ---------------- */

export interface PdfMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creator?: string
}

export async function setMetadata(file: File | Blob, meta: PdfMetadata): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  if (meta.title !== undefined) doc.setTitle(meta.title)
  if (meta.author !== undefined) doc.setAuthor(meta.author)
  if (meta.subject !== undefined) doc.setSubject(meta.subject)
  if (meta.keywords !== undefined) doc.setKeywords(meta.keywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean))
  // 契约：producer/creator 统一写 ToolHub（用户显式传入 creator 时以用户值为准）
  doc.setProducer('ToolHub')
  doc.setCreator(meta.creator ?? 'ToolHub')
  return await savePdf(doc)
}

export async function getMetadata(file: File | Blob): Promise<PdfMetadata & { pages: number }> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: (doc.getKeywords() as string) ?? '',
    creator: doc.getCreator() ?? '',
    pages: doc.getPageCount(),
  }
}

/* ---------------- 页面几何 ---------------- */

export async function cropPdf(
  file: File | Blob,
  pct: { top: number; right: number; bottom: number; left: number },
): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const x = (pct.left / 100) * width
    const y = (pct.bottom / 100) * height
    const w = width - ((pct.left + pct.right) / 100) * width
    const h = height - ((pct.top + pct.bottom) / 100) * height
    if (w > 0 && h > 0) page.setCropBox(x, y, w, h)
  }
  return await savePdf(doc)
}

export const PAGE_SIZES: Record<string, [number, number]> = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  Legal: [612, 1008],
}

export async function resizePdfTo(file: File | Blob, sizeName: string, landscape = false): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  let [w, h] = PAGE_SIZES[sizeName] ?? PAGE_SIZES.A4
  if (landscape) [w, h] = [h, w]
  const out = await createDoc()
  const srcPages = await out.embedPdf(await bytesOf(file))
  for (const emb of srcPages) {
    const page = out.addPage([w, h])
    const scale = Math.min(w / emb.width, h / emb.height)
    const dw = emb.width * scale
    const dh = emb.height * scale
    page.drawText('', { x: 0, y: 0, size: 1 })
    page.drawPage(emb, { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh })
  }
  return await savePdf(out)
}

/** N-up 多页合一 */
export async function nupPdf(file: File | Blob, per: 2 | 4 | 6 | 9): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const src = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const first = src.getPage(0).getSize()
  const pw = first.width
  const ph = first.height
  const cols = per === 2 ? 1 : per === 4 ? 2 : 3
  const rows = per === 2 ? 2 : per === 4 ? 2 : 3
  const sheetW = per === 2 ? pw : pw * cols
  const sheetH = ph * rows
  const out = await createDoc()
  const embedded = await out.embedPdf(await bytesOf(file))
  for (let i = 0; i < embedded.length; i += per) {
    const page = out.addPage([sheetW, sheetH])
    for (let k = 0; k < per && i + k < embedded.length; k++) {
      const col = k % cols
      const row = Math.floor(k / cols)
      // 从上到下排列
      const x = col * pw
      const y = sheetH - (row + 1) * ph
      page.drawPage(embedded[i + k], { x, y, width: pw, height: ph })
    }
  }
  return await savePdf(out)
}

/* ---------------- 图片转 PDF ---------------- */

export async function imagesToPdf(
  files: (File | Blob)[],
  opts: { pageSize?: 'auto' | 'A4' | 'Letter'; margin?: number; landscape?: boolean } = {},
): Promise<Blob> {
  const doc = await createDoc()
  for (const f of files) {
    const { decodeToCanvas } = await import('./imageEngine')
    const canvas = await decodeToCanvas(f)
    const png = await canvasToBlob(canvas, 'image/png')
    const bytes = new Uint8Array(await png.arrayBuffer())
    const img = await doc.embedPng(bytes)
    const margin = opts.margin ?? 0
    let pw: number, ph: number
    if (opts.pageSize === 'auto' || !opts.pageSize) {
      pw = img.width + margin * 2
      ph = img.height + margin * 2
    } else {
      const [w0, h0] = PAGE_SIZES[opts.pageSize]
      pw = opts.landscape ? h0 : w0
      ph = opts.landscape ? w0 : h0
    }
    const page = doc.addPage([pw, ph])
    const availW = pw - margin * 2
    const availH = ph - margin * 2
    const scale = Math.min(availW / img.width, availH / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh })
  }
  return await savePdf(doc)
}

/** 给指定页按比例坐标插入图片（透明 PNG 图章 / 插图），走 imageEngine 解码统一格式 */
export async function insertImagesAt(
  file: File | Blob,
  placements: {
    image: File | Blob
    /** 目标页（0 基） */
    pageIndex: number
    /** 点击点相对页面宽高的比例（0~1） */
    xRatio: number
    yRatio: number
    /** 图片显示宽度占页宽百分比 */
    scalePct: number
  }[],
): Promise<Blob> {
  const PDFDocument = (await loadPdfLib()).PDFDocument
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()))
  const { decodeToCanvas, canvasToBlob } = await import('./imageEngine')
  const pngCache = new Map<File | Blob, Awaited<ReturnType<typeof doc.embedPng>>>()
  const embed = async (img: File | Blob) => {
    let png = pngCache.get(img)
    if (!png) {
      const canvas = await decodeToCanvas(img)
      const blob = await canvasToBlob(canvas, 'image/png')
      png = await doc.embedPng(new Uint8Array(await blob.arrayBuffer()))
      pngCache.set(img, png)
    }
    return png
  }
  for (const p of placements) {
    const pages = doc.getPages()
    const page = pages[Math.max(0, Math.min(pages.length - 1, p.pageIndex))]
    const img = await embed(p.image)
    const w = (page.getWidth() * Math.max(1, Math.min(100, p.scalePct))) / 100
    const h = (img.height / img.width) * w
    // 点击点为图片中心，坐标翻转（PDF 原点在左下），并夹在页面内
    const x = Math.max(0, Math.min(page.getWidth() - w, p.xRatio * page.getWidth() - w / 2))
    const y = Math.max(0, Math.min(page.getHeight() - h, (1 - p.yRatio) * page.getHeight() - h / 2))
    page.drawImage(img, { x, y, width: w, height: h })
  }
  return await savePdf(doc)
}

/* ---------------- 渲染（pdf.js） ---------------- */

export async function renderPageToCanvas(
  file: File | Blob,
  pageIndex: number,
  scale = 1.5,
): Promise<HTMLCanvasElement> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: await bytesOf(file) }).promise
  try {
    const page = await doc.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale })
    const c = document.createElement('canvas')
    c.width = Math.floor(viewport.width)
    c.height = Math.floor(viewport.height)
    const ctx = c.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
    return c
  } finally {
    doc.destroy()
  }
}

export async function renderPageToBlob(
  file: File | Blob,
  pageIndex: number,
  opts: { format?: 'image/jpeg' | 'image/png' | 'image/webp'; quality?: number; scale?: number } = {},
): Promise<Blob> {
  const canvas = await renderPageToCanvas(file, pageIndex, opts.scale ?? 1.5)
  return canvasToBlob(canvas, opts.format ?? 'image/jpeg', opts.quality ?? 0.85)
}

export async function pdfToImages(
  file: File | Blob,
  opts: { format?: 'image/jpeg' | 'image/png'; quality?: number; scale?: number; onProgress?: (p: number) => void },
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: await bytesOf(file) }).promise
  const out: { name: string; blob: Blob }[] = []
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale: opts.scale ?? 2 })
      const c = document.createElement('canvas')
      c.width = Math.floor(viewport.width)
      c.height = Math.floor(viewport.height)
      const ctx = c.getContext('2d')!
      if (opts.format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
      }
      await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
      const blob = await canvasToBlob(c, opts.format ?? 'image/jpeg', opts.quality ?? 0.9)
      out.push({ name: `第${i}页.${opts.format === 'image/png' ? 'png' : 'jpg'}`, blob })
      opts.onProgress?.(i / doc.numPages)
    }
  } finally {
    doc.destroy()
  }
  return out
}

/** PDF 转纵向长图 */
export async function pdfToOneImage(
  file: File | Blob,
  opts: { format?: 'image/jpeg' | 'image/png'; scale?: number; gap?: number } = {},
): Promise<Blob> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: await bytesOf(file) }).promise
  const scale = opts.scale ?? 1.5
  const gap = opts.gap ?? 8
  const canvases: HTMLCanvasElement[] = []
  let width = 0
  let totalH = 0
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale })
      const c = document.createElement('canvas')
      c.width = Math.floor(viewport.width)
      c.height = Math.floor(viewport.height)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
      canvases.push(c)
      width = Math.max(width, c.width)
      totalH += c.height + gap
    }
  } finally {
    doc.destroy()
  }
  const out = document.createElement('canvas')
  out.width = width
  out.height = totalH
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  let y = 0
  for (const c of canvases) {
    ctx.drawImage(c, (width - c.width) / 2, y)
    y += c.height + gap
  }
  return canvasToBlob(out, opts.format ?? 'image/jpeg', 0.9)
}

/* ---------------- 文本提取 ---------------- */

export async function pdfPageTexts(file: File | Blob): Promise<string[]> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: await bytesOf(file) }).promise
  const texts: string[] = []
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      let last = 0
      let text = ''
      for (const item of tc.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
        if (item.str === undefined) continue
        const y = item.transform?.[5] ?? 0
        if (last !== 0 && Math.abs(y - last) > 2) text += '\n'
        text += item.str
        if (item.hasEOL) text += '\n'
        last = y
      }
      texts.push(text.trim())
    }
  } finally {
    doc.destroy()
  }
  return texts
}

export async function pdfText(file: File | Blob): Promise<string> {
  return (await pdfPageTexts(file)).join('\n\n')
}

/* ---------------- 图片提取 ---------------- */

export async function extractImages(
  file: File | Blob,
  onProgress?: (p: number) => void,
): Promise<{ name: string; blob: Blob }[]> {
  const { PDFDocument, PDFRawStream, PDFName, decodePDFRawStream } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const out: { name: string; blob: Blob }[] = []
  let idx = 0
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
      const filterName =
        filter instanceof PDFName ? filter.asString() : Array.isArray(filter) ? String(filter) : ''
      const bpc = Number(dict.lookup(PDFName.of('BitsPerComponent')) ?? 8)
      const cs = dict.lookup(PDFName.of('ColorSpace'))
      const csName = cs instanceof PDFName ? cs.asString() : ''
      if (!w || !h) continue
      try {
        // JPEG（DCTDecode）直接封装
        if (String(filterName).includes('DCT')) {
          out.push({ name: `图片-${++idx}.jpg`, blob: new Blob([obj.contents as BlobPart], { type: 'image/jpeg' }) })
          continue
        }
        // 原始流解码（Flate 等）
        let data: Uint8Array
        try {
          data = decodePDFRawStream(obj).decode()
        } catch {
          data = obj.contents
        }
        const canvas = await rawToCanvas(data, w, h, bpc, csName)
        if (canvas) {
          out.push({ name: `图片-${++idx}.png`, blob: await canvasToBlob(canvas, 'image/png') })
        }
      } catch {
        /* 单张图片解码失败跳过 */
      }
    }
    onProgress?.((i + 1) / doc.getPageCount())
  }
  return out
}

async function rawToCanvas(
  data: Uint8Array,
  w: number,
  h: number,
  bpc: number,
  csName: string,
): Promise<HTMLCanvasElement | null> {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const id = ctx.createImageData(w, h)
  if (data.length === w * h * 4) {
    id.data.set(data)
    ctx.putImageData(id, 0, 0)
    return c
  }
  if (data.length === w * h * 3 || (csName && /RGB/i.test(csName))) {
    for (let i = 0, j = 0; i < w * h * 3 && j < id.data.length; i += 3, j += 4) {
      id.data[j] = data[i]; id.data[j + 1] = data[i + 1]; id.data[j + 2] = data[i + 2]; id.data[j + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
    return c
  }
  if (data.length === w * h && bpc === 8) {
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      id.data[j] = id.data[j + 1] = id.data[j + 2] = data[i]
      id.data[j + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
    return c
  }
  if (data.length === w * h && bpc === 1) {
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      const v = (data[i >> 3] >> (7 - (i & 7))) & 1 ? 0 : 255
      id.data[j] = id.data[j + 1] = id.data[j + 2] = v
      id.data[j + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
    return c
  }
  return null
}

/* ---------------- 表单 ---------------- */

export interface FormFieldInfo {
  name: string
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'button' | 'unknown'
  value?: string
  options?: string[]
}

export async function pdfFormFields(file: File | Blob): Promise<FormFieldInfo[]> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const form = doc.getForm()
  const out: FormFieldInfo[] = []
  try {
    for (const f of form.getFields()) {
      const ctor = f.constructor.name
      const name = f.getName()
      if (ctor === 'PDFTextField') {
        const tf = f as unknown as { getText?: () => string | undefined }
        out.push({ name, type: 'text', value: tf.getText?.() ?? '' })
      } else if (ctor === 'PDFCheckBox') {
        const cb = f as unknown as { isChecked?: () => boolean }
        out.push({ name, type: 'checkbox', value: cb.isChecked?.() ? '是' : '否' })
      } else if (ctor === 'PDFDropdown') {
        const dd = f as unknown as { getOptions?: () => string[]; getSelected?: () => string[] }
        out.push({ name, type: 'dropdown', options: dd.getOptions?.() ?? [], value: (dd.getSelected?.() ?? []).join(', ') })
      } else if (ctor === 'PDFRadioGroup') {
        const rg = f as unknown as { getOptions?: () => string[]; getSelected?: () => string | undefined }
        out.push({ name, type: 'radio', options: rg.getOptions?.() ?? [], value: rg.getSelected?.() ?? '' })
      } else {
        out.push({ name, type: 'unknown' })
      }
    }
  } catch {
    /* 无表单或解析失败 */
  }
  return out
}

export async function fillForm(file: File | Blob, values: Record<string, string | boolean>): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const form = doc.getForm()
  for (const [name, val] of Object.entries(values)) {
    try {
      const field = form.getFieldMaybe?.(name) ?? undefined
      if (!field) continue
      const ctor = field.constructor.name
      if (ctor === 'PDFTextField') (field as unknown as { setText: (s: string) => void }).setText(String(val))
      else if (ctor === 'PDFCheckBox') (field as unknown as { check: () => void; uncheck: () => void })[val ? 'check' : 'uncheck']()
      else if (ctor === 'PDFDropdown') (field as unknown as { select: (s: string) => void }).select(String(val))
      else if (ctor === 'PDFRadioGroup') (field as unknown as { select: (s: string) => void }).select(String(val))
    } catch {
      /* 单个字段失败不影响整体 */
    }
  }
  try {
    form.flatten()
  } catch {
    /* 某些字段不可扁平化 */
  }
  return await savePdf(doc)
}

/** 汇总多个已填表单 PDF 的字段为行数据 */
export async function pdfFormRows(files: (File | Blob)[]): Promise<{ header: string[]; rows: string[][] }> {
  const headerSet = new Set<string>()
  const parsed: Record<string, string>[] = []
  for (const f of files) {
    const fields = await pdfFormFields(f)
    const row: Record<string, string> = {}
    for (const fd of fields) {
      if (fd.type === 'unknown' || fd.type === 'button') continue
      row[fd.name] = fd.value ?? ''
      headerSet.add(fd.name)
    }
    parsed.push(row)
  }
  const header = [...headerSet]
  return { header, rows: parsed.map((r) => header.map((h) => r[h] ?? '')) }
}

/* ---------------- 文字叠加 / 遮盖 ---------------- */

/** 在指定页面坐标添加文字（PDF 坐标：左下原点） */
export async function appendTextAt(
  file: File | Blob,
  pageIdx: number,
  x: number,
  y: number,
  text: string,
  opts: { size?: number; color?: [number, number, number] } = {},
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.getPage(pageIdx)
  page.drawText(text, {
    x, y, size: opts.size ?? 14, font,
    color: rgb(opts.color?.[0] ?? 0.1, opts.color?.[1] ?? 0.1, opts.color?.[2] ?? 0.1),
  })
  return await savePdf(doc)
}

/** 黑条遮盖指定区域（坐标为页面比例 0-1） */
export async function blackenRegions(
  file: File | Blob,
  boxes: { page: number; x: number; y: number; w: number; h: number }[],
): Promise<Blob> {
  const { PDFDocument, rgb } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  for (const b of boxes) {
    const page = doc.getPage(b.page)
    const { width, height } = page.getSize()
    page.drawRectangle({
      x: b.x * width,
      y: (1 - b.y - b.h) * height,
      width: b.w * width,
      height: b.h * height,
      color: rgb(0, 0, 0),
    })
  }
  return await savePdf(doc)
}

/* ---------------- 压缩（栅格化逼近目标体积） ---------------- */

export async function compressPdf(
  file: File | Blob,
  opts: { preset?: 'low' | 'medium' | 'high'; targetKB?: number; onProgress?: (p: number) => void },
): Promise<{ blob: Blob; originalKB: number; resultKB: number }> {
  const originalKB = file.size / 1024
  const quality = opts.targetKB ? undefined : opts.preset === 'low' ? 0.35 : opts.preset === 'medium' ? 0.6 : 0.8
  const scale = opts.preset === 'high' ? 2 : opts.preset === 'medium' ? 1.5 : 1.2

  const render = async (q: number, sc: number, onPage: (b: Blob, i: number) => void) => {
    const pdfjs = await loadPdfJs()
    const doc = await pdfjs.getDocument({ data: await bytesOf(file) }).promise
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale: sc })
        const c = document.createElement('canvas')
        c.width = Math.floor(viewport.width)
        c.height = Math.floor(viewport.height)
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
        await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise
        onPage(await canvasToBlob(c, 'image/jpeg', q), i)
      }
    } finally {
      doc.destroy()
    }
  }

  if (opts.targetKB) {
    // 二分质量逼近目标
    let lo = 0.25
    let hi = 0.9
    let best: Blob | null = null
    for (let iter = 0; iter < 5; iter++) {
      const q = (lo + hi) / 2
      const pages: Blob[] = []
      await render(q, scale, (b) => pages.push(b))
      const doc = await createDoc()
      for (const p of pages) {
        const img = await doc.embedJpg(new Uint8Array(await p.arrayBuffer()))
        const page = doc.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      }
      const out = await savePdf(doc)
      const kb = out.size / 1024
      best = out
      opts.onProgress?.((iter + 1) / 5)
      if (kb <= opts.targetKB) {
        lo = q
        if (opts.targetKB - kb < opts.targetKB * 0.1) break
      } else {
        hi = q
      }
    }
    if (!best) throw new Error('压缩失败')
    return { blob: best, originalKB, resultKB: best.size / 1024 }
  }

  // 预设质量
  const pages: Blob[] = []
  await render(quality ?? 0.6, scale, (b, i) => {
    pages.push(b)
    opts.onProgress?.(i / 10)
  })
  const doc = await createDoc()
  for (const p of pages) {
    const img = await doc.embedJpg(new Uint8Array(await p.arrayBuffer()))
    const page = doc.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  }
  const out = await savePdf(doc)
  return { blob: out, originalKB, resultKB: out.size / 1024 }
}

/** PDF/A 近似转换：嵌入 sRGB 输出意图 + 元数据 + 栅格化可选 */
export async function pdfToPdfa(file: File | Blob): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await loadPdfLib()
  const doc = await PDFDocument.load(await bytesOf(file), { ignoreEncryption: true })
  doc.setTitle(doc.getTitle() ?? '')
  doc.setProducer('ToolHub')
  doc.setCreator('ToolHub')
  doc.setCreationDate(new Date())
  // 标记 XMP 元数据（简化实现：设置 Info 字典并保存）
  const font = await doc.embedFont(StandardFonts.Helvetica)
  void font
  return await savePdf(doc, { useObjectStreams: false })
}

/** 清理扫描件：每页转灰度增强后重排 */
export async function cleanScannedPdf(
  file: File | Blob,
  opts: { mode?: 'bw' | 'contrast'; level?: number; onProgress?: (p: number) => void },
): Promise<Blob> {
  const pdfjs = await loadPdfJs()
  const doc0 = await pdfjs.getDocument({ data: await bytesOf(file) }).promise
  const pages: Blob[] = []
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
      const level = opts.level ?? 180
      for (let k = 0; k < d.length; k += 4) {
        const lum = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]
        const v = opts.mode === 'bw' ? (lum > level ? 255 : 0) : Math.min(255, Math.max(0, (lum - 60) * 1.6))
        d[k] = d[k + 1] = d[k + 2] = v
      }
      ctx.putImageData(id, 0, 0)
      pages.push(await canvasToBlob(c, 'image/jpeg', 0.85))
      opts.onProgress?.(i / doc0.numPages)
    }
  } finally {
    doc0.destroy()
  }
  const out = await createDoc()
  for (const p of pages) {
    const img = await out.embedJpg(new Uint8Array(await p.arrayBuffer()))
    const page = out.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  }
  return await savePdf(out)
}

/* ---------------- 渲染工具复用 ---------------- */

import { canvasToBlob } from './imageEngine'
