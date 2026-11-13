<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const shares = ref(1000)
const price = ref(20)
const divYield = ref(3)
const divGrowth = ref(5)
const priceGrowth = ref(4)
const drip = ref(true)
const years = ref(10)
/** 股息税率：每股股息先税后计入 DRIP 与累计 */
const tax = ref(0)
/** 派息频率：季/月付按子周期复利再投资 */
const payFreq = ref<'year' | 'quarter' | 'month'>('year')
const currency = ref<'CNY' | 'USD'>('CNY')

const STORAGE_KEY = 'toolhub-dividend'
onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>
      const setNum = (k: string, r: { value: number }) => {
        if (typeof p[k] === 'number') r.value = p[k]
      }
      setNum('shares', shares); setNum('price', price); setNum('divYield', divYield)
      setNum('divGrowth', divGrowth); setNum('priceGrowth', priceGrowth); setNum('years', years)
      if (typeof p.tax === 'number') tax.value = p.tax
      if (p.payFreq === 'quarter' || p.payFreq === 'month' || p.payFreq === 'year') payFreq.value = p.payFreq
      if (p.currency === 'CNY' || p.currency === 'USD') currency.value = p.currency
      if (typeof p.drip === 'boolean') drip.value = p.drip
    }
  } catch {
    /* 忽略损坏草稿 */
  }
})
watch(
  () => [shares.value, price.value, divYield.value, divGrowth.value, priceGrowth.value, years.value, tax.value, payFreq.value, currency.value, drip.value],
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ shares: shares.value, price: price.value, divYield: divYield.value, divGrowth: divGrowth.value, priceGrowth: priceGrowth.value, years: years.value, tax: tax.value, payFreq: payFreq.value, currency: currency.value, drip: drip.value }))
    } catch {
      /* 存储满静默 */
    }
  },
)

interface YearRow {
  year: number
  shares: number
  price: number
  dividend: number
  cum: number
}

/** 单次模拟：periods = 1/4/12；每股股息先扣税，再按子周期复利再投资 */
const simulate = (withDrip: boolean): YearRow[] => {
  const n0 = Math.max(0, Number(shares.value) || 0)
  const p0 = Math.max(0, Number(price.value) || 0)
  const y = (Number(divYield.value) || 0) / 100
  const dg = (Number(divGrowth.value) || 0) / 100
  const pg = (Number(priceGrowth.value) || 0) / 100
  const n = Math.min(60, Math.max(1, Math.round(Number(years.value) || 1)))
  const periods = payFreq.value === 'year' ? 1 : payFreq.value === 'quarter' ? 4 : 12
  const rows: YearRow[] = []
  let cnt = n0
  let cum = 0
  for (let t = 1; t <= n; t++) {
    const dpsYear = p0 * y * Math.pow(1 + dg, t - 1) * (1 - tax.value / 100)
    let divYear = 0
    for (let s = 1; s <= periods; s++) {
      const frac = (t - 1 + s / periods - 1) // 子周期进度（0 基）
      const p = p0 * Math.pow(1 + pg, Math.max(0, frac) + (periods === 1 ? 0 : 0)) // 年末价口径保持不变，仅再投资节奏变化
      const divSub = (cnt * dpsYear) / periods
      divYear += divSub
      cum += divSub
      if (withDrip && p > 0) cnt += divSub / p
    }
    const pEnd = p0 * Math.pow(1 + pg, t - 1)
    rows.push({ year: t, shares: cnt, price: pEnd, dividend: divYear, cum })
  }
  return rows
}

const schedule = computed(() => simulate(drip.value))
const baseline = computed(() => simulate(false))

const last = computed(() => schedule.value[schedule.value.length - 1])
const lastBase = computed(() => baseline.value[baseline.value.length - 1])
const totalCum = computed(() => schedule.value.reduce((s, r) => s + r.dividend, 0))
const firstYearDiv = computed(() => schedule.value[0]?.dividend ?? 0)
/** 复投增量 = 开与不开 DRIP 的期末股数差（恒 ≥0） */
const dripGain = computed(() => Math.max(0, (last.value?.shares ?? 0) - (lastBase.value?.shares ?? 0)))

const FREQ_CN = { year: '每年', quarter: '每季', month: '每月' } as const

const money = (n: number, d = 2) =>
  `${currency.value === 'CNY' ? '¥' : '$'}${n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })}`

