<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LineChart, Trash2 } from 'lucide-vue-next'
import { sharpeSortino } from '@/lib/finance'
import { renderChart } from '@/lib/chartEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const returnsText = ref(`2.1
-0.8
1.4
0.6
-1.2
2.8
0.3
-0.5
1.9
1.1`)
const riskFree = ref(2)

/** 每行一个百分比收益，兼容逗号/空格/制表符分隔 */
const returns = computed(() =>
  returnsText.value
    .split(/[\n,，\s\t;；]+/)
    .map((s) => parseFloat(s))
    .filter((n) => !Number.isNaN(n)),
)

const stat = computed(() => sharpeSortino(returns.value, (Number(riskFree.value) || 0) / 100))
const valid = computed(() => returns.value.length >= 2)
/** 按日度收益年化：×√252 */
const annualSharpe = computed(() => stat.value.sharpe * Math.sqrt(252))
const annualSortino = computed(() => stat.value.sortino * Math.sqrt(252))

const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const grade = (s: number) => (s >= 2 ? '优秀' : s >= 1 ? '良好' : s > 0 ? '一般' : '为负，风险调整后不赚钱')

/* ---------- 收益序列折线图 ---------- */
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null
const draw = () => {
  if (!stage.value || !valid.value) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  cleanup = renderChart(
    canvas,
    'line',
    returns.value.map((_, i) => `#${i + 1}`),
    [{ label: '各期收益率（%）', data: returns.value }],
    { legend: false },
  )
}
watch(returns, draw, { flush: 'post' })
onMounted(draw)
onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})

const clearText = () => {
  returnsText.value = ''
  toast.ok('已清空')
}
</script>

<template>
  <div>
    <div class="input-panel">
      <label class="field-label">收益率序列（每行一个百分比，可整段粘贴逗号/空格分隔的数据）</label>
      <textarea v-model="returnsText" class="textarea mono" style="min-height: 150px" placeholder="如&#10;2.1&#10;-0.8&#10;1.4"></textarea>
      <div class="row row-wrap mt-1">
        <div>
          <label class="field-label">年化无风险利率（%）</label>
          <input v-model.number="riskFree" type="number" class="input w-rf" step="0.1" placeholder="如 2" />
        </div>
        <button class="btn btn-ghost btn-sm align-end" @click="clearText"><Trash2 :size="14" /> 清空</button>
      </div>
    </div>

    <div v-if="!valid" class="notice notice-warn mt-2">至少需要 2 个有效收益数据才能计算比率。</div>

    <template v-else>
      <div class="stats mt-2">
        <div class="stat-tile">
          <span class="st-label">均值（每期）</span>
          <strong class="st-val">{{ pct(stat.mean) }}</strong>
        </div>
        <div class="stat-tile">
          <span class="st-label">标准差（波动）</span>
          <strong class="st-val">{{ pct(stat.std) }}</strong>
        </div>
        <div class="stat-tile">
          <span class="st-label">下行差（只算亏损）</span>
          <strong class="st-val">{{ pct(stat.downside) }}</strong>
        </div>
      </div>

      <div class="stats mt-2">
        <div class="stat-tile hl">
          <span class="st-label">夏普比率（每期）</span>
          <strong class="st-val big" :class="stat.sharpe > 0 ? 'ok' : 'bad'">{{ stat.sharpe.toFixed(2) }}</strong>
          <span class="st-sub">{{ grade(stat.sharpe) }}</span>
        </div>
        <div class="stat-tile hl">
          <span class="st-label">索提诺比率（每期）</span>
          <strong class="st-val big" :class="stat.sortino > 0 ? 'ok' : 'bad'">{{ stat.sortino.toFixed(2) }}</strong>
          <span class="st-sub">只惩罚下行波动</span>
        </div>
      </div>

      <div class="notice notice-info mt-2">
        年化提示：假设数据为<b>日度收益率</b>，年化夏普 ≈ {{ annualSharpe.toFixed(2) }}、年化索提诺 ≈ {{ annualSortino.toFixed(2) }}（每期比率 × √252）。
        若数据为月度收益，请改用 × √12 自行换算。
      </div>

      <div class="chart-stage mt-2">
        <div ref="stage" class="chart-box"></div>
      </div>
      <p class="hint mt-1">计算口径：夏普 =（均值 − 无风险利率）÷ 标准差；索提诺用下行差代替标准差。</p>
    </template>

    <div class="row mt-2">
      <span class="chip"><LineChart :size="13" /> 已解析 {{ returns.length }} 期收益</span>
    </div>
  </div>
</template>

<style scoped>
.input-panel { display: grid; gap: 6px; }
.w-rf { width: 160px; }
.align-end { align-self: flex-end; }
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
.st-val { font-size: 18px; }
.st-val.big { font-size: 26px; }
.st-sub { font-size: 12px; color: var(--text-3); }
.ok { color: var(--ok); }
.bad { color: var(--err); }
.chart-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.chart-box { height: 280px; position: relative; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
