<script setup lang="ts">
import { ref } from 'vue'
import { Play, Loader2, Download } from 'lucide-vue-next'
import { datasetToRecords, csvEscape, type Dataset } from './dataShared'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** SQL 面板（简版）：全部已载数据集注册进 alasql，运行 SELECT */
const props = defineProps<{ datasets: Dataset[] }>()
const toast = useToast()

interface AlaSqlApi {
  tables: Record<string, { data: unknown[] }>
  databases?: Record<string, { tables: Record<string, { data: unknown[] }> }>
  useid?: string
  promise?: <T>(sql: string) => Promise<T>
  exec?: <T>(sql: string) => T
}

const sql = ref('')
const running = ref(false)
const resultRows = ref<Record<string, unknown>[]>([])
const resultCols = ref<string[]>([])
const sqlError = ref('')

const getAlasql = async (): Promise<AlaSqlApi> => {
  const mod = (await import('alasql')) as unknown as { default?: unknown }
  return (mod.default ?? mod) as AlaSqlApi
}

const registerAll = async () => {
  const alasql = await getAlasql()
  const db =
    alasql.useid && alasql.databases?.[alasql.useid] ? alasql.databases[alasql.useid] : null
  const target = db?.tables ?? alasql.tables
  for (const ds of props.datasets) {
    const name = ds.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')
    target[name] = { data: datasetToRecords(ds) }
  }
}

/** alasql 解析器不认裸中文标识符，自动为含中文的标识符补上方括号 */
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
  if (!props.datasets.length) {
    toast.warn('请先在左侧载入数据文件')
    return
  }
  running.value = true
  sqlError.value = ''
  resultRows.value = []
  resultCols.value = []
  try {
    await registerAll()
    const alasql = await getAlasql()
    const stmt = prepareSql(sql.value)
    const res = alasql.promise
      ? await alasql.promise<Record<string, unknown>[]>(stmt)
      : (alasql.exec?.(stmt) as Record<string, unknown>[])
    const arr = Array.isArray(res) ? res : []
    resultRows.value = arr.slice(0, 500)
    resultCols.value = arr.length ? Object.keys(arr[0]) : []
    toast.ok(`查询完成：${arr.length} 行`)
  } catch (e) {
    sqlError.value = (e as Error).message || 'SQL 执行失败'
  } finally {
    running.value = false
  }
}

const dlResult = () => {
  if (!resultRows.value.length) return
  const csv = [
    resultCols.value.join(','),
    ...resultRows.value.map((r) => resultCols.value.map((c) => csvEscape(r[c])).join(',')),
  ].join('\n')
  saveText('\uFEFF' + csv, '查询结果.csv', 'text/csv;charset=utf-8')
}

const insertExample = () => {
  const names = props.datasets.map((d) => d.name.replace(/[^\w\u4e00-\u9fa5]/g, '_'))
  sql.value =
    names.length >= 2
      ? `SELECT a.*, b.*\nFROM ${names[0]} AS a\nLEFT JOIN ${names[1]} AS b ON a.${props.datasets[0].header[0] ?? 'id'} = b.${props.datasets[1].header[0] ?? 'id'}\nLIMIT 50`
      : `SELECT *\nFROM ${names[0] ?? '表名'}\nLIMIT 50`
}
</script>

<template>
  <div>
    <div class="row row-wrap">
      <span v-for="d in datasets" :key="d.name" class="badge badge-plain">{{ d.name }}（{{ d.rows.length }} 行）</span>
      <button class="btn btn-ghost btn-sm" @click="insertExample">插入示例 SQL</button>
    </div>
    <textarea v-model="sql" class="textarea mono mt-2" style="min-height: 120px" spellcheck="false" placeholder="SELECT * FROM 表名 LIMIT 50"></textarea>
    <div class="row mt-1">
      <button class="btn btn-primary" :disabled="running" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Play v-else :size="16" />
        运行查询
      </button>
    </div>

    <div v-if="sqlError" class="notice notice-err mt-2">SQL 错误：{{ sqlError }}</div>

    <template v-if="resultRows.length">
      <div class="row row-wrap mt-2">
        <span class="badge">结果 {{ resultRows.length }} 行</span>
        <button class="btn btn-sm" @click="dlResult"><Download :size="14" /> 下载 CSV</button>
      </div>
      <div class="table-wrap mt-1" style="max-height: 380px">
        <table class="data-table">
          <thead>
            <tr><th v-for="c in resultCols" :key="c">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in resultRows" :key="ri">
              <td v-for="c in resultCols" :key="c">{{ r[c] === null || r[c] === undefined ? '' : r[c] }}</td>
            </tr>
          </tbody>
        </table>
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
</style>
