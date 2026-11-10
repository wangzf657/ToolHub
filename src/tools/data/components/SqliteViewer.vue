<script setup lang="ts">
import { ref } from 'vue'
import { Database as DbIcon, Loader2, Play, Table2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import SqlPreviewTable from './SqlPreviewTable.vue'
import { useToast } from '@/composables/useToast'

/**
 * SQLite 查看器：sql.js（wasm）本地解析 .sqlite/.db。
 * 列出表 → 查看前 200 行 + 结构（PRAGMA table_info）→ 自定义只读 SELECT（限 500 行）。
 * wasm 首次加载约 1MB（注册项已标 needModel），加载后浏览器缓存。
 */
interface SqlJsDb {
  exec(sql: string): { columns: string[]; values: unknown[][] }[]
  close(): void
}
interface SqlJsStatic {
  Database: { new (data?: Uint8Array | null): SqlJsDb }
}

const toast = useToast()
/** 缓存已加载的 sql.js 运行时 */
let sqlRuntime: SqlJsStatic | null = null
const fileName = ref('')
const loading = ref(false)
const busy = ref(false)
const db = ref<SqlJsDb | null>(null)
const tables = ref<string[]>([])
const activeTable = ref('')
const headers = ref<string[]>([])
const rows = ref<unknown[][]>([])
const structHeaders = ref<string[]>([])
const structRows = ref<unknown[][]>([])
const sqlText = ref('')
const error = ref('')
const wasmReady = ref(false)

/** 懒加载并缓存 sql.js 运行时（wasm 位于 public/sqljs/） */
const loadSqlJs = async (): Promise<SqlJsStatic> => {
  if (sqlRuntime) return sqlRuntime
  const initSqlJs = (await import('sql.js')).default
  sqlRuntime = (await initSqlJs({ locateFile: (f: string) => '/sqljs/' + f })) as SqlJsStatic
  wasmReady.value = true
  return sqlRuntime
}

const openDb = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.(sqlite|sqlite3|db|db3)$/i.test(f.name)) {
    toast.err('请选择 .sqlite / .db / .sqlite3 / .db3 数据库文件')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const SQL = await loadSqlJs()
    const bytes = new Uint8Array(await f.arrayBuffer())
    db.value?.close()
    db.value = new SQL.Database(bytes)
    fileName.value = f.name
    const list = db.value.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    tables.value = list[0]?.values.map((r) => String(r[0])) ?? []
    activeTable.value = ''
    headers.value = []
    rows.value = []
    structHeaders.value = []
    structRows.value = []
    if (!tables.value.length) toast.warn('数据库为空（没有用户表）')
    else toast.ok(`已打开 ${f.name}：${tables.value.length} 张表`)
  } catch (e) {
    error.value = (e as Error).message || '数据库打开失败'
    toast.err('数据库打开失败：文件可能不是有效的 SQLite 数据库')
  } finally {
    loading.value = false
  }
}

/** 把查询结果写进数据预览区 */
const showResult = (res: { columns: string[]; values: unknown[][] }[]) => {
  headers.value = res[0]?.columns ?? []
  rows.value = res[0]?.values ?? []
}

const showTable = async (name: string) => {
  if (!db.value) return
  busy.value = true
  error.value = ''
  activeTable.value = name
  try {
    const q = `"${name.replace(/"/g, '""')}"`
    showResult(db.value.exec(`SELECT * FROM ${q} LIMIT 200`))
    const info = db.value.exec(`PRAGMA table_info(${q})`)
    // 列位置按返回列名动态定位，避免依赖固定下标
    const cols = info[0]?.columns ?? []
    const pick = (name0: string) => Math.max(0, cols.indexOf(name0))
    structHeaders.value = ['列名', '类型', '非空', '主键']
    structRows.value = (info[0]?.values ?? []).map((r) => [
      String(r[pick('name')] ?? ''),
      String(r[pick('type')] || 'ANY'),
      Number(r[pick('notnull')]) === 1 ? '是' : '否',
      Number(r[pick('pk')]) > 0 ? '是' : '否',
    ])
    sqlText.value = `SELECT * FROM ${q} LIMIT 200`
  } catch (e) {
    error.value = (e as Error).message || '查询失败'
  } finally {
    busy.value = false
  }
}

