<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, Wand2 } from 'lucide-vue-next'
import { renderChart } from '@/lib/chartEngine'
import { rowsToCsv } from '@/lib/csvEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface MonthRow {
  income: number
  expense: number
}

const cash0 = ref(500000)
const months = ref(12)
const defIncome = ref(150000)
const defExpense = ref(180000)

/** 每月明细（可逐月覆盖） */
const rows = ref<MonthRow[]>([])

const ensureRows = () => {
  const n = Math.min(36, Math.max(6, Math.round(Number(months.value) || 12)))
  months.value = n
  while (rows.value.length < n) rows.value.push({ income: Number(defIncome.value) || 0, expense: Number(defExpense.value) || 0 })
  if (rows.value.length > n) rows.value = rows.value.slice(0, n)
}
onMounted(ensureRows)
watch(months, ensureRows)

/** 把默认收入/支出应用到所有月份 */
const applyDefaults = () => {
  rows.value = rows.value.map(() => ({ income: Number(defIncome.value) || 0, expense: Number(defExpense.value) || 0 }))
  toast.ok('已应用到全部月份')
}

const num = (v: number | undefined) => (Number.isFinite(v) ? Number(v) : 0)

/** 月份标签：从当月起逐月推算 */
const monthLabels = computed(() => {
  const d = new Date()
  return rows.value.map((_, i) => {
    const t = new Date(d.getFullYear(), d.getMonth() + i, 1)
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
  })
})

interface CalcRow extends MonthRow {
  label: string
  net: number
  ending: number
}

const calcRows = computed<CalcRow[]>(() => {
  let cash = Number(cash0.value) || 0
  return rows.value.map((r, i) => {
    const net = num(r.income) - num(r.expense)
    cash += net
    return { ...r, label: monthLabels.value[i], net, ending: cash }
  })
})
const minEnding = computed(() => (calcRows.value.length ? Math.min(...calcRows.value.map((r) => r.ending)) : 0))
const finalCash = computed(() => calcRows.value[calcRows.value.length - 1]?.ending ?? 0)
const totalNet = computed(() => calcRows.value.reduce((s, r) => s + r.net, 0))

const fmt = (n: number) => `¥${Math.round(n).toLocaleString('zh-CN')}`

/* ---------- 现金曲线 ---------- */
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null
const draw = () => {
  if (!stage.value || !calcRows.value.length) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  cleanup = renderChart(
    canvas,
    'line',
    calcRows.value.map((r) => r.label),
    [{ label: '期末现金', data: calcRows.value.map((r) => Math.round(r.ending)) }],
    { legend: false },
  )
}
watch(calcRows, draw, { flush: 'post' })
onMounted(draw)
onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})

/* ---------- 下载 CSV ---------- */
const dlCsv = () => {
  const header = ['月份', '月收入', '月支出', '净流入', '期末现金']
  const data = calcRows.value.map((r) => [r.label, String(Math.round(num(r.income))), String(Math.round(num(r.expense))), String(Math.round(r.net)), String(Math.round(r.ending))])
  saveText('\uFEFF' + rowsToCsv(header, data), '现金流预测.csv', 'text/csv;charset=utf-8')
  toast.ok('CSV 已开始下载')
}
</script>

<template>
  <div>
    <div class="top-fields">
      <div>
        <label class="field-label">期初现金</label>
        <input v-model.number="cash0" type="number" class="input" placeholder="如 500000" />
      </div>
      <div class="months-box">
        <label class="field-label">预测月数：<b>{{ months }}</b> 个月</label>
        <input v-model.number="months" type="range" min="6" max="36" step="1" class="range" />
      </div>
      <div>
        <label class="field-label">默认月收入</label>
        <input v-model.number="defIncome" type="number" class="input" placeholder="如 150000" />
      </div>
      <div>
        <label class="field-label">默认月支出</label>
        <input v-model.number="defExpense" type="number" class="input" placeholder="如 180000" />
      </div>
    </div>
    <div class="row mt-1">
      <button class="btn btn-ghost btn-sm" @click="applyDefaults"><Wand2 :size="14" /> 把默认值应用到所有月份</button>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead>
          <tr><th>月份</th><th>月收入</th><th>月支出</th><th>净流入</th><th>期末现金</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in calcRows" :key="i" :class="{ 'min-row': r.ending === minEnding }">
            <td>{{ r.label }}</td>
            <td><input v-model.number="rows[i].income" type="number" class="input w-cell" /></td>
            <td><input v-model.number="rows[i].expense" type="number" class="input w-cell" /></td>
            <td :class="r.net >= 0 ? 'ok' : 'bad'">{{ r.net >= 0 ? '+' : '' }}{{ fmt(r.net) }}</td>
            <td><b :class="r.ending < 0 ? 'bad' : ''">{{ fmt(r.ending) }}</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="stats mt-2">
      <div class="stat-tile hl">
        <span class="st-label">期末现金（{{ monthLabels[monthLabels.length - 1] || '—' }}）</span>
        <strong class="st-val" :class="finalCash < 0 ? 'bad' : 'ok'">{{ fmt(finalCash) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">期间净流入合计</span>
        <strong class="st-val">{{ totalNet >= 0 ? '+' : '' }}{{ fmt(totalNet) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">最低现金点</span>
        <strong class="st-val" :class="minEnding < 0 ? 'bad' : ''">{{ fmt(minEnding) }}</strong>
        <span class="st-sub">出现在 {{ calcRows.find((r) => r.ending === minEnding)?.label || '—' }}</span>
      </div>
    </div>

    <div class="chart-stage mt-2">
      <div ref="stage" class="chart-box"></div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="dlCsv"><Download :size="16" /> 下载 CSV</button>
    </div>
    <p class="hint mt-1">期末现金 = 上月期末 + 月收入 − 月支出；余额为负的月份已标红，需提前安排融资或削减成本。</p>
  </div>
</template>

<style scoped>
.top-fields {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 860px) {
  .top-fields { grid-template-columns: repeat(2, 1fr); }
}
.months-box .range { width: 100%; }
.w-cell { width: 110px; }
.min-row td { background: rgba(251, 191, 36, 0.12); }
.ok { color: var(--ok); }
.bad { color: var(--err); }
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
@media (max-width: 640px) {
  .stats { grid-template-columns: 1fr; }
}
.stat-tile {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  display: grid;
  gap: 4px;
}
.stat-tile.hl { border-color: var(--accent); }
.st-label { font-size: 12px; color: var(--text-3); }
.st-val { font-size: 20px; }
.st-sub { font-size: 12px; color: var(--text-3); }
.chart-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.chart-box { height: 300px; position: relative; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
