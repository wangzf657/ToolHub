<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Trash2, Download, Braces } from 'lucide-vue-next'
import { renderChart } from '@/lib/chartEngine'
import { saveBlob, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 期权腿：买/卖 × 看涨/看跌 × 数量 + 行权价 + 权利金（1 张 = 100 股） */
interface Leg {
  side: 'buy' | 'sell'
  type: 'call' | 'put'
  qty: number
  strike: number
  premium: number
}

const spot = ref(100)
const legs = ref<Leg[]>([{ side: 'buy', type: 'call', qty: 1, strike: 100, premium: 3.5 }])
// Black-Scholes 互链预填（?spot=标的现价&strike=行权价，键名与 black-scholes links.query 对齐）
{
  const route = useRoute()
  const qn = (k: string) => {
    const raw = route.query[k]
    const x = Number(Array.isArray(raw) ? raw[0] : raw)
    return Number.isFinite(x) && x > 0 ? x : null
  }
  const qSpot = qn('spot')
  const qStrike = qn('strike')
  if (qSpot !== null) spot.value = qSpot
  if (qStrike !== null) legs.value[0]!.strike = qStrike
}
// 可选正股腿
const stockOn = ref(false)
const stockQty = ref(100)
const stockEntry = ref(100)
/** 图表区间：现价 ±20/40/60% */
const rangePct = ref(40)
/** 导入 JSON */
const importInput = ref<HTMLInputElement | null>(null)

const addLeg = () => legs.value.push({ side: 'buy', type: 'call', qty: 1, strike: Number(spot.value) || 100, premium: 3 })
const removeLeg = (i: number) => legs.value.splice(i, 1)

/* 策略预设：一键生成常见组合腿 */
const S = () => Number(spot.value) || 100
const PRESETS: { label: string; build: () => Leg[] }[] = [
  { label: '单腿 Call', build: () => [{ side: 'buy', type: 'call', qty: 1, strike: S(), premium: 3.5 }] },
  { label: '单腿 Put', build: () => [{ side: 'buy', type: 'put', qty: 1, strike: S(), premium: 3 }] },
  {
    label: '牛市价差',
    build: () => [
      { side: 'buy', type: 'call', qty: 1, strike: S() * 0.95, premium: 5 },
      { side: 'sell', type: 'call', qty: 1, strike: S() * 1.1, premium: 2 },
    ],
  },
  {
    label: '熊市价差',
    build: () => [
      { side: 'buy', type: 'put', qty: 1, strike: S() * 1.05, premium: 5 },
      { side: 'sell', type: 'put', qty: 1, strike: S() * 0.9, premium: 2 },
    ],
  },
  {
    label: '跨式',
    build: () => [
      { side: 'buy', type: 'call', qty: 1, strike: S(), premium: 3.5 },
      { side: 'buy', type: 'put', qty: 1, strike: S(), premium: 3 },
    ],
  },
  {
    label: '勒式',
    build: () => [
      { side: 'buy', type: 'call', qty: 1, strike: S() * 1.1, premium: 2 },
      { side: 'buy', type: 'put', qty: 1, strike: S() * 0.9, premium: 2 },
    ],
  },
  {
    label: '蝶式',
    build: () => [
      { side: 'buy', type: 'call', qty: 1, strike: S() * 0.9, premium: 5 },
      { side: 'sell', type: 'call', qty: 2, strike: S(), premium: 3 },
      { side: 'buy', type: 'call', qty: 1, strike: S() * 1.1, premium: 1.5 },
    ],
  },
]
const applyPreset = (p: { label: string; build: () => Leg[] }) => {
  legs.value = p.build()
  toast.ok(`已应用预设：${p.label}（行权价按现价比例生成，权利金可改）`)
}

/* 导入参数 JSON（与导出格式一致：spot/legs/stock） */
const onImportFile = async (ev: Event) => {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  try {
    const d = JSON.parse(await f.text()) as { spot?: number; legs?: Leg[]; stock?: { qty: number; entry: number } | null }
    if (typeof d.spot === 'number') spot.value = d.spot
    if (Array.isArray(d.legs) && d.legs.length) legs.value = d.legs.map((l) => ({ ...l, qty: Number(l.qty) || 0 }))
    if (d.stock && typeof d.stock.qty === 'number') {
      stockOn.value = true
      stockQty.value = d.stock.qty
      stockEntry.value = Number(d.stock.entry) || 0
    } else stockOn.value = false
    toast.ok('参数已导入，图表与统计已恢复')
  } catch {
    toast.err('JSON 解析失败——请使用本工具导出的参数文件')
  }
}

/** 单腿在到期价 s 的损益（美元） */
const legPnl = (l: Leg, s: number) => {
  const dir = l.side === 'buy' ? 1 : -1
  const intrinsic = l.type === 'call' ? Math.max(s - l.strike, 0) : Math.max(l.strike - s, 0)
  return dir * l.qty * 100 * (intrinsic - l.premium)
}

const payoffAt = (s: number) => {
  let v = 0
  for (const l of legs.value) v += legPnl(l, s)
  if (stockOn.value) v += (Number(stockQty.value) || 0) * (s - (Number(stockEntry.value) || 0))
  return v
}

/** 价格范围：现价 ±rangePct%，共 81 个点 */
const prices = computed(() => {
  const base = Number(spot.value) > 0 ? Number(spot.value) : 100
  const k = (Number(rangePct.value) || 40) / 100
  return Array.from({ length: 81 }, (_, i) => base * (1 - k) + (base * 2 * k * i) / 80)
})
const points = computed(() => prices.value.map(payoffAt))

/** 盈亏平衡点：解析序列过零并线性插值 */
const breakevens = computed(() => {
  const ps = prices.value
  const vs = points.value
  const out: number[] = []
  for (let i = 1; i < vs.length; i++) {
    if ((vs[i - 1] < 0 && vs[i] >= 0) || (vs[i - 1] > 0 && vs[i] <= 0)) {
      const t = Math.abs(vs[i - 1]) / (Math.abs(vs[i - 1]) + Math.abs(vs[i]) || 1)
      out.push(ps[i - 1] + (ps[i] - ps[i - 1]) * t)
    }
  }
  return out
})

/** 数量校验：任一腿 qty ≤ 0 或非法时统计瓦片显示「—」 */
const qtyInvalid = computed(() => legs.value.some((l) => !(Number(l.qty) >= 1)))
const hasLegs = computed(() => (legs.value.length > 0 || stockOn.value) && !qtyInvalid.value)

const maxProfit = computed(() => (!hasLegs.value || !points.value.length ? null : Math.max(...points.value)))
const maxLoss = computed(() => (!hasLegs.value || !points.value.length ? null : Math.min(...points.value)))
const netPremium = computed(() =>
  qtyInvalid.value ? null : legs.value.reduce((s, l) => s + (l.side === 'buy' ? -1 : 1) * l.qty * 100 * l.premium, 0),
)
const breakevenDisp = computed(() => {
  if (qtyInvalid.value) return '—'
  if (!breakevens.value.length) {
    const s0 = points.value[0] ?? 0
    const s1 = points.value[points.value.length - 1] ?? 0
    if ((s0 >= 0) === (s1 >= 0)) return '—（在区间外）'
    return '—'
  }
  return breakevens.value.map((b) => b.toFixed(2)).join(' / ')
})

/* ---------- 图表 ---------- */
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null

const draw = () => {
  if (!stage.value || !hasLegs.value) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  cleanup = renderChart(
    canvas,
    'line',
    prices.value.map((p) => p.toFixed(1)),
    [
      { label: '到期损益', data: points.value },
      { label: '盈亏平衡线', data: prices.value.map(() => 0) },
    ],
    { colors: ['#6366f1', '#94a3b8'] },
  )
}
watch([points, hasLegs], draw, { flush: 'post' })
onMounted(draw)
onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})

