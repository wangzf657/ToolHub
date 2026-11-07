<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { BarChart3, Loader2, Download } from 'lucide-vue-next'
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { renderChart, type ChartKind } from '@/lib/chartEngine'
import { useToast } from '@/composables/useToast'

/** CSV 图表生成器：粘贴 CSV → 柱/线/饼/环图 → 下载 PNG */
const toast = useToast()
const csvText = ref('')
const kind = ref<ChartKind>('bar')
const data = ref<CsvData | null>(null)
const loading = ref(false)
const drawErr = ref('')
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null

const SAMPLE = `月份,销售额,成本
一月,120,80
二月,150,90
三月,180,95
四月,140,88
五月,210,110`

const kinds: { v: ChartKind; label: string }[] = [
  { v: 'bar', label: '柱状图' },
  { v: 'line', label: '折线图' },
  { v: 'pie', label: '饼图' },
  { v: 'doughnut', label: '环形图' },
]

const loadSample = () => {
  csvText.value = SAMPLE
}

const parse = async () => {
  if (!csvText.value.trim()) {
    toast.warn('请先粘贴 CSV 内容，或点击载入示例')
    return
  }
  loading.value = true
  try {
    const d = await parseCsvAsync(csvText.value)
    if (!d.rows.length) throw new Error('没有数据行')
    data.value = d
    await nextTick()
    draw()
    toast.ok(`已绘制：${d.rows.length} 行 × ${d.header.length} 列`)
  } catch (e) {
    toast.err((e as Error).message || 'CSV 解析失败')
  } finally {
    loading.value = false
  }
}

/** 标签列 = 第一列；其余每列一个系列 */
const labels = computed(() => data.value?.rows.map((r) => r[0] ?? '') ?? [])
const series = computed(() => {
  const d = data.value
  if (!d) return []
  const out: { label: string; data: number[] }[] = []
  for (let c = 1; c < d.header.length; c++) {
    const nums = d.rows.map((r) => {
      const n = parseFloat(r[c] ?? '')
      return Number.isNaN(n) ? 0 : n
    })
    out.push({ label: d.header[c] ?? `系列${c}`, data: nums })
  }
  // 只有一列时该列就是值列，首列做标签
  if (!out.length && d.header.length >= 1) {
    out.push({
      label: d.header[0] || '数值',
      data: d.rows.map((r) => {
        const n = parseFloat(r[d.header.length - 1] ?? '')
        return Number.isNaN(n) ? 0 : n
      }),
    })
  }
  return out
})

const draw = () => {
  if (!stage.value) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  drawErr.value = ''
  try {
    cleanup = renderChart(canvas, kind.value, labels.value, series.value, { legend: series.value.length > 1 })
  } catch (e) {
    drawErr.value = (e as Error).message || '图表绘制失败'
  }
}

watch(kind, () => {
  if (data.value) draw()
})

onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})

const dlPng = async () => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) {
    toast.warn('请先生成图表')
    return
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) {
    toast.err('导出失败')
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '图表.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}
</script>

<template>
  <div>
    <div class="input-panel">
      <div class="label">粘贴 CSV（首列为标签，其余每列为一个数据系列）</div>
      <textarea
        v-model="csvText"
        class="textarea mono"
        style="min-height: 150px"
        placeholder="月份,销售额,成本&#10;一月,120,80&#10;二月,150,90"
      ></textarea>
      <div class="row row-wrap mt-1">
        <button class="btn btn-primary" :disabled="loading" @click="parse">
          <Loader2 v-if="loading" :size="16" class="spin" />
          <BarChart3 v-else :size="16" />
          生成图表
        </button>
        <button class="btn btn-ghost" @click="loadSample">载入示例</button>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button
        v-for="k in kinds"
        :key="k.v"
        class="chip"
        :class="{ active: kind === k.v }"
        @click="kind = k.v"
      >
        {{ k.label }}
      </button>
    </div>

    <div class="chart-stage mt-2">
      <div ref="stage" class="chart-box"></div>
    </div>
    <div v-if="drawErr" class="notice notice-err mt-2">{{ drawErr }}</div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!data" @click="dlPng">
        <Download :size="16" /> 下载 PNG
      </button>
    </div>
  </div>
</template>

<style scoped>
.input-panel {
  display: grid;
  gap: 8px;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.chart-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.chart-box {
  height: 400px;
  position: relative;
}
.chart-box canvas {
  max-width: 100%;
}
</style>
