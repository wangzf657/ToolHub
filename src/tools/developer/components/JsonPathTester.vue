<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/download'
import { debounceRun, installCtrlEnter } from '@/composables/usePasteRun'

interface Hit {
  value: unknown
  /** 命中路径（$..book[2].title 形态） */
  path: string
}

const toast = useToast()
const json = ref('{\n  "store": {\n    "book": [\n      { "title": "三体", "price": 45, "inStock": true },\n      { "title": "流浪地球", "price": 32, "inStock": false },\n      { "title": "球状闪电", "price": 28, "inStock": true }\n    ],\n    "location": "北京朝阳书店"\n  }\n}')
const path = ref('$.store.book[*].title')
const error = ref('')
const hits = ref<Hit[]>([])
const resultTexts = ref<string[]>([])
/** 自动执行（输入停顿 300ms 后自动查询） */
const autoRun = ref(true)
/** 最近复制的路径行（对勾反馈） */
const copiedIdx = ref(-1)

const SYNTAX = [
  { token: '$', desc: '根对象' },
  { token: '.key', desc: '子属性' },
  { token: '["key"]', desc: '带特殊字符的属性' },
  { token: '[0]', desc: '数组下标（支持负数）' },
  { token: '[*]', desc: '所有子项' },
  { token: '..key', desc: '递归查找所有层级' },
  { token: '[0:2]', desc: '数组切片' },
  { token: '[?(@.price<40)]', desc: '过滤器（== != < > <= >= 与 &&）' },
]

