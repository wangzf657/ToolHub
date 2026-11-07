<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { renderChart, type ChartKind } from '@/lib/chartEngine'
import type { Dataset } from './dataShared'

/** 图表面板：列选择 + 类型 + renderChart（含 cleanup） */
const props = defineProps<{ dataset: Dataset }>()

const kind = ref<ChartKind>('bar')
const xCol = ref(0)
const yCols = ref<number[]>([])
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null

const kinds: { v: ChartKind; label: string }[] = [
  { v: 'bar', label: '柱状图' },
  { v: 'line', label: '折线图' },
  { v: 'pie', label: '饼图' },
  { v: 'doughnut', label: '环形图' },
]

// 数据集变化时重置选择
watch(
  () => props.dataset,
  (ds) => {
    xCol.value = 0
    yCols.value = ds.header.length > 1 ? [1] : [0]
  },
  { immediate: true },
)

const numCols = computed(() => {
  // 粗略判断数值列：前 20 行多数可解析为数字
  const ds = props.dataset
  const out: number[] = []
  for (let c = 0; c < ds.header.length; c++) {
    const sample = ds.rows.slice(0, 20).filter((r) => (r[c] ?? '').trim() !== '')
    if (!sample.length) continue
    const numeric = sample.filter((r) => !Number.isNaN(parseFloat(r[c] ?? ''))).length
    if (numeric / sample.length > 0.6) out.push(c)
  }
  return out.length ? out : ds.header.map((_, i) => i)
})

const draw = () => {
  if (!stage.value) return
  cleanup?.()
  cleanup = null
  const ds = props.dataset
  const ys = yCols.value.length ? yCols.value : numCols.value.slice(0, 1)
  if (!ys.length) return
  const labels = ds.rows.map((r) => r[xCol.value] ?? '')
  const series = ys.map((c) => ({
    label: ds.header[c] ?? `列${c + 1}`,
    data: ds.rows.map((r) => {
      const n = parseFloat(r[c] ?? '')
      return Number.isNaN(n) ? 0 : n
    }),
  }))
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  cleanup = renderChart(canvas, kind.value, labels, series, { legend: series.length > 1 || kind.value === 'pie' || kind.value === 'doughnut' })
}

watch([kind, xCol, yCols, () => props.dataset], () => {
  nextTick(draw)
})

onMounted(() => {
  nextTick(draw)
})

onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})
</script>

<template>
  <div>
    <div class="row row-wrap">
      <div class="chip-row">
        <button v-for="k in kinds" :key="k.v" class="chip" :class="{ active: kind === k.v }" @click="kind = k.v">
          {{ k.label }}
        </button>
      </div>
    </div>
    <div class="row row-wrap mt-1">
      <label class="check">
        X 轴 / 标签
        <select v-model.number="xCol" class="select" style="width: 140px">
          <option v-for="(h, i) in dataset.header" :key="i" :value="i">{{ h }}</option>
        </select>
      </label>
      <label class="check">
        Y 轴数值列（可多选）
        <select v-model="yCols" class="select" multiple size="3" style="min-width: 140px">
          <option v-for="i in numCols" :key="i" :value="i">{{ dataset.header[i] }}</option>
        </select>
      </label>
    </div>

    <div class="chart-stage mt-2">
      <div ref="stage" class="chart-box"></div>
    </div>
  </div>
</template>

<style scoped>
.chip-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
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
