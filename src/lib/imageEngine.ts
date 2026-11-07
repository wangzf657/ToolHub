/**
 * 图像引擎：加载、解码（含 HEIC/TIFF/SVG）、画布操作、编码。
 * 全部基于原生 Canvas，重依赖按需懒加载。
 */

/* ---------------- 加载与解码 ---------------- */

export function loadImage(src: string | Blob | File): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败，请检查文件是否为有效图像'))
    img.src = url
  })
}

export function imageToCanvas(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = (img as HTMLImageElement).naturalWidth || img.width
  c.height = (img as HTMLImageElement).naturalHeight || img.height
  c.getContext('2d')!.drawImage(img, 0, 0)
  return c
}

export function fileToCanvas(file: File | Blob): Promise<HTMLCanvasElement> {
  return decodeToCanvas(file)
}

/** 统一解码入口：按格式路由到内置解码或懒加载解码器 */
export async function decodeToCanvas(file: File | Blob): Promise<HTMLCanvasElement> {
  const type = (file.type || '').toLowerCase()
  const name = ((file as File).name || '').toLowerCase()
  const isHeic =
    type === 'image/heic' || type === 'image/heif' || /\.heic$|\.heif$/.test(name)
  const isTiff = type === 'image/tiff' || /\.tiff?$/.test(name)
  const isSvg = type === 'image/svg+xml' || /\.svg$/.test(name)
  if (isHeic) return decodeHeic(file)
  if (isTiff) return decodeTiff(file)
  if (isSvg) return decodeSvg(file)
  // AVIF：现代浏览器已支持 <img> 解码，直接走 loadImage
  const img = await loadImage(file)
  return imageToCanvas(img)
}

/** HEIC/HEIF 解码（懒加载 heic2any） */
export async function decodeHeic(file: File | Blob): Promise<HTMLCanvasElement> {
  const mod = await import('heic2any')
  const heic2any = (mod as { default: (o: { blob: Blob; toType: string }) => Promise<Blob> }).default
  const out = await heic2any({ blob: file, toType: 'image/png' })
  const blob = Array.isArray(out) ? out[0] : out
  const img = await loadImage(blob)
  return imageToCanvas(img)
}

/** TIFF 解码（懒加载 UTIF） */
export async function decodeTiff(file: File | Blob): Promise<HTMLCanvasElement> {
  const UTIF = (await import('utif')) as unknown as {
    decode: (b: ArrayBuffer) => { width: number; height: number }[]
    decodeImage: (b: ArrayBuffer, ifd: unknown) => void
    toRGBA8: (ifd: unknown) => Uint8Array
  }
  const buf = await file.arrayBuffer()
  const ifds = UTIF.decode(buf)
  if (!ifds.length) throw new Error('无法解析 TIFF 文件')
  UTIF.decodeImage(buf, ifds[0])
  const rgba = UTIF.toRGBA8(ifds[0])
  const c = document.createElement('canvas')
  c.width = ifds[0].width
  c.height = ifds[0].height
  const ctx = c.getContext('2d')!
  const id = ctx.createImageData(c.width, c.height)
  id.data.set(rgba)
  ctx.putImageData(id, 0, 0)
  return c
}

/** SVG 栅格化（可指定输出宽度） */
export async function decodeSvg(file: File | Blob, targetWidth?: number): Promise<HTMLCanvasElement> {
  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) throw new Error('无法解析 SVG 文件')
  const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number)
  const w0 = Number(svg.getAttribute('width')) || vb[2] || 512
  const h0 = Number(svg.getAttribute('height')) || vb[3] || 512
  const scale = targetWidth ? targetWidth / w0 : 2
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
  try {
    const img = await loadImage(url)
    return imageToCanvas(img)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* ---------------- 编码 ---------------- */

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('导出失败'))),
      mime,
      quality,
    )
  })
}

export const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
}

/* ---------------- 画布操作（applyOps 管线） ---------------- */

