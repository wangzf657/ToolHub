<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const shares = ref(1000)
const price = ref(20)
const divYield = ref(3)
const divGrowth = ref(5)
const priceGrowth = ref(4)
const drip = ref(true)
const years = ref(10)

interface YearRow {
  year: number
  shares: number
  price: number
  dividend: number
  cum: number
}

/** 口径：第 t 年每股股息 = 初始股价 × 股息率 ×（1+股息增长）^(t-1)；
 *  股价按股价增长率复利；DRIP 在年末按当年股价把股息全部买入新股。 */
const schedule = computed<YearRow[]>(() => {
  const n0 = Math.max(0, Number(shares.value) || 0)
  const p0 = Math.max(0, Number(price.value) || 0)
  const y = (Number(divYield.value) || 0) / 100
  const dg = (Number(divGrowth.value) || 0) / 100
  const pg = (Number(priceGrowth.value) || 0) / 100
  const n = Math.min(60, Math.max(1, Math.round(Number(years.value) || 1)))
  const rows: YearRow[] = []
  let cnt = n0
  let cum = 0
  for (let t = 1; t <= n; t++) {
    const dps = p0 * y * Math.pow(1 + dg, t - 1)
    const p = p0 * Math.pow(1 + pg, t - 1)
    const div = cnt * dps
    cum += div
    if (drip.value) cnt += p > 0 ? div / p : 0
    rows.push({ year: t, shares: cnt, price: p, dividend: div, cum })
  }
  return rows
})

const last = computed(() => schedule.value[schedule.value.length - 1])
const totalCum = computed(() => schedule.value.reduce((s, r) => s + r.dividend, 0))
const firstYearDiv = computed(() => schedule.value[0]?.dividend ?? 0)

const money = (n: number, d = 2) => `$${n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })}`

const copyTip = () => {
  toast.ok(`期末年股息收入 ${money(last.value?.dividend ?? 0)}，累计 ${money(totalCum.value)}`)
}
</script>

<template>
  <div>
    <div class="fields">
      <div>
        <label class="field-label">初始持股数</label>
        <input v-model.number="shares" type="number" class="input" min="0" placeholder="如 1000" />
      </div>
      <div>
        <label class="field-label">当前股价</label>
        <input v-model.number="price" type="number" class="input" step="0.01" min="0" placeholder="如 20" />
      </div>
      <div>
        <label class="field-label">年股息率（%）</label>
        <input v-model.number="divYield" type="number" class="input" step="0.1" min="0" placeholder="如 3" />
      </div>
      <div>
        <label class="field-label">股息年增长率（%）</label>
        <input v-model.number="divGrowth" type="number" class="input" step="0.5" min="0" placeholder="如 5" />
      </div>
      <div>
        <label class="field-label">股价年增长率（%）</label>
        <input v-model.number="priceGrowth" type="number" class="input" step="0.5" placeholder="如 4" />
      </div>
      <div>
        <label class="field-label">投资年限（年）</label>
        <input v-model.number="years" type="number" class="input" min="1" max="60" placeholder="如 10" />
      </div>
    </div>

    <label class="check mt-2">
      <input v-model="drip" type="checkbox" />
      股息再投资（DRIP）——每年股息按当年股价买入新股
    </label>

    <div class="stats mt-2">
      <div class="stat-tile hl">
        <span class="st-label">期末年股息收入（第 {{ last?.year ?? 0 }} 年）</span>
        <strong class="st-val big">{{ money(last?.dividend ?? 0) }}</strong>
        <span class="st-sub" v-if="firstYearDiv > 0">较第 1 年增长 {{ (((last?.dividend ?? 0) / firstYearDiv - 1) * 100).toFixed(0) }}%</span>
      </div>
      <div class="stat-tile">
        <span class="st-label">{{ years }} 年累计股息收入</span>
        <strong class="st-val">{{ money(totalCum) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">期末持股数</span>
        <strong class="st-val">{{ Math.round(last?.shares ?? 0).toLocaleString() }} 股</strong>
      </div>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead>
          <tr><th>年份</th><th>年末持股</th><th>年末股价</th><th>该年股息收入</th><th>累计收入</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in schedule" :key="r.year">
            <td>第 {{ r.year }} 年</td>
            <td>{{ Math.round(r.shares).toLocaleString() }}</td>
            <td>{{ money(r.price) }}</td>
            <td>{{ money(r.dividend) }}</td>
            <td>{{ money(r.cum) }}</td>
          </tr>
          <tr class="sum-row">
            <td><b>合计</b></td>
            <td><b>{{ Math.round(last?.shares ?? 0).toLocaleString() }} 股</b></td>
            <td><b>{{ money(last?.price ?? 0) }}</b></td>
            <td><b>{{ money(last?.dividend ?? 0) }}/年</b></td>
            <td><b>{{ money(totalCum) }}</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row mt-2">
      <button class="btn btn-ghost btn-sm" @click="copyTip">复制关键结果</button>
    </div>
    <p class="hint mt-1">计算口径：每股股息 = 初始股价 × 股息率 ×（1+股息增长）^(t−1)，与股价增长相互独立；DRIP 忽略税费与交易摩擦。</p>
  </div>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
@media (max-width: 640px) {
  .fields { grid-template-columns: 1fr; }
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  color: var(--text-2);
}
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
.st-val.big { font-size: 26px; color: var(--accent-text); }
.st-sub { font-size: 12px; color: var(--text-3); }
.sum-row td { background: var(--accent-soft); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
