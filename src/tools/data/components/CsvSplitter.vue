<script setup lang="ts">
import { computed, ref } from 'vue'
import { Scissors, Loader2, PackageOpen } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, splitCsv, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 拆分：按行数 / 按列取值 / 按大小估算，表头开关 + 进度反馈，导出 csv/xlsx/json 打包 */
const toast = useToast()
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
const parseLabel = ref('')
const mode = ref<'rows' | 'column' | 'size'>('rows')
const chunkSize = ref(500)
const colIndex = ref(0)
const targetMB = ref(10)
const outFormat = ref<'csv' | 'xlsx' | 'json'>('csv')
const headerEach = ref(true)
const packProgress = ref(0)

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  parseLabel.value = ''
  try {
    const text = await f.text()
    if (text.length > 5 * 1024 * 1024) {
      // 大文件：PapaParse step 回调给百分比（按字符进度近似）
      const Papa = (await import('papaparse')).default
      const rows: string[][] = []
      const total = text.length
      await new Promise<void>((resolve, reject) => {
        Papa.parse(text, {
          skipEmptyLines: 'greedy',
          step: (res, parser) => {
            rows.push(res.data as string[])
            const done = Math.round((rows.join('').length / total) * 100)
            parseLabel.value = `已解析约 ${Math.min(99, done)}%…`
          },
          error: (err: { message: string }) => reject(new Error(err.message)),
          complete: () => resolve(),
        })
      })
      const [header = [], ...rest] = rows
      data.value = { header: header.map((h, i) => h.trim() || `列${i + 1}`), rows: rest }
    } else {
      data.value = await parseCsvAsync(text)
    }
    fileName.value = baseName(f.name)
    toast.ok(`已载入 ${data.value.rows.length} 行`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
    parseLabel.value = ''
  }
}

/** 按大小模式：抽样 200 行估算每行字节数 → 换算每片行数 */
const estRowsPerPart = computed(() => {
  const d = data.value
  if (!d || !d.rows.length) return 0
  const sample = d.rows.slice(0, 200)
  const avgBytes = sample.reduce((a, r) => a + r.join('\u0001').length + 12, 0) / sample.length
  const targetBytes = targetMB.value * 1024 * 1024 * 0.97
  return Math.max(1, Math.floor(targetBytes / Math.max(1, avgBytes)))
})

const parts = computed(() => {
  const d = data.value
  if (!d) return []
  if (mode.value === 'rows' && chunkSize.value < 1) return []
  if (mode.value === 'size' && targetMB.value <= 0) return []
  const spec =
    mode.value === 'rows'
      ? { kind: 'rows' as const, size: Math.max(1, chunkSize.value) }
      : mode.value === 'size'
        ? { kind: 'rows' as const, size: estRowsPerPart.value }
        : { kind: 'column' as const, col: colIndex.value }
  return splitCsv(d, spec)
})

const statCard = computed(() => {
  const d = data.value
  if (!d) return ''
  if (!parts.value.length) return ''
  if (mode.value === 'column') return `将生成 ${parts.value.length} 片（按「${d.header[colIndex.value]}」列取值）`
  const per = mode.value === 'rows' ? chunkSize.value : estRowsPerPart.value
  return `将生成 ${parts.value.length} 片 · 每片 ≤ ${per.toLocaleString()} 行${mode.value === 'size' ? '（按前 200 行抽样估算）' : ''}`
})

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)