export type ImageOp =
  | { op: 'resize'; width: number; height: number; mode?: 'stretch' | 'fit' | 'cover' }
  | { op: 'rotate'; deg: 90 | 180 | 270 }
  | { op: 'flip'; axis: 'h' | 'v' }
  | { op: 'grayscale'; intensity: number } // 0-1
  | { op: 'invert'; intensity: number }
  | { op: 'brightness'; value: number } // -100..100
  | { op: 'contrast'; value: number }
  | { op: 'saturate'; value: number } // -100..100
  | { op: 'blur'; radius: number } // px
  | { op: 'pixelate'; size: number } // px
  | { op: 'round'; radius: number } // px
  | { op: 'border'; width: number; color: string }
  | { op: 'sepia'; intensity: number }
  | { op: 'sharpen'; amount: number } // 0-100
  | { op: 'posterize'; levels: number }
  | { op: 'threshold'; level: number }

export function applyOps(src: HTMLCanvasElement, ops: ImageOp[]): HTMLCanvasElement {
  let c = src
  for (const o of ops) c = applyOne(c, o)
  return c
}

function newCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return [c, c.getContext('2d')!]
}

function applyOne(src: HTMLCanvasElement, o: ImageOp): HTMLCanvasElement {
  switch (o.op) {
    case 'resize': {
      const [c, ctx] = newCanvas(o.width, o.height)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      if (o.mode === 'cover') {
        const r = Math.max(o.width / src.width, o.height / src.height)
        const w = src.width * r
        const h = src.height * r
        ctx.drawImage(src, (o.width - w) / 2, (o.height - h) / 2, w, h)
      } else if (o.mode === 'fit') {
        const r = Math.min(o.width / src.width, o.height / src.height)
        const w = src.width * r
        const h = src.height * r
        ctx.drawImage(src, (o.width - w) / 2, (o.height - h) / 2, w, h)
      } else {
        ctx.drawImage(src, 0, 0, o.width, o.height)
      }
      return c
    }
    case 'rotate': {
      const swap = o.deg === 90 || o.deg === 270
      const [c, ctx] = newCanvas(swap ? src.height : src.width, swap ? src.width : src.height)
      ctx.translate(c.width / 2, c.height / 2)
      ctx.rotate((o.deg * Math.PI) / 180)
      ctx.drawImage(src, -src.width / 2, -src.height / 2)
      return c
    }
    case 'flip': {
      const [c, ctx] = newCanvas(src.width, src.height)
      if (o.axis === 'h') {
        ctx.translate(c.width, 0)
        ctx.scale(-1, 1)
      } else {
        ctx.translate(0, c.height)
        ctx.scale(1, -1)
      }
      ctx.drawImage(src, 0, 0)
      return c
    }
    case 'round': {
      const [c, ctx] = newCanvas(src.width, src.height)
      const r = Math.min(o.radius, c.width / 2, c.height / 2)
      ctx.beginPath()
      ctx.moveTo(r, 0)
      ctx.arcTo(c.width, 0, c.width, c.height, r)
      ctx.arcTo(c.width, c.height, 0, c.height, r)
      ctx.arcTo(0, c.height, 0, 0, r)
      ctx.arcTo(0, 0, c.width, 0, r)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(src, 0, 0)
      return c
    }
    case 'border': {
      const [c, ctx] = newCanvas(src.width + o.width * 2, src.height + o.width * 2)
      ctx.fillStyle = o.color
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(src, o.width, o.width)
      return c
    }
    case 'pixelate': {
      const s = Math.max(2, o.size)
      const smallW = Math.max(1, Math.floor(src.width / s))
      const smallH = Math.max(1, Math.floor(src.height / s))
      const [small] = [smallW, smallH]
      const t = document.createElement('canvas')
      t.width = small
      t.height = smallH
      const tctx = t.getContext('2d')!
      tctx.imageSmoothingEnabled = false
      tctx.drawImage(src, 0, 0, small, smallH)
      const [c, ctx] = newCanvas(src.width, src.height)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(t, 0, 0, c.width, c.height)
      return c
    }
    case 'blur': {
      const [c, ctx] = newCanvas(src.width, src.height)
      ctx.filter = `blur(${o.radius}px)`
      ctx.drawImage(src, 0, 0)
      ctx.filter = 'none'
      return c
    }
    case 'sharpen': {
      const ctx0 = src.getContext('2d')!
      const id = ctx0.getImageData(0, 0, src.width, src.height)
      const a = o.amount / 100
      // 卷积核：锐化
      const k = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]
      const out = convolve(id, src.width, src.height, k)
      const [c, ctx] = newCanvas(src.width, src.height)
      ctx.putImageData(out, 0, 0)
      return c
    }
    case 'grayscale':
    case 'invert':
    case 'brightness':
    case 'contrast':
    case 'saturate':
    case 'sepia':
    case 'posterize':
    case 'threshold': {
      const ctx0 = src.getContext('2d')!
      const id = ctx0.getImageData(0, 0, src.width, src.height)
      pixelOp(id.data, o)
      const [c, ctx] = newCanvas(src.width, src.height)
      ctx.putImageData(id, 0, 0)
      return c
    }
  }
}

