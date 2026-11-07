<script setup lang="ts">
import { computed, ref } from 'vue'
import { Layers, Loader2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, mergeCsvData, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 合并 CSV/Excel/JSON：按表头对齐合并，可附加来源列，预览 + 下载 */
const toast = useToast()
const list = ref<{ name: string; data: CsvData }[]>([])
const addSource = ref(false)
const loading = ref(false)
const merged = computed(() => mergeCsvData(list.value, { addSource: addSource.value }))
const PAGE = 100
const showAll = ref(false)

const loadOne = async (f: File): Promise<CsvData> => {
  const lower = f.name.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const { readXlsx } = await import('@/lib/officeEngine')
    const s = (await readXlsx(f))[0]
    return { header: s.header, rows: s.rows }
  }
  if (lower.endsWith('.json')) {
    const arr = JSON.parse(await f.text())
    if (!Array.isArray(arr) || !arr.length) throw new Error(`${f.name}：JSON 需为非空对象数组`)
    const header = [...new Set(arr.flatMap((o: Record<string, unknown>) => Object.keys(o)))]
    return {
      header,
      rows: arr.map((o: Record<string, unknown>) => header.map((h) => (o[h] === undefined || o[h] === null ? '' : String(o[h])))),
    }
  }
  return parseCsvAsync(await f.text())
}

const onFiles = async (files: File[]) => {
  loading.value = true
  try {
    const items: { name: string; data: CsvData }[] = []
    for (const f of files) {
      try {
        items.push({ name: f.name, data: await loadOne(f) })
      } catch (e) {
        toast.err(`${f.name} 解析失败：${(e as Error).message}`)
      }
    }
    list.value = items
    if (items.length) toast.ok(`已载入 ${items.length} 个文件，共 ${items.reduce((a, b) => a + b.data.rows.length, 0)} 行数据`)
  } finally {
    loading.value = false
  }
}

const previewRows = computed(() => (showAll.value ? merged.value.rows : merged.value.rows.slice(0, PAGE)))

const dlCsv = () => {
  saveText('\uFEFF' + rowsToCsv(merged.value.header, merged.value.rows), '合并结果.csv', 'text/csv;charset=utf-8')
}

const dlXlsx = async () => {
  const { rowsToXlsx } = await import('@/lib/officeEngine')
  const blob = await rowsToXlsx(merged.value.header, merged.value.rows, '合并结果')
  saveBlob(blob, '合并结果.xlsx')
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.tsv,.txt,.xlsx,.xls,.json" label="拖放多个 CSV / Excel / JSON 文件（按列表顺序合并）" @files="onFiles" />

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析…</div>

    <template v-if="list.length">
      <div class="row row-wrap mt-2">
        <span class="badge">{{ list.length }} 个文件</span>
        <span class="badge badge-plain">共 {{ merged.rows.length }} 行 · {{ merged.header.length }} 列</span>
        <label class="check"><input v-model="addSource" type="checkbox" /> 附加「来源文件」列</label>
      </div>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="(h, i) in merged.header" :key="i">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in previewRows" :key="ri">
              <td v-for="(_, ci) in merged.header" :key="ci">{{ r[ci] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button v-if="!showAll && merged.rows.length > PAGE" class="btn btn-ghost mt-1" @click="showAll = true">
        显示全部 {{ merged.rows.length }} 行
      </button>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" :disabled="!merged.rows.length" @click="dlCsv">
          <Download :size="16" /> 下载 CSV
        </button>
        <button class="btn" :disabled="!merged.rows.length" @click="dlXlsx">
          <Download :size="16" /> 下载 Excel
        </button>
      </div>
      <p class="muted small mt-1"><Layers :size="12" style="vertical-align: -2px" /> 按表头对齐合并：缺失的单元格自动留空。</p>
    </template>
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
</style>
