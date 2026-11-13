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
/** 数据频率：年化系数 √252 / √52 / √12 */
const freq = ref<'day' | 'week' | 'month'>('day')

const FREQ_META = { day: { k: 252, label: '日度', hint: '√252' }, week: { k: 52, label: '周度', hint: '√52' }, month: { k: 12, label: '月度', hint: '√12' } } as const

/** 逐行解析：整行为空跳过；一行内所有 token 都无法识别 → 该行报错 */
const parseResult = computed(() => {
  const values: number[] = []
  const badLines: string[] = []
  const lines = returnsText.value.split(/\n/)
  lines.forEach((line, li) => {
    if (!line.trim()) return
    const tokens = line.split(/[,，;；\s\t]+/).filter((s) => s.trim())
    const nums = tokens.map((t) => parseFloat(t.replace(/%$/, ''))).filter((n) => !Number.isNaN(n))
    if (!nums.length) badLines.push(`第 ${li + 1} 行`)
    values.push(...nums)
  })
  return { values, badLines }
})
const returns = computed(() => parseResult.value.values)

const stat = computed(() => sharpeSortino(returns.value, (Number(riskFree.value) || 0) / 100))
const valid = computed(() => returns.value.length >= 2)
const k = computed(() => FREQ_META[freq.value].k)
const annualSharpe = computed(() => stat.value.sharpe * Math.sqrt(k.value))
const annualSortino = computed(() => stat.value.sortino * Math.sqrt(k.value))

const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const grade = (s: number) => (s >= 2 ? '优秀' : s >= 1 ? '良好' : s > 0 ? '一般' : '为负，风险调整后不赚钱')

/* ---------- 图表：收益率 / 累计净值 双 Tab ---------- */
const chartTab = ref<'ret' | 'nav'>('ret')
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null
const draw = () => {
  if (!stage.value || !valid.value) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  if (chartTab.value === 'ret') {
    cleanup = renderChart(
      canvas,
      'line',
      returns.value.map((_, i) => `#${i + 1}`),
      [{ label: '各期收益率（%）', data: returns.value }],
      { legend: false },
    )
  } else {
    // 累计净值：1+r 逐期累乘，从 1 起步（% 口径收益）
    let nav = 1
    const navs = returns.value.map((r) => (nav *= 1 + r / 100))
    cleanup = renderChart(canvas, 'line', ['#0', ...returns.value.map((_, i) => `#${i + 1}`)], [{ label: '累计净值（1+r 累乘）', data: [1, ...navs] }], { legend: false })
  }
}
watch([returns, chartTab], draw, { flush: 'post' })
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
          <p class="field-hint">参考 10 年期国债收益率（国内约 2%~3%）；填 0 也可计算（口径为超额收益/波动）</p>
        </div>
        <div>
          <label class="field-label">数据频率</label>
          <select v-model="freq" class="select w-rf">
            <option value="day">日度（年化 ×√252）</option>
            <option value="week">周度（年化 ×√52）</option>
            <option value="month">月度（年化 ×√12）</option>
          </select>
        </div>
        <button class="btn btn-ghost btn-sm align-end" @click="clearText"><Trash2 :size="14" /> 清空</button>
      </div>
    </div>

    <div v-if="parseResult.badLines.length" class="notice notice-warn mt-2 small">{{ parseResult.badLines.join('、') }} 无法识别，已跳过（共解析 {{ returns.length }} 期有效收益）</div>

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
          <span class="st-label">夏普比率（{{ FREQ_META[freq].label }}）</span>
          <strong class="st-val big" :class="stat.sharpe > 0 ? 'ok' : 'bad'">{{ stat.sharpe.toFixed(2) }}</strong>
          <span class="st-sub">{{ grade(stat.sharpe) }}</span>
        </div>
        <div class="stat-tile hl">
          <span class="st-label">索提诺比率（{{ FREQ_META[freq].label }}）</span>
          <strong class="st-val big" :class="stat.sortino > 0 ? 'ok' : 'bad'">{{ stat.sortino.toFixed(2) }}</strong>
          <span class="st-sub">只惩罚下行波动</span>
        </div>
      </div>

      <div class="stats mt-2 annual-row">
        <div class="stat-tile annual">
          <span class="st-label">年化夏普</span>
          <strong class="st-val big" :class="annualSharpe > 0 ? 'ok' : 'bad'">{{ annualSharpe.toFixed(2) }}</strong>
        </div>
        <div class="stat-tile annual">
          <span class="st-label">年化索提诺</span>
          <strong class="st-val big" :class="annualSortino > 0 ? 'ok' : 'bad'">{{ annualSortino.toFixed(2) }}</strong>
        </div>
      </div>

      <div class="notice notice-info mt-2">
        年化口径：数据按<b>{{ FREQ_META[freq].label }}收益</b>处理，年化 = 每期比率 × {{ FREQ_META[freq].hint }}；夏普 ≈ {{ annualSharpe.toFixed(2) }}、索提诺 ≈ {{ annualSortino.toFixed(2) }}。
      </div>

      <div class="row mt-2" style="gap: 6px; align-items: center">
        <button class="chip" :class="{ on: chartTab === 'ret' }" @click="chartTab = 'ret'">收益率</button>
        <button class="chip" :class="{ on: chartTab === 'nav' }" @click="chartTab = 'nav'">累计净值</button>
      </div>
      <div class="chart-stage mt-2">
        <div ref="stage" class="chart-box"></div>
      </div>
      <p class="hint mt-1">计算口径：夏普 =（均值 − 无风险利率）÷ 标准差；索提诺用下行差代替标准差；累计净值 = (1 + r) 逐期累乘，从 1 起步。</p>
    </template>

    <div class="row mt-2">
      <span class="chip"><LineChart :size="13" /> 已解析 {{ returns.length }} 期收益</span>
    </div>
  </div>
</template>

<style scoped>
.input-panel { display: grid; gap: 6px; }
.w-rf { width: 200px; }
.align-end { align-self: flex-end; }
.field-hint { font-size: 11.5px; color: var(--text-3); margin: 4px 0 0; }
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.stats.annual-row { grid-template-columns: repeat(2, 1fr); max-width: 560px; }
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
.stat-tile.annual { border-color: var(--border-strong); }
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
.chip.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 700; }
</style>
