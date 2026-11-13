<script setup lang="ts">
import { ref } from 'vue'
import { FileBox, Loader2, Download, Info } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob, saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * Parquet 查看转换：hyparquet（纯 JS，可离线）解析 → schema + 行预览（分页累进）→ CSV/JSON 下载。
 * 无需下载模型；多文件同 schema 时可合并导出。
 */
const toast = useToast()
const fileName = ref('数据')
const loading = ref(false)
const rows = ref<Record<string, unknown>[]>([])
const columns = ref<string[]>([])
const schemaText = ref('')
const error = ref('')
const totalRows = ref(-1)
/** 文件缓冲缓存与各文件已载入行数（分页续读） */
const fileBufs = ref<{ name: string; buf: ArrayBuffer }[]>([])
const offsets = ref<number[]>([])
const MAX_ROWS = 500

/** 解析一个缓冲区：可选起始行与结束行，返回行数组 */
const readParquet = async (buf: ArrayBuffer, rowStart = 0, rowEnd = MAX_ROWS): Promise<Record<string, unknown>[]> => {
  const hy = (await import('hyparquet')) as unknown as {
    parquetRead: (opts: Record<string, unknown>) => Promise<void>
    parquetMetadataAsync?: (file: unknown) => Promise<unknown>
    parquetSchema?: (metadata: unknown) => unknown
  }
  const collected: Record<string, unknown>[] = []
  await hy.parquetRead({
    file: buf,
    rowFormat: 'object',
    rowStart,
    rowEnd,
    onBatch: (batch: Record<string, unknown>[]) => collected.push(...batch),
    onComplete: () => {},
  })
  return collected
}

/** 读取元数据（总行数 + schema），失败不阻塞 */
const readMeta = async (buf: ArrayBuffer): Promise<{ total: number; schema: string }> => {
  const hy = (await import('hyparquet')) as unknown as {
    parquetMetadataAsync?: (file: unknown) => Promise<unknown>
    parquetSchema?: (metadata: unknown) => unknown
  }
  if (!hy.parquetMetadataAsync || !hy.parquetSchema) return { total: -1, schema: '' }
  const metadata = await hy.parquetMetadataAsync({ byteLength: buf.byteLength, slice: (s: number, e: number) => Promise.resolve(buf.slice(s, e)) })
  const total = (metadata as { num_rows?: number }).num_rows ?? -1
  const schema = hy.parquetSchema(metadata) as { children: Record<string, { element?: { type?: string; num_children?: number } }> }
  const lines: string[] = []
  const walk = (node: { children: Record<string, { element?: { type?: string; num_children?: number } }> }, depth: number) => {
    for (const [name, child] of Object.entries(node.children)) {
      const el = child.element
      const typeLabel = el?.type ?? (el?.num_children ? 'group' : 'unknown')
      lines.push(`${'  '.repeat(depth)}${name}: ${typeLabel}`)
      if (el?.num_children) walk(child as { children: Record<string, { element?: { type?: string; num_children?: number } }> }, depth + 1)
    }
  }
  walk(schema, 0)
  return { total, schema: lines.join('\n') }
}

const onFiles = async (list: File[]) => {
  if (!list.length) return
  loading.value = true
  error.value = ''
  rows.value = []
  columns.value = []
  schemaText.value = ''
  fileBufs.value = []
  offsets.value = []
  totalRows.value = -1
  try {
    let first = true
    for (const f of list.slice(0, 20)) {
      const buf = await f.arrayBuffer()
      fileBufs.value.push({ name: f.name, buf })
      if (first) {
        fileName.value = baseName(f.name)
        const [head, meta] = await Promise.all([readParquet(buf, 0, MAX_ROWS), readMeta(buf).catch(() => ({ total: -1, schema: '' }))])
        rows.value = head
        columns.value = head.length ? Object.keys(head[0]) : []
        totalRows.value = meta.total
        schemaText.value = meta.schema || '（schema 解析失败，但数据可正常读取）'
        offsets.value.push(head.length)
        first = false
      } else {
        // 批量：同 schema 分片合并（各分片独立读前 500 行）
        const part = await readParquet(buf, 0, MAX_ROWS)
        rows.value.push(...part)
        offsets.value.push(part.length)
      }
    }
    if (!rows.value.length) throw new Error('没有读到数据行')
    const nameTail = list.length > 1 ? ` 等 ${list.length} 个文件` : ''
    toast.ok(`已读取 ${rows.value.length} 行 × ${columns.value.length} 列${nameTail}`)
  } catch (e) {
    error.value =
      (e as Error).message ||
      'Parquet 解析失败：可能是压缩编码不被支持（当前支持 snappy/uncompressed），请尝试转换后重试。'
    toast.err('Parquet 解析失败，详见下方错误信息')
  } finally {
    loading.value = false
  }
}

