<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfPageTexts } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转 Excel：按「2+ 空格 / 制表符」切列的启发式表格检测，每页一个 sheet */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const minCols = ref(2)
const busy = ref(false)
const stat = ref('')

/** 把一页文本切成行/列 */
function pageToRows(pageText: string): string[][] {
  return pageText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t| {2,}/).map((c) => c.trim()))
    .filter((cells) => cells.length >= 1)
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  stat.value = '正在提取文本…'
  try {
    const texts = await pdfPageTexts(file)
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    let sheets = 0
    let rows = 0
    texts.forEach((t, i) => {
      const all = pageToRows(t).filter((cells) => cells.length >= minCols.value || cells.length === 1)
      // 只保留像表格的行（≥ minCols 列）；若整页无表格行则整页作为单列文本
      const tableRows = all.filter((c) => c.length >= minCols.value)
      const useRows = tableRows.length ? tableRows : all.map((c) => [c.join(' ')])
      if (!useRows.length) return
      const ws = XLSX.utils.aoa_to_sheet(useRows)
      XLSX.utils.book_append_sheet(wb, ws, `第${i + 1}页`)
      sheets++
      rows += useRows.length
    })
    if (!sheets) {
      toast.warn('未检测到可用内容：该 PDF 可能是扫描图片，无文本层')
      return
    }
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), '表格.xlsx')
    stat.value = `共 ${sheets} 个工作表 / ${rows} 行`
    toast.ok('Excel 已生成')
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (stat = '')" />

    <div class="row row-wrap mt-2">
      <span class="field-label">至少列数（判定为表格行）</span>
      <input v-model.number="minCols" type="number" class="input w80" min="2" max="6" />
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 Excel 并下载
      </button>
      <span v-if="stat" class="small muted">{{ stat }}</span>
    </div>

    <p class="notice notice-info mt-2 small">
      检测规则：同一行内出现 2 个及以上连续空格或制表符即切分为多列，PDF 的每页生成一个工作表。规则为启发式，复杂合并单元格请导出后手动调整。
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
</style>
