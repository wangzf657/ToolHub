<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { BarChart3, Loader2, Download, Maximize2 } from 'lucide-vue-next'
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { renderChart, type ChartKind } from '@/lib/chartEngine'
import { useToast } from '@/composables/useToast'

/** CSV 图表生成器：粘贴 CSV（可映射标签列/数值列）→ 柱/横柱/线/饼/环图 → 下载 PNG */
const toast = useToast()
const csvText = ref('')
const kind = ref<'bar' | 'barH' | 'line' | 'pie' | 'doughnut'>('bar')
const data = ref<CsvData | null>(null)
const loading = ref(false)
const drawErr = ref('')
const stage = ref<HTMLDivElement | null>(null)
let cleanup: (() => void) | null = null
/** 列映射：标签列与数值列（数值列留空 = 标签列之外全部） */
const labelCol = ref(0)
const valueCols = ref<number[]>([])
/** 画布放大 */
const enlarged = ref(false)

const SAMPLE = `月份,销售额,成本
一月,120,80
二月,150,90
三月,180,95
四月,140,88
五月,210,110`

const kinds: { v: 'bar' | 'barH' | 'line' | 'pie' | 'doughnut'; label: string }[] = [
  { v: 'bar', label: '柱状图' },
  { v: 'barH', label: '横向柱状' },
  { v: 'line', label: '折线图' },
  { v: 'pie', label: '饼图' },
  { v: 'doughnut', label: '环形图' },
]

const loadSample = () => {
  csvText.value = SAMPLE
}

/* 粘贴即绘：粘贴事件 500ms 后自动生成 */
let pasteTimer: number | null = null
const onPaste = () => {
  if (pasteTimer !== null) window.clearTimeout(pasteTimer)
  pasteTimer = window.setTimeout(() => {
    if (csvText.value.trim()) void parse()
  }, 500)
}
onBeforeUnmount(() => {
  if (pasteTimer !== null) window.clearTimeout(pasteTimer)
})

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
    labelCol.value = Math.min(labelCol.value, d.header.length - 1)
    valueCols.value = valueCols.value.filter((c) => c < d.header.length && c !== labelCol.value)
    await nextTick()
    draw()
    toast.ok(`已绘制：${d.rows.length} 行 × ${d.header.length} 列${nonNumNote.value ? `（${nonNumNote.value}）` : ''}`)
  } catch (e) {
    toast.err((e as Error).message || 'CSV 解析失败')
  } finally {
    loading.value = false
  }
}

/** 标签列按映射取；数值列默认 = 标签列之外全部 */
const labels = computed(() => data.value?.rows.map((r) => r[labelCol.value] ?? '') ?? [])
/** 非数值项统计（导出披露口径：按 0 计） */
const nonNumNote = computed(() => {
  let bad = 0
  for (const c of effValueCols.value) {
    for (const r of data.value?.rows ?? []) {
      const v = (r[c] ?? '').trim()
      if (v !== '' && Number.isNaN(Number(v))) bad++
    }
  }
  return bad ? `${bad} 个非数值项已按 0 计` : ''
})
const effValueCols = computed<number[]>(() => {
  const d = data.value
  if (!d) return []
  const chosen = valueCols.value.length ? valueCols.value : d.header.map((_, i) => i).filter((i) => i !== labelCol.value)
  // 只有一列可作数值时兜底用最后一列
  return chosen.length ? chosen : [d.header.length - 1]
})
const series = computed(() => {
  const d = data.value
  if (!d) return []
  return effValueCols.value.map((c) => ({
    label: d.header[c] ?? `系列${c}`,
    data: d.rows.map((r) => {
      const n = parseFloat(r[c] ?? '')
      return Number.isNaN(n) ? 0 : n
    }),
  }))
})

const draw = () => {
  if (!stage.value) return
  cleanup?.()
  const canvas = document.createElement('canvas')
  stage.value.replaceChildren(canvas)
  drawErr.value = ''
  try {
    const realKind: ChartKind = kind.value === 'barH' ? 'bar' : kind.value
    cleanup = renderChart(canvas, realKind, labels.value, series.value, { legend: series.value.length > 1, horizontal: kind.value === 'barH' })
  } catch (e) {
    drawErr.value = (e as Error).message || '图表绘制失败'
  }
}

watch([kind, labelCol, valueCols, data], () => {
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
      <div class="label">粘贴 CSV（可自选标签列与数值列；直接粘贴即自动绘图）</div>
      <textarea
        v-model="csvText"
        class="textarea mono"
        style="min-height: 150px"
        placeholder="月份,销售额,成本&#10;一月,120,80&#10;二月,150,90"
        @paste="onPaste"
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
      <template v-if="data">
        <label class="check small">
          标签列
          <select v-model.number="labelCol" class="select" style="width: 110px">
            <option v-for="(h, i) in data.header" :key="i" :value="i">{{ h }}</option>
          </select>
        </label>
        <label class="check small">
          数值列
          <select v-model="valueCols" class="select" style="width: 150px" multiple size="3">
            <option v-for="(h, i) in data.header" :key="i" :value="i" :disabled="i === labelCol">{{ h }}</option>
          </select>
          <span class="muted">留空 = 除标签列外全部</span>
        </label>
      </template>
    </div>

    <div class="chart-stage mt-2">
      <div class="row" style="justify-content: flex-end">
        <button class="btn btn-ghost btn-sm" @click="enlarged = !enlarged"><Maximize2 :size="13" /> {{ enlarged ? '恢复高度' : '放大' }}</button>
      </div>
      <div ref="stage" class="chart-box" :class="{ big: enlarged }"></div>
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
/* 放大：视口口径（1366×768 下 ≥520px） */
.chart-box.big {
  height: min(72vh, 640px);
}
.chart-box canvas {
  max-width: 100%;
}
</style>
