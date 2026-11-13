<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Trash2, ClipboardCopy } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 一条持仓：名称 + 当前市值 + 目标配比（%） */
interface Holding {
  name: string
  value: number
  target: number
}

const STORAGE_KEY = 'toolhub-rebalance'
const holdings = ref<Holding[]>([
  { name: '股票型基金', value: 52000, target: 50 },
  { name: '债券基金', value: 30000, target: 30 },
  { name: '货币现金', value: 18000, target: 20 },
])
/** 触发阈值（占总市值 %），默认 0.1% */
const band = ref(0.1)
/** 新注资（可选） */
const newCash = ref(0)

const addHolding = () => holdings.value.push({ name: '', value: 0, target: 0 })
const removeHolding = (i: number) => holdings.value.splice(i, 1)

const num = (v: number | undefined) => (Number.isFinite(v) ? Number(v) : 0)

const totalValue = computed(() => holdings.value.reduce((s, h) => s + Math.max(0, num(h.value)), 0))
const targetSum = computed(() => holdings.value.reduce((s, h) => s + num(h.target), 0))
const sumOk = computed(() => Math.abs(targetSum.value - 100) <= 0.5)
/** 注资后的组合基数 */
const baseValue = computed(() => totalValue.value + Math.max(0, num(newCash.value)))

interface Row extends Holding {
  currentPct: number
  targetValue: number
  diff: number
  action: string
  kind: 'buy' | 'sell' | 'hold'
  buyPart: number
  curBar: number
}

const rows = computed<Row[]>(() => {
  const total = baseValue.value
  const threshold = Math.max(0, num(band.value)) / 100
  // 第一轮：各资产相对（含注资）基数的偏差
  const first = holdings.value.map((h) => {
    const v = Math.max(0, num(h.value))
    const tv = (total * num(h.target)) / 100
    return { h, v, tv, diff: tv - v }
  })
  // 注资优先补低配：现金池按顺序抵扣买入需求
  let cash = Math.max(0, num(newCash.value))
  const buyNeed = first.map((f) => Math.max(0, f.diff))
  const buyPart = buyNeed.map((need) => {
    const use = Math.min(need, cash)
    cash -= use
    return use
  })
  const shortfall = buyNeed.reduce((s, need, i) => s + (need - buyPart[i]), 0)
  const totalSellRoom = first.reduce((s, f) => s + Math.max(0, -f.diff), 0)
  return first.map((f, i) => {
    const { h, v, tv, diff } = f
    let action = '保持'
    let kind: Row['kind'] = 'hold'
    const effective = Math.abs(diff)
    if (total > 0 && effective >= Math.max(1, total * threshold)) {
      if (diff > 0) {
        action = `买入 ${fmt(buyPart[i])} 元${diff - buyPart[i] > 1 ? `（现金不足，需补卖 ${fmt(diff - buyPart[i])}）` : ''}`
        kind = 'buy'
      } else {
        const extra = totalSellRoom > 0 && shortfall > 0 ? (-diff / totalSellRoom) * shortfall : 0
        action = `卖出 ${fmt(-diff + extra)} 元`
        kind = 'sell'
      }
    }
    return {
      ...h,
      value: v,
      currentPct: totalValue.value > 0 ? (v / totalValue.value) * 100 : 0,
      targetValue: tv,
      diff,
      action,
      kind,
      buyPart: buyPart[i],
      curBar: 0,
    }
  })
})

const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
const barW = (r: Row, which: 'cur' | 'tgt') =>
  Math.min(100, which === 'cur' ? r.currentPct : Math.min(100, num(r.target)))

const reportText = computed(() => {
  const lines = [
    `组合总市值：${fmt(totalValue.value)} 元${num(newCash.value) > 0 ? `（新注资 ${fmt(num(newCash.value))} 元）` : ''}`,
    sumOk.value ? '目标配比合计：100%（校验通过）' : `⚠ 目标配比合计为 ${targetSum.value.toFixed(1)}%，应为 100%`,
    '',
    '持仓\t当前市值\t当前占比\t目标配比\t目标市值\t建议动作',
  ]
  for (const r of rows.value) {
    lines.push(`${r.name || '未命名'}\t${fmt(num(r.value))}\t${r.currentPct.toFixed(1)}%\t${num(r.target)}%\t${fmt(r.targetValue)}\t${r.action}`)
  }
  return lines.join('\n')
})

const copyReport = async () => {
  const okFlag = await copyText(reportText.value)
  if (okFlag) toast.ok('再平衡报告已复制')
  else toast.err('复制失败')
}

/* ---------- 输入记忆（清空浏览器数据后恢复默认示例） ---------- */
onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { holdings?: Holding[]; band?: number }
      if (Array.isArray(p.holdings) && p.holdings.length) holdings.value = p.holdings
      if (typeof p.band === 'number') band.value = p.band
    }
  } catch {
    /* 忽略损坏草稿 */
  }
})
watch(
  () => [holdings.value, band.value],
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ holdings: holdings.value, band: band.value }))
    } catch {
      /* 存储满静默 */
    }
  },
  { deep: true },
)
</script>

