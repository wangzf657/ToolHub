<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileSpreadsheet, Loader2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { readXlsx, type SheetData } from '@/lib/officeEngine'
import { rowsToCsv } from '@/lib/csvEngine'
import { saveText, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** Excel 转 CSV：多 sheet 选择 + 逐表预览 + 单表/多表导出 */
const toast = useToast()
const fileName = ref('工作簿')
const sheets = ref<SheetData[]>([])
const activeSheet = ref(0)
const loading = ref(false)
const delim = ref(',')
const PREVIEW = 50

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    sheets.value = await readXlsx(f)
    activeSheet.value = 0
    fileName.value = baseName(f.name)
    if (!sheets.value.length) {
      toast.warn('该工作簿没有可读取的工作表')
    } else {
      toast.ok(`已读取 ${sheets.value.length} 个工作表`)
    }
  } catch (e) {
    toast.err((e as Error).message || 'xlsx 解析失败，请确认为有效的 Excel 文件')
  } finally {
    loading.value = false
  }
}

const cur = computed(() => sheets.value[activeSheet.value] ?? null)
const previewRows = computed(() => cur.value?.rows.slice(0, PREVIEW) ?? [])

const sheetCsv = (s: SheetData): string => rowsToCsv(s.header, s.rows, delim.value)

const dlCurrent = () => {
  if (!cur.value) return
  saveText('\uFEFF' + sheetCsv(cur.value), `${fileName.value}-${cur.value.name}.csv`, 'text/csv;charset=utf-8')
}

const dlAll = async () => {
  if (!sheets.value.length) return
  if (sheets.value.length === 1) {
    dlCurrent()
    return
  }
  await saveMany(
    sheets.value.map((s) => ({
      name: `${fileName.value}-${s.name}.csv`,
      blob: new Blob(['\uFEFF' + sheetCsv(s)], { type: 'text/csv;charset=utf-8' }),
    })),
    `${fileName.value}-CSV.zip`,
  )
  toast.ok('已打包下载全部工作表')
}
</script>

<template>
  <div>
    <FileDrop accept=".xlsx,.xls" :multiple="false" label="拖放 Excel（xlsx/xls）文件，或点击选择" @files="onFiles" />
    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在读取…</div>

    <template v-if="sheets.length">
      <div class="row row-wrap mt-2">
        <button
          v-for="(s, i) in sheets"
          :key="s.name"
          class="chip"
          :class="{ active: activeSheet === i }"
          @click="activeSheet = i"
        >
          {{ s.name }}（{{ s.rows.length }} 行）
        </button>
      </div>

      <div class="row row-wrap mt-2">
        <label class="check">
          分隔符
          <select v-model="delim" class="select" style="width: 90px">
            <option value=",">逗号 ,</option>
            <option value="&#9;">制表符 Tab</option>
            <option value=";">分号 ;</option>
          </select>
        </label>
      </div>

      <div class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="(h, i) in cur?.header ?? []" :key="i">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in previewRows" :key="ri">
              <td v-for="(_, ci) in cur?.header ?? []" :key="ci">{{ r[ci] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="(cur?.rows.length ?? 0) > PREVIEW" class="muted small mt-1">
        仅预览前 {{ PREVIEW }} 行，导出包含全部 {{ cur?.rows.length }} 行。
      </p>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" @click="dlCurrent">
          <Download :size="16" /> 下载当前表 CSV
        </button>
        <button v-if="sheets.length > 1" class="btn" @click="dlAll">
          <Download :size="16" /> 全部工作表打包
        </button>
      </div>
    </template>
    <div v-else-if="!loading" class="row mt-2 muted small"><FileSpreadsheet :size="14" /> 载入 xlsx 后按工作表预览与导出。</div>
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