const doSplit = async () => {
  if (!parts.value.length) {
    toast.warn('没有可拆分的内容，请检查参数')
    return
  }
  const files: { name: string; blob: Blob }[] = []
  for (const [i, p] of parts.value.entries()) {
    packProgress.value = (i + 1) / parts.value.length
    const idx = String(i + 1).padStart(3, '0')
    const name = `${fileName.value}-${sanitize(p.name)}.${outFormat.value}`
    if (outFormat.value === 'csv') {
      // 表头开关：关闭时仅第 1 片带表头
      const withHeader = headerEach.value || i === 0
      let text = rowsToCsv(p.csv.header, p.csv.rows)
      if (!withHeader) text = text.split('\n').slice(1).join('\n')
      files.push({ name, blob: new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }) })
    } else if (outFormat.value === 'json') {
      const arr = p.csv.rows.map((r) => Object.fromEntries(p.csv.header.map((h, c) => [h, r[c] ?? ''])))
      files.push({ name, blob: new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json;charset=utf-8' }) })
    } else {
      const { rowsToXlsx } = await import('@/lib/officeEngine')
      const blob = await rowsToXlsx(p.csv.header, p.csv.rows, `第${i + 1}部分`)
      files.push({ name, blob })
    }
  }
  await saveMany(files, `${fileName.value}-拆分.zip`)
  packProgress.value = 0
  toast.ok(`已生成 ${files.length} 个文件并打包下载`)
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.tsv,.txt" :multiple="false" label="拖放 CSV 文件，或点击选择" @files="onFiles" />
    <div v-if="loading" class="mt-2">
      <div class="progress"><div class="fill indet" /></div>
      <p class="muted small mt-1">{{ parseLabel || '正在解析…' }}</p>
    </div>

    <template v-if="data">
      <div class="row row-wrap mt-2">
        <span class="badge">共 {{ data.rows.length }} 行 × {{ data.header.length }} 列</span>
      </div>

      <div class="row row-wrap mt-2">
        <button class="chip" :class="{ active: mode === 'rows' }" @click="mode = 'rows'">按行数拆分</button>
        <button class="chip" :class="{ active: mode === 'column' }" @click="mode = 'column'">按列取值拆分</button>
        <button class="chip" :class="{ active: mode === 'size' }" @click="mode = 'size'">按大小拆分（估算）</button>
      </div>

      <div class="row row-wrap mt-2">
        <template v-if="mode === 'rows'">
          <label class="check">
            每个文件行数
            <input v-model.number="chunkSize" type="number" min="1" class="input" style="width: 110px" />
          </label>
        </template>
        <template v-else-if="mode === 'size'">
          <label class="check">
            目标体积（MB/片）
            <input v-model.number="targetMB" type="number" min="0.5" step="0.5" class="input" style="width: 110px" />
          </label>
        </template>
        <template v-else>
          <label class="check">
            拆分列
            <select v-model.number="colIndex" class="select" style="width: 160px">
              <option v-for="(h, i) in data.header" :key="i" :value="i">{{ h }}</option>
            </select>
          </label>
        </template>
        <label class="check">
          输出格式
          <select v-model="outFormat" class="select" style="width: 110px">
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <label v-if="outFormat === 'csv'" class="check"><input v-model="headerEach" type="checkbox" /> 每片包含表头行</label>
      </div>

      <p v-if="statCard" class="notice notice-info mt-2 small">{{ statCard }}</p>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="!parts.length" @click="doSplit">
          <PackageOpen :size="16" />
          拆分并打包下载
        </button>
      </div>

      <div v-if="packProgress > 0" class="mt-2">
        <div class="progress"><div class="fill" :style="{ width: Math.round(packProgress * 100) + '%' }" /></div>
        <p class="muted small mt-1">正在生成第 {{ Math.ceil(packProgress * parts.length) }} / {{ parts.length }} 片…</p>
      </div>

      <div v-if="parts.length && !packProgress" class="mt-2">
        <div class="label">将生成 {{ parts.length }} 个文件：</div>
        <div class="parts">
          <div v-for="(p, i) in parts.slice(0, 60)" :key="i" class="part-row">
            <Scissors :size="13" class="muted" />
            <span class="part-name">{{ fileName }}-{{ p.name }}.{{ outFormat }}</span>
            <span class="muted small">{{ p.csv.rows.length }} 行</span>
          </div>
          <p v-if="parts.length > 60" class="muted small">…以及另外 {{ parts.length - 60 }} 个文件。</p>
        </div>
      </div>
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
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.parts {
  margin-top: 8px;
  display: grid;
  gap: 4px;
}
.part-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.part-name {
  font-family: var(--font-mono);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.fill.indet {
  width: 40%;
  animation: indet 1.1s ease-in-out infinite;
}
@keyframes indet {
  0% { margin-left: -40%; }
  100% { margin-left: 100%; }
}
</style>
