<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { Loader2, Download, Table2, AlertTriangle } from 'lucide-vue-next'
import { renderChart } from '@/lib/chartEngine'
import { rowsToXlsx } from '@/lib/officeEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 行 = 同期群（如 2026-01）+ 后续各期留存率%（% 可省略） */
const SAMPLE = `2026-01,100,86,74,66,61,58
2026-02,100,88,77,69,64
2026-03,100,85,72,63
2026-04,100,90,81
2026-05,100,87`

const csvText = ref('')
const cohorts = ref<{ label: string; values: (number | null)[] }[]>([])
const loading = ref(false)
const stage = ref<HTMLDivElement | null>(null)
const period = ref<'month' | 'week'>('month')
const overlayCurves = ref(false)
/** 量纲守卫：检测到非百分比数值时提示并可一键归一化 */
const scaleWarn = ref(false)
let cleanup: (() => void) | null = null

const unit = () => (period.value === 'month' ? '月' : '周')

const parse = async () => {
  const lines = csvText.value.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) {
    toast.warn('请先粘贴数据，或点击载入示例')
    return
  }
  loading.value = true
  try {
    await nextFrame()
    const out: { label: string; values: (number | null)[] }[] = []
    for (const line of lines) {
      const cells = line.split(/[,，\t;]+/).map((c) => c.trim())
      // 跳过表头行（首列不是「年-月」格式）
      if (!/^\d{4}[-/年]\d{1,2}/.test(cells[0]) && out.length === 0 && !/^\d/.test(cells[0])) continue
      const label = cells[0]
      const values = cells.slice(1).map((c) => {
        const n = parseFloat(c)
        return Number.isNaN(n) ? null : n
      })
      if (values.length) out.push({ label, values })
    }
    if (!out.length) throw new Error('没有解析到有效数据行（每行应为「2026-01,100,86,…」）')
    cohorts.value = out
    // 量纲守卫：任一行首值 ≠100 或任一值 >100 → 警告 + 归一化入口
    scaleWarn.value = out.some(
      (c) => (c.values[0] !== null && c.values[0] !== 100) || c.values.some((v) => v !== null && v > 100),
    )
    if (scaleWarn.value) {
      toast.warn('检测到非百分比数值（首列应为 100），可点击「按首列归一化」修正量纲')
    }
    // 图表容器在 v-if="cohorts.length" 内，等 DOM 挂载后再画，否则 stage 为 null 静默跳过
    await nextTick()
    draw()
    toast.ok(`已解析 ${out.length} 个同期群`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
}

/** 按首列归一化：每个值 ÷ 首列 ×100（首列变为 100） */
const normalize = () => {
  cohorts.value = cohorts.value.map((c) => {
    const base = c.values[0]
    if (base === null || base === undefined || base === 0) return c
    return { ...c, values: c.values.map((v) => (v === null ? null : Math.round((v / base) * 1000) / 10)) }
  })
  scaleWarn.value = false
  draw()
  toast.ok('已按首列归一化为百分比量纲')
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

const maxLen = () => Math.max(0, ...cohorts.value.map((c) => c.values.length))
/** 第 m 月的平均留存率（忽略空值） */
const avgAt = (m: number) => {
  const vals = cohorts.value.map((c) => c.values[m]).filter((v): v is number => v !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

/* ---------- 热力色（hsl 内插：值越高颜色越深） ---------- */
const cellColor = (v: number | null) => (v === null ? 'transparent' : `hsl(215, 68%, ${Math.max(32, 92 - v * 0.55)}%)`)
const cellText = (v: number | null) => (v === null ? 'var(--text-3)' : v > 55 ? '#ffffff' : 'var(--text)')

/* ---------- 平均留存曲线（可叠加各群组曲线） ---------- */
const draw = () => {
  if (!stage.value || !cohorts.value.length) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  const n = maxLen()
  const avg = Array.from({ length: n }, (_, m) => avgAt(m) ?? 0)
  const series: { label: string; data: number[] }[] = overlayCurves.value
    ? [
        ...cohorts.value.map((c) => ({ label: c.label, data: Array.from({ length: n }, (_, m) => c.values[m] ?? NaN) })),
        { label: '平均留存率（%）', data: avg },
      ]
    : [{ label: '平均留存率（%）', data: avg }]
  cleanup = renderChart(
    canvas,
    'line',
    Array.from({ length: n }, (_, m) => `第 ${m} ${unit()}`),
    series,
    { legend: overlayCurves.value },
  )
}
const redraw = () => {
  if (cohorts.value.length) draw()
}
onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})

/* ---------- 导出 xlsx ---------- */
const dlXlsx = async () => {
  if (!cohorts.value.length) {
    toast.warn('请先解析数据')
    return
  }
  const n = maxLen()
  const header = ['同期群', ...Array.from({ length: n }, (_, m) => `第${m}${unit()}`)]
  const rows = cohorts.value.map((c) => [c.label, ...Array.from({ length: n }, (_, m) => c.values[m] ?? '')])
  const blob = await rowsToXlsx(header, rows, '同期群留存')
  saveBlob(blob, '同期群留存分析.xlsx')
  toast.ok('xlsx 已开始下载')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      每行一个同期群：首列为群组（如 2026-01），其后依次为第 0、1、2…期的留存率（首列应为 100）。可从示例数据开始体验。
    </div>

    <textarea
      v-model="csvText"
      class="textarea mono mt-2"
      style="min-height: 140px"
      placeholder="2026-01,100,86,74,66&#10;2026-02,100,88,77"
    ></textarea>
    <div class="row row-wrap mt-1">
      <button class="btn btn-primary" :disabled="loading" @click="parse">
        <Loader2 v-if="loading" :size="16" class="spin" />
        <Table2 v-else :size="16" />
        生成留存热力表
      </button>
      <button class="btn btn-ghost" @click="csvText = SAMPLE">载入示例数据</button>
      <label class="opt-inline small">
        周期单位
        <select v-model="period" class="select" style="width: 90px" @change="redraw">
          <option value="month">月</option>
          <option value="week">周</option>
        </select>
      </label>
    </div>

    <div v-if="scaleWarn" class="notice notice-warn mt-2 small row row-wrap" style="align-items: center">
      <AlertTriangle :size="15" />
      <span>检测到非百分比数值（首列应为 100）或存在大于 100 的值，热力色可能失真。</span>
      <button class="btn btn-soft btn-sm" @click="normalize">按首列归一化</button>
    </div>

    <template v-if="cohorts.length">
      <div class="table-wrap mt-2 heat-wrap">
        <table class="data-table heat">
          <thead>
            <tr>
              <th>同期群</th>
              <th v-for="m in maxLen()" :key="m">第 {{ m - 1 }} {{ unit() }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in cohorts" :key="c.label">
              <td class="cohort-label">{{ c.label }}</td>
              <!-- 短行按最长行补齐「—」，各行右缘对齐 -->
              <td
                v-for="m in maxLen()"
                :key="m"
                class="cell"
                :style="{ background: cellColor(c.values[m - 1] ?? null), color: cellText(c.values[m - 1] ?? null) }"
              >{{ c.values[m - 1] === null || c.values[m - 1] === undefined ? '—' : (c.values[m - 1] as number).toFixed(0) }}</td>
            </tr>
            <tr class="sum-row">
              <td><b>平均</b></td>
              <td v-for="m in maxLen()" :key="m">
                <b>{{ avgAt(m - 1) === null ? '—' : (avgAt(m - 1) as number).toFixed(1) }}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="row row-wrap mt-2">
        <label class="check"><input v-model="overlayCurves" type="checkbox" @change="redraw" /> 叠加显示各群组曲线</label>
        <span class="small muted">开启后绘制每条群组曲线与平均线，图例可点击单组隐藏</span>
      </div>

      <div class="chart-stage mt-2">
        <div ref="stage" class="chart-box"></div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="dlXlsx"><Download :size="16" /> 下载 xlsx</button>
      </div>
      <p class="hint mt-1">热力表颜色越深代表留存越高；平均行与曲线均忽略该期无数据的同期群。</p>
    </template>
  </div>
</template>

<style scoped>
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
table.heat { border-collapse: separate; border-spacing: 3px; }
.cohort-label { font-weight: 600; color: var(--text-2); }
.cell {
  text-align: center;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
  min-width: 52px;
  font-weight: 600;
}
.sum-row td { background: var(--accent-soft); }
.chart-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
/* 弹性高度：热力表与图表均以视口为主 */
.heat-wrap {
  height: max(360px, calc(100vh - 420px));
  overflow: auto;
}
.chart-box { height: min(420px, calc(100vh - 460px)); min-height: 240px; position: relative; }
.hint { font-size: 12px; color: var(--text-3); }
.opt-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
}
</style>
