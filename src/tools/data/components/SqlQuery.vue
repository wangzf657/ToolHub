<script setup lang="ts">
import { ref } from 'vue'
import { Database, Loader2, Play, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { readXlsx } from '@/lib/officeEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** SQL 查询 CSV/Excel/JSON：alasql 本地引擎，多表 JOIN */

interface TableInfo {
  name: string
  rows: Record<string, unknown>[]
  header: string[]
}

const toast = useToast()
const tables = ref<TableInfo[]>([])
const sql = ref('SELECT *\nFROM 学生\nLIMIT 10')
const loading = ref(false)
const running = ref(false)
const resultRows = ref<Record<string, unknown>[]>([])
const resultCols = ref<string[]>([])
const sqlError = ref('')

const EXAMPLE = `-- 两表连接示例：先在上方载入两个文件（表名 = 文件名）
SELECT a.姓名, a.分数, b.城市
FROM 学生 AS a
LEFT JOIN 地址 AS b ON a.姓名 = b.姓名
LIMIT 20`

const loadExample = () => {
  sql.value = EXAMPLE
}

/** 统一解析为 {name, rows} 数据表 */
const loadedKeys = new Set<string>()

const onFiles = async (list: File[]) => {
  const fresh = list.filter((f) => !loadedKeys.has(`${f.name}:${f.size}`))
  if (!fresh.length) return
  loading.value = true
  try {
    for (const f of fresh) {
      loadedKeys.add(`${f.name}:${f.size}`)
      const name = f.name.replace(/\.[^.]+$/, '')
      const lower = f.name.toLowerCase()
      let rows: Record<string, unknown>[] = []
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const sheets = await readXlsx(f)
        for (const s of sheets) {
          tables.value.push({
            name: sheets.length > 1 ? `${name}_${s.name}` : name,
            header: s.header,
            rows: s.rows.map((r) => Object.fromEntries(s.header.map((h, i) => [h, r[i] ?? '']))),
          })
        }
        continue
      } else if (lower.endsWith('.json')) {
        const parsed = JSON.parse(await f.text())
        const arr = Array.isArray(parsed) ? parsed : (parsed as { data?: unknown[] }).data
        if (!Array.isArray(arr)) throw new Error('JSON 需要是对象数组')
        rows = arr as Record<string, unknown>[]
      } else {
        const d: CsvData = await parseCsvAsync(await f.text())
        rows = d.rows.map((r) => Object.fromEntries(d.header.map((h, i) => [h, r[i] ?? ''])))
      }
      tables.value.push({ name, rows, header: Object.keys(rows[0] ?? {}) })
    }
    await registerTables()
    toast.ok(`已加载 ${tables.value.length} 个数据表，可以输入 SQL 查询`)
  } catch (e) {
    toast.err((e as Error).message || '文件解析失败')
  } finally {
    loading.value = false
  }
}

/** alasql 运行时接口（按需最小化声明） */
interface AlaSqlApi {
  tables: Record<string, { data: unknown[] }>
  databases?: Record<string, { tables: Record<string, { data: unknown[] }> }>
  useid?: string
  promise?: <T>(sql: string) => Promise<T>
  exec?: <T>(sql: string) => T
}

const getAlasql = async (): Promise<AlaSqlApi> => {
  const mod = (await import('alasql')) as unknown as { default?: unknown }
  return (mod.default ?? mod) as AlaSqlApi
}

/** 把数据注册进 alasql 默认库（官方支持对表对象赋值 data） */
const registerTables = async () => {
  const alasql = await getAlasql()
  for (const t of tables.value) {
    // 表名仅限字母数字下划线与中文，不合法的自动替换
    t.name = t.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')
    const db = alasql.useid && alasql.databases?.[alasql.useid] ? alasql.databases[alasql.useid] : null
    const target = db?.tables ?? alasql.tables
    target[t.name] = { data: t.rows }
  }
}


/**
 * alasql 解析器不认裸中文标识符，自动为含中文的标识符补上方括号
 * （字符串字面量与已有方括号保持原样）
 */
