<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
// 可选正股腿
const stockOn = ref(false)
const stockQty = ref(100)
const stockEntry = ref(100)

const addLeg = () => legs.value.push({ side: 'buy', type: 'call', qty: 1, strike: Number(spot.value) || 100, premium: 3 })
const removeLeg = (i: number) => legs.value.splice(i, 1)

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

/** 价格范围：现价 ±40%，共 81 个点 */
const prices = computed(() => {
  const base = Number(spot.value) > 0 ? Number(spot.value) : 100
  return Array.from({ length: 81 }, (_, i) => base * 0.6 + (base * 0.8 * i) / 80)
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

const maxProfit = computed(() => (points.value.length ? Math.max(...points.value) : 0))
const maxLoss = computed(() => (points.value.length ? Math.min(...points.value) : 0))
const netPremium = computed(() => legs.value.reduce((s, l) => s + (l.side === 'buy' ? -1 : 1) * l.qty * 100 * l.premium, 0))
const hasLegs = computed(() => legs.value.length > 0 || stockOn.value)

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
        <strong :class="{ neg: netPremium < 0 }">{{ money(netPremium) }}</strong>
      </div>
    </div>

    <div class="legs">
      <div v-for="(l, i) in legs" :key="i" class="leg-row">
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
        <button class="icon-btn danger" title="删除" @click="removeLeg(i)"><Trash2 :size="14" /></button>
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
        <strong class="st-val ok">{{ money(maxProfit) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">最大亏损（区间内）</span>
        <strong class="st-val" :class="maxLoss < 0 ? 'bad' : 'ok'">{{ money(maxLoss) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">盈亏平衡点</span>
        <strong class="st-val">{{ breakevens.length ? breakevens.map((b) => b.toFixed(2)).join(' / ') : '—' }}</strong>
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
.chart-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.chart-box { height: 380px; position: relative; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