function pixelOp(d: Uint8ClampedArray, o: ImageOp): void {
  if (o.op === 'grayscale' || o.op === 'invert' || o.op === 'sepia') {
    const k = o.intensity
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      if (o.op === 'grayscale') {
        const v = 0.299 * r + 0.587 * g + 0.114 * b
        d[i] = r + (v - r) * k
        d[i + 1] = g + (v - g) * k
        d[i + 2] = b + (v - b) * k
      } else if (o.op === 'invert') {
        d[i] = r + (255 - r - r) * 0 + (255 - 2 * r) * k + r - r // 简化：线性混合
        d[i] = r * (1 - k) + (255 - r) * k
        d[i + 1] = g * (1 - k) + (255 - g) * k
        d[i + 2] = b * (1 - k) + (255 - b) * k
      } else {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b
        const sg = 0.349 * r + 0.686 * g + 0.168 * b
        const sb = 0.272 * r + 0.534 * g + 0.131 * b
        d[i] = r + (Math.min(255, sr) - r) * k
        d[i + 1] = g + (Math.min(255, sg) - g) * k
        d[i + 2] = b + (Math.min(255, sb) - b) * k
      }
    }
    return
  }
  if (o.op === 'brightness') {
    const t = (o.value / 100) * 255
    for (let i = 0; i < d.length; i += 4) {
      d[i] += t; d[i + 1] += t; d[i + 2] += t
    }
    return
  }
  if (o.op === 'contrast') {
    const f = (259 * (o.value * 2.55 + 255)) / (255 * (259 - o.value * 2.55))
    for (let i = 0; i < d.length; i += 4) {
      d[i] = f * (d[i] - 128) + 128
      d[i + 1] = f * (d[i + 1] - 128) + 128
      d[i + 2] = f * (d[i + 2] - 128) + 128
    }
    return
  }
  if (o.op === 'saturate') {
    const s = 1 + o.value / 100
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = lum + (d[i] - lum) * s
      d[i + 1] = lum + (d[i + 1] - lum) * s
      d[i + 2] = lum + (d[i + 2] - lum) * s
    }
    return
  }
  if (o.op === 'posterize') {
    const n = Math.max(2, o.levels)
    const step = 255 / (n - 1)
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / step) * step
      d[i + 1] = Math.round(d[i + 1] / step) * step
      d[i + 2] = Math.round(d[i + 2] / step) * step
    }
    return
  }
  if (o.op === 'threshold') {
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const w = v >= o.level ? 255 : 0
      d[i] = d[i + 1] = d[i + 2] = w
    }
  }
}

/** 3x3 卷积 */
function convolve(id: ImageData, w: number, h: number, k: number[]): ImageData {
  const src = id.data
  const out = new ImageData(w, h)
  const dst = out.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const yy = Math.min(h - 1, Math.max(0, y + ky))
          const xx = Math.min(w - 1, Math.max(0, x + kx))
          const i = (yy * w + xx) * 4
          const wgt = k[(ky + 1) * 3 + (kx + 1)]
          r += src[i] * wgt
          g += src[i + 1] * wgt
          b += src[i + 2] * wgt
        }
      }
      const oi = (y * w + x) * 4
      dst[oi] = r
      dst[oi + 1] = g
      dst[oi + 2] = b
      dst[oi + 3] = src[oi + 3]
    }
  }
  return out
}

/* ---------------- 常用复合操作 ---------------- */

