/** 全站共享类型定义 */

/** 工具分类 id */
export type CategoryId =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'data'
  | 'utility'
  | 'developer'
  | 'finance'
  | 'business'
  | 'seo'
  | 'ai'
  | 'editors'

export interface ToolDef {
  /** 全站唯一的 URL 标识，如 merge-pdf */
  slug: string
  /** 中文工具名 */
  title: string
  category: CategoryId
  /** 一句话简介（卡片/工具页用，60 字内） */
  desc: string
  /** 搜索关键词（含中英文别名） */
  keywords?: string[]
  /** 懒加载的工具面板组件（与以下内联定义二选一） */
  component?: () => Promise<unknown>
  /** 文本转换工具内联定义 */
  textDef?: TextToolDef
  /** 计算器内联定义 */
  calcDef?: CalcToolDef
  /** 通用图片格式转换配置 */
  imgcvt?: { target: 'image/png' | 'image/jpeg' | 'image/webp'; label: string; quality?: boolean; resize?: boolean }
  /** 首次使用需下载模型/编解码器时为 true（用于 UI 提示） */
  needModel?: boolean
  /** 是否为编辑器工作室（首页编辑器区展示） */
  studio?: boolean
  /** 工具页「快速指南」步骤（可选） */
  steps?: string[]
}

export interface CategoryDef {
  id: CategoryId
  /** 中文名，如 图片工具 */
  name: string
  /** 单数短名，如 图片（导航用） */
  short: string
  /** 分类描述 */
  desc: string
  /** lucide 图标名（AppIcon 使用） */
  icon: string
  /** 分类强调色（图标底色） */
  color: string
  /** 路由路径，如 /image-tools */
  path: string
}

/** 文本转换工具的可选项定义 */
export interface TextOptionDef {
  key: string
  label: string
  type: 'select' | 'toggle' | 'number' | 'text'
  default?: string | number | boolean
  /** select 的候选 */
  choices?: { value: string; label: string }[]
  placeholder?: string
}

/** 文本转换工具定义（注册在通用 TextTool 上运行） */
export interface TextToolDef {
  /** 允许返回 Promise（首次动态加载词典/词库等重依赖，TextTool 会自动等待） */
  transform: (input: string, opts: Record<string, string | number | boolean>) => string | Promise<string>
  options?: TextOptionDef[]
  /** 输入占位提示 */
  placeholder?: string
  /** 是否单行输入 */
  singleLine?: boolean
}

/** 计算器字段定义 */
export interface CalcFieldDef {
  key: string
  label: string
  type: 'number' | 'text' | 'select' | 'date' | 'check'
  default?: string | number | boolean
  choices?: { value: string; label: string }[]
  suffix?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
  hint?: string
}

/** 计算器结果行 */
export interface CalcResultRow {
  label: string
  value: string
  /** 强调展示（主结果） */
  primary?: boolean
  hint?: string
}

/** 计算器定义（注册在通用 CalcTool 上运行） */
export interface CalcToolDef {
  fields: CalcFieldDef[]
  compute: (v: Record<string, string | number | boolean>) => CalcResultRow[]
  /** 结果下方的补充说明（口径/免责） */
  note?: string
}

/** 文件选择项 */
export interface SavedItem {
  slug: string
  at: number
}
