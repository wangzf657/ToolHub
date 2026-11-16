import { computed, ref } from 'vue'
import type { ToolDef } from '@/types'
import { menuCategoryOfSlug } from '@/data/menuTree'

/** 全站搜索：中文名称 + 描述 + 关键词匹配 */
export function searchTools(allTools: ToolDef[], query: string, limit = 24): ToolDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const scored: { tool: ToolDef; score: number }[] = []
  for (const tool of allTools) {
    const title = tool.title.toLowerCase()
    const desc = tool.desc.toLowerCase()
    const keywords = (tool.keywords ?? []).join(' ').toLowerCase()
    const slug = tool.slug.toLowerCase()
    let score = 0
    for (const term of terms) {
      if (title === term) score += 100
      else if (title.includes(term)) score += 30
      if (slug.includes(term)) score += 15
      if (keywords.includes(term)) score += 12
      if (desc.includes(term)) score += 6
    }
    if (score > 0) scored.push({ tool, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.tool)
}

const open = ref(false)

export function useSearch() {
  return { searchOpen: open, openSearch: () => (open.value = true), closeSearch: () => (open.value = false) }
}

/** 全局搜索弹层状态由 App 级组件消费(分类名取菜单大类口径,与顶栏/菜单一致) */
export function searchCategoryName(slug: string): string {
  return menuCategoryOfSlug(slug)?.cat.name ?? ''
}

export const searchActive = computed(() => open.value)
