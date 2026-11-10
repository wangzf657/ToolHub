/**
 * 本批次（17 件文件格式类工具）第三方模块类型补充。
 *
 * 经逐一核对（2026-11），本批依赖均已自带或由 @types 提供类型声明，无需重复 declare module：
 * - sql.js → @types/sql.js（export = initSqlJs，动态导入 .default 类型可用）
 * - postal-mime / ag-psd / epubjs / gifuct-js / @zip.js/zip.js → 各包自带 .d.ts
 * - opentype.js → @types/opentype.js；pako → @types/pako；gifenc → src/env.d.ts 已声明
 *
 * 此处仅补充 postal-mime 解析结果的宽松形状（全局环境类型，eml-viewer.vue 直接引用）：
 * 其官方类型为 export = 命名空间形式，跨 default 类访问字段时的宽松兜底。
 */

/** postal-mime 解析出的邮箱地址 */
interface PostalMimeAddressMin {
  address?: string
  name?: string
}

/** postal-mime 解析出的附件（宽松形状，兼容官方 Attachment 的 null 字段） */
interface PostalMimeAttachmentMin {
  filename?: string | null
  mimeType?: string
  /** 附件内容（解析默认 ArrayBuffer，base64/utf8 时为 string） */
  content: Uint8Array | string | ArrayBuffer
  /** content 为 string 时的编码 */
  encoding?: 'base64' | 'utf8' | undefined
  /** Content-Disposition（attachment/inline） */
  disposition?: string | null
  /** 内联图片的 Content-ID，用于 HTML 正文引用 */
  contentId?: string
}

/** postal-mime 解析出的邮件（本项目只消费以下字段） */
interface PostalMimeEmailMin {
  from?: PostalMimeAddressMin
  to?: PostalMimeAddressMin[]
  cc?: PostalMimeAddressMin[]
  subject?: string
  date?: string
  html?: string
  text?: string
  attachments?: PostalMimeAttachmentMin[]
}
