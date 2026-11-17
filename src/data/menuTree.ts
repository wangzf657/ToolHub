/**
 * 菜单树派生层(V1.1):菜单大类 → 领域族 → 工具。
 * 归属与顺序来自 menuGroups.ts(蓝图生成,单一事实源),工具名/简介/URL 实时取自注册表——
 * 组内工具序 = 注册表数组序(reorder 后与蓝图一致),不复制第二份名录。
 */
import type { ToolDef } from '@/types'
import { allTools } from '@/tools'
import { menuCategories, menuGroups, groupOf } from '@/data/menuGroups'
import type { MenuCategoryDef, MenuGroupDef } from '@/data/menuGroups'

export interface MenuGroupNode {
  group: MenuGroupDef
  tools: ToolDef[]
  /** 锚点 id,供族索引弹层滚动定位(scrollIntoView + 闪烁高亮) */
  anchorId: string
}

export interface MenuCategoryNode {
  cat: MenuCategoryDef
  groups: MenuGroupNode[]
  /** 该类第一个工具(大类头点击的路由目标:「子工具默认路由是第一个工具」) */
  firstTool: ToolDef | undefined
  toolCount: number
}

/** 派生一次的菜单树(模块级静态数据,511 项过滤开销可忽略) */
export const menuTree: MenuCategoryNode[] = menuCategories.map((cat) => {
  const groups: MenuGroupNode[] = menuGroups
    .filter((g) => g.menuCategory === cat.id)
    .map((group) => {
      // 组内序取注册表数组序:组成员按 allTools 顺序过滤,不依赖 menuGroups 内的 slug 列表
      const tools = allTools.filter((t) => groupOf[t.slug] === group.id)
      return { group, tools, anchorId: `mgroup-${group.id}` }
    })
  const all = groups.flatMap((g) => g.tools)
  return { cat, groups, firstTool: all[0], toolCount: all.length }
})

/** 菜单大类视觉令牌(颜色/一句话简介):蓝图只管结构不管视觉,故放派生层而非生成文件 */
export const menuCatColor: Record<string, string> = {
  image: '#38bdf8',
  av: '#f472b6',
  docdata: '#f87171',
  utility: '#4ade80',
  dev: '#60a5fa',
  ai: '#c084fc',
  games: '#fb7185',
}

/** 菜单大类一句话简介(首页目录/页脚等展示位用) */
export const menuCatDesc: Record<string, string> = {
  image: '压缩、转格式、裁剪、抠图、OCR、滤镜与 GIF 制作，图片从不离开你的设备。',
  av: '视频与音频的转换、压缩、裁剪、合并、转写与降噪，全程本地处理不上传。',
  docdata: 'PDF 合并拆分加密、Office 转换、CSV/Excel 分析与 SQL 查询，文件全程留在浏览器。',
  utility: '二维码、密码生成、单位换算、各类计算器与文本处理等日常高频工具。',
  dev: 'JSON、哈希、Base64、JWT、正则测试与代码格式化等开发者常用工具。',
  ai: '端侧 AI 文本与图像工具：摘要、翻译、情感分析、OCR 与抠图，本地推理。',
  games: '数独、五子棋、贪吃蛇、2048、扫雷与数字华容道：无音效无弹窗，安静摸鱼。',
}

/** 当前工具所在菜单大类(高亮/强制展开用) */
export function menuCategoryOfSlug(slug: string): MenuCategoryNode | undefined {
  const gid = groupOf[slug]
  if (!gid) return undefined
  return menuTree.find((c) => c.groups.some((g) => g.group.id === gid))
}

/** 当前工具所在领域族(吸顶链/族高亮用) */
export function menuGroupOfSlug(slug: string): MenuGroupNode | undefined {
  for (const c of menuTree) {
    const g = c.groups.find((x) => groupOf[slug] === x.group.id)
    if (g) return g
  }
  return undefined
}
