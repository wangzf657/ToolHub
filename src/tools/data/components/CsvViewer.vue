<script setup lang="ts">
import { computed, ref } from 'vue'
import { Table2, Loader2, SortAsc, SortDesc, ArrowUpDown, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 表格查看器：粘贴/上传 → 分页表格 + 列排序 + 下载 CSV/JSON */
const toast = useToast()
const csvText = ref('')
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
const PAGE = 200
const page = ref(1)
type SortDir = 'none' | 'asc' | 'desc'
const sortCol = ref<number | null>(null)
const sortDir = ref<SortDir>('none')

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    const text = await f.text()
    csvText.value = text
    fileName.value = baseName(f.name)
    await parse()
  } catch (e) {
    toast.err((e as Error).message || '读取文件失败')
  } finally {
    loading.value = false
  }
}

const parse = async () => {
  if (!csvText.value.trim()) {
    toast.warn('请先粘贴 CSV 内容或上传文件')
    return
  }
  loading.value = true
  try {
    data.value = await parseCsvAsync(csvText.value)
    page.value = 1
    sortCol.value = null
    sortDir.value = 'none'
    toast.ok(`解析成功：${data.value.rows.length} 行 × ${data.value.header.length} 列`)
  } catch (e) {
    toast.err((e as Error).message || 'CSV 解析失败，请检查格式')
  } finally {
    loading.value = false
  }
}

/** 排序后的行（不改动原始数据） */
const sortedRows = computed(() => {
  const rows = data.value?.rows ?? []
  if (sortCol.value === null || sortDir.value === 'none') return rows
  const ci = sortCol.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[ci] ?? ''
    const y = b[ci] ?? ''
    const nx = parseFloat(x)
    const ny = parseFloat(y)
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) return (nx - ny) * dir
    return x.localeCompare(y, 'zh-CN') * dir
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / PAGE)))
const pagedRows = computed(() => sortedRows.value.slice((page.value - 1) * PAGE, page.value * PAGE))

const toggleSort = (i: number) => {
  if (sortCol.value !== i) {
    sortCol.value = i
    sortDir.value = 'asc'
  } else if (sortDir.value === 'asc') {
    sortDir.value = 'desc'
  } else {
    sortCol.value = null
    sortDir.value = 'none'
  }
  page.value = 1
}

const showMore = () => {
  page.value = Math.min(pageCount.value, page.value + 1)
}

const dlCsv = () => {
  if (!data.value) return
  saveText(rowsToCsv(data.value.header, data.value.rows), `${fileName.value}.csv`, 'text/csv;charset=utf-8')
}

const dlJson = () => {
  if (!data.value) return
  const arr = data.value.rows.map((r) =>
    Object.fromEntries(data.value!.header.map((h, i) => [h, r[i] ?? ''])),
  )
  saveText(JSON.stringify(arr, null, 2), `${fileName.value}.json`, 'application/json;charset=utf-8')
}
</script>

<template>
  <div>
    <div class="input-panel">
      <div class="label">粘贴 CSV 内容</div>
      <textarea
        v-model="csvText"
        class="textarea mono"
        placeholder="姓名,年龄,城市&#10;张三,28,北京&#10;李四,34,上海"
        @keydown.ctrl.enter="parse"
      ></textarea>
      <div class="row row-wrap mt-1">
        <button class="btn btn-primary" :disabled="loading" @click="parse">
          <Loader2 v-if="loading" :size="16" class="spin" />
          <Table2 v-else :size="16" />
          解析并显示表格
        </button>
        <span class="muted small">Ctrl+Enter 快速解析</span>
      </div>
    </div>

    <div class="mt-2">
      <FileDrop accept=".csv,.txt,.tsv" :multiple="false" label="拖放 CSV / TXT / TSV 文件，或点击选择" @files="onFiles" />
    </div>

    <template v-if="data">
      <div class="row row-wrap mt-2">
        <span class="badge">{{ data.rows.length }} 行</span>
        <span class="badge">{{ data.header.length }} 列</span>
        <span v-if="sortDir !== 'none'" class="badge badge-plain">
          已按「{{ data.header[sortCol!] }}」{{ sortDir === 'asc' ? '升序' : '降序' }}
        </span>
      </div>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr>
              <th class="idx-col">#</th>
              <th v-for="(h, i) in data.header" :key="i" class="sortable" @click="toggleSort(i)">
                <span class="th-inner">
                  {{ h }}
                  <SortAsc v-if="sortCol === i && sortDir === 'asc'" :size="13" />
                  <SortDesc v-else-if="sortCol === i && sortDir === 'desc'" :size="13" />
                  <ArrowUpDown v-else :size="12" class="sort-idle" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in pagedRows" :key="ri">
              <td class="idx-col">{{ (page - 1) * PAGE + ri + 1 }}</td>
              <td v-for="(_, ci) in data.header" :key="ci">{{ r[ci] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="pagedRows.length < data.rows.length" class="muted small mt-1">
        已显示 {{ pagedRows.length }} / {{ data.rows.length }} 行
      </p>
      <button v-if="page < pageCount" class="btn btn-ghost mt-1" @click="showMore">
        显示更多（第 {{ page + 1 }} 页）
      </button>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" :disabled="!data.rows.length" @click="dlCsv">
          <Download :size="16" /> 下载 CSV
        </button>
        <button class="btn" :disabled="!data.rows.length" @click="dlJson">
          <Download :size="16" /> 下载 JSON
        </button>
      </div>
    </template>
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
.sortable {
  cursor: pointer;
  user-select: none;
}
.sortable:hover {
  color: var(--text);
}
.th-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sort-idle {
  opacity: 0.35;
}
.idx-col {
  color: var(--text-3);
  font-size: 12px;
  min-width: 42px;
}
</style>
