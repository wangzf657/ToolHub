<script setup lang="ts">
import { ref } from 'vue'
import { FileBox, Loader2, Download, Info } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob, saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * Parquet 查看转换：hyparquet（纯 JS，可离线）解析 → schema + 行预览 → CSV/JSON 下载
 */
const toast = useToast()
const fileName = ref('数据')
const loading = ref(false)
const rows = ref<Record<string, unknown>[]>([])
const columns = ref<string[]>([])
const schemaText = ref('')
const error = ref('')
const MAX_ROWS = 500

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  error.value = ''
  rows.value = []
  columns.value = []
  schemaText.value = ''
  fileName.value = baseName(f.name)
  try {
    // hyparquet 纯 JS 解析器：无需模型，可离线运行
    const hy = (await import('hyparquet')) as unknown as {
      parquetRead: (opts: Record<string, unknown>) => Promise<void>
      parquetMetadataAsync?: (file: unknown) => Promise<unknown>
      parquetSchema?: (metadata: unknown) => unknown
    }
    const buf = await f.arrayBuffer()
    const collected: Record<string, unknown>[] = []
    await hy.parquetRead({
      file: buf,
      rowFormat: 'object',
      rowEnd: MAX_ROWS,
      onBatch: (batch: Record<string, unknown>[]) => collected.push(...batch),
      onComplete: () => {},
    })
    rows.value = collected
    columns.value = collected.length ? Object.keys(collected[0]) : []
    // schema 信息（失败不影响数据展示）
    try {
      if (hy.parquetMetadataAsync && hy.parquetSchema) {
        const metadata = await hy.parquetMetadataAsync({ byteLength: buf.byteLength, slice: (s: number, e: number) => Promise.resolve(buf.slice(s, e)) })
        const schema = hy.parquetSchema(metadata) as {
          children: Record<string, { element?: { type?: string; num_children?: number } }>
        }
        const lines: string[] = []
        const walk = (
          node: { children: Record<string, { element?: { type?: string; num_children?: number } }> },
          depth: number,
        ) => {
          for (const [name, child] of Object.entries(node.children)) {
            const el = child.element
            const typeLabel = el?.type ?? (el?.num_children ? 'group' : 'unknown')
            lines.push(`${'  '.repeat(depth)}${name}: ${typeLabel}`)
            if (el?.num_children) walk(child as { children: Record<string, { element?: { type?: string; num_children?: number } }> }, depth + 1)
          }
        }
        walk(schema, 0)
        schemaText.value = lines.join('\n')
      }
    } catch {
      schemaText.value = '（schema 解析失败，但数据可正常读取）'
    }
    toast.ok(`已读取 ${rows.value.length} 行 × ${columns.value.length} 列`)
  } catch (e) {
    error.value =
      (e as Error).message ||
      'Parquet 解析失败：可能是压缩编码不被支持（当前支持 snappy/uncompressed），请尝试转换后重试。'
    toast.err('Parquet 解析失败，详见下方错误信息')
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
  saveText('\uFEFF' + toCsv(), `${fileName.value}.csv`, 'text/csv;charset=utf-8')
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
      使用 hyparquet 纯 JS 解析器，无需下载任何模型，完全离线可用；支持 snappy 与未压缩编码的 Parquet 文件。
    </div>

    <div class="mt-2">
      <FileDrop accept=".parquet,.pq" :multiple="false" label="拖放 Parquet 文件，或点击选择" @files="onFiles" />
    </div>
    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析 Parquet…</div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <template v-if="rows.length">
      <div class="row row-wrap mt-2">
        <span class="badge">{{ rows.length }} 行（最多预览 {{ MAX_ROWS }}）</span>
        <span class="badge">{{ columns.length }} 列</span>
        <button class="btn btn-sm" @click="dlCsv"><Download :size="14" /> CSV</button>
        <button class="btn btn-sm" @click="dlJson"><Download :size="14" /> JSON</button>
        <button class="btn btn-sm" @click="dlXlsx"><Download :size="14" /> Excel</button>
      </div>

      <div v-if="schemaText" class="mt-2">
        <div class="label">Schema</div>
        <pre class="code-block" style="max-height: 160px">{{ schemaText }}</pre>
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
      <p v-if="rows.length > 100" class="muted small mt-1">表格仅预览前 100 行，导出包含全部 {{ rows.length }} 行。</p>
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
</style>
