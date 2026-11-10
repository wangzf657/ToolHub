/** 开发工具批次补充的第三方模块类型（仅声明实际用到的面，无官方类型的模块） */

declare module 'csso' {
  /** CSS 压缩结果 */
  export interface MinifyResult {
    /** 压缩后的 CSS */
    css: string
    /** source map（本项目不用） */
    map?: unknown
  }
  export interface MinifyOptions {
    restructure?: boolean
    debug?: boolean
    filename?: string
    sourceMap?: boolean
  }
  /** 压缩 CSS（基于 css-tree） */
  export function minify(source: string, options?: MinifyOptions): MinifyResult
}

declare module 'punycode.js' {
  const punycode: {
    /** Unicode 域名 → Punycode（xn--） */
    encode(input: string): string
    /** Punycode → Unicode */
    decode(input: string): string
    /** 域名整体转 ASCII（每个 label 单独编码） */
    toASCII(domain: string): string
    /** 域名整体转 Unicode */
    toUnicode(domain: string): string
    /** 版本号 */
    version: string
  }
  export default punycode
  export const encode: typeof punycode.encode
  export const decode: typeof punycode.decode
  export const toASCII: typeof punycode.toASCII
  export const toUnicode: typeof punycode.toUnicode
}
