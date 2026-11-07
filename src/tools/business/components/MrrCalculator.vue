<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'

/** 模式一：订阅档位汇总 */
interface Tier {
  name: string
  price: number
  count: number
}

const tiers = ref<Tier[]>([
  { name: '基础版', price: 29, count: 300 },
  { name: '专业版', price: 99, count: 120 },
  { name: '企业版', price: 499, count: 15 },
])
const addTier = () => tiers.value.push({ name: '', price: 0, count: 0 })
const removeTier = (i: number) => tiers.value.splice(i, 1)

const num = (v: number | undefined) => (Number.isFinite(v) ? Number(v) : 0)

const mrr = (t: Tier) => Math.max(0, num(t.price)) * Math.max(0, num(t.count))
const totalMrr = computed(() => tiers.value.reduce((s, t) => s + mrr(t), 0))
const totalArr = computed(() => totalMrr.value * 12)
const totalSubs = computed(() => tiers.value.reduce((s, t) => s + Math.max(0, num(t.count)), 0))
const share = (t: Tier) => (totalMrr.value > 0 ? (mrr(t) / totalMrr.value) * 100 : 0)

const money = (n: number) => `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`

/** 模式二：MRR 变动追踪 */
const newMrr = ref(5000)
const expandMrr = ref(2000)
const contractMrr = ref(800)
const churnMrr = ref(1200)
const startMrr = ref(100000)

const netNewMrr = computed(() => num(newMrr.value) + num(expandMrr.value) - num(contractMrr.value) - num(churnMrr.value))
/** MRR 流失率 = 流失 MRR ÷ 期初 MRR */
const churnRate = computed(() => (num(startMrr.value) > 0 ? (num(churnMrr.value) / num(startMrr.value)) * 100 : 0))
/** 净收入留存率（含扩张，近似） */
const nrr = computed(() => (num(startMrr.value) > 0 ? ((num(startMrr.value) + netNewMrr.value) / num(startMrr.value)) * 100 : 0))
const quickMrrRate = computed(() => (num(churnMrr.value) > 0 ? num(startMrr.value) / num(churnMrr.value) : Infinity))

const tab = ref<'tiers' | 'moves'>('tiers')
const tabs: { v: 'tiers' | 'moves'; label: string }[] = [
  { v: 'tiers', label: '档位汇总' },
  { v: 'moves', label: 'MRR 变动' },
]
</script>

<template>
  <div>
    <div class="row row-wrap mb-2">
      <button v-for="t in tabs" :key="t.v" class="chip" :class="{ active: tab === t.v }" @click="tab = t.v">{{ t.label }}</button>
    </div>

    <!-- 模式一：档位汇总 -->
    <template v-if="tab === 'tiers'">
      <div class="tier-head">
        <span>套餐名</span><span>月价（元）</span><span>订阅数</span><span></span>
      </div>
      <div v-for="(t, i) in tiers" :key="i" class="tier-row">
        <input v-model="t.name" class="input" placeholder="如 专业版" />
        <input v-model.number="t.price" type="number" class="input" min="0" placeholder="如 99" />
        <input v-model.number="t.count" type="number" class="input" min="0" placeholder="如 120" />
        <button class="icon-btn danger" title="删除" aria-label="删除" @click="removeTier(i)"><Trash2 :size="14" /></button>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="addTier"><Plus :size="14" /> 添加档位</button>

      <div class="stats mt-2">
        <div class="stat-tile hl">
          <span class="st-label">MRR（月度经常性收入）</span>
          <strong class="st-val big">{{ money(totalMrr) }}</strong>
        </div>
        <div class="stat-tile">
          <span class="st-label">ARR（年化）</span>
          <strong class="st-val">{{ money(totalArr) }}</strong>
        </div>
        <div class="stat-tile">
          <span class="st-label">总订阅数</span>
          <strong class="st-val">{{ totalSubs.toLocaleString() }}</strong>
        </div>
      </div>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr><th>档位</th><th>月价</th><th>订阅数</th><th>MRR</th><th>占 MRR 比例</th></tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in tiers" :key="i">
              <td>{{ t.name || `档位 ${i + 1}` }}</td>
              <td>{{ money(num(t.price)) }}</td>
              <td>{{ num(t.count).toLocaleString() }}</td>
              <td>{{ money(mrr(t)) }}</td>
              <td>
                <span class="bar-wrap"><span class="bar" :style="{ width: `${share(t)}%` }"></span></span>
                {{ share(t).toFixed(1) }}%
              </td>
            </tr>
            <tr class="sum-row">
              <td><b>合计</b></td><td></td><td><b>{{ totalSubs.toLocaleString() }}</b></td>
              <td><b>{{ money(totalMrr) }}</b></td><td><b>100%</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="hint mt-1">MRR = Σ 各档位月价 × 订阅数；ARR = MRR × 12。按年付可折算为月价（如年付价 ÷ 12）。</p>
    </template>

    <!-- 模式二：MRR 变动 -->
    <template v-else>
      <div class="fields">
        <div><label class="field-label">新增 MRR（新客户）</label><input v-model.number="newMrr" type="number" class="input" /></div>
        <div><label class="field-label">扩张 MRR（升配/加购）</label><input v-model.number="expandMrr" type="number" class="input" /></div>
        <div><label class="field-label">收缩 MRR（降配）</label><input v-model.number="contractMrr" type="number" class="input" /></div>
        <div><label class="field-label">流失 MRR</label><input v-model.number="churnMrr" type="number" class="input" /></div>
        <div><label class="field-label">期初 MRR（算流失率用）</label><input v-model.number="startMrr" type="number" class="input" /></div>
      </div>

      <div class="stats mt-2">
        <div class="stat-tile hl">
          <span class="st-label">净新增 MRR</span>
          <strong class="st-val big" :class="netNewMrr >= 0 ? 'ok' : 'bad'">
            {{ netNewMrr >= 0 ? '+' : '' }}{{ money(netNewMrr) }}
          </strong>
          <span class="st-sub">新增 + 扩张 − 收缩 − 流失</span>
        </div>
        <div class="stat-tile">
          <span class="st-label">MRR 流失率</span>
          <strong class="st-val" :class="churnRate <= 2 ? 'ok' : churnRate <= 5 ? '' : 'bad'">{{ churnRate.toFixed(2) }}%</strong>
          <span class="st-sub" v-if="Number.isFinite(quickMrrRate)">按当前流失速度约 {{ quickMrrRate.toFixed(0) }} 个月流失完</span>
        </div>
        <div class="stat-tile">
          <span class="st-label">净收入留存率（NRR）</span>
          <strong class="st-val" :class="nrr >= 100 ? 'ok' : ''">{{ nrr.toFixed(1) }}%</strong>
          <span class="st-sub">≥100% 说明扩张能抵消流失</span>
        </div>
      </div>
      <p class="hint mt-1">口径：流失率 = 流失 MRR ÷ 期初 MRR（月度）。月流失率 &lt; 2% 通常被视为健康。</p>
    </template>
  </div>
</template>

<style scoped>
.tier-head {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 34px;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.tier-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 34px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.icon-btn {
  width: 30px; height: 30px; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer;
}
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.fields {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 560px) {
  .fields { grid-template-columns: 1fr; }
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
.st-val.big { font-size: 26px; }
.st-sub { font-size: 12px; color: var(--text-3); }
.ok { color: var(--ok); }
.bad { color: var(--err); }
.bar-wrap {
  display: inline-block;
  width: 80px;
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
  vertical-align: middle;
  margin-right: 6px;
}
.bar { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.sum-row td { background: var(--accent-soft); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
