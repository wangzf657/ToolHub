<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Trash2, RotateCcw, Calculator } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 一笔交易：买/卖 + 价格 + 数量（股） */
interface Lot {
  kind: 'buy' | 'sell'
  price: number
  qty: number
}

const STORAGE_KEY = 'toolhub-stock-average'
const currency = ref<'CNY' | 'USD'>('CNY')
const feeRate = ref(0.025) // 万分之 2.5 = 0.025%
const minFee = ref(5)
const showTrial = ref(false)
const trialPrice = ref(23)
const trialQty = ref(200)
const trialKind = ref<'buy' | 'sell'>('buy')

const lots = ref<Lot[]>([
  { kind: 'buy', price: 25.5, qty: 200 },
  { kind: 'buy', price: 24.0, qty: 300 },
])

const addLot = () => lots.value.push({ kind: 'buy', price: 0, qty: 100 })
const removeLot = (i: number) => lots.value.splice(i, 1)
const resetAll = () => {
  lots.value = [{ kind: 'buy', price: 0, qty: 100 }]
  toast.ok('已重置')
}

const num = (v: number | undefined) => (Number.isFinite(v) ? Number(v) : 0)

/** 加权平均法：买入抬升均价，卖出按当前均价减持（均价不变） */
const position = computed(() => {
  let shares = 0
  let cost = 0
  let avg = 0
  let sellQty = 0
  for (const l of lots.value) {
    const p = Math.max(0, num(l.price))
    const q = Math.max(0, num(l.qty))
    if (l.kind === 'sell') {
      const exec = Math.min(q, shares)
      shares -= exec
      cost -= exec * avg
      sellQty += exec
      continue
    }
    shares += q
    cost += q * p
    avg = shares > 0 ? cost / shares : 0
  }
  return { shares, cost, avg, sellQty }
})

const totalShares = computed(() => position.value.shares)
const avgCost = computed(() => position.value.avg)
const displayShares = computed(() => position.value.shares + position.value.sellQty)
const grossBuyCost = computed(() =>
  lots.value.reduce((s, l) => s + (l.kind === 'buy' ? Math.max(0, num(l.qty)) * Math.max(0, num(l.price)) : 0), 0),
)

/** 每笔买入佣金 = max(金额 × 费率, 最低佣金)；卖出同理按卖出金额计 */
const feeOf = (l: Lot) => Math.max(num(l.price) * num(l.qty) * (feeRate.value / 100), minFee.value || 0)
const totalFees = computed(() =>
  lots.value.reduce((s, l) => s + (Math.max(0, num(l.qty)) > 0 && num(l.price) > 0 ? feeOf(l) : 0), 0),
)
const totalCostWithFee = computed(() => grossBuyCost.value + totalFees.value)
/** 保本价 =（买入总投入 + 全部佣金）÷ 持股数（未计卖出印花税与滑点） */
const breakEven = computed(() => (totalShares.value > 0 ? totalCostWithFee.value / totalShares.value : 0))

/** 每行买入金额占比（按买入金额口径） */
const rowShare = (l: Lot) => {
  const c = l.kind === 'buy' ? Math.max(0, num(l.qty)) * Math.max(0, num(l.price)) : 0
  return grossBuyCost.value > 0 ? (c / grossBuyCost.value) * 100 : 0
}

const money = (n: number, d = 2) =>
  `${currency.value === 'CNY' ? '¥' : '$'}${n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })}`

/* 试算：不影响正式数据 */
const trial = computed(() => {
  const { shares, cost, avg } = position.value
  const p = Math.max(0, num(trialPrice.value))
  const q = Math.max(0, num(trialQty.value))
  if (!p || !q) return null
  if (trialKind.value === 'buy') {
    const ns = shares + q
    return { label: '试算后均价', avg: ns > 0 ? (cost + q * p) / ns : 0, shares: ns, delta: ns > 0 ? (cost + q * p) / ns - avg : 0 }
  }
  const exec = Math.min(q, shares)
  return { label: '试算后持股', avg, shares: shares - exec, delta: 0 }
})

