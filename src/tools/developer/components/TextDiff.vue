<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { GitCompare } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const left = ref('第一行：欢迎\n第二行：这里有一段旧文案\n第三行：保持不变\n第四行：待删除')
const right = ref('第一行：欢迎\n第二行：这里有一段新文案\n第三行：保持不变\n新增的第五行')
const ignoreWs = ref(false)
const busy = ref(false)
/** 统一 | 并排视图（rx5） */
const view = ref<'unified' | 'side'>('unified')
/** 自动重算时间戳（rx3） */
const updatedAt = ref('')
const resultEl = ref<HTMLElement | null>(null)
const leftEl = ref<HTMLTextAreaElement | null>(null)
const rightEl = ref<HTMLTextAreaElement | null>(null)

interface DiffRow {
  type: 'same' | 'add' | 'del'
  text: string
  /** 行内词级高亮（rx4）：被改词标记 */
  marks?: { text: string; hit: boolean }[]
  lnA?: number
  lnB?: number
}

const rows = ref<DiffRow[]>([])
const stats = ref({ add: 0, del: 0, same: 0 })

/** 词级高亮：对删除/新增配对行做 diffWords */
const withWordMarks = async (out: DiffRow[]): Promise<DiffRow[]> => {
  try {
    const { diffWords } = await import('diff')
    let i = 0
    while (i < out.length) {
      if (out[i]!.type === 'del') {
        const delRun: DiffRow[] = []
        while (i < out.length && out[i]!.type === 'del') delRun.push(out[i++]!)
        const addRun: DiffRow[] = []
        while (i < out.length && out[i]!.type === 'add') addRun.push(out[i++]!)
        const n = Math.min(delRun.length, addRun.length)
        for (let k = 0; k < n; k++) {
          const parts = diffWords(delRun[k]!.text, addRun[k]!.text)
          delRun[k]!.marks = parts.filter((p) => !p.added).map((p) => ({ text: p.value ?? '', hit: !!p.removed }))
          addRun[k]!.marks = parts.filter((p) => !p.removed).map((p) => ({ text: p.value ?? '', hit: !!p.added }))
        }
      } else i++
    }
  } catch {
    /* 词级库加载失败则退回整行显示 */
  }
  return out
}

