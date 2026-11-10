/** 工具注册中枢：聚合所有分类注册表 */
import type { ToolDef } from '@/types'

import image from './image/registry'
import video from './video/registry'
import audio from './audio/registry'
import pdf from './pdf/registry'
import data from './data/registry'
import utility from './utility/registry'
import developer from './developer/registry'
import finance from './finance/registry'
import business from './business/registry'
import seo from './seo/registry'
import ai from './ai/registry'
import editors from './editors/registry'

export const allTools: ToolDef[] = [
  ...image,
  ...video,
  ...audio,
  ...pdf,
  ...data,
  ...utility,
  ...developer,
  ...finance,
  ...business,
  ...seo,
  ...ai,
  ...editors,
]

export const toolMap = new Map(allTools.map((t) => [t.slug, t]))

export function toolsByCategory(category: string): ToolDef[] {
  return allTools.filter((t) => t.category === category)
}

/** 编辑器工作室（首页编辑器区展示） */
export const studioTools = allTools.filter((t) => t.studio)

/** 热门工具（首页展示，按曝光优先级排序：高频刚需 + 端侧旗舰，轻重搭配） */
export const popularSlugs = [
  'compress-pdf',
  'merge-pdf',
  'remove-background',
  'ocr',
  'pdf-to-word',
  'passport-photo',
  'compress-video',
  'json-formatter',
  'qr-code-generator',
  'income-tax-calculator',
  'word-counter',
  'merge-images-long',
  'rmb-uppercase',
  'amortization-calculator',
  'lucky-wheel',
  'typing-test',
]
export const popularTools = popularSlugs
  .map((s) => toolMap.get(s))
  .filter((t): t is ToolDef => Boolean(t))