const dlPng = async () => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先添加期权腿以生成曲线')
    return
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (blob) {
    saveBlob(blob, '期权到期损益图.png')
    toast.ok('已开始下载')
  }
}

const exportJson = () => {
  const data = {
    spot: Number(spot.value),
    legs: legs.value,
    stock: stockOn.value ? { qty: Number(stockQty.value), entry: Number(stockEntry.value) } : null,
  }
  saveText(JSON.stringify(data, null, 2), '期权组合参数.json', 'application/json;charset=utf-8')
  toast.ok('参数 JSON 已导出')
}

const money = (n: number) => `$${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
</script>

<template>
  <div>
    <div class="grid-2 mb-2">
      <div>
        <label class="field-label">标的现价</label>
        <input v-model.number="spot" type="number" class="input" step="0.01" placeholder="如 100" />
      </div>
      <div class="stat-mini">
        <span>净权利金收入</span>
        <strong :class="{ neg: (netPremium ?? 0) < 0 }">{{ netPremium === null ? '—' : money(netPremium) }}</strong>
      </div>
      <div class="stat-mini">
        <span>图表区间</span>
        <select v-model.number="rangePct" class="select" style="width: 100px">
          <option :value="20">±20%</option>
          <option :value="40">±40%</option>
          <option :value="60">±60%</option>
        </select>
      </div>
    </div>

    <div class="row row-wrap mb-2" style="gap: 6px; align-items: center">
      <span class="muted small">策略预设：</span>
      <button v-for="p in PRESETS" :key="p.label" class="chip" @click="applyPreset(p)">{{ p.label }}</button>
      <span class="grow"></span>
      <button class="btn btn-ghost btn-sm" @click="importInput?.click()"><Braces :size="13" /> 导入参数</button>
      <input ref="importInput" type="file" accept=".json,application/json" style="display: none" @change="onImportFile" />
    </div>

    <div class="legs">
      <div v-for="(l, i) in legs" :key="i" class="leg-row" :class="{ 'leg-bad': !(Number(l.qty) >= 1) }">
        <select v-model="l.side" class="select w-side">
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
        </select>
        <select v-model="l.type" class="select w-type">
          <option value="call">看涨 Call</option>
          <option value="put">看跌 Put</option>
        </select>
        <input v-model.number="l.qty" type="number" class="input w-num" min="1" placeholder="数量" />
        <input v-model.number="l.strike" type="number" class="input w-num" step="0.5" placeholder="行权价" />
        <input v-model.number="l.premium" type="number" class="input w-num" step="0.05" placeholder="权利金" />
        <button class="icon-btn danger" title="删除" aria-label="删除" @click="removeLeg(i)"><Trash2 :size="14" /></button>
        <span v-if="!(Number(l.qty) >= 1)" class="qty-err small">数量需 ≥1</span>
      </div>
      <button class="btn btn-ghost btn-sm" @click="addLeg"><Plus :size="15" /> 添加期权腿</button>

      <div class="stock-row">
        <label class="check"><input v-model="stockOn" type="checkbox" /> 包含正股腿</label>
        <template v-if="stockOn">
          <input v-model.number="stockQty" type="number" class="input w-num" placeholder="股数" />
          <input v-model.number="stockEntry" type="number" class="input w-num" step="0.01" placeholder="买入成本价" />
        </template>
      </div>
    </div>

    <div class="stats mt-2">
      <div class="stat-tile">
        <span class="st-label">最大盈利（区间内）</span>
        <strong class="st-val ok">{{ maxProfit === null ? '—' : money(maxProfit) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">最大亏损（区间内）</span>
        <strong class="st-val" :class="maxLoss !== null && maxLoss < 0 ? 'bad' : 'ok'">{{ maxLoss === null ? '—' : money(maxLoss) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">盈亏平衡点</span>
        <strong class="st-val">{{ breakevenDisp }}</strong>
      </div>
    </div>

    <div class="chart-stage mt-2">
      <div ref="stage" class="chart-box"></div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="!hasLegs" @click="dlPng"><Download :size="16" /> 下载损益图</button>
      <button class="btn btn-ghost" :disabled="!hasLegs" @click="exportJson"><Braces :size="16" /> 导出参数 JSON</button>
    </div>
    <p class="hint mt-1">1 张期权 = 100 股；曲线按到期日内在价值计算，未含时间价值与手续费。</p>
  </div>
</template>

<style scoped>
.legs {
  display: grid;
  gap: 8px;
}
.leg-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.w-side { width: 92px; }
.w-type { width: 128px; }
.w-num { width: 108px; }
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
.icon-btn.danger:hover {
  border-color: var(--err);
  color: var(--err);
}
.stock-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 4px;
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
.st-label { font-size: 12px; color: var(--text-3); }
.st-val { font-size: 18px; }
.ok { color: var(--ok); }
.bad { color: var(--err); }
.stat-mini {
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: 12px;
  color: var(--text-3);
}
.stat-mini strong { font-size: 18px; color: var(--ok); }
.stat-mini strong.neg { color: var(--err); }
.leg-bad { outline: 1px dashed var(--err); border-radius: 8px; padding: 2px 4px; }
.qty-err { color: var(--err); }
.chart-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.chart-box { height: max(380px, calc(100vh - 360px)); position: relative; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
