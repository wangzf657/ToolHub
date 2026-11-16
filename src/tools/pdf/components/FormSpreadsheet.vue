<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownAZ, ArrowUpAZ, Download, Loader2, Search } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfFormFields, type FormFieldInfo } from '@/lib/pdfEngine'
import { rowsToXlsx } from '@/lib/officeEngine'
import { saveBlob, saveMany, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 表单数据汇总：多份已填表单 → 一行一份的表格 + FDF/XFDF/JSON 导出。
 * 逐份解析（带进度）并保留来源文件名；支持排序/搜索与漏填高亮。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const progressLabel = ref('')
const header = ref<string[]>([])
const rows = ref<string[][]>([])
const fileNames = ref<string[]>([])

/* ---------- 展示态：搜索 + 排序 ---------- */
const keyword = ref('')
const sortCol = ref(-1) // -1 表示按文件原序；>=0 为 header 列
const sortAsc = ref(true)

/** 解析循环：逐份 pdfFormFields，聚合表头与行（口径与引擎 pdfFormRows 一致） */
const process = async () => {
  const files = base.value?.files ?? []
  if (!files.length) {
    toast.warn('请先添加已填写完成的 PDF 表单（可多选）')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const headerSet = new Set<string>()
    const parsed: Record<string, string>[] = []
    for (let i = 0; i < files.length; i++) {
      progressLabel.value = `正在解析第 ${i + 1} / ${files.length} 份…`
      const fields: FormFieldInfo[] = await pdfFormFields(files[i])
      const row: Record<string, string> = {}
      for (const fd of fields) {
        if (fd.type === 'unknown' || fd.type === 'button') continue
        row[fd.name] = fd.value ?? ''
        headerSet.add(fd.name)
      }
      parsed.push(row)
      progress.value = (i + 1) / files.length
    }
    header.value = [...headerSet]
    rows.value = parsed.map((r) => header.value.map((h) => r[h] ?? ''))
    fileNames.value = files.map((f) => f.name)
    sortCol.value = -1
    keyword.value = ''
    if (!header.value.length) {
      toast.warn('没有在任何文件中检测到表单字段（或字段全部为空）')
    } else {
      toast.ok(`已汇总 ${rows.value.length} 份表单，共 ${header.value.length} 个字段`)
    }
  } catch (e) {
    toast.err((e as Error).message || '汇总失败')
  } finally {
    busy.value = false
    progressLabel.value = ''
  }
}

/** 过滤后的行索引（保留原序号） */
const viewIdx = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let idx = rows.value.map((_, i) => i)
  if (kw) {
    idx = idx.filter((i) =>
      [fileNames.value[i] ?? '', ...rows.value[i]].some((c) => String(c).toLowerCase().includes(kw)),
    )
  }
  if (sortCol.value >= 0) {
    const col = sortCol.value
    idx = [...idx].sort((a, b) => {
      const va = rows.value[a]?.[col] ?? ''
      const vb = rows.value[b]?.[col] ?? ''
      const na = Number(va)
      const nb = Number(vb)
      const cmp = !Number.isNaN(na) && !Number.isNaN(nb) && va !== '' && vb !== '' ? na - nb : String(va).localeCompare(String(vb), 'zh-CN')
      return sortAsc.value ? cmp : -cmp
    })
  }
  return idx
})

const toggleSort = (col: number) => {
  if (sortCol.value === col) {
    if (sortAsc.value) sortAsc.value = false
    else {
      sortCol.value = -1
      sortAsc.value = true
    }
  } else {
    sortCol.value = col
    sortAsc.value = true
  }
}

const isEmptyCell = (r: number, j: number) => (rows.value[r]?.[j] ?? '').trim() === ''

/* ---------- 导出 ---------- */

const toObjects = () =>
  rows.value.map((r) => Object.fromEntries(header.value.map((k, i) => [k, r[i] ?? ''])))

const exportXlsx = async () => {
  const blob = await rowsToXlsx(['文件名', ...header.value], rows.value.map((r, i) => [fileNames.value[i] ?? '', ...r]), '表单汇总')
  saveBlob(blob, '表单汇总.xlsx')
}

const exportCsv = () => {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const text = [header.value.map(esc).join(','), ...rows.value.map((r) => r.map(esc).join(','))].join('\r\n')
  saveText('\ufeff' + text, '表单汇总.csv', 'text/csv;charset=utf-8')
}

const exportJson = () => {
  saveText(JSON.stringify(toObjects(), null, 2), '表单数据.json', 'application/json;charset=utf-8')
}

