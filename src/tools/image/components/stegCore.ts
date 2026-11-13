/**
 * 隐写核心（Steganography 专用，UX1.0）：
 * LSB 逐位写入 R/G/B 通道；头部 8 字节 = 魔数（STG1 文本 / STG3 文本+口令 / STG2 图片载荷 / STG4 图片+口令）+ uint32 长度。
 * 口令以重复异或流作用于正文；错误口令解出乱码而不抛异常。
 */
export const MAGIC_TEXT = [0x53, 0x54, 0x47, 0x31] // STG1
export const MAGIC_TEXT_X = [0x53, 0x54, 0x47, 0x33] // STG3
export const MAGIC_FILE = [0x53, 0x54, 0x47, 0x32] // STG2
export const MAGIC_FILE_X = [0x53, 0x54, 0x47, 0x34] // STG4

/** 理论容量（字节）：每像素 R/G/B 各 1 位，扣除 8 字节头 */
export function capacityOf(w: number, h: number): number {
  return Math.max(0, Math.floor((w * h * 3) / 8) - 8)
}

function bitIndex(i: number): number {
  return ((i / 3) | 0) * 4 + (i % 3)
}

/** 从 startBit 起写入 bytes（可先经口令异或） */
export function embedBytes(d: Uint8ClampedArray, bytes: Uint8Array, startBit: number, key?: Uint8Array): void {
  let bit = startBit
  for (let k = 0; k < bytes.length; k++) {
    const plain = key && key.length ? bytes[k]! ^ key[k % key.length]! : bytes[k]!
    for (let b = 7; b >= 0; b--) {
      d[bitIndex(bit)] = (d[bitIndex(bit)]! & 0xfe) | ((plain >> b) & 1)
      bit++
    }
  }
}

/** 从 startBit 起读取 count 字节（口令异或还原） */
export function extractBytes(d: Uint8ClampedArray, startBit: number, count: number, key?: Uint8Array): Uint8Array {
  const out = new Uint8Array(count)
  let bit = startBit
  for (let k = 0; k < count; k++) {
    let byte = 0
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (d[bitIndex(bit)]! & 1)
      bit++
    }
    out[k] = key && key.length ? byte ^ key[k % key.length]! : byte
  }
  return out
}

export function keyBytes(password: string): Uint8Array | undefined {
  const s = password.trim()
  if (!s) return undefined
  return new TextEncoder().encode(s)
}

/** 差异可视化：|out − src| × 8 灰度（rx2） */
export function diffCanvas(src: HTMLCanvasElement, out: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  const a = src.getContext('2d')!.getImageData(0, 0, src.width, src.height)
  const b = out.getContext('2d')!.getImageData(0, 0, out.width, out.height)
  const d = a.data
  for (let i = 0; i < d.length; i += 4) {
    const diff = Math.min(
      255,
      (Math.abs(d[i]! - b.data[i]!) + Math.abs(d[i + 1]! - b.data[i + 1]!) + Math.abs(d[i + 2]! - b.data[i + 2]!)) * 8,
    )
    d[i] = d[i + 1] = d[i + 2] = diff
    d[i + 3] = 255
  }
  ctx.putImageData(a, 0, 0)
  return c
}