/** 在画布上绘制文字水印 */
export function drawWatermark(
  c: HTMLCanvasElement,
  text: string,
  opts: { position?: string; size?: number; color?: string; opacity?: number; rotate?: boolean } = {},
): HTMLCanvasElement {
  const [out, ctx] = newCanvas(c.width, c.height)
  ctx.drawImage(c, 0, 0)
  const size = opts.size ?? Math.max(18, Math.round(c.width / 24))
  ctx.font = `600 ${size}px sans-serif`
  ctx.fillStyle = opts.color ?? '#ffffff'
  ctx.globalAlpha = opts.opacity ?? 0.6
  const m = ctx.measureText(text)
  const pad = size
  const pos = opts.position ?? 'center'
  let x: number, y: number
  if (opts.rotate) {
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate(-Math.PI / 6)
    x = -m.width / 2
    y = size / 2
  } else {
    x = pos.includes('right') ? c.width - m.width - pad : pos.includes('left') ? pad : (c.width - m.width) / 2
    y = pos.includes('top') ? pad + size : pos.includes('bottom') ? c.height - pad : c.height / 2 + size / 3
  }
  ctx.fillText(text, x, y)
  ctx.globalAlpha = 1
  return out
}

/** 圆形裁剪 */
export function circleCrop(src: HTMLCanvasElement): HTMLCanvasElement {
  const s = Math.min(src.width, src.height)
  const [c, ctx] = newCanvas(s, s)
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, s, s)
  return c
}

/** 九宫格切分 */
export function splitGrid(src: HTMLCanvasElement, rows: number, cols: number): HTMLCanvasElement[] {
  const w = Math.floor(src.width / cols)
  const h = Math.floor(src.height / rows)
  const out: HTMLCanvasElement[] = []
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const [c, ctx] = newCanvas(w, h)
      ctx.drawImage(src, col * w, r * h, w, h, 0, 0, w, h)
      out.push(c)
    }
  }
  return out
}

/** 网格拼图 */
export function collage(
  canvases: HTMLCanvasElement[],
  cols: number,
  gap: number,
  bg: string,
): HTMLCanvasElement {
  const n = canvases.length
  const rows = Math.ceil(n / cols)
  const cw = Math.min(...canvases.map((c) => c.width))
  const ch = Math.min(...canvases.map((c) => c.height))
  const [c, ctx] = newCanvas(cols * cw + (cols + 1) * gap, rows * ch + (rows + 1) * gap)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, c.width, c.height)
  canvases.forEach((src, i) => {
    const r = Math.floor(i / cols)
    const col = i % cols
    ctx.drawImage(src, gap + col * (cw + gap), gap + r * (ch + gap), cw, ch)
  })
  return c
}

/** 图片叠加（logo / 第二张图） */
export function overlay(
  base: HTMLCanvasElement,
  top: HTMLCanvasElement,
  opts: { x?: number; y?: number; scale?: number; opacity?: number; position?: string },
): HTMLCanvasElement {
  const [c, ctx] = newCanvas(base.width, base.height)
  ctx.drawImage(base, 0, 0)
  const scale = opts.scale ?? 0.25
  const w = top.width * scale
  const h = top.height * scale
  const pos = opts.position ?? 'bottom-right'
  const pad = Math.round(Math.min(c.width, c.height) * 0.04)
  let x = c.width - w - pad, y = c.height - h - pad
  if (pos.includes('top')) y = pad
  if (pos.includes('left')) x = pad
  if (pos.includes('center') && !pos.includes('-')) {
    x = (c.width - w) / 2
    y = (c.height - h) / 2
  }
  if (opts.x !== undefined) x = opts.x
  if (opts.y !== undefined) y = opts.y
  ctx.globalAlpha = opts.opacity ?? 1
  ctx.drawImage(top, x, y, w, h)
  ctx.globalAlpha = 1
  return c
}

/* ---------------- ICO 编码 ---------------- */

