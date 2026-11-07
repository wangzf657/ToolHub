<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { HTTP_STATUS } from '@/lib/jsEngine'

const query = ref('')
const openGroups = ref<Set<string>>(new Set(['2xx', '4xx']))

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const GROUPS = [
  { id: '1xx', label: '1xx 信息响应', color: '#818cf8' },
  { id: '2xx', label: '2xx 成功', color: '#34d399' },
  { id: '3xx', label: '3xx 重定向', color: '#fbbf24' },
  { id: '4xx', label: '4xx 客户端错误', color: '#fb923c' },
  { id: '5xx', label: '5xx 服务器错误', color: '#f87171' },
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const all = HTTP_STATUS.map((s) => {
    const hit =
      !q ||
      String(s.code).includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q)
    let name = s.name
    let desc = s.desc
    let codeText = String(s.code)
    if (q && hit) {
      const wrap = (t: string) => escapeHtml(t).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`)
      name = wrap(s.name)
      desc = wrap(s.desc)
      codeText = wrap(codeText)
    } else {
      name = escapeHtml(name)
      desc = escapeHtml(desc)
    }
    return { ...s, hit, nameHtml: name, descHtml: desc, codeHtml: codeText }
  })
  return GROUPS.map((g) => ({ ...g, items: all.filter((s) => s.hit && String(s.code)[0] === g.id[0]) }))
})

const toggle = (id: string) => {
  const s = new Set(openGroups.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  openGroups.value = s
}

const expandAll = (open: boolean) => {
  openGroups.value = new Set(open ? GROUPS.map((g) => g.id) : [])
}

const total = computed(() => filtered.value.reduce((n, g) => n + g.items.length, 0))
</script>

<template>
  <div class="http-codes">
    <div class="row" style="gap: 8px">
      <div class="grow" style="position: relative">
        <Search :size="15" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3)" />
        <input v-model="query" type="text" class="input" style="padding-left: 36px" placeholder="搜索状态码、英文名或场景说明（如 404、redirect、超时）" />
      </div>
      <button class="btn btn-ghost btn-sm" @click="expandAll(true)">全部展开</button>
      <button class="btn btn-ghost btn-sm" @click="expandAll(false)">全部折叠</button>
    </div>

    <p class="small muted mt-1" style="margin-left: 2px">共 {{ total }} 条匹配（总库 {{ HTTP_STATUS.length }} 条）</p>

    <div class="mt-2 groups">
      <section v-for="g in filtered" :key="g.id" class="group">
        <button class="g-head" :class="{ open: openGroups.has(g.id) }" @click="toggle(g.id)">
          <ChevronRight v-if="!openGroups.has(g.id)" :size="16" />
          <ChevronDown v-else :size="16" />
          <span class="g-dot" :style="{ background: g.color }"></span>
          <b>{{ g.label }}</b>
          <span class="muted small">{{ g.items.length }} 条</span>
        </button>
        <div v-if="openGroups.has(g.id)" class="g-body">
          <div v-for="s in g.items" :key="s.code" class="code-row">
            <code class="code-num mono" v-html="s.codeHtml"></code>
            <div class="code-main">
              <b class="code-name" v-html="s.nameHtml"></b>
              <p class="code-desc" v-html="s.descHtml"></p>
            </div>
          </div>
          <p v-if="!g.items.length" class="muted small" style="padding: 6px 12px 10px">无匹配项</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.groups {
  display: grid;
  gap: 10px;
}
.group {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.g-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: none;
  background: none;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.g-head:hover {
  background: var(--accent-soft);
}
.g-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}
.g-body {
  border-top: 1px solid var(--border);
  display: grid;
}
.code-row {
  display: flex;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.code-row:last-child {
  border-bottom: none;
}
.code-num {
  flex: none;
  width: 48px;
  font-size: 15px;
  font-weight: 700;
  color: var(--accent-text);
}
.code-main {
  min-width: 0;
}
.code-name {
  font-size: 13.5px;
  display: block;
}
.code-desc {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}
.code-row :deep(mark),
.code-name :deep(mark) {
  background: rgba(251, 191, 36, 0.35);
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
}
</style>
