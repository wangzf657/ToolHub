<script setup lang="ts">
import { computed, ref } from 'vue'
import { Grid3x3, Loader2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { readXlsx, rowsToXlsx } from '@/lib/officeEngine'
import { saveText, saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { buildPivot, flattenTree, countNonNumeric, type PivotNode } from './pivotCore'

/** 在线数据透视表：多级行字段 + 基数护栏 + 占比 + 热力色阶 + 导出 */
const toast = useToast()
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
/** 行字段多选（嵌套缩进，按选择顺序） */
const rowCols = ref<number[]>([0])
const colCol = ref(-1) // -1 = 不分列
const valCol = ref(1)
type Fn = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'pct-row' | 'pct-col' | 'pct-total'
const fn = ref<Fn>('sum')
const heat = ref(false)

const fns: { v: Fn; label: string }[] = [
  { v: 'sum', label: '求和' },
  { v: 'avg', label: '平均' },
  { v: 'count', label: '计数' },
  { v: 'min', label: '最小' },
  { v: 'max', label: '最大' },
  { v: 'median', label: '中位数' },
  { v: 'pct-row', label: '求和占比·行' },
  { v: 'pct-col', label: '求和占比·列' },
  { v: 'pct-total', label: '求和占比·总计' },
]

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    const lower = f.name.toLowerCase()
    let d: CsvData
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const sheets = await readXlsx(f)
      const s = sheets[0]
      d = { header: s.header, rows: s.rows }
    } else {
      d = await parseCsvAsync(await f.text())
    }
    data.value = d
    fileName.value = baseName(f.name)
    rowCols.value = [0]
    colCol.value = d.header.length > 1 ? 1 : -1
    valCol.value = d.header.length > 2 ? 2 : 0
    toast.ok(`已载入 ${d.rows.length} 行`)
  } catch (e) {
    toast.err((e as Error).message || '文件解析失败')
  } finally {
    loading.value = false
  }
}

const toggleRowCol = (i: number) => {
  rowCols.value = rowCols.value.includes(i) ? rowCols.value.filter((x) => x !== i) : [...rowCols.value, i]
}

/** 非数值披露 */
const nonNum = computed(() => (data.value ? countNonNumeric(data.value.rows, valCol.value) : 0))

const calc = (arr: number[]): number => {
  if (!arr.length) return 0
  switch (fn.value) {
    case 'sum': case 'pct-row': case 'pct-col': case 'pct-total':
      return arr.reduce((a, b) => a + b, 0)
    case 'avg': return arr.reduce((a, b) => a + b, 0) / arr.length
    case 'count': return arr.length
    case 'min': return Math.min(...arr)
    case 'max': return Math.max(...arr)
    case 'median': {
      const s = [...arr].sort((a, b) => a - b)
      const m = Math.floor(s.length / 2)
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
    }
  }
}

const MAX_ROWS = 200
const build = computed(() => {
  const d = data.value
  if (!d || !d.rows.length || !rowCols.value.length) return null
  return buildPivot(d.rows, rowCols.value, colCol.value, valCol.value)
})
const flat = computed(() => (build.value ? flattenTree(build.value.root, MAX_ROWS) : { rows: [], truncated: 0 }))

const isPct = computed(() => fn.value.startsWith('pct'))
const pctBase = computed(() => (fn.value === 'pct-row' ? 'row' : fn.value === 'pct-col' ? 'col' : 'total'))

