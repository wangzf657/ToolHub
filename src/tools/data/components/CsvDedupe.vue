<script setup lang="ts">
import { computed, ref } from 'vue'
import { CopyX, Loader2, Download, ClipboardPaste } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { parseCsvAsync, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 去重：chip 选键列 + 保留首条/末条 + 重复副本导出 + 粘贴入口 */
const toast = useToast()
const data = ref<CsvData | null>(null)
const fileName = ref('数据')
const loading = ref(false)
const selectedCols = ref<number[]>([]) // 空 = 整行
const ignoreCase = ref(false)
const trimSpace = ref(false)
const keepLast = ref(false)
const pasteText = ref('')

const loadCsvText = async (text: string, name: string) => {
  loading.value = true
  try {
    data.value = await parseCsvAsync(text)
    fileName.value = name
    selectedCols.value = []
    toast.ok(`已载入 ${data.value.rows.length} 行`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
}

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  await loadCsvText(await f.text(), baseName(f.name))
}

const fromPaste = async () => {
  if (!pasteText.value.trim()) return toast.warn('请先粘贴 CSV 内容')
  await loadCsvText(pasteText.value, '粘贴数据')
}

/** 与引擎同口径的键归一（trim = 合并连续空白并去首尾） */
const keyOf = (r: string[]): string => {
  const arr = selectedCols.value.length ? selectedCols.value.map((i) => r[i] ?? '') : r
  let v = arr.join('\u0001')
  if (trimSpace.value) v = v.replace(/\s+/g, ' ').trim()
  if (ignoreCase.value) v = v.toLowerCase()
  return v
}

const result = computed(() => {
  const d = data.value
  if (!d) return null
  const rows = d.rows
  const unique: string[][] = []
  const dups: string[][] = []
  if (keepLast.value) {
    const lastIdx = new Map<string, number>()
    rows.forEach((r, i) => lastIdx.set(keyOf(r), i))
    rows.forEach((r, i) => {
      if (lastIdx.get(keyOf(r)) === i) unique.push(r)
      else dups.push(r)
    })
  } else {
    const seen = new Set<string>()
    rows.forEach((r) => {
      const k = keyOf(r)
      if (!seen.has(k)) {
        seen.add(k)
        unique.push(r)
      } else dups.push(r)
    })
  }
  return { unique, dups, removed: rows.length - unique.length }
})

const toggleCol = (i: number) => {
  selectedCols.value = selectedCols.value.includes(i) ? selectedCols.value.filter((x) => x !== i) : [...selectedCols.value, i]
}

const dlCsv = () => {
  if (!data.value || !result.value) return
  saveText('\uFEFF' + rowsToCsv(data.value.header, result.value.unique), `${fileName.value}-去重.csv`, 'text/csv;charset=utf-8')
}

/** 重复副本导出：每组保留一条，其余重复副本全量输出 */
const dlDups = () => {
  if (!data.value || !result.value) return
  if (!result.value.dups.length) return toast.warn('没有检测到重复行')
  saveText('\uFEFF' + rowsToCsv(data.value.header, result.value.dups), `${fileName.value}-重复行.csv`, 'text/csv;charset=utf-8')
  toast.ok(`已导出 ${result.value.dups.length} 行重复副本`)
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
    <div class="row row-wrap mt-2" style="gap: 8px; align-items: end">
      <label class="check" style="flex: 1; min-width: 240px">
        <span class="f-label">或直接粘贴 CSV 文本（与文件入口同流）</span>
        <textarea v-model="pasteText" class="textarea mono" rows="3" placeholder="姓名,城市&#10;张三,北京&#10;张三,北京&#10;李四,上海"></textarea>
      </label>
      <button class="btn btn-soft" @click="fromPaste"><ClipboardPaste :size="15" /> 解析粘贴内容</button>
    </div>
    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="14" class="spin" /> 正在解析…</div>

    <template v-if="data && result">
      <div class="mt-2">
        <div class="label">去重依据（不选 = 按整行，点选即重算）</div>
        <div class="row row-wrap" style="gap: 6px">
          <label v-for="(h, i) in data.header" :key="i" class="chip" :class="{ on: selectedCols.includes(i) }" style="cursor: pointer">
            <input type="checkbox" :checked="selectedCols.includes(i)" style="margin-right: 4px" @change="toggleCol(i)" /> {{ h }}
          </label>
        </div>
      </div>
      <div class="row row-wrap mt-2" style="gap: 14px">
        <label class="check"><input v-model="ignoreCase" type="checkbox" /> 忽略大小写</label>
        <label class="check"><input v-model="trimSpace" type="checkbox" /> 忽略首尾空格<span v-if="trimSpace" class="muted small">（同时会合并连续空格）</span></label>
        <label class="check">
          保留
          <select v-model="keepLast" class="select" style="width: 150px">
            <option :value="false">首次出现（默认）</option>
            <option :value="true">最后一次出现</option>
          </select>
        </label>
      </div>

      <div class="row row-wrap mt-2">
        <span class="badge">原 {{ data.rows.length }} 行</span>
        <span class="badge badge-ok">去重后 {{ result.unique.length }} 行</span>
        <span v-if="result.removed" class="badge badge-del">移除重复 {{ result.removed }} 行</span>
      </div>

      <div class="table-wrap mt-2">
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
        <button class="btn" :disabled="!result.unique.length" @click="dlCsv">
          <Download :size="16" /> 下载 CSV
        </button>
        <button class="btn btn-soft" :disabled="!result.dups.length" @click="dlDups">
          <Download :size="16" /> 下载重复行（{{ result.dups.length }} 副本）
        </button>
        <DownloadButton :produce="buildXlsx" :default-name="`${fileName}-去重.xlsx`" button-text="下载 Excel" />
      </div>
      <p class="muted small mt-1"><CopyX :size="12" style="vertical-align: -2px" /> 保留{{ keepLast ? '最后一次出现' : '首次出现' }}的行；「下载重复行」输出每组中除保留行外的全部重复副本。</p>
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
.f-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 4px;
  display: block;
}
.chip.on {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}
.badge-ok {
  background: rgba(52, 211, 153, 0.1);
  color: var(--ok);
}
.badge-del {
  background: rgba(248, 113, 113, 0.1);
  color: var(--err);
}
/* 结果预览弹性高度 */
.table-wrap {
  height: min(420px, calc(100vh - 500px));
  min-height: 240px;
  overflow: auto;
}
</style>
