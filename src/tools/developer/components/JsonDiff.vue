<script setup lang="ts">
import { ref } from 'vue'
import { GitCompareArrows } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const leftText = ref('{\n  "name": "widget",\n  "version": "1.0.0",\n  "tags": ["ui", "tool"],\n  "debug": false\n}')
const rightText = ref('{\n  "name": "widget",\n  "version": "1.2.0",\n  "tags": ["ui", "tool", "dev"],\n  "author": "张三"\n}')

interface Change {
  kind: 'add' | 'del' | 'mod'
  path: string
  left: string
  right: string
}

const changes = ref<Change[]>([])
const counts = ref({ add: 0, del: 0, mod: 0 })
/** 类别过滤：全部/新增/删除/修改 */
const kindFilter = ref<'all' | 'add' | 'del' | 'mod'>('all')
/** 数组对比口径提示：检测到对象数组含共同键时建议按键匹配 */
const arrayHint = ref('')

/** 检测对象数组是否含共同键（如 id），给出按键匹配建议 */
const detectArrayKey = (a: unknown, b: unknown): string => {
  const scan = (x: unknown): string | null => {
    if (Array.isArray(x)) {
      const objs = x.filter((i) => i && typeof i === 'object' && !Array.isArray(i)) as Record<string, unknown>[]
      if (objs.length >= 2) {
        for (const k of Object.keys(objs[0] ?? {})) {
          if (k === 'id' && objs.every((o) => k in o)) return k
        }
      }
      for (const i of x) {
        const hit = scan(i)
        if (hit) return hit
      }
    } else if (x && typeof x === 'object') {
      for (const v of Object.values(x as Record<string, unknown>)) {
        const hit = scan(v)
        if (hit) return hit
      }
    }
    return null
  }
  return scan(a) ?? scan(b) ?? ''
}

const fmt = (v: unknown): string => (v === undefined ? '（不存在）' : typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v))

function deepDiff(a: unknown, b: unknown, path: string, out: Change[]): void {
  if (a === undefined && b === undefined) return
  if (a === undefined) {
    out.push({ kind: 'add', path, left: '', right: fmt(b) })
    return
  }
  if (b === undefined) {
    out.push({ kind: 'del', path, left: fmt(a), right: '' })
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) deepDiff(a[i], b[i], `${path}[${i}]`, out)
    return
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])]
    for (const k of keys) deepDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out)
    return
  }
  if (a !== b) out.push({ kind: 'mod', path, left: fmt(a), right: fmt(b) })
}

const run = () => {
  let a: unknown
  let b: unknown
  try {
    a = JSON.parse(leftText.value)
  } catch {
    return toast.err('左侧 JSON 语法有误')
  }
  try {
    b = JSON.parse(rightText.value)
  } catch {
    return toast.err('右侧 JSON 语法有误')
  }
  const out: Change[] = []
  deepDiff(a, b, '', out)
  changes.value = out
  counts.value = {
    add: out.filter((c) => c.kind === 'add').length,
    del: out.filter((c) => c.kind === 'del').length,
    mod: out.filter((c) => c.kind === 'mod').length,
  }
  arrayHint.value = detectArrayKey(a, b)
  toast.ok(`对比完成：新增 ${counts.value.add}、删除 ${counts.value.del}、修改 ${counts.value.mod}`)
}

const visibleChanges = () => (kindFilter.value === 'all' ? changes.value : changes.value.filter((c) => c.kind === kindFilter.value))
</script>

<template>
  <div class="json-diff">
    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">JSON A（原始）</span>
        <textarea v-model="leftText" class="textarea mono diff-input"></textarea>
      </div>
      <div>
        <span class="field-label">JSON B（修改后）</span>
        <textarea v-model="rightText" class="textarea mono diff-input"></textarea>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="run"><GitCompareArrows :size="16" /> 深度对比</button>
      <span class="muted small">数组按索引逐位对比{{ arrayHint ? `；检测到对象数组含共同键「${arrayHint}」，可考虑先按键（${arrayHint}）对齐再对比` : '' }}</span>
    </div>

    <div v-if="changes.length" class="mt-2 diff-out">
      <div class="sticky-head row row-wrap small" style="gap: 10px">
        <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399">新增 {{ counts.add }}</span>
        <span class="badge" style="background: rgba(248, 113, 113, 0.15); color: #f87171">删除 {{ counts.del }}</span>
        <span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24">修改 {{ counts.mod }}</span>
        <span class="grow"></span>
        <span class="kf" :class="{ on: kindFilter === 'all' }" @click="kindFilter = 'all'">全部</span>
        <span class="kf" :class="{ on: kindFilter === 'add' }" @click="kindFilter = 'add'">只看新增</span>
        <span class="kf" :class="{ on: kindFilter === 'del' }" @click="kindFilter = 'del'">只看删除</span>
        <span class="kf" :class="{ on: kindFilter === 'mod' }" @click="kindFilter = 'mod'">只看修改</span>
      </div>
      <div class="change-list">
        <div v-for="(c, i) in visibleChanges()" :key="i" class="change-row" :class="c.kind">
          <span class="kind-tag">
            {{ c.kind === 'add' ? '新增' : c.kind === 'del' ? '删除' : '修改' }}
          </span>
          <code class="path mono">{{ c.path || '(根)' }}</code>
          <span class="vals mono">
            <template v-if="c.kind === 'mod'">{{ c.left }} <b>→</b> {{ c.right }}</template>
            <template v-else-if="c.kind === 'add'">{{ c.right }}</template>
            <template v-else>{{ c.left }}</template>
          </span>
        </div>
      </div>
    </div>
    <div v-else-if="counts.mod === 0 && counts.add === 0 && counts.del === 0 && changes.length === 0" class="notice notice-info mt-2">
      两份 JSON 完全一致，或尚未执行对比。
    </div>
  </div>
</template>

<style scoped>
/* 输入区弹性高度：随视口伸展，高屏多看行、低屏不撑爆页面 */
.diff-input {
  min-height: min(400px, calc(100dvh - 420px));
}
/* 差异列表约束：内部滚动 + 计数徽章/过滤常驻顶部，千项差异不撑长页面 */
.diff-out {
  display: grid;
  gap: 6px;
}
.sticky-head {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 6px 0;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  align-items: center;
}
.kf {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 2px 10px;
  cursor: pointer;
  color: var(--text-2);
}
.kf.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.change-list {
  display: grid;
  gap: 7px;
  max-height: 50vh;
  overflow: auto;
  padding-right: 4px;
}
.change-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: 9px;
  font-size: 13px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.change-row.add {
  border-left-color: #34d399;
}
.change-row.del {
  border-left-color: #f87171;
}
.change-row.mod {
  border-left-color: #fbbf24;
}
.kind-tag {
  flex: none;
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 6px;
  padding: 2px 8px;
}
.change-row.add .kind-tag {
  color: #34d399;
  background: rgba(52, 211, 153, 0.14);
}
.change-row.del .kind-tag {
  color: #f87171;
  background: rgba(248, 113, 113, 0.14);
}
.change-row.mod .kind-tag {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.14);
}
.path {
  color: var(--accent-text);
  flex: none;
  min-width: 90px;
  font-size: 12.5px;
}
.vals {
  color: var(--text-2);
  overflow-wrap: anywhere;
  font-size: 12.5px;
}
</style>
