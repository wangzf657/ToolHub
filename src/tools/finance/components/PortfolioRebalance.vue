<script setup lang="ts">
import { computed, ref } from 'vue'
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

const holdings = ref<Holding[]>([
  { name: '股票型基金', value: 52000, target: 50 },
  { name: '债券基金', value: 30000, target: 30 },
  { name: '货币现金', value: 18000, target: 20 },
])

const addHolding = () => holdings.value.push({ name: '', value: 0, target: 0 })
const removeHolding = (i: number) => holdings.value.splice(i, 1)

const num = (v: number | undefined) => (Number.isFinite(v) ? Number(v) : 0)

const totalValue = computed(() => holdings.value.reduce((s, h) => s + Math.max(0, num(h.value)), 0))
const targetSum = computed(() => holdings.value.reduce((s, h) => s + num(h.target), 0))
/** 配比合计校验（±0.5% 容差） */
const sumOk = computed(() => Math.abs(targetSum.value - 100) <= 0.5)

interface Row extends Holding {
  currentPct: number
  targetValue: number
  diff: number
  action: string
  kind: 'buy' | 'sell' | 'hold'
}

const rows = computed<Row[]>(() => {
  const total = totalValue.value
  return holdings.value.map((h) => {
    const v = Math.max(0, num(h.value))
    const tv = (total * num(h.target)) / 100
    const diff = tv - v
    let action = '保持'
    let kind: Row['kind'] = 'hold'
    if (total > 0 && Math.abs(diff) >= Math.max(1, total * 0.001)) {
      if (diff > 0) {
        action = `买入 ${fmt(diff)} 元`
        kind = 'buy'
      } else {
        action = `卖出 ${fmt(-diff)} 元`
        kind = 'sell'
      }
    }
    return { ...h, currentPct: total > 0 ? (v / total) * 100 : 0, targetValue: tv, diff, action, kind }
  })
})

const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })

const reportText = computed(() => {
  const lines = [
    `组合总市值：${fmt(totalValue.value)} 元`,
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
    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost btn-sm" @click="addHolding"><Plus :size="15" /> 添加持仓</button>
      <span class="chip" :class="sumOk ? '' : 'chip-err'">配比合计：{{ targetSum.toFixed(1) }}%{{ sumOk ? ' ✓' : '（应为 100%）' }}</span>
    </div>

    <div v-if="!sumOk" class="notice notice-warn mt-2">目标配比合计不等于 100%，请先调整各持仓的目标比例。</div>

    <div class="stats mt-2">
      <div class="stat-tile">
        <span class="st-label">组合总市值</span>
        <strong class="st-val">{{ fmt(totalValue) }} 元</strong>
      </div>
      <div class="stat-tile hl">
        <span class="st-label">需要调整的资产</span>
        <strong class="st-val">{{ rows.filter((r) => r.kind !== 'hold').length }} 项</strong>
      </div>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead>
          <tr><th>持仓</th><th>当前市值</th><th>当前占比</th><th>目标配比</th><th>目标市值</th><th>偏差</th><th>建议动作</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td>{{ r.name || `持仓 ${i + 1}` }}</td>
            <td>{{ fmt(num(r.value)) }}</td>
            <td>{{ r.currentPct.toFixed(1) }}%</td>
            <td>{{ num(r.target) }}%</td>
            <td>{{ fmt(r.targetValue) }}</td>
            <td :class="r.diff > 0 ? 'ok' : r.diff < 0 ? 'bad' : ''">{{ r.diff > 0 ? '+' : '' }}{{ fmt(r.diff) }}</td>
            <td><span class="act" :class="r.kind">{{ r.action }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="copyReport"><ClipboardCopy :size="16" /> 一键复制报告</button>
    </div>
    <p class="hint mt-1">目标市值 = 组合总市值 × 目标配比；偏差超过总市值 0.1% 时给出买卖建议，否则保持不动。</p>
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
.act {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.act.buy { background: rgba(52, 211, 153, 0.12); color: var(--ok); }
.act.sell { background: rgba(239, 68, 68, 0.12); color: var(--err); }
.act.hold { background: var(--accent-soft); color: var(--text-3); }
.ok { color: var(--ok); }
.bad { color: var(--err); }
.chip-err { border-color: var(--err); color: var(--err); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