/* ---- 本地查询实现：带路径回溯，过滤器支持 == != < > <= >= 与 && ---- */
const joinPath = (base: string, seg: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(seg) ? (base ? `${base}.${seg}` : seg) : `${base}[${JSON.stringify(seg)}]`

const evalCond = (node: unknown, cond: string): boolean | null => {
  const m = cond.trim().match(/^@\.?([\w]+)\s*(==|!=|<=|>=|<|>)\s*(.+)$/)
  if (!m) return null
  const v = (node as Record<string, unknown>)?.[m[1]]
  let rhs: string | number | boolean = m[3].trim().replace(/^['"]|['"]$/g, '')
  const asNum = Number(rhs)
  const isNumCmp = ['<', '>', '<=', '>='].includes(m[2])
  if (isNumCmp) {
    if (typeof v !== 'number' || Number.isNaN(asNum)) return false
    switch (m[2]) {
      case '<': return v < asNum
      case '>': return v > asNum
      case '<=': return v <= asNum
      default: return v >= asNum
    }
  }
  if (typeof v === 'boolean' || rhs === 'true' || rhs === 'false') return String(v) === String(rhs)
  if (typeof v === 'number' && !Number.isNaN(asNum)) return v === asNum
  return String(v) === String(rhs)
}

const evalFilter = (node: unknown, expr: string): boolean | null => {
  const conds = expr.split('&&').map((c) => c.trim())
  let out: boolean | null = true
  for (const c of conds) {
    const r = evalCond(node, c)
    if (r === null) return null
    out = out && r
  }
  return out
}

/** 过滤器里出现不支持的操作符时返回描述，供行内黄条提示 */
const unsupportedOp = (expr: string): string => {
  const m = expr.match(/[=<>!]+/g)
  const okOps = ['==', '!=', '<=', '>=', '<', '>']
  for (const op of m ?? []) if (!okOps.includes(op)) return op
  if (/\|\|/.test(expr)) return '||'
  return ''
}

const queryLocal = (data: unknown, p: string): { hits: Hit[]; badOp: string } => {
  const hits: Hit[] = []
  const tokens = p.replace(/^\$\.?/, '').split(/\.|\[(.+?)\]/g).filter((t) => t !== undefined && t !== '')
  let badOp = ''
  const walk = (node: unknown, idx: number, cur: string): void => {
    if (idx >= tokens.length) {
      hits.push({ value: node, path: cur ? `$${cur}` : '$' })
      return
    }
    const t = tokens[idx].trim()
    if (t === '*') {
      if (Array.isArray(node)) node.forEach((n, i) => walk(n, idx + 1, `${cur}[${i}]`))
      else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, idx + 1, joinPath(cur, k))
    } else if (t.startsWith('?')) {
      const expr = t.replace(/^\?\((.*)\)$/, '$1')
      badOp = badOp || unsupportedOp(expr)
      if (badOp) return
      if (Array.isArray(node)) {
        node.forEach((n, i) => {
          const r = evalFilter(n, expr)
          if (r === true) walk(n, idx + 1, `${cur}[${i}]`)
        })
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          const r = evalFilter(v, expr)
          if (r === true) walk(v, idx + 1, joinPath(cur, k))
        }
      }
    } else if (t === '..') {
      const next = tokens[idx + 1]
      const collect = (n: unknown, cur2: string): void => {
        if (Array.isArray(n)) n.forEach((x, i) => collect(x, `${cur2}[${i}]`))
        else if (n && typeof n === 'object') {
          for (const [k, v] of Object.entries(n)) {
            const p2 = joinPath(cur2, k)
            if (k === next) walk(v, idx + 2, p2)
            collect(v, p2)
          }
        }
      }
      collect(node, cur)
    } else if (/^-?\d+$/.test(t)) {
      const i = Number(t)
      if (Array.isArray(node) && (i >= 0 || node.length + i >= 0)) walk(node[i < 0 ? node.length + i : i], idx + 1, `${cur}[${i}]`)
    } else if (t.includes(':')) {
      const [a, b] = t.split(':').map(Number)
      if (Array.isArray(node)) node.slice(a, b).forEach((n, i) => walk(n, idx + 1, `${cur}[${a + i}]`))
    } else {
      if (node !== null && typeof node === 'object') walk((node as Record<string, unknown>)[t], idx + 1, joinPath(cur, t))
    }
  }
  walk(data, 0, '')
  return { hits, badOp }
}

const run = () => {
  error.value = ''
  hits.value = []
  resultTexts.value = []
  if (!json.value.trim()) return toast.warn('请先粘贴 JSON')
  let data: unknown
  try {
    data = JSON.parse(json.value)
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message.slice(0, 100)}`
    return
  }
  if (!path.value.trim()) return toast.warn('请输入 JSONPath 表达式')
  const { hits: hs, badOp } = queryLocal(data, path.value)
  if (badOp) error.value = `过滤器暂仅支持 ==、!=、<、>、<=、>= 与 &&，检测到「${badOp}」`
  hits.value = hs
  resultTexts.value = hs.map((h) => JSON.stringify(h.value, null, 2))
  if (!badOp) toast.ok(`命中 ${hs.length} 条`)
}

/** 自动执行：输入停顿 300ms 后自动查询 */
let deb: { call: () => void; cancel: () => void } | null = null
let unbindKey: (() => void) | null = null
const rootEl = ref<HTMLElement | null>(null)
onMounted(() => {
  deb = debounceRun(() => {
    if (autoRun.value && json.value.trim() && path.value.trim()) run()
  }, 300)
  unbindKey = installCtrlEnter(rootEl.value, run)
})
onBeforeUnmount(() => {
  deb?.cancel()
  unbindKey?.()
})
watch([json, path], () => deb?.call())

const copyPath = async (h: Hit, i: number) => {
  if (await copyText(h.path)) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else toast.err('复制失败')
}
</script>

<template>
  <div ref="rootEl" class="json-path">
    <div class="row row-wrap" style="gap: 10px; align-items: end">
      <div class="grow" style="min-width: 240px">
        <span class="field-label">JSONPath 表达式</span>
        <input v-model="path" type="text" class="input mono" spellcheck="false" @keyup.enter="run" />
      </div>
      <label class="check" title="输入停顿 300ms 后自动执行查询"><input v-model="autoRun" type="checkbox" /> 自动执行</label>
      <button class="btn btn-primary" @click="run"><Search :size="16" /> 执行查询</button>
    </div>

    <div class="grid-2 mt-2" style="gap: 12px">
      <div>
        <span class="field-label">JSON 输入</span>
        <textarea v-model="json" class="textarea mono jp-input" spellcheck="false"></textarea>
      </div>
      <div>
        <span class="field-label">查询结果（{{ hits.length }} 条命中）</span>
        <div class="result-area">
          <div v-if="error" class="notice notice-warn">{{ error }}</div>
          <div v-else-if="!hits.length" class="notice notice-info">暂无结果：输入表达式后点击执行，或开启自动执行。</div>
          <div v-for="(h, i) in hits" :key="i" class="res-item">
            <button class="res-path mono" :title="`复制路径 ${h.path}`" @click="copyPath(h, i)">
              {{ copiedIdx === i ? '✓ 已复制' : h.path }}
            </button>
            <pre class="mono res-val">{{ resultTexts[i] }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-3">
      <span class="field-label">JSONPath 语法速查</span>
      <div class="syntax-grid">
        <div v-for="s in SYNTAX" :key="s.token" class="syn-row">
          <button class="syn-token mono" @click="path = s.token === '.key' ? '$.store.location' : path + s.token">{{ s.token }}</button>
          <span class="syn-desc">{{ s.desc }}</span>
        </div>
      </div>
      <p class="muted small mt-1">点击语法片段可快速插入（.key 会填入示例）。支持 ==、!=、&lt;、&gt;、&lt;=、&gt;= 与 &amp;&amp; 组合过滤。</p>
    </div>
  </div>
</template>

<style scoped>
/* 弹性高度：随视口伸展，命中列表多时不撑爆页面 */
.jp-input {
  min-height: min(420px, calc(100dvh - 360px));
}
.result-area {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  padding: 10px;
  min-height: 420px;
  height: calc(100dvh - 340px);
  max-height: 780px;
  overflow: auto;
  display: grid;
  gap: 8px;
  align-content: start;
}
.res-item {
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 12.5px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  overflow-wrap: anywhere;
}
.res-path {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  border-bottom: 1px dashed var(--border);
  background: none;
  color: var(--accent-text);
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
}
.res-val {
  margin: 0;
  padding: 10px 12px;
  white-space: pre-wrap;
}
.syntax-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 7px;
}
.syn-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
}
.syn-token {
  flex: none;
  border: none;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
}
.syn-desc {
  color: var(--text-2);
}
</style>
