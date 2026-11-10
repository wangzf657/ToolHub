<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Table2, Loader2 } from 'lucide-vue-next'
import { amortize, formatMoney, type AmortRow } from '@/lib/finance'
import { renderChart } from '@/lib/chartEngine'
import { rowsToXlsx } from '@/lib/officeEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)

const principal = ref<number | ''>('')
const rate = ref(3.6)
const years = ref(30)
const mode = ref<'axbx' | 'axbj'>('axbx')
const withPrepay = ref(false)
const prepayMonth = ref(12)
const prepayAmount = ref<number | ''>('')

const result = ref<{ monthly: number; rows: AmortRow[]; totalInterest: number; total: number } | null>(null)
const showAll = ref(false)
const seriesRef = ref<HTMLCanvasElement | null>(null)

const displayed = computed(() => (result.value ? (showAll.value ? result.value.rows : result.value.rows.slice(0, 12)) : []))

const money = (n: number) => formatMoney(n)

const run = async () => {
  const p = Number(principal.value)
  if (!(p > 0)) return toast.warn('请填写贷款本金')
  const r = amortize(p, Number(rate.value), Math.round(Number(years.value) * 12), mode.value, withPrepay.value && Number(prepayAmount.value) > 0 ? { month: Math.max(1, Math.round(Number(prepayMonth.value))), amount: Number(prepayAmount.value) } : undefined)
  result.value = r
  await nextTick()
  drawChart(r)
}

const drawChart = (r: { rows: AmortRow[] }) => {
  // 每年本金/利息累计的柱状图
  const byYear = new Map<number, { p: number; i: number }>()
  for (const row of r.rows) {
    const y = Math.ceil(row.month / 12)
    const agg = byYear.get(y) ?? { p: 0, i: 0 }
    agg.p += row.principal
    agg.i += row.interest
    byYear.set(y, agg)
  }
  const yearsArr = [...byYear.keys()].sort((a, b) => a - b)
  const cv = seriesRef.value
  if (!cv) return
  renderChart(
    cv,
    'bar',
    yearsArr.map((y) => `第${y}年`),
    [
      { label: '本金（万元）', data: yearsArr.map((y) => +(byYear.get(y)!.p / 10000).toFixed(2)) },
      { label: '利息（万元）', data: yearsArr.map((y) => +(byYear.get(y)!.i / 10000).toFixed(2)) },
    ],
    { legend: true },
  )
}

const exportXlsx = async () => {
  if (!result.value) return
  busy.value = true
  try {
    const rows: (string | number)[][] = []
    for (const r of result.value.rows) rows.push([r.month, +r.payment.toFixed(2), +r.principal.toFixed(2), +r.interest.toFixed(2), +r.balance.toFixed(2)])
    const blob = await rowsToXlsx(['期数', '月供（元）', '本金（元）', '利息（元）', '剩余本金（元）'], rows, '还款计划表')
    saveBlob(blob, '房贷还款计划表.xlsx')
    toast.ok('已导出 Excel')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="field-label">贷款本金</span>
        <input v-model="principal" type="number" class="input n-input" placeholder="元" />
        <span class="field-label">年利率</span>
        <input v-model="rate" type="number" class="input n-input" step="0.01" />
        <span class="field-label">年限</span>
        <input v-model="years" type="number" class="input n-input" min="1" max="50" />
        <span class="field-label">方式</span>
        <select v-model="mode" class="input">
          <option value="axbx">等额本息</option>
          <option value="axbj">等额本金</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="run"><Table2 :size="15" /> 生成计划表</button>
      </div>
      <div class="row wrap gap mt-2">
        <label class="check"><input v-model="withPrepay" type="checkbox" /> 模拟提前还款</label>
        <template v-if="withPrepay">
          <span class="field-label">第</span>
          <input v-model="prepayMonth" type="number" class="input n-input" min="1" />
          <span class="field-label">期还款后多还</span>
          <input v-model="prepayAmount" type="number" class="input n-input" placeholder="元" />
        </template>
      </div>
      <p class="hint mt-1">口径：等额本息月供固定、利息先多后少；等额本金每月本金相同、月供递减。提前还款按「月供减少、期限不变」重算。利率以实际合同为准。</p>
    </div>

    <div v-if="result" class="mt-2">
      <div class="stat-grid">
        <div class="stat primary">
          <span class="v">¥{{ money(mode === 'axbx' ? result.monthly : result.rows[0]?.payment ?? 0) }}</span>
          <span class="l">{{ mode === 'axbx' ? '每月月供' : '首月月供（递减）' }}</span>
        </div>
        <div class="stat"><span class="v">¥{{ money(result.totalInterest) }}</span><span class="l">利息总额</span></div>
        <div class="stat"><span class="v">¥{{ money(result.total) }}</span><span class="l">本息合计</span></div>
        <div class="stat"><span class="v">{{ result.rows.length }}</span><span class="l">总期数</span></div>
      </div>

      <canvas ref="seriesRef" class="mt-2" width="720" height="240"></canvas>

      <div class="row gap mt-2">
        <button class="btn btn-sm" @click="showAll = !showAll">{{ showAll ? '只看前 12 期' : `展开全部 ${result.rows.length} 期` }}</button>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="exportXlsx"><Loader2 v-if="busy" :size="14" class="spin" /><Table2 v-else :size="14" /> 导出 Excel</button>
      </div>

      <div class="table-wrap mt-2">
        <table class="tbl">
          <thead><tr><th>期数</th><th>月供</th><th>本金</th><th>利息</th><th>剩余本金</th></tr></thead>
          <tbody>
            <tr v-for="r in displayed" :key="r.month">
              <td>{{ r.month }}</td>
              <td>{{ money(r.payment) }}</td>
              <td>{{ money(r.principal) }}</td>
              <td>{{ money(r.interest) }}</td>
              <td>{{ money(r.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!showAll && result.rows.length > 12" class="hint mt-1">仅显示前 12 期，导出 Excel 或展开查看全部。</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; }
.n-input { width: 110px; }
.stat-grid { display: flex; gap: 10px; flex-wrap: wrap; }
.stat { padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; gap: 2px; min-width: 110px; }
.stat .v { font-size: 18px; font-weight: 700; }
.stat .l { font-size: 12px; color: var(--muted); }
.stat.primary { border-color: var(--accent); }
.stat.primary .v { color: var(--accent-text); }
.hint { font-size: 12px; color: var(--muted); }
.table-wrap { max-height: 380px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th, .tbl td { padding: 6px 12px; text-align: right; border-bottom: 1px solid var(--border); }
.tbl th:first-child, .tbl td:first-child { text-align: left; }
.tbl thead th { position: sticky; top: 0; background: var(--surface-2, inherit); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
