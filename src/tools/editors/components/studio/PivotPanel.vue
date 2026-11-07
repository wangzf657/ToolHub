<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Dataset } from './dataShared'

/** 透视面板（简版）：行字段 × 列字段 × 值聚合 */
const props = defineProps<{ dataset: Dataset }>()

const rowCol = ref(0)
const colCol = ref(-1)
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

const pivot = computed(() => {
  const ds = props.dataset
  const cells = new Map<string, Map<string, number[]>>()
  const rowKeys: string[] = []
  const colKeys: string[] = []
  for (const r of ds.rows) {
    const rk = rowCol.value >= 0 ? (r[rowCol.value] ?? '') || '（空）' : '全部'
    const ck = colCol.value >= 0 ? (r[colCol.value] ?? '') || '（空）' : '全部'
    if (!cells.has(rk)) {
      cells.set(rk, new Map())
      rowKeys.push(rk)
    }
    const rm = cells.get(rk)!
    if (!rm.has(ck)) {
      rm.set(ck, [])
      if (!colKeys.includes(ck)) colKeys.push(ck)
    }
    const v = parseFloat(r[valCol.value] ?? '')
    rm.get(ck)!.push(Number.isNaN(v) ? 0 : v)
  }
  return { rowKeys, colKeys, cells }
})

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

const cell = (rk: string, ck: string) => {
  const arr = pivot.value.cells.get(rk)?.get(ck)
  return arr ? calc(arr) : 0
}
const rowTotal = (rk: string) => {
  const all: number[] = []
  for (const ck of pivot.value.colKeys) all.push(...(pivot.value.cells.get(rk)?.get(ck) ?? []))
  return calc(all)
}
const colTotal = (ck: string) => {
  const all: number[] = []
  for (const rk of pivot.value.rowKeys) all.push(...(pivot.value.cells.get(rk)?.get(ck) ?? []))
  return calc(all)
}
const grand = computed(() => {
  const all: number[] = []
  for (const rk of pivot.value.rowKeys) for (const ck of pivot.value.colKeys) all.push(...(pivot.value.cells.get(rk)?.get(ck) ?? []))
  return calc(all)
})
</script>

<template>
  <div>
    <div class="row row-wrap">
      <label class="check">
        行字段
        <select v-model.number="rowCol" class="select" style="width: 130px">
          <option :value="-1">（不分组）</option>
          <option v-for="(h, i) in dataset.header" :key="i" :value="i">{{ h }}</option>
        </select>
      </label>
      <label class="check">
        列字段
        <select v-model.number="colCol" class="select" style="width: 130px">
          <option :value="-1">（不分列）</option>
          <option v-for="(h, i) in dataset.header" :key="i" :value="i">{{ h }}</option>
        </select>
      </label>
      <label class="check">
        值字段
        <select v-model.number="valCol" class="select" style="width: 130px">
          <option v-for="(h, i) in dataset.header" :key="i" :value="i">{{ h }}</option>
        </select>
      </label>
      <label class="check">
        聚合
        <select v-model="fn" class="select" style="width: 110px">
          <option v-for="f in fns" :key="f.v" :value="f.v">{{ f.label }}</option>
        </select>
      </label>
    </div>

    <div class="table-wrap mt-2" style="max-height: 460px">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ rowCol >= 0 ? dataset.header[rowCol] : '全部' }}</th>
            <th v-for="ck in pivot.colKeys" :key="ck">{{ ck }}</th>
            <th class="total">合计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rk in pivot.rowKeys" :key="rk">
            <th class="row-head">{{ rk }}</th>
            <td v-for="ck in pivot.colKeys" :key="ck">{{ fmt(cell(rk, ck)) }}</td>
            <td class="total">{{ fmt(rowTotal(rk)) }}</td>
          </tr>
          <tr class="total-row">
            <th class="row-head">合计</th>
            <td v-for="ck in pivot.colKeys" :key="ck">{{ fmt(colTotal(ck)) }}</td>
            <td class="total">{{ fmt(grand) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
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
