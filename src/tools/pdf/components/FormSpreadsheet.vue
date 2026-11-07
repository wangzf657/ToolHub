<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfFormFields, pdfFormRows } from '@/lib/pdfEngine'
import { rowsToXlsx } from '@/lib/officeEngine'
import { saveBlob, saveMany, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 表单数据汇总：多份已填表单 → 一行一份的表格 + FDF/XFDF/JSON 导出 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const header = ref<string[]>([])
const rows = ref<string[][]>([])
const fileNames = ref<string[]>([])

const process = async () => {
  const files = base.value?.files ?? []
  if (!files.length) {
    toast.warn('请先添加已填写完成的 PDF 表单（可多选）')
    return
  }
  busy.value = true
  try {
    const { header: h, rows: r } = await pdfFormRows(files)
    header.value = h
    rows.value = r
    fileNames.value = files.map((f) => f.name)
    if (!h.length) {
      toast.warn('没有在任何文件中检测到表单字段（或字段全部为空）')
    } else {
      toast.ok(`已汇总 ${r.length} 份表单，共 ${h.length} 个字段`)
    }
  } catch (e) {
    toast.err((e as Error).message || '汇总失败')
  } finally {
    busy.value = false
  }
}

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
      <span class="small muted">每个 PDF 汇总为一行，字段名作为表头</span>
    </div>

    <div v-if="header.length" class="mt-2">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th v-for="h in header" :key="h">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows.slice(0, 50)" :key="i">
              <td class="muted">{{ i + 1 }}</td>
              <td v-for="(c, j) in r" :key="j">{{ c }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > 50" class="small muted">仅预览前 50 行，导出包含全部 {{ rows.length }} 行</p>

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
</style>
