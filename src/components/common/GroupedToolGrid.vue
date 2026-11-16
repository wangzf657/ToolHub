<script setup lang="ts">
/**
 * 全宽分组目录网格(V1.1 R3-a):/tools 与 12 个分类页共用的目录形态——
 * 按「菜单大类(或数据分类)→ 领域族 → 工具」分组,排序与工作台菜单同源(menuGroups + 注册表序),
 * 去卡片孤岛感:族小标题 + 紧凑网格。filter 非空时就地过滤(工具口径复用 SearchModal,族名命中显示整族)。
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { menuTree } from '@/data/menuTree'
import { menuGroups, groupOf } from '@/data/menuGroups'
import { allTools } from '@/tools'
import type { ToolDef } from '@/types'
import type { CategoryId } from '@/types'

const props = defineProps<{
  /** menu = 按 6 菜单大类分组(/tools);category = 按单个数据分类的领域族分组(分类页) */
  scope: 'menu' | 'category'
  categoryId?: CategoryId
  /** scope=menu 时聚焦单个菜单大类(/tools?cat= 入口) */
  onlyCat?: string
  filter?: string
}>()

interface GridGroup {
  id: string
  name: string
  tools: ToolDef[]
}
interface GridSection {
  id: string
  name: string
  count: number
  groups: GridGroup[]
}

const q = computed(() => (props.filter ?? '').trim().toLowerCase())

function matchTool(t: ToolDef) {
  if (!q.value) return true
  return (
    t.title.toLowerCase().includes(q.value) ||
    t.slug.includes(q.value) ||
    (t.keywords ?? []).some((k) => k.toLowerCase().includes(q.value))
  )
}

/** 数据分类 → 其领域族分组(组序 = menuGroups 数组序,组内 = 注册表数组序,与菜单同源) */
function sectionsForCategory(cid: CategoryId): GridSection[] {
  const toolsInCat = allTools.filter((t) => t.category === cid)
  const groups: GridGroup[] = menuGroups
    .filter((def) => def.category === cid)
    .map((def) => {
      const full = toolsInCat.filter((t) => groupOf[t.slug] === def.id)
      // 族名命中显示整族;否则仅保留命中工具
      const groupHit = Boolean(q.value) && def.name.toLowerCase().includes(q.value)
      return { id: def.id, name: def.name, tools: groupHit ? full : full.filter(matchTool) }
    })
    .filter((g) => g.tools.length > 0)
  return [{ id: `cat-${cid}`, name: '', count: groups.reduce((n, g) => n + g.tools.length, 0), groups }]
}

const sections = computed<GridSection[]>(() => {
  if (props.scope === 'category' && props.categoryId) return sectionsForCategory(props.categoryId)
  const tree = props.onlyCat ? menuTree.filter((c) => c.cat.id === props.onlyCat) : menuTree
  return tree.map((c) => {
    const groups = c.groups
      .map((g) => {
        const def = g.group
        const groupHit = q.value && def.name.toLowerCase().includes(q.value)
        const tools = groupHit ? g.tools : g.tools.filter(matchTool)
        return { id: def.id, name: def.name, tools }
      })
      .filter((g) => g.tools.length > 0)
    return { id: c.cat.id, name: c.cat.name, count: groups.reduce((n, g) => n + g.tools.length, 0), groups }
  })
})

const total = computed(() => sections.value.reduce((n, s) => n + s.count, 0))
const hasMatch = computed(() => total.value > 0)
defineExpose({ total, hasMatch })
</script>

<template>
  <div class="gt-grid">
    <section v-for="s in sections" :key="s.id" class="gt-section">
      <h2 v-if="s.name" class="gt-cat">
        {{ s.name }}
        <span class="gt-cat-count">{{ s.count }}</span>
      </h2>
      <div v-for="g in s.groups" :key="g.id" class="gt-group" :id="`dir-${g.id}`">
        <h3 class="gt-group-title">
          {{ g.name }}<span class="gt-group-count">{{ g.tools.length }}</span>
        </h3>
        <div class="gt-tools">
          <RouterLink v-for="t in g.tools" :key="t.slug" :to="`/t/${t.slug}`" class="gt-tool" :title="t.desc">
            <span class="gt-tool-name">{{ t.title }}</span>
            <span class="gt-tool-desc">{{ t.desc }}</span>
          </RouterLink>
        </div>
      </div>
    </section>
    <p v-if="!hasMatch" class="gt-empty">没有匹配的工具。</p>
  </div>
</template>

<style scoped>
.gt-cat {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 19px;
  margin: 30px 0 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.gt-section:first-child .gt-cat {
  margin-top: 6px;
}
.gt-cat-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}
.gt-group-title {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-size: 13.5px;
  color: var(--text-2);
  margin: 16px 0 8px;
}
.gt-group-count {
  font-size: 11px;
  color: var(--text-3);
}
.gt-tools {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 8px;
}
.gt-tool {
  display: grid;
  gap: 2px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--panel);
  min-width: 0;
  text-decoration: none !important;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.gt-tool:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  background: var(--panel-hover);
}
.gt-tool-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gt-tool-desc {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gt-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--text-3);
}
@media (max-width: 480px) {
  .gt-tools {
    grid-template-columns: 1fr;
  }
}
</style>
