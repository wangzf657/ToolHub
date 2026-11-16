<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { loadPdfJs } from '@/lib/pdfEngine'
import { extractPageTable, smartCellNum, type PageTable } from './tableDetect'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转 Excel：坐标聚类切列 + 检测预览确认（每页一个 sheet，数值列可计算） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const minCols = ref(2)
const busy = ref(false)
const scanning = ref(false)
/** 扫描结果（先预览确认，再下载） */
const pages = ref<{ pageNo: number; table: PageTable; sample: string[][] }[]>([])
const droppedTotal = ref(0)

const clampMinCols = () => {
  if (minCols.value < 2 || minCols.value > 6) {
    minCols.value = Math.min(6, Math.max(2, Math.round(minCols.value || 2)))
    toast.warn('表格最少列数已按 2~6 钳制')
  }
}

/** 扫描：逐页检测（不落盘），结果供预览 */
const scan = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  scanning.value = true
  try {
    const pdfjs = await loadPdfJs()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const out: typeof pages.value = []
    droppedTotal.value = 0
    for (let i = 0; i < doc.numPages; i++) {
      const table = await extractPageTable(doc, i, minCols.value)
      droppedTotal.value += table.dropped
      out.push({ pageNo: i + 1, table, sample: table.tableRows.slice(0, 5) })
    }
    doc.destroy()
    pages.value = out
    const hit = out.filter((p) => p.table.tableRows.length)
    if (!hit.length) {
      toast.warn('未检测到表格行：该 PDF 可能是扫描图片（无文本层），或表格列数少于阈值')
    } else {
      toast.ok(`第 ${hit.map((p) => p.pageNo).join('、')} 页命中表格行；请预览切列结果后下载`)
    }
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
    scanning.value = false
  }
}

/** 下载：全部检测行进 xlsx（数值列转数字，SUM 可计算） */
const download = async () => {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  let sheets = 0
  let rows = 0
  for (const p of pages.value) {
    const useRows = p.table.tableRows.length ? p.table.tableRows : p.table.rows.map((c) => [c.join(' ')])
    if (!useRows.length) continue
    const numeric = useRows.map((r) => r.map(smartCellNum))
    const ws = XLSX.utils.aoa_to_sheet(numeric)
    XLSX.utils.book_append_sheet(wb, ws, `第${p.pageNo}页`)
    sheets++
    rows += useRows.length
  }
  if (!sheets) {
    toast.warn('没有可导出的内容')
    return
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), '表格.xlsx')
  toast.ok(`Excel 已生成：${sheets} 个工作表 / ${rows} 行${droppedTotal.value ? `（已忽略 ${droppedTotal.value} 行非表格文本）` : ''}`)
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => ((pages = []), (droppedTotal = 0))" />

    <div class="row row-wrap mt-2">
      <span class="field-label" title="同一行至少切出这么多列才视为表格行（2~6）">表格最少列数</span>
      <input v-model.number="minCols" type="number" class="input w80" min="2" max="6" @blur="clampMinCols" />
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="scan">
        <Loader2 v-if="busy" :size="16" class="spinner" /> {{ scanning ? '正在检测表格…' : '扫描表格' }}
      </button>
      <button v-if="pages.length" class="btn btn-soft" @click="download"><Download :size="15" /> 确认并下载 Excel</button>
    </div>

    <p v-if="droppedTotal" class="small muted mt-1">已忽略 {{ droppedTotal }} 行非表格文本（标题、页脚等单列行）</p>

    <div v-if="pages.length" class="mt-2 page-list">
      <div v-for="p in pages" :key="p.pageNo" class="page-card">
        <span class="small">
          第 {{ p.pageNo }} 页：
          <b v-if="p.table.tableRows.length">{{ p.table.tableRows.length }} 行表格行</b>
          <span v-else class="muted">未检测到表格（整页按单列文本导出）</span>
        </span>
        <table v-if="p.sample.length" class="mini-table">
          <tr v-for="(r, i) in p.sample" :key="i">
            <td v-for="(c, j) in r" :key="j">{{ c }}</td>
          </tr>
        </table>
      </div>
      <p class="small muted">列界按 x 坐标间距聚类判定（间距 > 3×行内中位间距即断列）；全连成列时退回空格切列。复杂合并单元格请导出后手动调整。</p>
    </div>

    <p class="notice notice-info mt-2 small">
      流程：扫描（不落盘）→ 预览每页切列结果 → 确认下载。金额等数值列会转为数字（清理千分位与货币符号），Excel 中可直接 SUM。
    </p>
  </div>
</template>

<style scoped>
.w80 {
  width: 90px;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.page-list {
  display: grid;
  gap: 8px;
  max-height: max(420px, calc(100dvh - 420px));
  overflow: auto;
}
.page-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  display: grid;
  gap: 6px;
}
.mini-table {
  border-collapse: collapse;
  font-size: 12px;
  max-width: 100%;
}
.mini-table td {
  border: 1px solid var(--border);
  padding: 3px 8px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
