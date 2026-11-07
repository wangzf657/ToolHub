/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare module 'heic2any' {
  const heic2any: (options: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>
  export default heic2any
}

declare module 'utif' {
  export function decode(buffer: ArrayBuffer): unknown[]
  export function decodeImage(buffer: ArrayBuffer, ifd: unknown): void
  export function toRGBA8(ifd: unknown): Uint8Array
}

declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame: (index: Uint8Array, width: number, height: number, opts: { palette: number[][]; delay?: number }) => void
    finish: () => void
    bytes: () => Uint8Array
  }
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number): number[][]
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: number[][]): Uint8Array
}

declare module '@breezystack/lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number)
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array
    flush(): Int8Array
  }
}

declare module 'jsbarcode' {
  const JsBarcode: (
    element: HTMLElement | SVGElement | HTMLCanvasElement | string,
    text: string,
    options?: Record<string, unknown>,
  ) => void
  export default JsBarcode
}

declare module 'alasql' {
  const alasql: {
    exec: (sql: string, params?: unknown[], cb?: (data: unknown) => void) => unknown[] | Promise<unknown[]>
    (sql: string, params?: unknown[]): unknown[]
  }
  export default alasql
}

declare module 'hyparquet' {
  export function parquetRead(options: {
    file: ArrayBuffer
    onBatch?: (batch: Record<string, unknown>[]) => void
    onComplete?: () => void
    rowFormat?: string
  }): void
}

declare module 'diff' {
  export interface DiffChange {
    count?: number
    value?: string
    added?: boolean
    removed?: boolean
  }
  export function diffLines(oldStr: string, newStr: string, options?: Record<string, unknown>): DiffChange[]
  export function diffWordsWithSpace(oldStr: string, newStr: string): DiffChange[]
  export function diffWords(oldStr: string, newStr: string): DiffChange[]
  export function diffChars(oldStr: string, newStr: string): DiffChange[]
}

declare module 'js-yaml' {
  export function load(text: string, opts?: unknown): unknown
  export function dump(data: unknown, opts?: unknown): string
}
