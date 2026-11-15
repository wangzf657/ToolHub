<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Trash2, Plus } from 'lucide-vue-next'
import { irr, npv, mirr, formatMoney } from '@/lib/finance'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Flow { period: number; amount: number | null }
const flows = ref<Flow[]>([
  { period: 0, amount: -10000 },
  { period: 1, amount: 3000 },
  { period: 2, amount: 3500 },
  { period: 3, amount: 4000 },
])

const rate = ref(8) // 折现率 %
const financeRate = ref(8)
const reinvestRate = ref(8)
const tab = ref<'stats' | 'npv'>('stats')
const barStage = ref<HTMLDivElement | null>(null)
const lineStage = ref<HTMLDivElement | null>(null)
let barCleanup: (() => void) | null = null
let lineCleanup: (() => void) | null = null

const STORAGE_KEY = 'toolhub-irr-npv'
onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { flows?: Flow[]; rate?: number; fr?: number; rr?: number }
      if (Array.isArray(p.flows) && p.flows.length >= 2) flows.value = p.flows
      if (typeof p.rate === 'number') rate.value = p.rate
      if (typeof p.fr === 'number') financeRate.value = p.fr
      if (typeof p.rr === 'number') reinvestRate.value = p.rr
    }
  } catch {
    /* 忽略损坏草稿 */
  }
})
watch(
  () => [flows.value, rate.value, financeRate.value, reinvestRate.value],
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ flows: flows.value, rate: rate.value, fr: financeRate.value, rr: reinvestRate.value }))
    } catch {
      /* 存储满静默 */
    }
  },
  { deep: true },
)

const sorted = computed(() => [...flows.value].filter((f) => f.amount !== null).sort((a, b) => a.period - b.period))
const values = computed(() => sorted.value.map((f) => f.amount!))

/** 期数校验：重复期数警示（仍按排序计算） */
const dupWarn = computed(() => {
  const ps = flows.value.filter((f) => f.amount !== null).map((f) => f.period)
  const uniq = new Set(ps)
  return ps.length !== uniq.size ? '期数重复，已按排序计算——重复期请核对是否漏填' : ''
})

const addRow = () => {
  const last = flows.value[flows.value.length - 1]
  flows.value.push({ period: (last?.period ?? 0) + 1, amount: null })
}

const removeRow = (i: number) => {
  if (flows.value.length <= 2) return toast.warn('至少保留两期现金流')
  flows.value.splice(i, 1)
}

const clearAll = () => {
  flows.value = [{ period: 0, amount: null }, { period: 1, amount: null }]
}

const result = computed(() => {
  const fs = values.value
  if (fs.length < 2) return null
  const r = irr(fs)
  const ratePer = Number(rate.value) / 100
  const npvV = npv(ratePer, fs)
  const m = mirr(fs, Number(financeRate.value) / 100, Number(reinvestRate.value) / 100)
  const payback = (() => {
    let acc = 0
    for (let i = 0; i < fs.length; i++) {
      acc += fs[i]!
      if (acc >= 0 && i > 0) return `${i} 期`
    }
    return null
  })()
  return {
    irr: r,
    irrAnnual: r === null ? null : (Math.pow(1 + r, 12) - 1) * 100,
    npv: npvV,
    mirr: m,
    payback,
    hasPos: fs.some((v) => v > 0),
    hasNeg: fs.some((v) => v < 0),
  }
})

const money = (n: number) => formatMoney(n)
const pct = (n: number | null, digits = 2) => (n === null ? '—' : `${n.toFixed(digits)}%`)

const SAMPLE_INSURANCE = () => {
  flows.value = [
    { period: 0, amount: -50000 }, { period: 1, amount: null }, { period: 2, amount: null },
    { period: 3, amount: null }, { period: 4, amount: null }, { period: 5, amount: 8500 },
    { period: 6, amount: 8500 }, { period: 7, amount: 8500 }, { period: 8, amount: 8500 },
    { period: 9, amount: 8500 }, { period: 10, amount: 8500 },
  ]
  toast.ok('已填入示例：趸交 5 万，第 6 年起每年领 8500，共领 5 年')
}

/* ---------- 现金流柱状图（正绿负红：两个 series，null 点不渲染） ---------- */
const drawBar = () => {
  if (!barStage.value) return
  void import('@/lib/chartEngine').then(({ renderChart }) => {
    barCleanup?.()
    const canvas = document.createElement('canvas')
    barStage.value!.replaceChildren(canvas)
    const labels = sorted.value.map((f) => `第${f.period}期`)
    const pos = sorted.value.map((f) => (f.amount !== null && f.amount > 0 ? f.amount : null))
    const neg = sorted.value.map((f) => (f.amount !== null && f.amount < 0 ? f.amount : null))
    barCleanup = renderChart(canvas, 'bar', labels, [
      { label: '回收（+）', data: pos as number[] },
      { label: '投入（−）', data: neg as number[] },
    ], { colors: ['#34d399', '#f87171'], legend: true })
  })
}

/* ---------- NPV 曲线（0~50%，含零轴虚线近似 series） ---------- */
const drawLine = () => {
  if (!lineStage.value) return
  void import('@/lib/chartEngine').then(({ renderChart }) => {
    lineCleanup?.()
    const canvas = document.createElement('canvas')
    lineStage.value!.replaceChildren(canvas)
    const rates: number[] = []
    const npvVals: number[] = []
    for (let r = 0; r <= 50; r += 2) {
      rates.push(r)
      npvVals.push(npv(r / 100, values.value))
    }
    const labels = rates.map((r) => `${r}%`)
    const zero = rates.map(() => 0)
    lineCleanup = renderChart(canvas, 'line', labels, [
      { label: 'NPV @折现率', data: npvVals },
      { label: '零轴', data: zero },
    ], { colors: ['#6366f1', 'rgba(148,163,205,0.7)'], legend: true })
  })
}