/** 生成多尺寸 ICO（含 BMP 内嵌帧） */
export async function encodeIco(canvas: HTMLCanvasElement, sizes: number[]): Promise<Blob> {
  const frames: { size: number; data: Uint8Array }[] = []
  for (const s of sizes) {
    const [c] = (() => {
      const cc = document.createElement('canvas')
      cc.width = s
      cc.height = s
      const cx = cc.getContext('2d')!
      cx.imageSmoothingQuality = 'high'
      cx.drawImage(canvas, 0, 0, s, s)
      return [cc]
    })()
    const id = c.getContext('2d')!.getImageData(0, 0, s, s)
    frames.push({ size: s, data: new Uint8Array(id.data.buffer) })
  }
  const headerSize = 6 + frames.length * 16
  let dataSize = 0
  for (const f of frames) dataSize += f.size * f.size * 4 + 40
  const buf = new ArrayBuffer(headerSize + dataSize)
  const v = new DataView(buf)
  v.setUint16(0, 0, true)
  v.setUint16(2, 1, true)
  v.setUint16(4, frames.length, true)
  let offset = headerSize
  frames.forEach((f, i) => {
    const e = 6 + i * 16
    v.setUint8(e, f.size >= 256 ? 0 : f.size)
    v.setUint8(e + 1, f.size >= 256 ? 0 : f.size)
    v.setUint8(e + 2, 0)
    v.setUint8(e + 3, 0)
    v.setUint16(e + 4, 1, true)
    v.setUint16(e + 6, 32, true)
    v.setUint32(e + 8, f.size * f.size * 4 + 40, true)
    v.setUint32(e + 12, offset, true)
    // BITMAPINFOHEADER（高度加倍表示含 AND mask）
    const dv = new DataView(buf, offset, 40)
    dv.setUint32(0, 40, true)
    dv.setInt32(4, f.size, true)
    dv.setInt32(8, f.size * 2, true)
    dv.setUint16(12, 1, true)
    dv.setUint16(14, 32, true)
    // BGRA 像素（自底向上）
    const px = new Uint8Array(buf, offset + 40, f.size * f.size * 4)
    for (let y = f.size - 1; y >= 0; y--) {
      for (let x = 0; x < f.size; x++) {
        const si = (y * f.size + x) * 4
        const di = ((f.size - 1 - y) * f.size + x) * 4
        px[di] = f.data[si + 2]
        px[di + 1] = f.data[si + 1]
        px[di + 2] = f.data[si]
        px[di + 3] = f.data[si + 3]
      }
    }
    offset += f.size * f.size * 4 + 40
  })
  return new Blob([buf], { type: 'image/x-icon' })
}

/* ---------------- GIF 编码（懒加载 gifenc） ---------------- */

export async function encodeGif(
  canvases: HTMLCanvasElement[],
  delayMs = 200,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const enc = GIFEncoder()
  const w = canvases[0].width
  const h = canvases[0].height
  for (let i = 0; i < canvases.length; i++) {
    const ctx = canvases[i].getContext('2d')!
    const id = ctx.getImageData(0, 0, w, h)
    const palette = quantize(id.data, 256)
    const index = applyPalette(id.data, palette)
    enc.writeFrame(index, w, h, { palette, delay: delayMs })
    onProgress?.((i + 1) / canvases.length)
  }
  enc.finish()
  return new Blob([enc.bytes()], { type: 'image/gif' })
}

/* ---------------- 调色板提取（中位切分） ---------------- */

export function paletteFrom(canvas: HTMLCanvasElement, count = 6): { hex: string; ratio: number }[] {
  const ctx = canvas.getContext('2d')!
  const s = Math.min(canvas.width, 200)
  const scale = s / canvas.width
  const t = document.createElement('canvas')
  t.width = s
  t.height = Math.max(1, Math.round(canvas.height * scale))
  t.getContext('2d')!.drawImage(canvas, 0, 0, t.width, t.height)
  const d = t.getContext('2d')!.getImageData(0, 0, t.width, t.height).data
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue
    const key = `${d[i] >> 4}-${d[i + 1] >> 4}-${d[i + 2] >> 4}`
    const b = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; b.n++
    buckets.set(key, b)
  }
  const total = [...buckets.values()].reduce((s2, b) => s2 + b.n, 0) || 1
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((b) => ({
      hex: rgbToHex(Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)),
      ratio: b.n / total,
    }))
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const f = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(f, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/* ---------------- ASCII 艺术字 ---------------- */

export function asciiFrom(
  canvas: HTMLCanvasElement,
  cols = 80,
  charset = ' .:-=+*#%@',
): string {
  const ratio = canvas.height / canvas.width
  const rows = Math.max(1, Math.round(cols * ratio * 0.5))
  const t = document.createElement('canvas')
  t.width = cols
  t.height = rows
  const ctx = t.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, cols, rows)
  const d = ctx.getImageData(0, 0, cols, rows).data
  const lines: string[] = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const idx = Math.floor(((255 - lum) / 255) * (charset.length - 1))
      line += charset[idx]
    }
    lines.push(line)
  }
  return lines.join('\n')
}

/* ---------------- EXIF ---------------- */

export interface ExifData {
  tag: string
  value: string
}