/** 分页续读：每个文件各自从已载入位置续读 500 行（offset 累进） */
const loadMore = async () => {
  loading.value = true
  try {
    let added = 0
    for (let i = 0; i < fileBufs.value.length; i++) {
      const start = offsets.value[i] ?? 0
      const more = await readParquet(fileBufs.value[i].buf, start, start + MAX_ROWS)
      rows.value.push(...more)
      offsets.value[i] = start + more.length
      added += more.length
    }
    if (!added) toast.warn('已到文件末尾')
    else toast.ok(`已累计载入 ${rows.value.length} 行`)
  } catch (e) {
    toast.err(`续读失败：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
}

const toCsv = (): string => {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.value.join(','), ...rows.value.map((r) => columns.value.map((c) => esc(r[c])).join(','))].join('\n')
}

const dlCsv = () => {
  saveText('\uFEFF' + toCsv(), `${fileName.value}${fileBufs.value.length > 1 ? '-合并' : ''}.csv`, 'text/csv;charset=utf-8')
}

const dlJson = () => {
  saveText(JSON.stringify(rows.value, null, 2), `${fileName.value}.json`, 'application/json;charset=utf-8')
}

const dlXlsx = async () => {
  const { rowsToXlsx } = await import('@/lib/officeEngine')
  const rowsOut = rows.value.map((r) => columns.value.map((c) => (r[c] === null || r[c] === undefined ? '' : String(r[c]))))
  const blob = await rowsToXlsx(columns.value, rowsOut, 'Sheet1')
  saveBlob(blob, `${fileName.value}.xlsx`)
}
</script>

<template>
  <div>
    <div class="notice notice-info small">
      <Info :size="14" style="flex: none" />
      使用 hyparquet 纯 JS 解析器，无需下载任何模型，完全离线可用；支持 snappy 与未压缩编码的 Parquet 文件；可一次拖入多个同 schema 分片合并导出。
    </div>

    <div class="mt-2">
      <FileDrop accept=".parquet,.pq" :multiple="true" label="拖放 Parquet 文件（可多选，同 schema 分片自动合并）" @files="onFiles" />
    </div>
    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析 Parquet…</div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <template v-if="rows.length">
      <div class="row row-wrap mt-2">
        <span class="badge">{{ totalRows >= 0 ? `文件共 ${totalRows} 行（已载入前 ${rows.length}）` : `已载入 ${rows.length} 行` }}</span>
        <span class="badge">{{ columns.length }} 列</span>
        <button v-if="totalRows < 0 || rows.length < totalRows" class="btn btn-ghost btn-sm" :disabled="loading" @click="loadMore"><Loader2 v-if="loading" :size="13" class="spin" /> 载入后续 {{ MAX_ROWS }} 行</button>
        <button class="btn btn-sm" @click="dlCsv"><Download :size="14" /> CSV</button>
        <button class="btn btn-sm" @click="dlJson"><Download :size="14" /> JSON</button>
        <button class="btn btn-sm" @click="dlXlsx"><Download :size="14" /> Excel</button>
      </div>
      <p class="notice notice-warn mt-2 small">本工具按需载入（每次 {{ MAX_ROWS }} 行）——导出内容即当前已载入的 {{ rows.length }} 行，未载入的行不会出现在导出文件中。</p>

      <div v-if="schemaText" class="mt-2">
        <div class="label">Schema</div>
        <pre class="code-block schema-box">{{ schemaText }}</pre>
      </div>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr><th v-for="c in columns" :key="c">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in rows.slice(0, 100)" :key="ri">
              <td v-for="c in columns" :key="c">{{ r[c] === null || r[c] === undefined ? '' : String(r[c]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > 100" class="muted small mt-1">表格仅预览前 100 行，导出包含全部已载入 {{ rows.length }} 行。</p>
    </template>
    <div v-else-if="!loading && !error" class="row mt-2 muted small"><FileBox :size="14" /> 载入文件后显示 schema 与数据。</div>
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
/* schema 弹性高度（1366×768 下 30 列 schema 同屏可见 ≥15 行） */
.schema-box {
  height: min(320px, calc(100vh - 560px));
  min-height: 160px;
  overflow: auto;
  margin: 0;
}
</style>
