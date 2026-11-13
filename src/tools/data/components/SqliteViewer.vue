<script setup lang="ts">
import { computed, ref } from 'vue'
import { Database as DbIcon, Download, Loader2, Play, Table2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import SqlPreviewTable from './SqlPreviewTable.vue'
import { saveText } from '@/lib/download'
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
/** 侧栏条目：表 + 视图（kind 标注类型） */
const tables = ref<{ name: string; kind: 'table' | 'view' }[]>([])
const activeTable = ref('')
const activeKind = ref<'table' | 'view'>('table')
const totalRows = ref(-1)
const headers = ref<string[]>([])
const rows = ref<unknown[][]>([])
const structHeaders = ref<string[]>([])
const structRows = ref<unknown[][]>([])
/** 结构区默认折叠（点击展开），把首屏让给数据预览 */
const structOpen = ref(false)
const sqlText = ref('')
const error = ref('')
const wasmReady = ref(false)

/** 数据表高度：视口口径（1366×768 下数据区首屏完整可见） */
const dataMax = computed(() => Math.max(280, Math.min(420, (typeof window !== 'undefined' ? window.innerHeight : 900) - 480)))

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
    const list = db.value.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name")
    tables.value = (list[0]?.values ?? []).map((r) => ({ name: String(r[0]), kind: String(r[1]) === 'view' ? ('view' as const) : ('table' as const) }))
    activeTable.value = ''
    headers.value = []
    rows.value = []
    structHeaders.value = []
    structRows.value = []
    totalRows.value = -1
    if (!tables.value.length) toast.warn('数据库为空（没有用户表）')
    else toast.ok(`已打开 ${f.name}：${tables.value.filter((t) => t.kind === 'table').length} 张表、${tables.value.filter((t) => t.kind === 'view').length} 个视图`)
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

const showTable = async (item: { name: string; kind: 'table' | 'view' }) => {
  if (!db.value) return
  busy.value = true
  error.value = ''
  activeTable.value = item.name
  activeKind.value = item.kind
  try {
    const q = `"${item.name.replace(/"/g, '""')}"`
    showResult(db.value.exec(`SELECT * FROM ${q} LIMIT 200`))
    // 行数披露：共 N 行（预览前 200）
    const cnt = db.value.exec(`SELECT COUNT(*) FROM ${q}`)
    totalRows.value = Number(cnt[0]?.values?.[0]?.[0] ?? -1)
    // 结构（表与视图都支持 PRAGMA table_info），补默认值列
    const info = db.value.exec(`PRAGMA table_info(${q})`)
    // 列位置按返回列名动态定位，避免依赖固定下标
    const cols = info[0]?.columns ?? []
    const pick = (name0: string) => Math.max(0, cols.indexOf(name0))
    structHeaders.value = ['列名', '类型', '非空', '默认值', '主键']
    structRows.value = (info[0]?.values ?? []).map((r) => {
      const dflt = r[pick('dflt_value')]
      return [
        String(r[pick('name')] ?? ''),
        String(r[pick('type')] || 'ANY'),
        Number(r[pick('notnull')]) === 1 ? '是' : '否',
        dflt === null || dflt === undefined ? '—' : String(dflt),
        Number(r[pick('pk')]) > 0 ? '是' : '否',
      ]
    })
    sqlText.value = `SELECT * FROM ${q} LIMIT 200`
  } catch (e) {
    error.value = (e as Error).message || '查询失败'
  } finally {
    busy.value = false
  }
}

/** 数据预览导出 CSV（带 BOM，Excel 打开中文正常） */
const dlPreview = () => {
  if (!rows.value.length) return
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    if (v instanceof Uint8Array) return `BLOB(${v.length}B)`
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.value.join(','), ...rows.value.map((r) => r.map(esc).join(','))].join('\n')
  saveText('\uFEFF' + csv, `${activeTable.value || '查询结果'}.csv`, 'text/csv;charset=utf-8')
  toast.ok(`已导出 ${rows.value.length} 行 CSV`)
}

const runSql = async () => {
  if (!db.value) return
  const q = sqlText.value.trim()
  if (!q) {
    toast.warn('请输入 SELECT 查询语句')
    return
  }
  if (!/^select\b/i.test(q) && !/^explain\b/i.test(q) && !/^with\b/i.test(q)) {
    error.value = '本工具为只读查询，仅支持 SELECT / WITH / EXPLAIN 语句'
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
    structOpen.value = false
    activeTable.value = ''
    totalRows.value = -1
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
          <p class="side-title"><Table2 :size="14" /> 表与视图（{{ tables.length }}）</p>
          <div class="table-list">
            <button v-for="t in tables" :key="t.name" class="t-item" :class="{ active: activeTable === t.name }" :title="t.name" @click="showTable(t)">
              <span class="kind" :class="t.kind">{{ t.kind === 'view' ? '视图' : '表' }}</span>
              {{ t.name }}
            </button>
          </div>
        </div>

        <div class="main">
          <div class="sql-row">
            <textarea
              v-model="sqlText"
              class="input grow sql-box"
              rows="3"
              placeholder="输入只读 SELECT / WITH 查询（结果限 500 行），Ctrl+Enter 执行"
              spellcheck="false"
              @keydown.ctrl.enter.prevent="runSql"
              @keydown.meta.enter.prevent="runSql"
            ></textarea>
            <button class="btn btn-primary btn-sm" :disabled="busy" @click="runSql"><Play :size="14" /> 执行</button>
          </div>
          <p class="muted small mt-1" style="margin-top: 4px">多行 SQL 直接粘贴（Ctrl+Enter 或 ⌘+Enter 执行）</p>

          <div v-if="error" class="err mt-1"><DbIcon :size="13" /> {{ error }}</div>

          <div v-if="activeTable" class="mt-1">
            <span class="chip">{{ activeKind === 'view' ? '视图' : '表' }} {{ activeTable }}</span>
            <span class="chip">{{ totalRows >= 0 ? `共 ${totalRows} 行（预览前 ${rows.length}）` : `预览 ${rows.length} 行` }}</span>
          </div>

          <div v-if="structHeaders.length" class="mt-1">
            <button class="sec-toggle small muted" @click="structOpen = !structOpen">
              {{ structOpen ? '▾' : '▸' }} 结构（PRAGMA table_info，含默认值）
            </button>
            <SqlPreviewTable v-if="structOpen" :headers="structHeaders" :rows="structRows" raw :max-height="180" />
          </div>

          <div v-if="headers.length" class="mt-1">
            <p class="small muted preview-title">
              数据预览
              <button class="btn btn-ghost btn-sm" @click="dlPreview"><Download :size="13" /> 下载 CSV</button>
            </p>
            <SqlPreviewTable :headers="headers" :rows="rows" :max-height="dataMax" />
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
.kind {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 10.5px;
  line-height: 16px;
}
.kind.table {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.kind.view {
  background: color-mix(in srgb, var(--ok, #34d399) 15%, transparent);
  color: var(--ok, #34d399);
}
.sql-box {
  min-height: 72px;
  height: auto;
  resize: vertical;
  font-family: var(--font-mono);
}
.sec-toggle {
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  color: var(--text-2);
}
.sec-toggle:hover {
  color: var(--text);
}
.preview-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 6px 0 4px;
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