watch(tab, (t) => {
  if (t === 'npv') drawLine()
})
watch(values, () => {
  if (tab.value === 'npv') drawLine()
  drawBar()
}, { immediate: false })
onMounted(drawBar)
onBeforeUnmount(() => {
  barCleanup?.()
  lineCleanup?.()
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th style="width: 90px">期数</th><th>现金流金额（投入为负、回收为正）</th><th style="width: 44px"></th></tr></thead>
          <tbody>
            <tr v-for="(f, i) in flows" :key="i">
              <td><input v-model.number="f.period" type="number" class="input small" /></td>
              <td><input v-model.number="f.amount" type="number" class="input grow" placeholder="如 -10000 或 3000" /></td>
              <td><button class="mini-btn" title="删除" @click="removeRow(i)"><Trash2 :size="13" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="dupWarn" class="notice notice-warn mt-2 small">{{ dupWarn }}</div>
      <div class="row wrap gap mt-2">
        <button class="btn btn-sm" @click="addRow"><Plus :size="14" /> 加一期</button>
        <button class="btn btn-sm" @click="clearAll">清空</button>
        <button class="btn btn-sm" @click="SAMPLE_INSURANCE">填入年金示例</button>
      </div>
      <div class="row wrap gap mt-2">
        <span class="field-label">NPV 折现率（%）</span>
        <input v-model="rate" type="number" class="input n-input" step="0.5" />
        <span class="field-label">融资利率</span>
        <input v-model="financeRate" type="number" class="input n-input" step="0.5" />
        <span class="field-label">再投资率</span>
        <input v-model="reinvestRate" type="number" class="input n-input" step="0.5" />
        <span class="hint">后两项用于 MIRR</span>
      </div>
    </div>

    <div v-if="result" class="mt-2">
      <div v-if="!result.hasPos || !result.hasNeg" class="warn-box">现金流需要同时包含投入（负数）与回收（正数）才能求解 IRR。</div>
      <div class="row" style="gap: 6px; align-items: center">
        <button class="chip" :class="{ on: tab === 'stats' }" @click="tab = 'stats'">指标卡</button>
        <button class="chip" :class="{ on: tab === 'npv' }" @click="tab = 'npv'">NPV 曲线</button>
      </div>

      <div v-if="tab === 'stats'" class="stat-grid mt-2">
        <div class="stat primary">
          <span class="v">{{ pct(result.irr === null ? null : result.irr * 100) }}</span>
          <span class="l">IRR（每期收益率）</span>
        </div>
        <div class="stat">
          <span class="v">{{ pct(result.irrAnnual) }}</span>
          <span class="l">IRR（年化）</span>
        </div>
        <div class="stat">
          <span class="v">¥{{ money(result.npv) }}</span>
          <span class="l">NPV @ {{ rate }}%</span>
        </div>
        <div class="stat">
          <span class="v">{{ pct(result.mirr === null ? null : result.mirr * 100) }}</span>
          <span class="l">MIRR</span>
        </div>
        <div class="stat">
          <span class="v">{{ result.payback ?? '—' }}</span>
          <span class="l">静态回收期</span>
        </div>
      </div>

      <div v-else class="mt-2">
        <div ref="lineStage" class="chart-stage"></div>
        <p class="hint mt-1">
          横轴为折现率（0~50%，步长 2%），纵轴为对应 NPV；曲线与零轴交点即 IRR ≈ {{ pct(result.irr === null ? null : result.irr * 100) }}。
        </p>
      </div>
    </div>

    <div ref="barStage" class="chart-stage mt-2"></div>
    <p class="hint mt-2">口径：按「期」折现（0 为期初），IRR 用牛顿迭代 + 二分数值求解；年化 =（1 + 每期 IRR）^12 − 1，仅在按月现金流时有意义，按年现金流时该卡仅供参考。多解或无解时 IRR 显示「—」。输入自动保存到本地。</p>
  </div>
</template>

<style scoped>
.gap { gap: 10px; }
.n-input { width: 90px; }
.small { width: 80px; }
.grow { flex: 1; }
.tbl-wrap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th, .tbl td { padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.tbl thead th { background: var(--surface-2, rgba(127,127,127,.08)); }
.mini-btn { border: 1px solid var(--border); background: transparent; border-radius: 6px; padding: 3px 6px; cursor: pointer; color: var(--muted); }
.stat-grid { display: flex; gap: 10px; flex-wrap: wrap; }
.stat { padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; min-width: 130px; display: flex; flex-direction: column; gap: 2px; }
.stat .v { font-size: 20px; font-weight: 700; }
.stat .l { font-size: 12px; color: var(--muted); }
.stat.primary { border-color: var(--accent); }
.stat.primary .v { color: var(--accent-text); }
.warn-box { padding: 10px 14px; border: 1px solid var(--warn); border-radius: 10px; color: var(--warn); font-size: 13px; margin-bottom: 10px; }
.hint { font-size: 12px; color: var(--muted); }
.chip.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 700; }
.chart-stage { position: relative; height: 300px; border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); }
</style>
