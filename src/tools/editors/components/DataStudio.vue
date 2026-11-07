<script setup lang="ts">
import { computed, ref } from 'vue'
import { Database, Loader2, Download, Trash2, Table2, BarChart3, Grid3x3, FileSearch, Terminal } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadFilesToDatasets, datasetToRecords, csvEscape, type Dataset } from './studio/dataShared'
import DataTablePanel from './studio/DataTablePanel.vue'
import ChartPanel from './studio/ChartPanel.vue'
import PivotPanel from './studio/PivotPanel.vue'
import SqlPanel from './studio/SqlPanel.vue'
import { saveText, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 数据分析工作台：左侧文件栏 + 数据表 / 图表 / 透视 / SQL / 导出
 */
const toast = useToast()
const datasets = ref<Dataset[]>([])
const activeIdx = ref(0)
const tab = ref<'table' | 'chart' | 'pivot' | 'sql' | 'export'>('table')
const loading = ref(false)

const steps = ['导入 CSV / Excel / JSON 文件', '筛选、排序与透视', '用图表与 SQL 探索，导出结果']

const tabs = [
  { v: 'table', label: '数据表', icon: Table2 },
  { v: 'chart', label: '图表', icon: BarChart3 },
  { v: 'pivot', label: '透视', icon: Grid3x3 },
  { v: 'sql', label: 'SQL', icon: Terminal },
  { v: 'export', label: '导出', icon: Download },
] as const

const active = computed(() => datasets.value[activeIdx.value] ?? null)

/** 已载入文件的指纹，防止 FileDrop 重复累加 */
const loadedKeys = new Set<string>()
const fileKey = (f: File) => `${f.name}:${f.size}`

const onFiles = async (files: File[]) => {
  const fresh = files.filter((f) => !loadedKeys.has(fileKey(f)))
  if (!fresh.length) return
  loading.value = true
  try {
    const loaded = await loadFilesToDatasets(fresh)
    loaded.forEach((_, i) => loadedKeys.add(fileKey(fresh[i])))
    datasets.value.push(...loaded)
    if (!active.value && loaded.length) activeIdx.value = 0
    toast.ok(`已载入 ${loaded.length} 个数据集`)
  } catch (e) {
    toast.err((e as Error).message || '文件解析失败')
  } finally {
    loading.value = false
  }
}

const selectAt = (i: number) => {
  activeIdx.value = i
}

const removeAt = (i: number) => {
  // 移除对应指纹（数据集名 ↔ 文件名近似对应），允许重新载入同名文件
  const name = datasets.value[i]?.name
  for (const k of loadedKeys) {
    if (k.startsWith(`${name}:`)) loadedKeys.delete(k)
  }
  datasets.value.splice(i, 1)
  if (activeIdx.value >= datasets.value.length) activeIdx.value = Math.max(0, datasets.value.length - 1)
}

/* ------- 导出 ------- */
const dlCsv = () => {
  if (!active.value) return
  const csv = [
    active.value.header.map(csvEscape).join(','),
    ...active.value.rows.map((r) => r.map(csvEscape).join(',')),
  ].join('\n')
  saveText('\uFEFF' + csv, `${active.value.name}.csv`, 'text/csv;charset=utf-8')
}

const dlJson = () => {
  if (!active.value) return
  saveText(JSON.stringify(datasetToRecords(active.value), null, 2), `${active.value.name}.json`, 'application/json;charset=utf-8')
}

const dlXlsx = async () => {
  if (!active.value) return
  const { rowsToXlsx } = await import('@/lib/officeEngine')
  const blob = await rowsToXlsx(active.value.header, active.value.rows, active.value.name.slice(0, 28) || 'Sheet1')
  saveBlob(blob, `${active.value.name}.xlsx`)
}
</script>

<template>
  <div class="studio">
    <div class="steps row row-wrap">
      <span v-for="(s, i) in steps" :key="i" class="step">
        <b class="step-n">{{ i + 1 }}</b> {{ s }}<span v-if="i < steps.length - 1" class="step-arrow">→</span>
      </span>
    </div>

    <div class="layout">
      <aside class="sidebar">
        <FileDrop
          accept=".csv,.tsv,.txt,.xlsx,.xls,.json"
          label="拖放数据文件（可多选）"
          hint="CSV / Excel / JSON"
          @files="onFiles"
        />
        <div v-if="loading" class="row mt-1 muted small"><Loader2 :size="14" class="spin" /> 正在解析…</div>

        <div v-if="datasets.length" class="ds-list mt-2">
          <div class="ds-title">数据集（{{ datasets.length }}）</div>
          <div
            v-for="(d, i) in datasets"
            :key="`${d.name}-${i}`"
            class="ds-item"
            :class="{ active: i === activeIdx }"
            @click="selectAt(i)"
          >
            <Database :size="13" class="ds-icon" />
            <span class="ds-name" :title="d.name">{{ d.name }}</span>
            <span class="ds-meta">{{ d.rows.length }}行</span>
            <button class="ds-del" title="移除" @click.stop="removeAt(i)"><Trash2 :size="12" /></button>
          </div>
        </div>
        <p v-else class="muted small mt-2">支持多文件，每个 Excel 工作表会作为独立数据集。</p>
      </aside>

      <main class="main">
        <template v-if="active">
          <div class="tabs">
            <button v-for="t in tabs" :key="t.v" class="tab" :class="{ active: tab === t.v }" @click="tab = t.v">
              <component :is="t.icon" :size="14" /> {{ t.label }}
            </button>
          </div>

          <div class="panel">
            <DataTablePanel v-if="tab === 'table'" :dataset="active" />
            <ChartPanel v-else-if="tab === 'chart'" :dataset="active" />
            <PivotPanel v-else-if="tab === 'pivot'" :dataset="active" />
            <SqlPanel v-else-if="tab === 'sql'" :datasets="datasets" />
            <div v-else>
              <div class="row row-wrap">
                <span class="badge">{{ active.name }} · {{ active.rows.length }} 行 × {{ active.header.length }} 列</span>
              </div>
              <div class="row row-wrap mt-2">
                <button class="btn btn-primary" @click="dlCsv"><Download :size="16" /> 导出 CSV</button>
                <button class="btn" @click="dlXlsx"><Download :size="16" /> 导出 Excel</button>
                <button class="btn" @click="dlJson"><Download :size="16" /> 导出 JSON</button>
              </div>
              <p class="muted small mt-1">导出的是当前选中数据集的完整数据（不受表格筛选影响）。</p>
            </div>
          </div>
        </template>
        <div v-else class="empty">
          <FileSearch :size="40" class="empty-icon" />
          <p>先在左侧载入数据文件，即可开始分析。</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.steps {
  gap: 14px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-2);
}
.step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.step-n {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
}
.step-arrow {
  color: var(--text-3);
  margin-left: 8px;
}
.layout {
  display: grid;
  grid-template-columns: 290px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.sidebar {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
}
.ds-list {
  display: grid;
  gap: 6px;
}
.ds-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-2);
}
.ds-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
}
.ds-item:hover {
  border-color: var(--accent);
}
.ds-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.ds-icon {
  color: var(--accent-text);
  flex: none;
}
.ds-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-meta {
  color: var(--text-3);
  font-size: 11.5px;
  flex: none;
}
.ds-del {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
  display: grid;
  place-items: center;
  border-radius: 6px;
}
.ds-del:hover {
  color: var(--err);
}
.main {
  min-width: 0;
}
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 9px 14px;
  font-size: 13.5px;
  color: var(--text-2);
  cursor: pointer;
  white-space: nowrap;
}
.tab.active {
  color: var(--accent-text);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.panel {
  padding-top: 14px;
}
.empty {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 70px 20px;
  color: var(--text-3);
  border: 1px dashed var(--border-strong);
  border-radius: 14px;
}
.empty-icon {
  opacity: 0.5;
}
</style>