/** XFDF / FDF（每个文件一份；多文件自动打包 ZIP） */
const exportFdfXfdf = async (kind: 'fdf' | 'xfdf') => {
  const files = base.value?.files ?? []
  if (!files.length) return
  const out: { name: string; blob: Blob }[] = []
  for (let i = 0; i < files.length; i++) {
    const fields = await pdfFormFields(files[i])
    const baseName = (fileNames.value[i] ?? `表单${i + 1}`).replace(/\.pdf$/i, '')
    if (kind === 'xfdf') {
      const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n  <fields>\n` +
        fields
          .filter((f) => f.type !== 'button' && f.type !== 'unknown')
          .map((f) => `    <field name="${esc(f.name)}"><value>${esc(f.value ?? '')}</value></field>`)
          .join('\n') +
        `\n  </fields>\n  <f href="" />\n</xfdf>\n`
      out.push({ name: `${baseName}.xfdf`, blob: new Blob([xml], { type: 'application/xml;charset=utf-8' }) })
    } else {
      const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
      const entries = fields
        .filter((f) => f.type !== 'button' && f.type !== 'unknown')
        .map((f) => `<< /T (${esc(f.name)}) /V (${esc(f.value ?? '')}) >>`)
        .join('\n')
      const fdf = `%FDF-1.2\n1 0 obj\n<< /FDF << /Fields [\n${entries}\n] >> >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`
      out.push({ name: `${baseName}.fdf`, blob: new Blob([fdf], { type: 'application/vnd.fdf' }) })
    }
  }
  if (out.length === 1) saveBlob(out[0].blob, out[0].name)
  else await saveMany(out, `${kind.toUpperCase()}导出.zip`)
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入一批已填写完成的 PDF 表单" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="process">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 读取并汇总表单
      </button>
      <span v-if="progressLabel" class="small muted">{{ progressLabel }}</span>
      <span v-else class="small muted">每个 PDF 汇总为一行，字段名作为表头</span>
    </div>

    <div v-if="busy" class="progress mt-1">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="header.length" class="mt-2">
      <div class="row row-wrap mb-2 table-tools">
        <span class="search-box">
          <Search :size="14" class="muted" />
          <input v-model="keyword" type="text" class="input" placeholder="搜索文件名或任意字段值…" />
        </span>
        <span class="small muted">点击列头排序（升 → 降 → 恢复原序）；空值以浅黄底标出</span>
      </div>

      <div class="table-wrap result-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>文件名</th>
              <th v-for="(h, j) in header" :key="h" class="sortable" @click="toggleSort(j)">
                {{ h }}
                <ArrowUpAZ v-if="sortCol === j && sortAsc" :size="12" />
                <ArrowDownAZ v-else-if="sortCol === j" :size="12" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, k) in viewIdx.slice(0, 200)" :key="r">
              <td class="muted">{{ k + 1 }}</td>
              <td class="fname" :title="fileNames[r]">{{ fileNames[r] }}</td>
              <td
                v-for="(c, j) in rows[r]"
                :key="j"
                :class="{ 'cell-empty': isEmptyCell(r, j) }"
              >
                {{ c }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="viewIdx.length > 200" class="small muted">仅预览前 200 行（当前过滤后 {{ viewIdx.length }} 行），导出包含全部 {{ rows.length }} 行</p>
      <p v-else-if="viewIdx.length !== rows.length" class="small muted">过滤后 {{ viewIdx.length }} / {{ rows.length }} 行</p>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" @click="exportXlsx"><Download :size="15" /> Excel (.xlsx)</button>
        <button class="btn btn-soft" @click="exportCsv"><Download :size="15" /> CSV</button>
        <button class="btn btn-soft" @click="exportJson"><Download :size="15" /> JSON</button>
        <button class="btn btn-ghost" @click="exportFdfXfdf('xfdf')"><Download :size="15" /> XFDF（可回填）</button>
        <button class="btn btn-ghost" @click="exportFdfXfdf('fdf')"><Download :size="15" /> FDF（可回填）</button>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">
      XFDF/FDF 按每个 PDF 单独导出（Adobe 表单数据格式，可在 Acrobat 中重新导入回填），多个文件时自动打包 ZIP；JSON 为「一行一个对象」的数组。
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
  max-width: 420px;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.table-tools {
  align-items: center;
}
.search-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.search-box .input {
  width: 240px;
}
/* 弹性结果区：视口为主，下限 420px */
.result-table {
  height: max(420px, calc(100dvh - 330px));
  overflow: auto;
}
.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.fname {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-empty {
  background: color-mix(in srgb, #fbbf24 22%, transparent);
}
</style>