/** 读取 EXIF（JPEG 为主；PNG/WebP 通常无 EXIF） */
export async function readExif(file: File | Blob): Promise<ExifData[]> {
  const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer())
  const TAGS: Record<number, string> = {
    0x010f: '相机厂商', 0x0110: '相机型号', 0x0112: '方向', 0x0132: '修改时间',
    0x8298: '版权', 0x829a: '曝光时间', 0x829d: '光圈值', 0x8827: 'ISO 感光度',
    0x9003: '拍摄时间', 0x9004: '数字化时间', 0x920a: '焦距', 0xa002: '图像宽度',
    0xa003: '图像高度', 0x8822: '曝光程序', 0x9209: '闪光灯', 0xa405: '焦距(35mm)',
    0x010e: '图片描述', 0x013b: '作者', 0x8769: 'EXIF 详情',
  }
  const GPS_TAGS: Record<number, string> = { 1: 'GPS 纬度参考', 2: 'GPS 纬度', 3: 'GPS 经度参考', 4: 'GPS 经度', 6: 'GPS 海拔' }
  const out: ExifData[] = []
  // JPEG SOI + APP1
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return out
  let i = 2
  while (i < buf.length - 4) {
    if (buf[i] !== 0xff) { i++; continue }
    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
    const len = (buf[i + 2] << 8) | buf[i + 3]
    if (marker === 0xe1) {
      // 检查 Exif\0\0
      const sig = 'Exif\0\0'
      let ok = true
      for (let k = 0; k < sig.length; k++) if (buf[i + 4 + k] !== sig.charCodeAt(k)) ok = false
      if (ok) {
        parseTiff(buf, i + 10, TAGS, GPS_TAGS, out)
        break
      }
    }
    if (marker === 0xda) break // SOS
    i += 2 + len
  }
  return out
}

function parseTiff(
  buf: Uint8Array,
  base: number,
  TAGS: Record<number, string>,
  GPS_TAGS: Record<number, string>,
  out: ExifData[],
): void {
  try {
    const le = buf[base] === 0x49
    const v = (o: number, s = 4) => {
      if (le) return s === 2 ? buf[base + o] | (buf[base + o + 1] << 8) : buf[base + o] | (buf[base + o + 1] << 8) | (buf[base + o + 2] << 16) | (buf[base + o + 3] << 24)
      return s === 2 ? (buf[base + o] << 8) | buf[base + o + 1] : (buf[base + o] << 24) | (buf[base + o + 1] << 16) | (buf[base + o + 2] << 8) | buf[base + o + 3]
    }
    const ifd0 = v(4)
    const readIfd = (off: number, tags: Record<number, string>, gps = false) => {
      const n = v(off, 2)
      for (let k = 0; k < n; k++) {
        const e = off + 2 + k * 12
        const tag = v(e, 2)
        const type = v(e + 2, 2)
        const cnt = v(e + 4)
        const valOff = cnt * (type === 2 ? 1 : type === 3 ? 2 : 4) <= 4 ? e + 8 : base + v(e + 8)
        const name = tags[tag]
        if (!name) continue
        if (gps) {
          out.push({ tag: name, value: `${v(e + 8)}（原始值）` })
          continue
        }
        if (type === 2) {
          let s = ''
          for (let c = 0; c < cnt - 1 && valOff + c < buf.length; c++) s += String.fromCharCode(buf[valOff + c])
          out.push({ tag: name, value: s })
        } else if (type === 3) {
          out.push({ tag: name, value: String(v(valOff - base, 2)) })
        } else {
          out.push({ tag: name, value: String(v(valOff - base)) })
        }
      }
    }
    readIfd(ifd0, TAGS)
    // GPS IFD
    const n0 = v(ifd0, 2)
    for (let k = 0; k < n0; k++) {
      const e = ifd0 + 2 + k * 12
      if (v(e, 2) === 0x8825) {
        readIfd(base + v(e + 8), GPS_TAGS, true)
      }
    }
  } catch {
    /* EXIF 解析失败时静默返回已解析部分 */
  }
}

/** 用 Canvas 重编码去除全部元数据 */
export async function stripExif(file: File | Blob, mime = 'image/jpeg', quality = 0.92): Promise<Blob> {
  const canvas = await decodeToCanvas(file)
  return canvasToBlob(canvas, mime, quality)
}
