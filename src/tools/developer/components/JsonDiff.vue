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
  toast.ok(`对比完成：新增 ${counts.value.add}、删除 ${counts.value.del}、修改 ${counts.value.mod}`)
}
</script>

<template>
  <div class="json-diff">
    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">JSON A（原始）</span>
        <textarea v-model="leftText" class="textarea mono" style="min-height: 170px"></textarea>
      </div>
      <div>
        <span class="field-label">JSON B（修改后）</span>
        <textarea v-model="rightText" class="textarea mono" style="min-height: 170px"></textarea>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="run"><GitCompareArrows :size="16" /> 深度对比</button>
    </div>

    <div v-if="changes.length" class="row row-wrap small mt-2" style="gap: 14px">
      <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399">新增 {{ counts.add }}</span>
      <span class="badge" style="background: rgba(248, 113, 113, 0.15); color: #f87171">删除 {{ counts.del }}</span>
      <span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24">修改 {{ counts.mod }}</span>
    </div>
    <div v-else-if="counts.mod === 0 && counts.add === 0 && counts.del === 0 && changes.length === 0" class="notice notice-info mt-2">
      两份 JSON 完全一致，或尚未执行对比。
    </div>

    <div v-if="changes.length" class="mt-2 change-list">
      <div v-for="(c, i) in changes" :key="i" class="change-row" :class="c.kind">
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
</template>

<style scoped>
.change-list {
  display: grid;
  gap: 7px;
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
