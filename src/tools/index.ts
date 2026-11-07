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

/** 热门工具（首页展示） */
export const popularSlugs = [
  'restore-old-photo',
  'add-subtitles-to-video',
  'compress-pdf',
  'remove-background',
  'compress-video',
  'colorize-photo',
  'unlock-pdf',
  'audio-transcribe',
]
export const popularTools = popularSlugs
  .map((s) => toolMap.get(s))
  .filter((t): t is ToolDef => Boolean(t))
