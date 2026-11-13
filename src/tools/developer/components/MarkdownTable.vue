<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Table2, Plus, Minus, Copy, X, ArrowDownToLine } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const cells = ref<string[][]>([
  ['功能', '说明', '状态'],
  ['本地处理', '数据不出浏览器', '✅'],
])
/** 逐列对齐（rx2）：默认左 */
type Align = 'left' | 'center' | 'right'
const aligns = ref<Align[]>(['left', 'left', 'left'])
const outView = ref<'src' | 'prev'>('src')
const csvHint = ref('')
const copied = ref(false)

const syncAligns = () => {
  const cols = Math.max(...cells.value.map((r) => r.length), 1)
  while (aligns.value.length < cols) aligns.value.push('left')
  if (aligns.value.length > cols) aligns.value = aligns.value.slice(0, cols)
}

const addRow = () => {
  cells.value.push(cells.value[0]?.map(() => '') ?? [''])
  syncAligns()
}
const addCol = () => {
  cells.value.forEach((r) => r.push(''))
  syncAligns()
}
const removeRow = () => {
  if (cells.value.length > 1) cells.value.pop()
}
const removeCol = () => {
  if ((cells.value[0]?.length ?? 0) > 1) cells.value.forEach((r) => r.pop())
  syncAligns()
}
/** 行粒度（rx1）：i 行后插入 / 删除第 i 行 */
const insertRowAt = (i: number) => {
  cells.value.splice(i + 1, 0, cells.value[i]?.map(() => '') ?? [''])
}
const deleteRowAt = (i: number) => {
  if (cells.value.length > 1) {
    cells.value.splice(i, 1)
    if (!cells.value.length) cells.value.push([''])
  }
}
/** 列粒度（rx1）：ci 列后插入 / 删除第 ci 列 */
const insertColAt = (ci: number) => {
  cells.value.forEach((r) => r.splice(ci + 1, 0, ''))
  aligns.value.splice(ci + 1, 0, 'left')
}
const deleteColAt = (ci: number) => {
  if ((cells.value[0]?.length ?? 0) > 1) {
    cells.value.forEach((r) => r.splice(ci, 1))
    aligns.value.splice(ci, 1)
  }
}

/** CSV 迷你解析（rx3）：引号字段正确拆分 */
const parseCsvLine = (line: string): string[] => {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQ = false
      else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}
/** 粘贴侦测：多行含逗号 → 一键导入（rx3） */
const onCellPaste = (e: ClipboardEvent) => {
  const text = e.clipboardData?.getData('text') ?? ''
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length >= 2 && lines.filter((l) => (l.match(/,/g) ?? []).length >= 2).length >= 2) {
    e.preventDefault()
    csvHint.value = text
    toast.ok('检测到 CSV 内容，已一键导入网格')
    importCsv()
  } else if ((text.match(/,/g) ?? []).length >= 2 && lines.length === 1) {
    csvHint.value = text
  }
}
const importCsv = () => {
  if (!csvHint.value) return
  const rows = csvHint.value.split(/\r?\n/).filter(Boolean).map(parseCsvLine)
  const cols = Math.max(...rows.map((r) => r.length))
  cells.value = rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''))
  aligns.value = Array.from({ length: cols }, () => 'left' as Align)
  csvHint.value = ''
}