const runSql = async () => {
  if (!db.value) return
  const q = sqlText.value.trim()
  if (!q) {
    toast.warn('请输入 SELECT 查询语句')
    return
  }
  if (!/^select\b/i.test(q) && !/^explain\b/i.test(q)) {
    error.value = '本工具为只读查询，仅支持 SELECT / EXPLAIN 语句'
    toast.err('仅支持 SELECT 只读查询')
    return
  }
  busy.value = true
  error.value = ''
  try {
    // 子查询包装统一限流 500 行（并去掉末尾分号）
    const clean = q.replace(/;\s*$/, '')
    showResult(db.value.exec(`SELECT * FROM (${clean}) LIMIT 500`))
    structHeaders.value = []
    structRows.value = []
    activeTable.value = ''
    toast.ok(`查询返回 ${rows.value.length} 行`)
  } catch (e) {
    error.value = (e as Error).message || 'SQL 执行失败'
    headers.value = []
    rows.value = []
    toast.err('SQL 执行失败，详见错误信息')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".sqlite,.sqlite3,.db,.db3" :multiple="false" label="拖入 SQLite 数据库文件" hint="首次使用需加载约 1MB 的 sql.js wasm（之后浏览器缓存）；数据库仅在本地解析" @files="openDb" />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在加载 wasm 引擎并解析数据库…</div>

    <div v-if="db" class="mt-2">
      <div class="layout">
        <div class="side">
          <p class="side-title"><Table2 :size="14" /> 数据表（{{ tables.length }}）</p>
          <div class="table-list">
            <button v-for="t in tables" :key="t" class="t-item" :class="{ active: activeTable === t }" :title="t" @click="showTable(t)">
              {{ t }}
            </button>
          </div>
        </div>

        <div class="main">
          <div class="sql-row">
            <input v-model="sqlText" type="text" class="input grow" placeholder="输入只读 SELECT 查询（结果限 500 行），回车执行" @keyup.enter="runSql" />
            <button class="btn btn-primary btn-sm" :disabled="busy" @click="runSql"><Play :size="14" /> 执行</button>
          </div>

          <div v-if="error" class="err mt-1"><DbIcon :size="13" /> {{ error }}</div>

          <div v-if="activeTable" class="mt-1">
            <span class="chip">表 {{ activeTable }}</span>
            <span class="chip">前 {{ rows.length }} 行</span>
          </div>

          <div v-if="structHeaders.length" class="mt-1">
            <p class="small muted">结构（PRAGMA table_info）</p>
            <SqlPreviewTable :headers="structHeaders" :rows="structRows" raw :max-height="180" />
          </div>

          <div v-if="headers.length" class="mt-1">
            <p class="small muted">数据预览</p>
            <SqlPreviewTable :headers="headers" :rows="rows" />
          </div>
          <p v-else-if="!error && !busy && activeTable" class="small muted mt-1">该表没有数据行。</p>
        </div>
      </div>
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
.layout {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
.side {
  flex: none;
  width: 220px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.side-title {
  margin: 0;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
}
.table-list {
  max-height: 380px;
  overflow: auto;
}
.t-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 12px;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--text-2);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.t-item:hover,
.t-item.active {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.main {
  flex: 1;
  min-width: 0;
}
.sql-row {
  display: flex;
  gap: 8px;
}
.grow {
  flex: 1;
}
.err {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12.5px;
  color: var(--err, #c0392b);
  background: color-mix(in srgb, #c0392b 8%, transparent);
  border-radius: 8px;
  padding: 6px 10px;
}
.chip {
  display: inline-block;
  margin-right: 8px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-2, rgba(127, 127, 127, 0.12));
  font-size: 12px;
}
@media (max-width: 760px) {
  .layout {
    flex-direction: column;
  }
  .side {
    width: 100%;
  }
}
</style>