const prepareSql = (raw: string): string => {
  if (!/[\u4e00-\u9fa5]/.test(raw)) return raw
  const idRe = /[\u4e00-\u9fa5A-Za-z0-9_]/
  let out = ''
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (ch === "'") {
      let j = i + 1
      while (j < raw.length) {
        if (raw[j] === "'" && raw[j + 1] === "'") {
          j += 2
          continue
        }
        if (raw[j] === "'") break
        j++
      }
      out += raw.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (ch === '[') {
      let j = i + 1
      while (j < raw.length && raw[j] !== ']') j++
      out += raw.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (idRe.test(ch)) {
      let j = i
      while (j < raw.length && idRe.test(raw[j])) j++
      const word = raw.slice(i, j)
      out += /[\u4e00-\u9fa5]/.test(word) ? `[${word}]` : word
      i = j
      continue
    }
    out += ch
    i++
  }
  return out
}

const run = async () => {
  if (!tables.value.length) {
    toast.warn('请先加载数据文件')
    return
  }
  running.value = true
  sqlError.value = ''
  resultRows.value = []
  resultCols.value = []
  try {
    await registerTables()
    const alasql = await getAlasql()
    const stmt = prepareSql(sql.value)
    const res =
      alasql.promise
        ? await alasql.promise<Record<string, unknown>[]>(stmt)
        : (alasql.exec?.(stmt) as Record<string, unknown>[])
    const arr = Array.isArray(res) ? res : []
    resultRows.value = arr.slice(0, 500)
    resultCols.value = arr.length ? Object.keys(arr[0]) : []
    toast.ok(`查询完成：${arr.length} 行（最多预览 500 行）`)
  } catch (e) {
    sqlError.value = (e as Error).message || 'SQL 执行失败'
  } finally {
    running.value = false
  }
}

const dlResult = () => {
  if (!resultRows.value.length) return
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    resultCols.value.join(','),
    ...resultRows.value.map((r) => resultCols.value.map((c) => esc(r[c])).join(',')),
  ].join('\n')
  saveText('\uFEFF' + csv, '查询结果.csv', 'text/csv;charset=utf-8')
}

const previewRows = (t: TableInfo) => t.rows.slice(0, 3)
</script>

<template>
  <div>
    <div class="notice notice-info small">
      文件将注册为本地 SQL 表（表名 = 文件名，不含扩展名），所有查询在你的浏览器内完成。支持标准 SQL 与多表 JOIN。
    </div>

    <FileDrop accept=".csv,.tsv,.txt,.xlsx,.xls,.json" label="拖放 CSV / Excel / JSON 文件（可多选）" @files="onFiles" />

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析文件…</div>

    <template v-if="tables.length">
      <div class="mt-2">
        <span class="badge"><Database :size="12" /> 数据表</span>
        <div class="tables-grid mt-1">
          <div v-for="t in tables" :key="t.name" class="table-card">
            <div class="row">
              <span class="tname">{{ t.name }}</span>
              <span class="muted small">{{ t.rows.length }} 行</span>
            </div>
            <div class="muted small cols-line">列：{{ t.header.join('、') }}</div>
            <pre class="mini-table mono">{{ previewRows(t) }}</pre>
          </div>
        </div>
      </div>

      <div class="mt-2">
        <div class="label">SQL 编辑器</div>
        <textarea v-model="sql" class="textarea mono" style="min-height: 140px" spellcheck="false"></textarea>
        <div class="row row-wrap mt-1">
          <button class="btn btn-primary" :disabled="running" @click="run">
            <Loader2 v-if="running" :size="16" class="spin" />
            <Play v-else :size="16" />
            运行查询
          </button>
          <button class="btn btn-ghost" @click="loadExample">插入 JOIN 示例</button>
        </div>
      </div>

      <div v-if="sqlError" class="notice notice-err mt-2">SQL 错误：{{ sqlError }}</div>

      <template v-if="resultRows.length">
        <div class="row row-wrap mt-2">
          <span class="badge">结果 {{ resultRows.length }} 行</span>
          <button class="btn btn-sm" @click="dlResult"><Download :size="14" /> 下载结果 CSV</button>
        </div>
        <div class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="c in resultCols" :key="c">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in resultRows" :key="ri">
                <td v-for="c in resultCols" :key="c">{{ r[c] === null || r[c] === undefined ? '' : r[c] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <div v-else-if="!sqlError && resultCols.length === 0 && sql" class="muted small mt-2">
        点击「运行查询」查看结果。
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
  margin-bottom: 8px;
}
.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.table-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.tname {
  font-weight: 700;
  color: var(--accent-text);
}
.cols-line {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-table {
  margin: 8px 0 0;
  font-size: 11.5px;
  max-height: 96px;
  overflow: auto;
  color: var(--text-2);
  white-space: pre;
}
</style>
