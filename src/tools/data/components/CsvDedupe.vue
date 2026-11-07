<script setup lang="ts">
import { computed, ref } from 'vue'
import { CopyX, Loader2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { parseCsvAsync, dedupeRows, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 去重：整行或按列去重，可选忽略大小写/去首尾空格 */
const toast = useToast()
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
const selectedCols = ref<number[]>([]) // 空 = 整行
const ignoreCase = ref(false)
const trimSpace = ref(false)

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    data.value = await parseCsvAsync(await f.text())
    fileName.value = baseName(f.name)
    selectedCols.value = []
    toast.ok(`已载入 ${data.value.rows.length} 行`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
}

const result = computed(() => {
  if (!data.value) return null
  return dedupeRows(data.value.rows, selectedCols.value.length ? selectedCols.value : null, {
    ignoreCase: ignoreCase.value,
    trim: trimSpace.value,
  })
})

const dlCsv = () => {
  if (!data.value || !result.value) return
  saveText('\uFEFF' + rowsToCsv(data.value.header, result.value.unique), `${fileName.value}-去重.csv`, 'text/csv;charset=utf-8')
}

const buildXlsx = async (): Promise<Blob> => {
  if (!data.value || !result.value) throw new Error('请先载入数据')
  const { rowsToXlsx } = await import('@/lib/officeEngine')
  return rowsToXlsx(data.value.header, result.value.unique, 'Sheet1')
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.tsv,.txt" :multiple="false" label="拖放 CSV 文件，或点击选择" @files="onFiles" />
    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析…</div>

    <template v-if="data && result">
      <div class="mt-2">
        <div class="label">去重依据（不选 = 按整行；Ctrl+点击多选）</div>
        <select v-model="selectedCols" class="select" multiple size="3">
          <option v-for="(h, i) in data.header" :key="i" :value="i">{{ h }}</option>
        </select>
      </div>
      <div class="row row-wrap mt-2">
        <label class="check"><input v-model="ignoreCase" type="checkbox" /> 忽略大小写</label>
        <label class="check"><input v-model="trimSpace" type="checkbox" /> 忽略首尾空格</label>
      </div>

      <div class="row row-wrap mt-2">
        <span class="badge">原 {{ data.rows.length }} 行</span>
        <span class="badge badge-ok">去重后 {{ result.unique.length }} 行</span>
        <span v-if="result.removed" class="badge badge-del">移除重复 {{ result.removed }} 行</span>
      </div>

      <div class="table-wrap mt-2" style="max-height: 300px">
        <table class="data-table">
          <thead>
            <tr><th v-for="(h, i) in data.header" :key="i">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in result.unique.slice(0, 50)" :key="ri">
              <td v-for="(_, ci) in data.header" :key="ci">{{ r[ci] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="result.unique.length > 50" class="muted small mt-1">仅预览前 50 行，导出包含全部。</p>

      <div class="row row-wrap mt-2">
        <DownloadButton :produce="buildXlsx" :default-name="`${fileName}-去重.xlsx`" button-text="下载 Excel" />
      </div>
      <div class="row mt-1">
        <button class="btn" :disabled="!result.unique.length" @click="dlCsv">
          <Download :size="16" /> 下载 CSV
        </button>
      </div>
      <p class="muted small mt-1"><CopyX :size="12" style="vertical-align: -2px" /> 保留首次出现的行，后续重复行被移除。</p>
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
  margin-bottom: 6px;
}
select.select[multiple] {
  height: auto;
  min-height: 84px;
}
.badge-ok {
  background: rgba(52, 211, 153, 0.1);
  color: var(--ok);
}
.badge-del {
  background: rgba(248, 113, 113, 0.1);
  color: var(--err);
}
</style>
