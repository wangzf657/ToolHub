<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Trash2, RotateCcw } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 一笔买入：价格 + 数量（股） */
interface Lot {
  price: number
  qty: number
}

const STORAGE_KEY = 'toolhub-stock-average'

const lots = ref<Lot[]>([{ price: 25.5, qty: 200 }, { price: 24.0, qty: 300 }])

const addLot = () => lots.value.push({ price: 0, qty: 100 })
const removeLot = (i: number) => lots.value.splice(i, 1)
const resetAll = () => {
  lots.value = [{ price: 0, qty: 100 }]
  toast.ok('已重置')
}

const num = (v: number | undefined) => (Number.isFinite(v) ? Number(v) : 0)

/** 总股数 */
const totalShares = computed(() => lots.value.reduce((s, l) => s + Math.max(0, num(l.qty)), 0))
/** 总投入 */
const totalCost = computed(() => lots.value.reduce((s, l) => s + Math.max(0, num(l.qty)) * Math.max(0, num(l.price)), 0))
/** 加权平均成本 */
const avgCost = computed(() => (totalShares.value > 0 ? totalCost.value / totalShares.value : 0))

/** 每行占比 */
const rowShare = (l: Lot) => {
  const c = Math.max(0, num(l.qty)) * Math.max(0, num(l.price))
  return totalCost.value > 0 ? (c / totalCost.value) * 100 : 0
}

const money = (n: number, d = 2) => `$${n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })}`

/* ---------- localStorage 持久化 ---------- */
onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Lot[]
      if (Array.isArray(parsed) && parsed.length) lots.value = parsed
    }
  } catch {
    /* 忽略损坏的草稿 */
  }
})
watch(
  lots,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    } catch {
      /* 存储已满时静默失败 */
    }
  },
  { deep: true },
)
</script>

<template>
  <div>
    <div class="lots">
      <div class="head-row">
        <span class="idx">#</span>
        <span>买入价</span>
        <span>数量（股）</span>
        <span>金额</span>
        <span>占比</span>
        <span></span>
      </div>
      <div v-for="(l, i) in lots" :key="i" class="lot-row">
        <span class="idx">{{ i + 1 }}</span>
        <input v-model.number="l.price" type="number" class="input w-num" step="0.01" min="0" placeholder="如 25.50" />
        <input v-model.number="l.qty" type="number" class="input w-num" step="1" min="0" placeholder="如 100" />
        <span class="cell-val">{{ money(num(l.price) * num(l.qty)) }}</span>
        <span class="cell-val pct">{{ rowShare(l).toFixed(1) }}%</span>
        <button class="icon-btn danger" title="删除该笔" aria-label="删除该笔" @click="removeLot(i)"><Trash2 :size="14" /></button>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost" @click="addLot"><Plus :size="15" /> 再加一笔</button>
      <button class="btn btn-ghost" @click="resetAll"><RotateCcw :size="15" /> 重置</button>
    </div>

    <div class="stats mt-2">
      <div class="stat-tile hl">
        <span class="st-label">加权平均成本</span>
        <strong class="st-val big">{{ money(avgCost) }}</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">总股数</span>
        <strong class="st-val">{{ totalShares.toLocaleString() }} 股</strong>
      </div>
      <div class="stat-tile">
        <span class="st-label">总投入</span>
        <strong class="st-val">{{ money(totalCost) }}</strong>
      </div>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead>
          <tr><th>笔次</th><th>买入价</th><th>数量</th><th>金额</th><th>占总投入</th><th>较均价</th></tr>
        </thead>
        <tbody>
          <tr v-for="(l, i) in lots" :key="i">
            <td>第 {{ i + 1 }} 笔</td>
            <td>{{ money(num(l.price)) }}</td>
            <td>{{ num(l.qty).toLocaleString() }}</td>
            <td>{{ money(num(l.price) * num(l.qty)) }}</td>
            <td>{{ rowShare(l).toFixed(1) }}%</td>
            <td :class="num(l.price) > avgCost ? 'bad' : num(l.price) < avgCost ? 'ok' : ''">
              {{ avgCost ? (num(l.price) > avgCost ? '高于均价 ' : num(l.price) < avgCost ? '低于均价 ' : '等于均价 ') + money(Math.abs(num(l.price) - avgCost)) : '—' }}
            </td>
          </tr>
          <tr v-if="lots.length" class="sum-row">
            <td><b>合计</b></td><td><b>均价 {{ money(avgCost) }}</b></td>
            <td><b>{{ totalShares.toLocaleString() }}</b></td><td><b>{{ money(totalCost) }}</b></td><td><b>100%</b></td><td></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="hint mt-1">加权平均成本 = 总投入 ÷ 总股数。数据保存在浏览器本地，刷新后仍在。</p>
  </div>
</template>

<style scoped>
.lots { display: grid; gap: 8px; }
.head-row,
.lot-row {
  display: grid;
  grid-template-columns: 28px 1fr 1fr 110px 70px 34px;
  gap: 8px;
  align-items: center;
}
.head-row {
  font-size: 12px;
  color: var(--text-3);
}
.idx {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}
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
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
@media (max-width: 640px) {
  .stats, .head-row, .lot-row { grid-template-columns: 28px 1fr 1fr; }
  .stats { grid-template-columns: 1fr; }
  .cell-val, .lot-row .icon-btn { display: none; }
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
.ok { color: var(--ok); }
.bad { color: var(--err); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
