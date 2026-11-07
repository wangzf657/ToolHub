<script setup lang="ts">
import { computed, ref } from 'vue'
import { Scissors, Loader2, PackageOpen } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, splitCsv, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 拆分：按行数 / 按列取值，导出 csv/xlsx/json 打包 */
const toast = useToast()
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
const mode = ref<'rows' | 'column'>('rows')
const chunkSize = ref(500)
const colIndex = ref(0)
const outFormat = ref<'csv' | 'xlsx' | 'json'>('csv')

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    data.value = await parseCsvAsync(await f.text())
    fileName.value = baseName(f.name)
    toast.ok(`已载入 ${data.value.rows.length} 行`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
}

const parts = computed(() => {
  if (!data.value) return []
  if (mode.value === 'rows' && chunkSize.value < 1) return []
  const spec = mode.value === 'rows' ? { kind: 'rows' as const, size: Math.max(1, chunkSize.value) } : { kind: 'column' as const, col: colIndex.value }
  return splitCsv(data.value, spec)
})

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)

const doSplit = async () => {
  if (!parts.value.length) {
    toast.warn('没有可拆分的内容，请检查参数')
    return
  }
  const files: { name: string; blob: Blob }[] = []
  for (const [i, p] of parts.value.entries()) {
    const idx = String(i + 1).padStart(3, '0')
    const name = `${fileName.value}-${sanitize(p.name)}.${outFormat.value}`
    if (outFormat.value === 'csv') {
      files.push({ name, blob: new Blob(['\uFEFF' + rowsToCsv(p.csv.header, p.csv.rows)], { type: 'text/csv;charset=utf-8' }) })
    } else if (outFormat.value === 'json') {
      const arr = p.csv.rows.map((r) => Object.fromEntries(p.csv.header.map((h, c) => [h, r[c] ?? ''])))
      files.push({ name, blob: new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json;charset=utf-8' }) })
    } else {
      const { rowsToXlsx } = await import('@/lib/officeEngine')
      const blob = await rowsToXlsx(p.csv.header, p.csv.rows, `第${i + 1}部分`)
      files.push({ name, blob })
    }
  }
  await saveMany(files, `${fileName.value}-拆分.zip`)
  toast.ok(`已生成 ${files.length} 个文件并打包下载`)
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.tsv,.txt" :multiple="false" label="拖放 CSV 文件，或点击选择" @files="onFiles" />
    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析…</div>

    <template v-if="data">
      <div class="row row-wrap mt-2">
        <span class="badge">共 {{ data.rows.length }} 行 × {{ data.header.length }} 列</span>
      </div>

      <div class="row row-wrap mt-2">
        <button class="chip" :class="{ active: mode === 'rows' }" @click="mode = 'rows'">按行数拆分</button>
        <button class="chip" :class="{ active: mode === 'column' }" @click="mode = 'column'">按列取值拆分</button>
      </div>

      <div class="row row-wrap mt-2">
        <template v-if="mode === 'rows'">
          <label class="check">
            每个文件行数
            <input v-model.number="chunkSize" type="number" min="1" class="input" style="width: 110px" />
          </label>
        </template>
        <template v-else>
          <label class="check">
            拆分列
            <select v-model.number="colIndex" class="select" style="width: 160px">
              <option v-for="(h, i) in data.header" :key="i" :value="i">{{ h }}</option>
            </select>
          </label>
        </template>
        <label class="check">
          输出格式
          <select v-model="outFormat" class="select" style="width: 110px">
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="json">JSON</option>
          </select>
        </label>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="!parts.length" @click="doSplit">
          <PackageOpen :size="16" />
          拆分并打包下载
        </button>
      </div>

      <div v-if="parts.length" class="mt-2">
        <div class="label">将生成 {{ parts.length }} 个文件：</div>
        <div class="parts">
          <div v-for="(p, i) in parts.slice(0, 60)" :key="i" class="part-row">
            <Scissors :size="13" class="muted" />
            <span class="part-name">{{ fileName }}-{{ p.name }}.{{ outFormat }}</span>
            <span class="muted small">{{ p.csv.rows.length }} 行</span>
          </div>
          <p v-if="parts.length > 60" class="muted small">…以及另外 {{ parts.length - 60 }} 个文件。</p>
        </div>
      </div>
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
}
.parts {
  margin-top: 8px;
  display: grid;
  gap: 4px;
}
.part-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.part-name {
  font-family: var(--font-mono);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