const md = computed(() => {
  const rows = cells.value
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.length))
  syncAligns()
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const sep = Array.from({ length: cols }, (_, i) => (aligns.value[i] === 'center' ? ':---:' : aligns.value[i] === 'right' ? '---:' : '---'))
  const width = Math.max(...rows.map((r) => Math.max(...r.map((c) => esc(c).length))), 5)
  const fmt = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => esc(r[i] ?? '').padEnd(width)).join(' | ')} |`
  return [fmt(rows[0] ?? []), fmt(sep), ...rows.slice(1).map((r) => fmt(r))].join('\n')
})

/** 渲染预览（rx4）：marked 可用则解析，回退手写表格 */
const prevHtml = computed(() => {
  const rows = cells.value
  const cols = Math.max(...rows.map((r) => r.length), 1)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th style="text-align:${aligns.value[i] ?? 'left'}">${esc(rows[0]?.[i] ?? '')}</th>`).join('')}</tr>`
  const body = rows
    .slice(1)
    .map((r) => `<tr>${Array.from({ length: cols }, (_, i) => `<td style="text-align:${aligns.value[i] ?? 'left'}">${esc(r[i] ?? '')}</td>`).join('')}</tr>`)
    .join('')
  return `<table class="pv"><thead>${head}</thead><tbody>${body}</tbody></table>`
})

const doCopy = async () => {
  const okFlag = await copyText(md.value)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('Markdown 表格已复制')
  } else toast.err('复制失败')
}
const goCsv2Md = () => router.push('/t/csv-to-markdown')
</script>

<template>
  <div class="md-table">
    <div class="row row-wrap mb-2" style="gap: 10px; align-items: center">
      <button class="btn btn-ghost btn-sm" @click="goCsv2Md">从 CSV 导入？用「CSV 转 Markdown 表格」 →</button>
      <span class="muted small">在单元格粘贴多行 CSV 会自动导入网格</span>
    </div>

    <div class="row row-wrap mb-2" style="gap: 10px; align-items: center">
      <button class="btn btn-ghost btn-sm" @click="addRow"><Plus :size="14" /> 加一行</button>
      <button class="btn btn-ghost btn-sm" @click="removeRow" :disabled="cells.length <= 1"><Minus :size="14" /> 减一行</button>
      <button class="btn btn-ghost btn-sm" @click="addCol"><Plus :size="14" /> 加一列</button>
      <button class="btn btn-ghost btn-sm" @click="removeCol" :disabled="(cells[0]?.length ?? 0) <= 1"><Minus :size="14" /> 减一列</button>
    </div>

    <div class="grid-wrap">
      <table class="edit-grid">
        <tr v-for="(row, ri) in cells" :key="ri" class="grid-row" :class="{ head: ri === 0 }">
          <td v-for="(_, ci) in row" :key="ci" class="cell-td">
            <div class="cell-tools">
              <button v-if="ri === 0" class="ct-btn" :title="`在「${cells[0]?.[ci] || ci + 1}」列后插入一列`" @click="insertColAt(ci)"><Plus :size="11" /></button>
              <button v-if="ri === 0 && row.length > 1" class="ct-btn danger" title="删除本列" @click="deleteColAt(ci)"><X :size="11" /></button>
            </div>
            <input
              v-model="cells[ri]![ci]"
              type="text"
              :placeholder="ri === 0 ? `列头 ${ci + 1}` : ''"
              spellcheck="false"
              @paste="onCellPaste"
            />
            <div class="cell-tools after">
              <button v-if="ri > 0 || cells.length > 1" class="ct-btn" title="在本行下方插入一行" @click="insertRowAt(ri)"><ArrowDownToLine :size="11" /></button>
              <button v-if="cells.length > 1" class="ct-btn danger" title="删除本行" @click="deleteRowAt(ri)"><X :size="11" /></button>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div class="row row-wrap mt-2" style="gap: 6px; align-items: center">
      <span class="field-label" style="margin: 0">逐列对齐：</span>
      <template v-for="(a, i) in aligns" :key="i">
        <span class="muted small">{{ cells[0]?.[i] || `列${i + 1}` }}</span>
        <select v-model="aligns[i]" class="select" style="width: 88px">
          <option value="left">左 :---</option>
          <option value="center">中 :---:</option>
          <option value="right">右 ---:</option>
        </select>
      </template>
    </div>

    <div class="mt-3">
      <div class="row" style="align-items: center; margin-bottom: 6px; gap: 8px">
        <span class="field-label" style="margin: 0"><Table2 :size="14" style="vertical-align: -2px" /> GFM 表格输出</span>
        <span class="vt" :class="{ on: outView === 'src' }" @click="outView = 'src'">源码</span>
        <span class="vt" :class="{ on: outView === 'prev' }" @click="outView = 'prev'">预览</span>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" @click="doCopy"><Copy :size="14" /> {{ copied ? '已复制' : '复制表格' }}</button>
      </div>
      <pre v-show="outView === 'src'" class="out mono">{{ md }}</pre>
      <div v-show="outView === 'prev'" class="out prev" v-html="prevHtml"></div>
    </div>
  </div>
</template>

<style scoped>
.grid-wrap {
  overflow-x: auto;
}
.grid-row:hover .cell-tools {
  opacity: 1;
}
.cell-td {
  position: relative;
  padding: 0;
}
.cell-tools {
  position: absolute;
  top: 1px;
  z-index: 2;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s;
}
.cell-tools.after {
  top: auto;
  bottom: 1px;
}
.ct-btn {
  border: 1px solid var(--border);
  background: var(--panel-solid);
  color: var(--text-2);
  border-radius: 5px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
}
.ct-btn.danger:hover {
  color: var(--err);
  border-color: var(--err);
}
.edit-grid {
  border-collapse: collapse;
  width: 100%;
}
.edit-grid td {
  border: 1px solid var(--border);
  padding: 0;
}
.edit-grid tr.head td {
  background: var(--accent-soft);
}
.edit-grid input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13.5px;
  padding: 9px 12px;
  outline: none;
  min-width: 120px;
  font-family: inherit;
}
.edit-grid input:focus {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.vt {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-2);
}
.vt.on {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.out {
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  /* 滚动上限（rx5）：长表格不撑长页面 */
  max-height: 420px;
  overflow: auto;
}
.prev :deep(table.pv) {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}
.prev :deep(table.pv th),
.prev :deep(table.pv td) {
  border: 1px solid var(--border);
  padding: 7px 12px;
}
.prev :deep(table.pv th) {
  background: color-mix(in srgb, var(--panel-solid) 80%, transparent);
}
</style>