/* ---------- localStorage 持久化 ---------- */
onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { lots?: Lot[]; currency?: 'CNY' | 'USD'; feeRate?: number; minFee?: number }
      if (Array.isArray(parsed.lots) && parsed.lots.length) lots.value = parsed.lots.map((l) => ({ ...l, kind: l.kind ?? 'buy' }))
      if (parsed.currency) currency.value = parsed.currency
      if (typeof parsed.feeRate === 'number') feeRate.value = parsed.feeRate
      if (typeof parsed.minFee === 'number') minFee.value = parsed.minFee
    }
  } catch {
    /* 忽略损坏的草稿 */
  }
})
watch(
  () => [lots.value, currency.value, feeRate.value, minFee.value],
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lots: lots.value, currency: currency.value, feeRate: feeRate.value, minFee: minFee.value }))
    } catch {
      /* 存储已满时静默失败 */
    }
  },
  { deep: true },
)
</script>

<template>
  <div>
    <div class="row row-wrap" style="justify-content: flex-end; gap: 8px; align-items: center">
      <label class="check small">
        佣金费率（%）
        <input :value="feeRate" @input="feeRate = Number(($event.target as HTMLInputElement).value)" type="number" step="0.005" min="0" class="input" style="width: 90px" />
      </label>
      <label class="check small">
        最低佣金（元/笔）
        <input :value="minFee" @input="minFee = Number(($event.target as HTMLInputElement).value)" type="number" step="1" min="0" class="input" style="width: 90px" />
      </label>
      <span class="cur-toggle">
        <button class="chip" :class="{ on: currency === 'CNY' }" @click="currency = 'CNY'">¥</button>
        <button class="chip" :class="{ on: currency === 'USD' }" @click="currency = 'USD'">$</button>
      </span>
    </div>

    <div class="lots">
      <div class="head-row">
        <span class="idx">#</span>
        <span>类型</span>
        <span>价格</span>
        <span>数量（股）</span>
        <span class="hide-m">金额</span>
        <span class="hide-m">占比</span>
        <span></span>
      </div>
      <div v-for="(l, i) in lots" :key="i" class="lot-row">
        <span class="idx">{{ i + 1 }}</span>
        <select v-model="l.kind" class="select kind-select">
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
        </select>
        <input v-model.number="l.price" type="number" class="input w-num" step="0.01" min="0" placeholder="如 25.50" />
        <input v-model.number="l.qty" type="number" class="input w-num" step="1" min="0" placeholder="如 100" />
        <span class="cell-val hide-m">{{ money(num(l.price) * num(l.qty)) }}</span>
        <span class="cell-val pct hide-m">{{ rowShare(l).toFixed(1) }}%</span>
        <button class="icon-btn danger" title="删除该笔" aria-label="删除该笔" @click="removeLot(i)"><Trash2 :size="14" /></button>
        <span class="mobile-note small muted hide-d">金额 {{ money(num(l.price) * num(l.qty)) }} · 占比 {{ rowShare(l).toFixed(1) }}%</span>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost" @click="addLot"><Plus :size="15" /> 再加一笔</button>
      <button class="btn btn-ghost" @click="resetAll"><RotateCcw :size="15" /> 重置</button>
      <button class="btn btn-ghost" @click="showTrial = !showTrial"><Calculator :size="15" /> 试算下一笔</button>
    </div>

    <div v-if="showTrial" class="trial mt-2">
      <div class="row row-wrap" style="gap: 10px; align-items: end">
        <label class="check small">
          类型
          <select v-model="trialKind" class="select" style="width: 90px">
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </select>
        </label>
        <label class="check small">
          价格
          <input v-model.number="trialPrice" type="number" step="0.01" min="0" class="input" style="width: 100px" />
        </label>
        <label class="check small">
          数量
          <input v-model.number="trialQty" type="number" step="1" min="0" class="input" style="width: 100px" />
        </label>
        <template v-if="trial">
          <span class="small">{{ trial.label }}：<b class="trial-val">{{ money(trial.avg) }}</b> · 持股 {{ trial.shares.toLocaleString() }} 股<template v-if="trialKind === 'buy' && trial.delta">（较当前 {{ trial.delta > 0 ? '+' : '' }}{{ trial.delta.toFixed(2) }}）</template></span>
        </template>
        <span class="muted small">试算不影响正式数据</span>
      </div>
    </div>

    <div class="stats mt-2">
      <div class="stat-tile hl">
        <span class="st-label">加权平均成本</span>
        <strong class="st-val big">{{ money(avgCost) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">当前持股</span>
        <strong class="st-val">{{ totalShares.toLocaleString() }} 股</strong>
        <span v-if="position.sellQty" class="small muted">已卖出 {{ position.sellQty.toLocaleString() }} 股</span>
      </div>
      <div class="stat-tile">
        <span class="st-label">含费总投入</span>
        <strong class="st-val">{{ money(totalCostWithFee) }}</strong>
        <span class="small muted">佣金 {{ money(totalFees) }}</span>
      </div>
      <div class="stat-tile">
        <span class="st-label">保本价</span>
        <strong class="st-val">{{ money(breakEven) }}</strong>
      </div>
    </div>

    <div class="table-wrap mt-2 hide-d">
      <table class="data-table">
        <thead>
          <tr><th>笔次</th><th>类型</th><th>价格</th><th>数量</th><th>金额</th><th>占总投入</th></tr>
        </thead>
        <tbody>
          <tr v-for="(l, i) in lots" :key="i">
            <td>第 {{ i + 1 }} 笔</td>
            <td>{{ l.kind === 'buy' ? '买入' : '卖出' }}</td>
            <td>{{ money(num(l.price)) }}</td>
            <td>{{ num(l.qty).toLocaleString() }}</td>
            <td>{{ money(num(l.price) * num(l.qty)) }}</td>
            <td>{{ rowShare(l).toFixed(1) }}%</td>
          </tr>
          <tr v-if="lots.length" class="sum-row">
            <td><b>合计</b></td><td><b>均价 {{ money(avgCost) }}</b></td>
            <td><b>{{ displayShares.toLocaleString() }}</b></td><td><b>{{ money(totalCostWithFee) }}</b></td><td><b>100%</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="hint mt-1">
      口径：加权平均法——买入抬升均价，卖出按当前均价减持、不改变均价；佣金 = max(成交金额 × 费率, 最低佣金)，保本价 =（买入总投入 + 佣金）÷ 持股数，未计卖出费用与滑点。数据保存在浏览器本地。
    </p>
  </div>
</template>

<style scoped>
.lots { display: grid; gap: 8px; }
.head-row,
.lot-row {
  display: grid;
  grid-template-columns: 28px 76px 1fr 1fr 110px 70px 34px;
  gap: 8px;
  align-items: center;
}
.mobile-note { grid-column: 2 / -1; }
.head-row {
  font-size: 12px;
  color: var(--text-3);
}
.idx {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}
.kind-select { width: 100%; padding: 6px 26px 6px 8px; }
.w-num { width: 100%; }
.cell-val { font-size: 13.5px; color: var(--text-2); text-align: right; }
.cell-val.pct { color: var(--text-3); }
.icon-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: none;
  color: var(--text-2);
  cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.cur-toggle { display: inline-flex; gap: 4px; }
.chip.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 700; }
.trial {
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 10px 12px;
}
.trial-val { color: var(--accent-text); }
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
/* 移动端：保留删除按钮；金额/占比改行下小字 */
@media (max-width: 640px) {
  .head-row { grid-template-columns: 28px 1fr 1fr 34px; }
  .head-row span:nth-child(n + 4) { display: none; }
  .lot-row { grid-template-columns: 28px 1fr 1fr 34px; }
  .hide-m { display: none; }
  .hide-d { display: none; }
  .stats { grid-template-columns: 1fr 1fr; }
}
@media (min-width: 641px) {
  .mobile-note { display: none; }
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
.sum-row td { background: var(--accent-soft); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