<template>
  <div>
    <div class="holdings">
      <div class="head-row">
        <span>持仓名称</span><span>当前市值（元）</span><span>目标配比（%）</span><span></span>
      </div>
      <div v-for="(h, i) in holdings" :key="i" class="h-row">
        <input v-model="h.name" class="input" placeholder="如 股票型基金" />
        <input v-model.number="h.value" type="number" class="input" min="0" placeholder="如 50000" />
        <input v-model.number="h.target" type="number" class="input" min="0" max="100" step="0.5" placeholder="如 50" />
        <button class="icon-btn danger" title="删除" aria-label="删除" @click="removeHolding(i)"><Trash2 :size="14" /></button>
      </div>
    </div>
    <div class="row row-wrap mt-2" style="gap: 14px">
      <button class="btn btn-ghost btn-sm" @click="addHolding"><Plus :size="15" /> 添加持仓</button>
      <span class="chip" :class="sumOk ? '' : 'chip-err'">配比合计：{{ targetSum.toFixed(1) }}%{{ sumOk ? ' ✓' : '（应为 100%）' }}</span>
      <label class="check">
        触发阈值（%）
        <input v-model.number="band" type="number" class="input" style="width: 90px" step="0.1" min="0" />
      </label>
      <label class="check">
        投入新资金（元，可选）
        <input v-model.number="newCash" type="number" class="input" style="width: 130px" min="0" step="1000" />
      </label>
    </div>

    <div v-if="!sumOk" class="notice notice-warn mt-2">目标配比合计不等于 100%，请先调整各持仓的目标比例。</div>

    <div class="stats mt-2">
      <div class="stat-tile">
        <span class="st-label">组合总市值</span>
        <strong class="st-val">{{ fmt(totalValue) }} 元</strong>
        <span v-if="num(newCash) > 0" class="st-sub">含新注资后基数 {{ fmt(baseValue) }} 元</span>
      </div>
      <div class="stat-tile hl">
        <span class="st-label">需要调整的资产</span>
        <strong class="st-val">{{ rows.filter((r) => r.kind !== 'hold').length }} 项</strong>
        <span class="st-sub">阈值 {{ band }}% 以内的偏差按「保持」处理</span>
      </div>
    </div>

    <!-- 占比对比双条形（当前 vs 目标） -->
    <div class="bars mt-2">
      <div v-for="(r, i) in rows" :key="'b' + i" class="bar-row">
        <span class="bar-name">{{ r.name || `持仓 ${i + 1}` }}</span>
        <span class="bar-track">
          <span class="bar cur" :style="{ width: barW(r, 'cur') + '%' }" />
          <span class="bar tgt" :style="{ width: barW(r, 'tgt') + '%' }" />
        </span>
        <span class="muted small">当前 {{ r.currentPct.toFixed(1) }}% / 目标 {{ num(r.target) }}%</span>
      </div>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table reb-table">
        <thead>
          <tr><th>持仓</th><th>当前市值</th><th>当前占比</th><th>目标配比</th><th>目标市值</th><th>偏差</th><th>建议动作</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td :data-label="'持仓'">{{ r.name || `持仓 ${i + 1}` }}</td>
            <td :data-label="'当前市值'">{{ fmt(num(r.value)) }}</td>
            <td :data-label="'当前占比'">{{ r.currentPct.toFixed(1) }}%</td>
            <td :data-label="'目标配比'">{{ num(r.target) }}%</td>
            <td :data-label="'目标市值'">{{ fmt(r.targetValue) }}</td>
            <td :data-label="'偏差'" :class="r.diff > 0 ? 'ok' : r.diff < 0 ? 'bad' : ''">{{ r.diff > 0 ? '+' : '' }}{{ fmt(r.diff) }}</td>
            <td :data-label="'建议动作'"><span class="act" :class="r.kind">{{ r.action }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="copyReport"><ClipboardCopy :size="16" /> 一键复制报告</button>
    </div>
    <p class="hint mt-1">
      口径：目标市值 =（总市值 + 新注资）× 目标配比；偏差 ≥ 总市值 × 阈值时才给出动作；有注资时现金优先补低配资产，不足部分按超配比例分摊到卖出清单。
    </p>
  </div>
</template>

<style scoped>
.holdings { display: grid; gap: 8px; }
.head-row {
  display: grid;
  grid-template-columns: 1fr 1fr 120px 34px;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.h-row {
  display: grid;
  grid-template-columns: 1fr 1fr 120px 34px;
  gap: 8px;
  align-items: center;
}
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
@media (max-width: 640px) {
  .head-row, .h-row { grid-template-columns: 1fr 1fr 90px 34px; }
}
.bars { display: grid; gap: 8px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-name { flex: none; width: 110px; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; position: relative; height: 16px; background: var(--bg-soft); border-radius: 999px; overflow: hidden; }
.bar { position: absolute; top: 0; height: 100%; border-radius: 999px; }
.bar.cur { background: var(--accent); opacity: 0.85; }
.bar.tgt { background: transparent; border: 1.5px dashed var(--warn, #fbbf24); box-sizing: border-box; }
.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 560px) {
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
/* 移动端卡片化：清单表变持仓卡片 */
@media (max-width: 640px) {
  .reb-table thead { display: none; }
  .reb-table tr { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; margin-bottom: 8px; }
  .reb-table td { display: block; border: none; padding: 2px 4px; }
  .reb-table td::before { content: attr(data-label) '：'; color: var(--text-3); font-size: 11.5px; }
  .reb-table td:first-child { grid-column: 1 / -1; font-weight: 700; }
  .reb-table td:first-child::before { content: ''; }
}
.act {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  display: inline-block;
}
.act.buy { background: rgba(52, 211, 153, 0.12); color: var(--ok); }
.act.sell { background: rgba(239, 68, 68, 0.12); color: var(--err); }
.act.hold { background: var(--accent-soft); color: var(--text-3); }
.ok { color: var(--ok); }
.bad { color: var(--err); }
.chip-err { border-color: var(--err); color: var(--err); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
