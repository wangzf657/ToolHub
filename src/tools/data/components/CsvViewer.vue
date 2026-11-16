<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Table2, Loader2, SortAsc, SortDesc, ArrowUpDown, Download, BarChart3, X, ChevronUp } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 表格查看器：粘贴/上传 → 分页表格 + 列排序/统计 + 搜索高亮 + 下载 CSV/JSON */
const toast = useToast()
const csvText = ref('')
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
const progressLabel = ref('')
const PAGE = 200
const page = ref(1)
type SortDir = 'none' | 'asc' | 'desc'
const sortCol = ref<number | null>(null)
const sortDir = ref<SortDir>('none')
/** 解析成功后输入区折叠为单行条 */
const collapsed = ref(false)
/** 列统计弹层 */
const statCol = ref<number | null>(null)
/** 搜索高亮 */
const keyword = ref('')
const tableRef = ref<HTMLElement | null>(null)

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
  progressLabel.value = ''
  try {
    const big = csvText.value.length > 5 * 1024 * 1024
    if (big) {
      // 大文件：PapaParse step 回调逐行上报进度（不冻结 UI）
      const Papa = (await import('papaparse')).default
      const rows: string[][] = []
      Papa.parse(csvText.value, {
        skipEmptyLines: 'greedy',
        step: (res) => {
          rows.push(res.data as string[])
          if (rows.length % 5000 === 0) progressLabel.value = `已解析 ${rows.length} 行…`
        },
        error: (err: { message: string; row?: number }) => toast.warn(`第 ${err.row ?? '?'} 行附近解析异常：${err.message}`),
        complete: () => {
          const [header = [], ...rest] = rows
          data.value = { header: header.map((h, i) => h.trim() || `列${i + 1}`), rows: rest }
          afterParse(big)
        },
      })
      return
    }
    data.value = await parseCsvAsync(csvText.value)
    afterParse(false)
  } catch (e) {
    toast.err((e as Error).message || 'CSV 解析失败，请检查格式')
  } finally {
    loading.value = false
    progressLabel.value = ''
  }
}

