<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Loader2, Download, Table2 } from 'lucide-vue-next'
import { renderChart } from '@/lib/chartEngine'
import { rowsToXlsx } from '@/lib/officeEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 行 = 同期群（如 2026-01）+ 后续各月留存率%（% 可省略） */
const SAMPLE = `2026-01,100,86,74,66,61,58
2026-02,100,88,77,69,64
2026-03,100,85,72,63
2026-04,100,90,81
2026-05,100,87`

const csvText = ref('')
const cohorts = ref<{ label: string; values: (number | null)[] }[]>([])
const loading = ref(false)
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null

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
    draw()
    toast.ok(`已解析 ${out.length} 个同期群`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
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

/* ---------- 平均留存曲线 ---------- */
const draw = () => {
  if (!stage.value || !cohorts.value.length) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  const n = maxLen()
  const avg = Array.from({ length: n }, (_, m) => avgAt(m) ?? 0)
  cleanup = renderChart(
    canvas,
    'line',
    Array.from({ length: n }, (_, m) => `第 ${m} 月`),
    [{ label: '平均留存率（%）', data: avg }],
    { legend: false },
  )
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
  const header = ['同期群', ...Array.from({ length: n }, (_, m) => `第${m}月`)]
  const rows = cohorts.value.map((c) => [c.label, ...Array.from({ length: n }, (_, m) => c.values[m] ?? '')])
  const blob = await rowsToXlsx(header, rows, '同期群留存')
  saveBlob(blob, '同期群留存分析.xlsx')
  toast.ok('xlsx 已开始下载')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      每行一个同期群：首列为群组（如 2026-01），其后依次为第 0、1、2…月的留存率。可从示例数据开始体验。
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
    </div>

    <template v-if="cohorts.length">
      <div class="table-wrap mt-2">
        <table class="data-table heat">
          <thead>
            <tr>
              <th>同期群</th>
              <th v-for="m in maxLen()" :key="m">第 {{ m - 1 }} 月</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in cohorts" :key="c.label">
              <td class="cohort-label">{{ c.label }}</td>
              <td
                v-for="(v, m) in c.values"
                :key="m"
                class="cell"
                :style="{ background: cellColor(v), color: cellText(v) }"
              >{{ v === null ? '—' : v.toFixed(0) }}</td>
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

      <div class="chart-stage mt-2">
        <div ref="stage" class="chart-box"></div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="dlXlsx"><Download :size="16" /> 下载 xlsx</button>
      </div>
      <p class="hint mt-1">热力表颜色越深代表留存越高；平均行与曲线均忽略该月无数据的同期群。</p>
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
.chart-box { height: 300px; position: relative; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