const rawSumOf = (node: PivotNode, ck?: string): number => {
  const arr = ck === undefined ? node.arr : (node.colArrs.get(ck) ?? [])
  return arr.reduce((a, b) => a + b, 0)
}
const grandRaw = computed(() => (build.value ? rawSumOf(build.value.root) : 0))
const colRaw = (ck: string) => {
  if (!build.value) return 0
  return ck === '全部' ? grandRaw.value : rawSumOf(build.value.root, ck)
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

/** 单元格渲染值（占比模式输出百分比字符串；ck='全部' 表示行合计，取节点全量） */
const cellDisp = (node: PivotNode, ck: string): string => {
  const raw = ck === '全部' ? calc(node.arr) : calc(node.colArrs.get(ck) ?? [])
  if (!isPct.value) return fmt(raw)
  let base = grandRaw.value
  if (pctBase.value === 'row') base = rawSumOf(node)
  if (pctBase.value === 'col') base = ck === '全部' ? grandRaw.value : colRaw(ck)
  return base ? `${((raw / base) * 100).toFixed(1)}%` : '0.0%'
}

/** 热力：全表值归一化强度 */
const heatVal = computed(() => {
  if (!heat.value) return null
  const vals: number[] = []
  for (const fr of flat.value.rows) for (const ck of build.value?.colKeys ?? []) {
    const arr = fr.node.colArrs.get(ck)
    if (arr?.length) vals.push(calc(arr))
  }
  if (!vals.length) return null
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return (v: number) => (max === min ? 0.5 : (v - min) / (max - min))
})
const cellStyle = (node: PivotNode, ck: string) => {
  const h = heatVal.value
  if (!h) return undefined
  const arr = ck === '全部' ? node.arr : node.colArrs.get(ck)
  const v = arr?.length ? calc(arr) : 0
  return { background: `color-mix(in srgb, var(--accent) ${Math.round(6 + h(v) * 34)}%, transparent)` }
}

const nodeRowLabel = (fr: { key: string; level: number }) => `${'\u00A0\u00A0\u00A0\u00A0'.repeat(fr.level)}${fr.key}`

/* ---------- 导出（色阶仅网页生效） ---------- */
const exportXlsx = async () => {
  const b = build.value
  const d = data.value
  if (!b || !d) return
  const rows: (string | number)[][] = flat.value.rows.map((fr) => {
    const line: (string | number)[] = [nodeRowLabel(fr), ...b.colKeys.map((ck) => cellDisp(fr.node, ck))]
    line.push(cellDisp(fr.node, '全部'))
    return line
  })
  rows.push(['合计（全部）', ...b.colKeys.map((ck) => cellDisp(b.root, ck)), cellDisp(b.root, '全部')])
  const blob = await rowsToXlsx(
    [rowCols.value.map((i) => d.header[i]).join('>') || '行', ...b.colKeys, '合计'],
    rows,
    '透视表',
  )
  saveBlob(blob, `${fileName.value}-透视表.xlsx`)
  if (heat.value) toast.ok('已导出（色阶为网页效果，xlsx 不含底色）')
}

const exportCsv = () => {
  const b = build.value
  const d = data.value
  if (!b || !d) return
  const esc = (s: string) => (/["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [
    [rowCols.value.map((i) => d.header[i]).join('>') || '行', ...b.colKeys, '合计'].map(esc).join(','),
    ...flat.value.rows.map((fr) => [nodeRowLabel(fr), ...b.colKeys.map((ck) => cellDisp(fr.node, ck)), cellDisp(fr.node, '全部')].map(esc).join(',')),
    ['合计（全部）', ...b.colKeys.map((ck) => cellDisp(b.root, ck)), cellDisp(b.root, '全部')].map(esc).join(','),
  ]
  saveText('\uFEFF' + lines.join('\n'), `${fileName.value}-透视表.csv`, 'text/csv;charset=utf-8')
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.tsv,.txt,.xlsx,.xls" :multiple="false" label="拖放 CSV 或 Excel 文件，或点击选择" @files="onFiles" />

    <template v-if="data && build">
      <div v-if="nonNum > 0" class="notice notice-warn mt-2 small">值列「{{ data.header[valCol] }}」有 {{ nonNum }} 个非数值项，已按 0 计入聚合。</div>

      <div class="row row-wrap mt-2" style="gap: 6px; align-items: center">
        <span class="f-label">行字段（可多选嵌套）：</span>
        <label v-for="(h, i) in data.header" :key="i" class="chip" :class="{ on: rowCols.includes(i) }" style="cursor: pointer">
          <input type="checkbox" :checked="rowCols.includes(i)" style="margin-right: 4px" @change="toggleRowCol(i)" /> {{ h }}
        </label>
      </div>

      <div class="grid-4 mt-2">
        <div class="field">
          <label class="f-label">列字段</label>
          <select v-model.number="colCol" class="select">
            <option :value="-1">（不分列）</option>
            <option v-for="(h, i) in data.header" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
        <div class="field">
          <label class="f-label">值字段</label>
          <select v-model.number="valCol" class="select">
            <option v-for="(h, i) in data.header" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
        <div class="field">
          <label class="f-label">聚合方式</label>
          <select v-model="fn" class="select">
            <option v-for="f in fns" :key="f.v" :value="f.v">{{ f.label }}</option>
          </select>
        </div>
        <div class="field">
          <label class="f-label">色阶</label>
          <label class="check"><input v-model="heat" type="checkbox" /> 按值深浅着色（仅网页生效）</label>
        </div>
      </div>

      <div class="row row-wrap mt-2">
        <span class="badge">行 {{ flat.rows.length }}{{ flat.truncated ? `（截断，仅显示前 ${MAX_ROWS}）` : '' }} × 列 {{ build.colKeys.length }}{{ build.totalColKeys > build.colKeys.length ? `（截断，共 ${build.totalColKeys}）` : '' }}</span>
        <button class="btn btn-sm" @click="exportXlsx"><Download :size="14" /> 下载 xlsx</button>
        <button class="btn btn-sm" @click="exportCsv"><Download :size="14" /> 下载 CSV</button>
      </div>
      <p v-if="flat.truncated || build.totalColKeys > build.colKeys.length" class="muted small mt-1">
        仅显示前 {{ MAX_ROWS }} 个行组合（实际更多），请收窄行字段或加筛选后再透视。
      </p>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ rowCols.map((i) => data!.header[i]).join(' / ') || '全部' }}</th>
              <th v-for="ck in build.colKeys" :key="ck">{{ ck }}</th>
              <th class="total">合计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(fr, ri) in flat.rows" :key="ri" :class="{ leaf: fr.isLeaf }">
              <th class="row-head" :style="{ paddingLeft: 10 + fr.level * 18 + 'px' }">{{ fr.key }}<span v-if="!fr.isLeaf" class="muted small">（小计）</span></th>
              <td v-for="ck in build.colKeys" :key="ck" :style="cellStyle(fr.node, ck)">{{ cellDisp(fr.node, ck) }}</td>
              <td class="total" :style="cellStyle(fr.node, '全部')">{{ cellDisp(fr.node, '全部') }}</td>
            </tr>
            <tr class="total-row">
              <th class="row-head">合计（全部）</th>
              <td v-for="ck in build.colKeys" :key="ck" :style="cellStyle(build.root, ck)">{{ cellDisp(build.root, ck) }}</td>
              <td class="total" :style="cellStyle(build.root, '全部')">{{ cellDisp(build.root, '全部') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small mt-1">
        多级行字段逐级缩进，带「小计」的行为其子树聚合；占比模式以当前聚合的求和为基数。计数模式统计每分组数据条数，其余基于「{{ data.header[valCol] }}」列。
      </p>
    </template>
    <div v-else class="row mt-2 muted small">
      <Loader2 v-if="loading" :size="14" class="spin" />
      <Grid3x3 v-else :size="14" />
      {{ loading ? '正在载入…' : '载入数据后开始配置透视表' }}
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.field {
  display: grid;
  gap: 6px;
}
.f-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}
.chip.on {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}
tr.leaf td {
  color: var(--text-2);
}
.row-head {
  font-weight: 600;
  color: var(--text-2);
  background: var(--panel-solid);
  position: sticky;
  left: 0;
  z-index: 1;
}
.total {
  font-weight: 700;
}
.total-row td,
.total-row th {
  border-top: 2px solid var(--border-strong);
  font-weight: 700;
}
.table-wrap {
  max-height: max(480px, calc(100dvh - 420px));
  overflow: auto;
}
</style>
