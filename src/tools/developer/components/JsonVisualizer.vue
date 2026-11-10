<script setup lang="ts">
import { provide, reactive, ref, watch } from 'vue'
import { Search, Expand, Shrink, Binary } from 'lucide-vue-next'
import JsonTreeNode from './JsonTreeNode.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const parsed = ref<unknown>(null)
const errMsg = ref('')
const keyword = ref('')
const stats = ref<{ nodes: number; depth: number; keys: number } | null>(null)

/** 全站展开状态：路径集合（默认展开前两层） */
const expanded = reactive(new Set<string>())
provide('jsonTreeExp', {
  has: (p: string) => expanded.has(p) || p === '',
  toggle: (p: string) => (expanded.has(p) ? expanded.delete(p) : expanded.add(p)),
})

let timer: number | null = null
watch(input, () => {
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(doParse, 250)
})

/** 统计节点数/深度/键数 */
function measure(v: unknown, depth: number, acc: { nodes: number; depth: number; keys: number }) {
  acc.nodes++
  acc.depth = Math.max(acc.depth, depth)
  if (Array.isArray(v)) {
    for (const x of v) measure(x, depth + 1, acc)
  } else if (v !== null && typeof v === 'object') {
    for (const [, x] of Object.entries(v as Record<string, unknown>)) {
      acc.keys++
      measure(x, depth + 1, acc)
    }
  }
}

/** 收集命中关键词的祖先路径，自动展开 */
function collectHitPaths(v: unknown, path: string, kw: string, out: string[]) {
  const hit = (s: string) => s.toLowerCase().includes(kw)
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      const p = `${path}[${i}]`
      if (hit(JSON.stringify(x) ?? '')) out.push(path, p)
      collectHitPaths(x, p, kw, out)
    })
  } else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const p = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? (path ? `${path}.${k}` : k) : `${path}[${JSON.stringify(k)}]`
      if (hit(k) || hit(JSON.stringify(x) ?? '')) out.push(path, p)
      collectHitPaths(x, p, kw, out)
    }
  }
}

const doParse = () => {
  errMsg.value = ''
  stats.value = null
  expanded.clear()
  parsed.value = null
  const t = input.value.trim()
  if (!t) return
  try {
    const data = JSON.parse(t)
    parsed.value = data
    // 默认展开根与前两层
    expanded.add('')
    const root = data
    const childPaths: string[] = []
    const walk = (v: unknown, path: string, depth: number) => {
      if (depth >= 2) return
      if (Array.isArray(v)) v.forEach((x, i) => { const p = `${path}[${i}]`; childPaths.push(p); walk(x, p, depth + 1) })
      else if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) { const p = `${path ? path + '.' : ''}${k}`; childPaths.push(p); walk(x, p, depth + 1) }
    }
    walk(root, '', 0)
    for (const p of childPaths) expanded.add(p)
    const acc = { nodes: 0, depth: 0, keys: 0 }
    measure(data, 0, acc)
    stats.value = acc
    if (acc.nodes > 50000) toast.warn('JSON 规模较大（超过 5 万节点），已按懒展开渲染，展开深层节点可能稍慢')
  } catch (e) {
    errMsg.value = `JSON 解析失败：${(e as Error).message}`
  }
}

watch(keyword, (kw) => {
  if (!parsed.value) return
  const k = kw.trim().toLowerCase()
  if (!k) return
  const hits: string[] = []
  collectHitPaths(parsed.value, '', k, hits)
  for (const p of hits) expanded.add(p)
})

const expandAll = () => {
  if (!parsed.value) return
  const acc = { nodes: 0, depth: 0, keys: 0 }
  measure(parsed.value, 0, acc)
  if (acc.nodes > 30000) return toast.warn('节点过多，全部展开可能造成页面卡顿，请用搜索定位后再局部展开')
  const paths: string[] = ['']
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => { const p = `${path}[${i}]`; paths.push(p); walk(x, p) })
    else if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) { const p = `${path ? path + '.' : ''}${k}`; paths.push(p); walk(x, p) }
  }
  walk(parsed.value, '')
  for (const p of paths) expanded.add(p)
}
const collapseAll = () => {
  expanded.clear()
}
</script>

<template>
  <div class="jv">
    <span class="field-label">粘贴 JSON（对象或数组，实时解析）</span>
    <textarea v-model="input" class="textarea mono" style="min-height: 110px" placeholder='如 {"name": "百宝", "tags": ["dev", "tools"], "meta": {"ok": true}}'></textarea>

    <div v-if="errMsg" class="notice notice-err mt-2 small">{{ errMsg }}</div>

    <div v-if="parsed !== null" class="mt-2">
      <div class="toolbar row row-wrap">
        <div class="search-box">
          <Search :size="14" />
          <input v-model="keyword" class="input" placeholder="搜索键名或值（命中自动展开并高亮）" />
        </div>
        <button class="btn btn-soft btn-sm" @click="expandAll"><Expand :size="14" /> 全部展开</button>
        <button class="btn btn-ghost btn-sm" @click="collapseAll"><Shrink :size="14" /> 全部折叠</button>
        <span class="muted small stats" v-if="stats">
          <Binary :size="13" style="vertical-align: -2px" />
          {{ stats.nodes }} 个节点 · 最大层级 {{ stats.depth + 1 }} · {{ stats.keys }} 个键值对
        </span>
      </div>

      <div class="tree mt-2">
        <JsonTreeNode :value="parsed" path="" :keyword="keyword" is-root />
      </div>
      <p class="muted small mt-2">提示：点击键名复制路径（如 data.list[0].id），点击值复制原值；点击箭头或括号折叠展开，深层节点懒渲染不卡顿。</p>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.search-box { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 220px; color: var(--text-3); }
.search-box .input { flex: 1; }
.stats { margin-left: auto; }
.tree {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  max-height: 480px;
  overflow: auto;
}
</style>
