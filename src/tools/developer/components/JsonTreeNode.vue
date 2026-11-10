<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  /** 节点值 */
  value: unknown
  /** 从根到该节点的路径（a.b[0].c） */
  path: string
  /** 搜索关键词 */
  keyword: string
  /** 父级键名（根节点为空） */
  name?: string
  /** 是否根节点（无缩进） */
  isRoot?: boolean
}>()

/** 展开状态由父组件统一管理（reactive Set） */
const exp = inject<{ has(p: string): boolean; toggle(p: string): void }>('jsonTreeExp')!

const toast = useToast()
const shownCount = ref(50)

const isArr = computed(() => Array.isArray(props.value))
const isObj = computed(() => !isArr.value && props.value !== null && typeof props.value === 'object')
const container = computed(() => isArr.value || isObj.value)
const isOpen = computed(() => exp.has(props.path))

const kind = computed(() => {
  const v = props.value
  if (v === null) return 'null'
  if (Array.isArray(v) || typeof v === 'object') return 'object'
  return typeof v // string | number | boolean
})

const display = computed(() => {
  const v = props.value
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
})

/** 子项列表（懒展开：只有展开时才求值） */
const children = computed(() => {
  if (!container.value) return []
  const v = props.value as Record<string, unknown> | unknown[]
  if (Array.isArray(v)) {
    return v.map((val, i) => ({ key: String(i), name: String(i), value: val, path: `${props.path}[${i}]` }))
  }
  return Object.entries(v).map(([k, val]) => ({
    key: k,
    name: k,
    value: val,
    path: /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? (props.path ? `${props.path}.${k}` : k) : `${props.path}[${JSON.stringify(k)}]`,
  }))
})

const shown = computed(() => children.value.slice(0, shownCount.value))
const summary = computed(() => (isArr.value ? `${children.value.length} 项` : `${children.value.length} 个键`))

/** 自身（键名或标量值）是否命中搜索词 */
const matchSelf = computed(() => {
  const kw = props.keyword.trim().toLowerCase()
  if (!kw) return false
  if (props.name && props.name.toLowerCase().includes(kw)) return true
  return !container.value && display.value.toLowerCase().includes(kw)
})

/** 子树里是否有命中（用于搜索时自动展开祖先） */
function subtreeHasMatch(): boolean {
  const kw = props.keyword.trim().toLowerCase()
  if (!kw) return false
  if (matchSelf.value) return true
  if (!container.value) return false
  return children.value.some((c) => {
    if (c.name && c.name.toLowerCase().includes(kw)) return true
    if (c.value === null || typeof c.value !== 'object') return JSON.stringify(c.value)?.toLowerCase().includes(kw)
    return hasMatchDeep(c.value, kw)
  })
}
function hasMatchDeep(v: unknown, kw: string): boolean {
  if (Array.isArray(v)) return v.some((x) => hasMatchDeep(x, kw))
  if (v !== null && typeof v === 'object') return Object.entries(v).some(([k, x]) => k.toLowerCase().includes(kw) || hasMatchDeep(x, kw))
  return JSON.stringify(v)?.toLowerCase().includes(kw) ?? false
}
const autoExpand = computed(() => subtreeHasMatch() && props.keyword.trim() !== '')

const toggle = () => {
  if (container.value) exp.toggle(props.path)
}

const copyPath = async () => {
  if (await copyText(props.path)) toast.ok(`已复制路径 ${props.path}`)
  else toast.err('复制失败')
}
const copyValue = async () => {
  const raw = props.value
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  if (text !== undefined && (await copyText(text))) toast.ok('已复制值')
  else toast.err('复制失败')
}
</script>

<template>
  <div class="jt" :class="{ root: isRoot }">
    <template v-if="container">
      <div class="jt-row" :class="{ hit: matchSelf }">
        <button class="jt-arrow" :aria-label="isOpen ? '折叠' : '展开'" @click="toggle">
          <ChevronRight :size="13" class="rot" :class="{ open: isOpen }" />
        </button>
        <span v-if="name !== undefined" class="jt-key" title="点击复制路径" @click="copyPath">{{ name }}</span>
        <span class="jt-brace" @click="toggle">{{ isArr ? '[' : '{' }}</span>
        <span v-if="!isOpen" class="jt-meta" @click="toggle">…{{ summary }}</span>
        <span v-if="!isOpen" class="jt-brace" @click="toggle">{{ isArr ? ']' : '}' }}</span>
      </div>
      <div v-if="isOpen || autoExpand" class="jt-children">
        <JsonTreeNode
          v-for="c in shown"
          :key="c.key"
          :name="c.name"
          :value="c.value"
          :path="c.path"
          :keyword="keyword"
        />
        <button v-if="children.length > shownCount" class="jt-more" @click="shownCount += 200">
          显示更多（还有 {{ children.length - shownCount }} 项）
        </button>
      </div>
      <div v-if="isOpen || autoExpand" class="jt-row">
        <span class="jt-pad"></span>
        <span class="jt-brace">{{ isArr ? ']' : '}' }}</span>
      </div>
    </template>
    <div v-else class="jt-row" :class="{ hit: matchSelf }">
      <span class="jt-pad"></span>
      <span v-if="name !== undefined" class="jt-key" title="点击复制路径" @click="copyPath">{{ name }}</span>
      <span class="jt-val" :class="kind" title="点击复制值" @click="copyValue">{{ display }}</span>
    </div>
  </div>
</template>

<style scoped>
.jt { font-size: 12.5px; line-height: 1.7; }
.jt.root { font-size: 13px; }
.jt-row { display: flex; align-items: baseline; gap: 4px; }
.jt-arrow { border: none; background: none; cursor: pointer; color: var(--text-3); display: inline-flex; padding: 0 2px; align-self: center; }
.rot { transition: transform 0.15s; }
.rot.open { transform: rotate(90deg); }
.jt-children { padding-left: 18px; border-left: 1px dashed color-mix(in srgb, var(--border) 70%, transparent); margin-left: 7px; }
.jt-pad { display: inline-block; width: 18px; }
.jt-key { color: var(--text-2); cursor: pointer; }
.jt-key:hover { text-decoration: underline; color: var(--accent-text); }
.jt-brace { color: var(--text-3); cursor: pointer; }
.jt-meta { color: var(--muted); font-size: 11.5px; cursor: pointer; }
.jt-val { cursor: pointer; overflow-wrap: anywhere; }
.jt-val.string { color: #34d399; }
.jt-val.number { color: #60a5fa; }
.jt-val.boolean { color: #c084fc; }
.jt-val.null, .jt-val.object { color: var(--muted); font-style: italic; }
.jt-row.hit { background: rgba(250, 204, 21, 0.14); border-radius: 4px; }
.jt-more { border: 1px dashed var(--border); background: none; color: var(--text-2); font-size: 12px; border-radius: 7px; padding: 2px 10px; cursor: pointer; margin-top: 2px; }
</style>
