/** 二维码与条形码引擎 */

export interface QrOptions {
  size?: number
  margin?: number
  dark?: string
  light?: string
  errorCorrection?: 'L' | 'M' | 'Q' | 'H'
}

/** 生成二维码 Canvas（本地 qrcode 库） */
export async function makeQrCanvas(text: string, opts: QrOptions = {}): Promise<HTMLCanvasElement> {
  const QRCode = await import('qrcode')
  const c = document.createElement('canvas')
  await QRCode.toCanvas(c, text, {
    width: opts.size ?? 320,
    margin: opts.margin ?? 2,
    color: { dark: opts.dark ?? '#111827', light: opts.light ?? '#ffffff' },
    errorCorrectionLevel: opts.errorCorrection ?? 'M',
  })
  return c
}

/** 生成二维码 SVG 字符串 */
export async function makeQrSvg(text: string, opts: QrOptions = {}): Promise<string> {
  const QRCode = await import('qrcode')
  return QRCode.toString(text, {
    type: 'svg',
    width: opts.size ?? 320,
    margin: opts.margin ?? 2,
    color: { dark: opts.dark ?? '#111827', light: opts.light ?? '#ffffff' },
    errorCorrectionLevel: opts.errorCorrection ?? 'M',
  })
}

/** 识别图片中的二维码 */
export async function scanQr(file: File | Blob): Promise<string> {
  const jsQR = (await import('jsqr')).default
  const { decodeToCanvas } = await import('./imageEngine')
  const canvas = await decodeToCanvas(file)
  const ctx = canvas.getContext('2d')!
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(id.data, canvas.width, canvas.height)
  if (!code) throw new Error('未在图片中识别到二维码，请尝试更清晰的截图')
  return code.data
}

/** 条形码渲染（JsBarcode） */
export async function makeBarcode(
  canvas: HTMLCanvasElement,
  text: string,
  format: string,
  opts: { width?: number; height?: number; displayValue?: boolean } = {},
): Promise<void> {
  const JsBarcode = (await import('jsbarcode')).default
  JsBarcode(canvas, text, {
    format,
    width: opts.width ?? 2,
    height: opts.height ?? 90,
    displayValue: opts.displayValue ?? true,
    fontSize: 14,
    margin: 8,
    background: '#ffffff',
    lineColor: '#111827',
  })
}

export const BARCODE_FORMATS: { value: string; label: string }[] = [
  { value: 'CODE128', label: 'CODE128（通用）' },
  { value: 'CODE39', label: 'CODE39' },
  { value: 'EAN13', label: 'EAN-13（商品码）' },
  { value: 'EAN8', label: 'EAN-8' },
  { value: 'UPC', label: 'UPC-A' },
  { value: 'ITF14', label: 'ITF-14（物流码）' },
  { value: 'MSI', label: 'MSI' },
  { value: 'pharmacode', label: 'Pharmacode（药品码）' },
]

/** WiFi 二维码内容串 */
export function wifiPayload(opts: { ssid: string; password: string; encryption: 'WPA' | 'WEP' | 'nopass'; hidden?: boolean }): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
  const auth = opts.encryption === 'nopass' ? 'nopass' : opts.encryption
  return `WIFI:T:${auth};S:${esc(opts.ssid)};${auth !== 'nopass' ? `P:${esc(opts.password)};` : ''}${opts.hidden ? 'H:true;' : ''};`
}