/** 复制关键结果：完整文案写入剪贴板 + 成功反馈 */
const copied = ref(false)
const copyTip = async () => {
  const text = `期末年股息收入 ${money(last.value?.dividend ?? 0)}，累计 ${money(totalCum.value)}，期末持股 ${Math.round(last.value?.shares ?? 0).toLocaleString()} 股`
  const ok = await copyText(text)
  if (ok) {
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1500)
    toast.ok('关键结果已复制到剪贴板')
  } else toast.err('复制失败，请手动选择文本复制')
}
</script>

<template>
  <div>
    <div class="row" style="justify-content: flex-end">
      <span class="cur-toggle">
        <button class="chip" :class="{ on: currency === 'CNY' }" @click="currency = 'CNY'">¥</button>
        <button class="chip" :class="{ on: currency === 'USD' }" @click="currency = 'USD'">$</button>
      </span>
    </div>
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
      <div>
        <label class="field-label">股息税率</label>
        <select v-model.number="tax" class="select">
          <option :value="0">0（免税/个人养老金户）</option>
          <option :value="10">10%</option>
          <option :value="20">20%</option>
        </select>
      </div>
      <div>
        <label class="field-label">派息频率</label>
        <select v-model="payFreq" class="select">
          <option value="year">年付</option>
          <option value="quarter">季付（复利再投资）</option>
          <option value="month">月付（复利再投资）</option>
        </select>
      </div>
    </div>

    <label class="check mt-2">
      <input v-model="drip" type="checkbox" />
      股息再投资（DRIP）——{{ FREQ_CN[payFreq] }}股息按当期股价买入新股
    </label>

    <div class="stats mt-2">
      <div class="stat-tile hl">
        <span class="st-label">期末年股息收入（第 {{ last?.year ?? 0 }} 年，税后）</span>
        <strong class="st-val big">{{ money(last?.dividend ?? 0) }}</strong>
        <span class="st-sub" v-if="firstYearDiv > 0">较第 1 年增长 {{ (((last?.dividend ?? 0) / firstYearDiv - 1) * 100).toFixed(0) }}%</span>
      </div>
      <div class="stat-tile">
        <span class="st-label">{{ years }} 年累计股息收入（税后）</span>
        <strong class="st-val">{{ money(totalCum) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">期末持股数</span>
        <strong class="st-val">{{ Math.round(last?.shares ?? 0).toLocaleString() }} 股</strong>
        <span v-if="drip" class="st-sub">复投增量 +{{ dripGain.toFixed(1) }} 股（vs 不复投）</span>
      </div>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead>
          <tr><th>年份</th><th>年末持股</th><th>年末股价</th><th>该年股息收入</th><th>累计收入</th><th v-if="drip">若不复投累计</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in schedule" :key="r.year">
            <td>第 {{ r.year }} 年</td>
            <td>{{ Math.round(r.shares).toLocaleString() }}</td>
            <td>{{ money(r.price) }}</td>
            <td>{{ money(r.dividend) }}</td>
            <td>{{ money(r.cum) }}</td>
            <td v-if="drip">{{ money(baseline[i]?.cum ?? 0) }}</td>
          </tr>
          <tr class="sum-row">
            <td><b>合计</b></td>
            <td><b>{{ Math.round(last?.shares ?? 0).toLocaleString() }} 股</b></td>
            <td><b>{{ money(last?.price ?? 0) }}</b></td>
            <td><b>{{ money(last?.dividend ?? 0) }}/年</b></td>
            <td><b>{{ money(totalCum) }}</b></td>
            <td v-if="drip"><b>{{ money(lastBase?.cum ?? 0) }}</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row mt-2">
      <button class="btn btn-ghost btn-sm" @click="copyTip">
        <Check v-if="copied" :size="14" style="color: var(--ok)" />
        <Copy v-else :size="14" />
        {{ copied ? '已复制' : '复制关键结果' }}
      </button>
    </div>
    <p class="hint mt-1">
      计算口径：每股股息 = 初始股价 × 股息率 ×（1+股息增长）^(t−1) ×（1 − 股息税率），先税后计入再投资与累计；{{ FREQ_CN[payFreq] }}派息时股息按子周期等分、即到即投（复利频率：{{ FREQ_CN[payFreq] }}）；与股价增长相互独立；忽略交易摩擦。
    </p>
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
.cur-toggle { display: inline-flex; gap: 4px; }
.chip.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 700; }
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
