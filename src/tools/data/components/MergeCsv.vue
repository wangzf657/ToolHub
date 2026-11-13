<script setup lang="ts">
import { computed, ref } from 'vue'
import { Layers, Loader2, Download, ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, mergeCsvData, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 合并 CSV/Excel/JSON：追加载入 + chip 调序/移除 + 表头对齐 + 合并去重 + 列对齐披露 */
const toast = useToast()
const list = ref<{ name: string; data: CsvData }[]>([])
const addSource = ref(false)
const dedupe = ref(false)
const loading = ref(false)
const PAGE = 100
/** 分页护栏：大于 5000 行不再提供"显示全部"，改 500/页 翻页 */
const page = ref(1)

const mergedRaw = computed(() => mergeCsvData(list.value, { addSource: addSource.value }))
const merged = computed(() => {
  if (!dedupe.value) return mergedRaw.value
  const seen = new Set<string>()
  const rows = mergedRaw.value.rows.filter((r) => {
    const k = JSON.stringify(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { ...mergedRaw.value, rows }
})

/* 列名对齐披露：合并表头多于任一输入文件的列数时，列出各文件缺的列 */
const alignWarn = computed(() => {
  if (list.value.length < 2) return ''
  const union = mergedRaw.value.header
  const parts: string[] = []
  for (const item of list.value) {
    const missing = union.filter((h) => !item.data.header.includes(h))
    if (missing.length) parts.push(`「${item.name}」缺少列：${missing.join('、')}`)
  }
  return parts.join('；')
})

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
    // 追加语义：新文件并入列表，已有文件与顺序保持不变
    list.value = [...list.value, ...items]
    if (items.length) toast.ok(`已追加 ${items.length} 个文件，列表共 ${list.value.length} 个`)
    page.value = 1
  } finally {
    loading.value = false
  }
}

const removeAt = (i: number) => {
  list.value = list.value.filter((_, k) => k !== i)
  page.value = 1
}
const moveAt = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= list.value.length) return
  const arr = [...list.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  list.value = arr
}

const pageCount = computed(() => Math.max(1, Math.ceil(merged.value.rows.length / PAGE)))
const previewRows = computed(() => merged.value.rows.slice((page.value - 1) * PAGE, page.value * PAGE))

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
    <FileDrop accept=".csv,.tsv,.txt,.xlsx,.xls,.json" label="拖放多个 CSV / Excel / JSON 文件（可分多次追加，按列表顺序合并）" @files="onFiles" />

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析…</div>

    <template v-if="list.length">
      <div class="row row-wrap mt-2">
        <span v-for="(it, i) in list" :key="it.name + i" class="chip file-chip" :title="it.name">
          <span class="fname" :title="it.name">{{ i + 1 }}. {{ it.name }}</span>
          <button class="mini" :aria-label="`${it.name} 上移`" @click="moveAt(i, -1)"><ChevronLeft :size="11" /></button>
          <button class="mini" :aria-label="`${it.name} 下移`" @click="moveAt(i, 1)"><ChevronRight :size="11" /></button>
          <button class="mini danger" :aria-label="`移除 ${it.name}`" @click="removeAt(i)"><X :size="11" /></button>
        </span>
      </div>

      <div class="row row-wrap mt-2">
        <span class="badge">{{ list.length }} 个文件</span>
        <span class="badge badge-plain">共 {{ merged.rows.length }} 行 · {{ merged.header.length }} 列</span>
        <label class="check"><input v-model="addSource" type="checkbox" /> 附加「来源文件」列</label>
        <label class="check"><input v-model="dedupe" type="checkbox" /> 合并后按整行去重</label>
      </div>

      <p v-if="alignWarn" class="notice notice-warn mt-2 small">{{ alignWarn }}（缺失列合并后留空）</p>

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

      <!-- 渲染护栏：一律分页 500/页（>5000 行不再提供"显示全部"防冻结） -->
      <div class="row mt-2" style="align-items: center" v-if="merged.rows.length > PAGE">
        <button class="btn btn-soft btn-sm" :disabled="page <= 1" @click="page--"><ChevronLeft :size="14" /> 上一页</button>
        <span class="muted small">第 {{ page }} / {{ pageCount }} 页（每页 {{ PAGE }} 行，共 {{ merged.rows.length }} 行{{ dedupe ? '，去重后' : '' }}）</span>
        <button class="btn btn-soft btn-sm" :disabled="page >= pageCount" @click="page++">下一页 <ChevronRight :size="14" /></button>
      </div>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" :disabled="!merged.rows.length" @click="dlCsv">
          <Download :size="16" /> 下载 CSV
        </button>
        <button class="btn" :disabled="!merged.rows.length" @click="dlXlsx">
          <Download :size="16" /> 下载 Excel
        </button>
      </div>
      <p class="muted small mt-1">
        <Layers :size="12" style="vertical-align: -2px" /> 按表头对齐合并：缺失的单元格自动留空。反向操作去
        <RouterLink to="/t/split-csv-file">CSV 文件拆分</RouterLink>
        。
      </p>
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
.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 320px;
}
.fname {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  padding: 2px;
  border-radius: 5px;
}
.mini:hover {
  color: var(--accent-text);
  background: var(--accent-soft);
}
.mini.danger:hover {
  color: var(--err);
  background: color-mix(in srgb, var(--err) 12%, transparent);
}
</style>