const run = async (opts: { silent?: boolean; scroll?: boolean } = {}) => {
  if (!left.value && !right.value) {
    if (!opts.silent) toast.warn('请输入要对比的文本')
    return
  }
  busy.value = true
  try {
    const { diffLines } = await import('diff')
    const parts = diffLines(left.value, right.value, ignoreWs.value ? { ignoreWhitespace: true } : undefined)
    const out: DiffRow[] = []
    let add = 0
    let del = 0
    let same = 0
    let lnA = 1
    let lnB = 1
    for (const part of parts) {
      const kind: DiffRow['type'] = part.added ? 'add' : part.removed ? 'del' : 'same'
      const lines = (part.value ?? '').replace(/\n$/, '').split('\n')
      for (const line of lines) {
        if (kind === 'add') {
          add++
          out.push({ type: kind, text: line, lnB: lnB++ })
        } else if (kind === 'del') {
          del++
          out.push({ type: kind, text: line, lnA: lnA++ })
        } else {
          same++
          out.push({ type: kind, text: line, lnA: lnA++, lnB: lnB++ })
        }
      }
    }
    rows.value = await withWordMarks(out)
    stats.value = { add, del, same }
    updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    if (!opts.silent) toast.ok(`对比完成：新增 ${add} 行，删除 ${del} 行`)
    if (opts.scroll) {
      await nextTick()
      resultEl.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  } catch (e) {
    toast.err(`对比失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

/** 自动重算（rx3）：双输入 500ms 防抖，保留手动按钮 */
let deb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  deb = debounceRun(() => {
    if (rows.value.length) run({ silent: true })
  }, 500)
  run({ silent: true })
})
onBeforeUnmount(() => deb?.cancel())

/** 并排视图（rx5）：左右行对齐列表 */
interface SideCell {
  text: string
  n?: number
  marks?: { text: string; hit: boolean }[]
}
interface SideRow {
  a: SideCell | null
  b: SideCell | null
}
const sideRows = computed<SideRow[]>(() => {
  const out: SideRow[] = []
  let i = 0
  const rs = rows.value
  while (i < rs.length) {
    if (rs[i]!.type === 'same') {
      out.push({ a: { text: rs[i]!.text, n: rs[i]!.lnA }, b: { text: rs[i]!.text, n: rs[i]!.lnB } })
      i++
    } else {
      const delRun: DiffRow[] = []
      while (i < rs.length && rs[i]!.type === 'del') delRun.push(rs[i++]!)
      const addRun: DiffRow[] = []
      while (i < rs.length && rs[i]!.type === 'add') addRun.push(rs[i++]!)
      const n = Math.max(delRun.length, addRun.length)
      for (let k = 0; k < n; k++) {
        out.push({
          a: delRun[k] ? { text: delRun[k]!.text, n: delRun[k]!.lnA, marks: delRun[k]!.marks } : null,
          b: addRun[k] ? { text: addRun[k]!.text, n: addRun[k]!.lnB, marks: addRun[k]!.marks } : null,
        })
      }
    }
  }
  return out
})

/** 并排同步滚动（rx5）：按比例联动 */
let syncing = false
const syncSideScroll = (e: Event) => {
  if (syncing) return
  const src = e.target as HTMLElement
  const pane = src.closest('.side-wrap')?.querySelectorAll('.side-pane')
  if (!pane) return
  syncing = true
  const max = src.scrollHeight - src.clientHeight
  pane.forEach((p) => {
    if (p !== src) p.scrollTop = max > 0 ? (src.scrollTop / max) * Math.max(0, p.scrollHeight - p.clientHeight) : 0
  })
  requestAnimationFrame(() => (syncing = false))
}
</script>

<template>
  <div class="text-diff">
    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">原始文本（A）</span>
        <textarea v-model="left" class="textarea mono diff-input" ref="leftEl"></textarea>
      </div>
      <div>
        <span class="field-label">修改后文本（B）</span>
        <textarea v-model="right" class="textarea mono diff-input" ref="rightEl"></textarea>
      </div>
    </div>

    <div class="row row-wrap mt-2" style="gap: 12px; align-items: center">
      <label class="check"><input v-model="ignoreWs" type="checkbox" /> 忽略行内空白差异</label>
      <span class="muted small">改动停顿 500ms 自动重算</span>
      <span v-if="updatedAt" class="muted small">· 最后对比于 {{ updatedAt }}</span>
      <span class="grow"></span>
      <button class="btn btn-primary" :disabled="busy" @click="run({ scroll: true })"><GitCompare :size="16" /> 开始对比</button>
    </div>

    <div ref="resultEl" class="mt-3">
      <div class="row row-wrap small" style="gap: 14px; margin-bottom: 8px; align-items: center">
        <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399">新增 {{ stats.add }} 行</span>
        <span class="badge" style="background: rgba(248, 113, 113, 0.15); color: #f87171">删除 {{ stats.del }} 行</span>
        <span class="badge badge-plain">相同 {{ stats.same }} 行</span>
        <span class="grow"></span>
        <span class="vt" :class="{ on: view === 'unified' }" @click="view = 'unified'">统一</span>
        <span class="vt" :class="{ on: view === 'side' }" @click="view = 'side'">并排</span>
      </div>

      <div v-show="view === 'unified'" class="diff-view mono" :class="{ side: view === 'side' }">
        <div v-for="(r, i) in rows" :key="i" class="diff-row" :class="r.type">
          <span class="ln mono">{{ r.lnA ?? '' }}</span>
          <span class="ln mono">{{ r.lnB ?? '' }}</span>
          <span class="dt">
            <template v-if="r.marks"><mark v-for="(m, k) in r.marks" :key="k" :class="{ hit: m.hit }">{{ m.text }}</mark></template>
            <template v-else>{{ r.text }}</template>
          </span>
        </div>
      </div>

      <div v-show="view === 'side'" class="side-wrap">
        <div class="side-pane mono" @scroll="syncSideScroll">
          <div v-for="(r, i) in sideRows" :key="i" class="side-row" :class="{ add: r.a && !r.b, del: r.b && !r.a }">
            <span class="ln mono">{{ r.a?.n ?? '' }}</span>
            <span class="dt"><template v-if="r.a?.marks"><mark v-for="(m, k) in r.a.marks" :key="k" :class="{ hit: m.hit }">{{ m.text }}</mark></template><template v-else>{{ r.a?.text ?? '' }}</template></span>
          </div>
        </div>
        <div class="side-pane mono" @scroll="syncSideScroll">
          <div v-for="(r, i) in sideRows" :key="i" class="side-row" :class="{ add: !r.a && r.b, del: r.a && !r.b }">
            <span class="ln mono">{{ r.b?.n ?? '' }}</span>
            <span class="dt"><template v-if="r.b?.marks"><mark v-for="(m, k) in r.b.marks" :key="k" :class="{ hit: m.hit }">{{ m.text }}</mark></template><template v-else>{{ r.b?.text ?? '' }}</template></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 输入区弹性高度（rx1） */
.diff-input {
  min-height: min(340px, calc(100dvh - 440px));
}
.sr-only {
  position: absolute;
  opacity: 0;
}
.vt {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 2px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-2);
}
.vt.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.diff-view {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: auto;
  /* 结果区默认高度（rx2） */
  height: calc(100dvh - 360px);
  min-height: 340px;
  font-size: 12.5px;
  background: var(--code-bg);
}
.diff-row {
  display: flex;
  gap: 8px;
  padding: 1px 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ln {
  flex: none;
  width: 30px;
  text-align: right;
  color: var(--text-3);
  user-select: none;
}
.dt {
  flex: 1;
}
.diff-row.add {
  background: rgba(52, 211, 153, 0.12);
}
.diff-row.del {
  background: rgba(248, 113, 113, 0.12);
}
mark {
  background: transparent;
  color: inherit;
}
mark.hit {
  border-radius: 3px;
  padding: 0 1px;
}
.diff-row.del mark.hit,
.side-row.del mark.hit {
  background: rgba(248, 113, 113, 0.45);
}
.diff-row.add mark.hit,
.side-row.add mark.hit {
  background: rgba(52, 211, 153, 0.45);
}
/* 并排（rx5） */
.side-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.side-pane {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: auto;
  height: calc(100dvh - 360px);
  min-height: 340px;
  font-size: 12.5px;
  background: var(--code-bg);
}
.side-row {
  display: flex;
  gap: 8px;
  padding: 1px 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.side-row.add {
  background: rgba(52, 211, 153, 0.12);
}
.side-row.del {
  background: rgba(248, 113, 113, 0.12);
}
@media (max-width: 760px) {
  .side-wrap {
    grid-template-columns: 1fr;
  }
}
</style>
