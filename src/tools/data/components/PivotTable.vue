<script setup lang="ts">
import { computed, ref } from 'vue'
import { Grid3x3, Loader2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { readXlsx, rowsToXlsx } from '@/lib/officeEngine'
import { saveText, saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 在线数据透视表：行/列/值 + 聚合方式 → 透视表格 + 行列合计 + 导出 */
const toast = useToast()
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
const rowCol = ref(0)
const colCol = ref(-1) // -1 = 不分列
const valCol = ref(1)
const fn = ref<'sum' | 'avg' | 'count' | 'min' | 'max' | 'median'>('sum')

const fns = [
  { v: 'sum', label: '求和' },
  { v: 'avg', label: '平均' },
  { v: 'count', label: '计数' },
  { v: 'min', label: '最小' },
  { v: 'max', label: '最大' },
  { v: 'median', label: '中位数' },
] as const

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
    rowCol.value = 0
    colCol.value = d.header.length > 1 ? 1 : -1
    valCol.value = d.header.length > 2 ? 2 : 0
    toast.ok(`已载入 ${d.rows.length} 行`)
  } catch (e) {
    toast.err((e as Error).message || '文件解析失败')
  } finally {
    loading.value = false
  }
}

const calc = (arr: number[]): number => {
  if (!arr.length) return 0
  switch (fn.value) {
    case 'sum': return arr.reduce((a, b) => a + b, 0)
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

interface PivotResult {
  rowKeys: string[]
  colKeys: string[]
  cells: Map<string, Map<string, number[]>>
}

/** 双层聚合：行字段 × 列字段 */
const pivot = computed<PivotResult | null>(() => {
  const d = data.value
  if (!d || !d.rows.length) return null
  const cells = new Map<string, Map<string, number[]>>()
  const rowKeys: string[] = []
  const colKeys: string[] = []
  for (const r of d.rows) {
    const rk = rowCol.value >= 0 ? (r[rowCol.value] ?? '') || '（空）' : '全部'
    const ck = colCol.value >= 0 ? (r[colCol.value] ?? '') || '（空）' : '全部'
    if (!cells.has(rk)) {
      cells.set(rk, new Map())
      rowKeys.push(rk)
    }
    const rowMap = cells.get(rk)!
    if (!rowMap.has(ck)) {
      rowMap.set(ck, [])
      if (!colKeys.includes(ck)) colKeys.push(ck)
    }
    const v = parseFloat(r[valCol.value] ?? '')
    rowMap.get(ck)!.push(Number.isNaN(v) ? 0 : v)
  }
  return { rowKeys, colKeys, cells }
})

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

/** 单元格值 */
const cellVal = (rk: string, ck: string): number => {
  const p = pivot.value
  const arr = p?.cells.get(rk)?.get(ck)
  return arr ? calc(arr) : 0
}
/** 行合计 */
const rowTotal = (rk: string): number => {
  const p = pivot.value
  if (!p) return 0
  const all: number[] = []
  for (const ck of p.colKeys) all.push(...(p.cells.get(rk)?.get(ck) ?? []))
  return calc(all)
}
/** 列合计 */
const colTotal = (ck: string): number => {
  const p = pivot.value
  if (!p) return 0
  const all: number[] = []
  for (const rk of p.rowKeys) all.push(...(p.cells.get(rk)?.get(ck) ?? []))
  return calc(all)
}
/** 总合计 */
const grandTotal = computed(() => {
  const p = pivot.value
  if (!p) return 0
  const all: number[] = []
  for (const rk of p.rowKeys) for (const ck of p.colKeys) all.push(...(p.cells.get(rk)?.get(ck) ?? []))
  return calc(all)
})

const exportXlsx = async () => {
  const p = pivot.value
  const d = data.value
  if (!p || !d) return
  const rows: (string | number)[][] = p.rowKeys.map((rk) => {
    const line: (string | number)[] = [rk, ...p.colKeys.map((ck) => fmt(cellVal(rk, ck)))]
    line.push(fmt(rowTotal(rk)))
    return line
  })
  rows.push([
    '合计',
    ...p.colKeys.map((ck) => fmt(colTotal(ck))),
    fmt(grandTotal.value),
  ])
  const blob = await rowsToXlsx(
    [d.header[rowCol.value >= 0 ? rowCol.value : 0] ?? '行', ...p.colKeys, '合计'],
    rows,
    '透视表',
  )
  saveBlob(blob, `${fileName.value}-透视表.xlsx`)
}

const exportCsv = () => {
  const p = pivot.value
  const d = data.value
  if (!p || !d) return
  const esc = (s: string) => (/["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [
    [d.header[rowCol.value >= 0 ? rowCol.value : 0] ?? '行', ...p.colKeys, '合计'].map(esc).join(','),
    ...p.rowKeys.map((rk) =>
      [rk, ...p.colKeys.map((ck) => fmt(cellVal(rk, ck))), fmt(rowTotal(rk))].map(esc).join(','),
    ),
    ['合计', ...p.colKeys.map((ck) => fmt(colTotal(ck))), fmt(grandTotal.value)].map(esc).join(','),
  ]
  saveText('\uFEFF' + lines.join('\n'), `${fileName.value}-透视表.csv`, 'text/csv;charset=utf-8')
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.tsv,.txt,.xlsx,.xls" :multiple="false" label="拖放 CSV 或 Excel 文件，或点击选择" @files="onFiles" />

    <template v-if="data && pivot">
      <div class="grid-4 mt-2">
        <div class="field">
          <label class="f-label">行字段</label>
          <select v-model.number="rowCol" class="select">
            <option :value="-1">（不分组）</option>
            <option v-for="(h, i) in data.header" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
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
      </div>

      <div class="row row-wrap mt-2">
        <span class="badge">行 {{ pivot.rowKeys.length }} × 列 {{ pivot.colKeys.length }}</span>
        <button class="btn btn-sm" @click="exportXlsx"><Download :size="14" /> 下载 xlsx</button>
        <button class="btn btn-sm" @click="exportCsv"><Download :size="14" /> 下载 CSV</button>
      </div>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ rowCol >= 0 ? data.header[rowCol] : '全部' }}</th>
              <th v-for="ck in pivot.colKeys" :key="ck">{{ ck }}</th>
              <th class="total">合计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rk in pivot.rowKeys" :key="rk">
              <th class="row-head">{{ rk }}</th>
              <td v-for="ck in pivot.colKeys" :key="ck">{{ fmt(cellVal(rk, ck)) }}</td>
              <td class="total">{{ fmt(rowTotal(rk)) }}</td>
            </tr>
            <tr class="total-row">
              <th class="row-head">合计</th>
              <td v-for="ck in pivot.colKeys" :key="ck">{{ fmt(colTotal(ck)) }}</td>
              <td class="total">{{ fmt(grandTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small mt-1">
        计数模式下统计每个分组的数据条数；其他方式基于「{{ data.header[valCol] }}」列的数值。
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
</style>
