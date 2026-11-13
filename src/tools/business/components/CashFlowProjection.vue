<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, Wand2 } from 'lucide-vue-next'
import { renderChart } from '@/lib/chartEngine'
import { rowsToCsv } from '@/lib/csvEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { useCashFlowStore, type MonthRow } from './useCashFlowStore'

/**
 * 现金流预测：场景持久化（localStorage）、跑道判定磁贴、覆盖确认、增长率批量器、移动端降列；
 * 支持从烧钱率工具透传（query: cash/revenue/expense，见 useCashFlowStore）。
 */
const toast = useToast()

const cash0 = ref(500000)
const months = ref(12)
const defIncome = ref(150000)
const defExpense = ref(180000)
const growthRate = ref(0) // 月收入增长率（%，批量填充用）
const rows = ref<MonthRow[]>([])
/** 用户编辑过的月份（覆盖确认用） */
const edited = ref<Set<number>>(new Set())
const confirmOpen = ref(false)

useCashFlowStore({ cash0, months, defIncome, defExpense, rows, edited })

const ensureRows = () => {
  const n = Math.min(36, Math.max(6, Math.round(Number(months.value) || 12)))
  months.value = n
  while (rows.value.length < n) rows.value.push({ income: Number(defIncome.value) || 0, expense: Number(defExpense.value) || 0 })
  if (rows.value.length > n) rows.value = rows.value.slice(0, n)
}
onMounted(ensureRows)
watch(months, ensureRows)

const markEdited = (i: number) => edited.value.add(i)

/** 把默认收入/支出应用到月份（确认弹层：全部覆盖 / 仅未编辑行 / 取消） */
const askApplyDefaults = () => {
  if (!edited.value.size) {
    doApply(true)
    return
  }
  confirmOpen.value = true
}
const doApply = (all: boolean) => {
  confirmOpen.value = false
  const g = Math.min(99, Math.max(0, Number(growthRate.value) || 0)) / 100
  rows.value = rows.value.map((r, i) => {
    const shouldApply = all || !edited.value.has(i)
    if (!shouldApply) return r
    return { income: Math.round((Number(defIncome.value) || 0) * Math.pow(1 + g, i)), expense: Number(defExpense.value) || 0 }
  })
  if (all) edited.value = new Set()
  toast.ok(all ? '已应用到全部月份' : '已仅覆盖未编辑月份')
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
/** 首个现金转负的月份（0 基；无则 -1） */
const firstNegative = computed(() => calcRows.value.findIndex((r) => r.ending < 0))

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
    <div class="row row-wrap mt-1" style="align-items: flex-end">
      <div>
        <label class="field-label">月收入增长率%（可选，批量填充用）</label>
        <input v-model.number="growthRate" type="number" class="input" style="width: 150px" step="0.5" placeholder="如 5" />
      </div>
      <button class="btn btn-ghost btn-sm" @click="askApplyDefaults"><Wand2 :size="14" /> 把默认值应用到月份</button>
      <span class="small muted" v-if="edited.size">已编辑 {{ edited.size }} 个月（覆盖前会确认）</span>
    </div>

    <!-- 覆盖确认弹层 -->
    <div v-if="confirmOpen" class="confirm-box mt-1">
      <span class="small">将覆盖 <b>{{ edited.size }}</b> 个已编辑月份的数值，请选择方式：</span>
      <button class="btn btn-soft btn-sm" @click="doApply(false)">仅覆盖未编辑行</button>
      <button class="btn btn-primary btn-sm" @click="doApply(true)">全部覆盖</button>
      <button class="btn btn-ghost btn-sm" @click="confirmOpen = false">取消</button>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead>
          <tr><th>月份</th><th>月收入</th><th>月支出</th><th class="col-net">净流入</th><th>期末现金</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in calcRows" :key="i" :class="{ 'min-row': r.ending === minEnding }">
            <td>{{ r.label }}</td>
            <td><input v-model.number="rows[i].income" type="number" class="input w-cell" @input="markEdited(i)" /></td>
            <td><input v-model.number="rows[i].expense" type="number" class="input w-cell" @input="markEdited(i)" /></td>
            <td class="col-net" :class="r.net >= 0 ? 'ok' : 'bad'">{{ r.net >= 0 ? '+' : '' }}{{ fmt(r.net) }}</td>
            <td><b :class="r.ending < 0 ? 'bad' : ''">{{ fmt(r.ending) }}</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 跑道判定磁贴：现金转负预警 -->
    <div v-if="firstNegative >= 0" class="warn-tile mt-2">
      ✗ 预计 <b>{{ monthLabels[firstNegative] }}</b> 现金转负，距今 {{ firstNegative + 1 }} 个月 —— 请提前安排融资或削减成本。
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
    <p class="hint mt-1">期末现金 = 上月期末 + 月收入 − 月支出；余额为负的月份已标红。场景数据自动保存在本机浏览器，刷新后恢复。</p>
  </div>
</template>

<style scoped>
.top-fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 860px) { .top-fields { grid-template-columns: repeat(2, 1fr); } }
.months-box .range { width: 100%; }
.w-cell { width: 110px; }
.min-row td { background: rgba(251, 191, 36, 0.12); }
.ok { color: var(--ok); }
.bad { color: var(--err); }
.confirm-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--warn);
  background: color-mix(in srgb, var(--warn) 10%, transparent);
  border-radius: 10px;
  padding: 8px 12px;
}
.warn-tile {
  border: 1px solid var(--err);
  background: color-mix(in srgb, var(--err) 12%, transparent);
  color: var(--err);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 13.5px;
}
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 640px) { .stats { grid-template-columns: 1fr; } }
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
/* 移动端降列：隐藏净流入列并收窄输入格 */
@media (max-width: 560px) {
  .col-net { display: none; }
  .w-cell { width: 74px; }
}
</style>