const afterParse = (big: boolean) => {
  page.value = 1
  sortCol.value = null
  sortDir.value = 'none'
  statCol.value = null
  collapsed.value = true
  toast.ok(`解析成功：${data.value!.rows.length} 行 × ${data.value!.header.length} 列${big ? '（大文件已按流式解析）' : ''}`)
  void nextTick(() => tableRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

const editAgain = () => {
  collapsed.value = false
  void nextTick(() => (document.querySelector('.input-panel textarea') as HTMLTextAreaElement | null)?.focus())
}

/** 排序后的行（携带原始行号，不改动原始数据） */
const sortedRows = computed(() => {
  const rows = data.value?.rows ?? []
  const pairs = rows.map((row, idx) => ({ row, idx }))
  if (sortCol.value === null || sortDir.value === 'none') return pairs
  const ci = sortCol.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return pairs.sort((a, b) => {
    const x = a.row[ci] ?? ''
    const y = b.row[ci] ?? ''
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

/* ---------- 列统计：数值列 均值/最大/最小；文本列 唯一数/空值数 ---------- */
const colStats = computed(() => {
  if (statCol.value === null || !data.value) return null
  const i = statCol.value
  const vals = data.value.rows.map((r) => (r[i] ?? '').trim())
  const nonEmpty = vals.filter((v) => v !== '')
  const nums = nonEmpty.map(Number).filter((n) => !Number.isNaN(n))
  if (nums.length && nums.length === nonEmpty.length) {
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    return { numeric: true as const, mean, max: Math.max(...nums), min: Math.min(...nums), count: nums.length }
  }
  return { numeric: false as const, unique: new Set(nonEmpty).size, empty: vals.length - nonEmpty.length, count: vals.length }
})

/* ---------- 搜索高亮：命中单元格黄底 + 计数 ---------- */
const kw = computed(() => keyword.value.trim().toLowerCase())
const isHit = (v: string) => !!kw.value && (v ?? '').toLowerCase().includes(kw.value)
const hitCount = computed(() => {
  if (!kw.value || !data.value) return 0
  let n = 0
  for (const r of data.value.rows) for (const c of r) if (isHit(c)) n++
  return n
})

const dlCsv = () => {
  if (!data.value) return
  saveText(rowsToCsv(data.value.header, data.value.rows), `${fileName.value.trim() || '数据'}.csv`, 'text/csv;charset=utf-8')
}

const dlJson = () => {
  if (!data.value) return
  const arr = data.value.rows.map((r) =>
    Object.fromEntries(data.value!.header.map((h, i) => [h, r[i] ?? ''])),
  )
  saveText(JSON.stringify(arr, null, 2), `${fileName.value.trim() || '数据'}.json`, 'application/json;charset=utf-8')
}
</script>

<template>
  <div>
    <!-- 解析成功后折叠为单行条，保证表格进入首屏 -->
    <div v-if="!collapsed" class="input-panel">
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
        <span v-if="csvText.trim() && !data" class="paste-hint small">已粘贴 {{ csvText.length }} 字符，点击左侧按钮或按 Ctrl+Enter 解析</span>
      </div>
    </div>
    <div v-else class="collapsed-bar">
      <span class="small">已解析 <b>{{ fileName }}</b> · {{ data?.rows.length }} 行 × {{ data?.header.length }} 列</span>
      <button class="btn btn-ghost btn-sm" @click="editAgain"><ChevronUp :size="14" /> 重新编辑</button>
    </div>

    <div class="mt-2">
      <FileDrop accept=".csv,.txt,.tsv" :multiple="false" label="拖放 CSV / TXT / TSV 文件，或点击选择" @files="onFiles" />
    </div>

    <p v-if="progressLabel" class="muted small mt-1"><Loader2 :size="13" class="spin" style="vertical-align: -2px" /> {{ progressLabel }}</p>

    <template v-if="data">
      <div class="row row-wrap mt-2">
        <span class="badge">{{ data.rows.length }} 行</span>
        <span class="badge">{{ data.header.length }} 列</span>
        <span v-if="sortDir !== 'none'" class="badge badge-plain">
          已按「{{ data.header[sortCol!] }}」{{ sortDir === 'asc' ? '升序' : '降序' }}
        </span>
        <span class="search-box">
          <input v-model="keyword" class="input" style="max-width: 220px" placeholder="搜索单元格…" />
          <span v-if="kw" class="small hit-badge">命中 {{ hitCount }} 处</span>
        </span>
      </div>

      <!-- 列统计摘要 -->
      <div v-if="statCol !== null && colStats" class="notice notice-info mt-2 small stat-card">
        <b>「{{ data.header[statCol] }}」列统计：</b>
        <template v-if="colStats.numeric">
          均值 {{ colStats.mean.toFixed(2) }} · 最大 {{ colStats.max }} · 最小 {{ colStats.min }}（{{ colStats.count }} 个数值）
        </template>
        <template v-else>
          唯一值 {{ colStats.unique }} 个 · 空值 {{ colStats.empty }} 个（共 {{ colStats.count }} 行）
        </template>
        <button class="btn btn-ghost btn-sm" @click="statCol = null"><X :size="13" /> 关闭</button>
      </div>

      <div ref="tableRef" class="table-wrap mt-2">
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
                  <BarChart3 class="sort-idle stat-ico" :size="12" title="列统计" @click.stop="statCol = i" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, ri) in pagedRows" :key="p.idx">
              <td class="idx-col">{{ p.idx + 1 }}</td>
              <td v-for="(_, ci) in data.header" :key="ci" :class="{ hit: isHit(p.row[ci] ?? '') }">{{ p.row[ci] ?? '' }}</td>
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
        <input v-model="fileName" class="input" style="max-width: 200px" aria-label="输出文件名" placeholder="输出文件名" />
        <span class="muted small">导出为 {{ fileName.trim() || '数据' }}.csv / .json</span>
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
.paste-hint {
  color: var(--accent-text);
}
.collapsed-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.search-box {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.hit-badge {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 2px 10px;
  font-weight: 600;
  flex: none;
}
/* 表格弹性高度：视口口径，首屏尽量多行 */
.table-wrap {
  height: max(480px, calc(100dvh - 330px));
  overflow: auto;
}
td.hit,
td.hit:first-child {
  background: rgba(250, 204, 21, 0.22);
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
.stat-ico:hover {
  opacity: 1;
  color: var(--accent-text);
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.idx-col {
  color: var(--text-3);
  font-size: 12px;
  min-width: 42px;
}
</style>
