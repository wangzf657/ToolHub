<script setup lang="ts">
import { computed, ref } from 'vue'
import { GitCompare, Loader2, Download, PlusCircle, MinusCircle, Edit3 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, diffCsvData, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 文件对比：diffCsvData → 新增/删除/修改 三类差异 + 报告下载 */
const toast = useToast()
const fileA = ref<File | null>(null)
const fileB = ref<File | null>(null)
const dataA = ref<CsvData | null>(null)
const dataB = ref<CsvData | null>(null)
const loading = ref(false)
const keyCols = ref<number[]>([]) // 空 = 整行作为键
const tab = ref<'added' | 'removed' | 'changed'>('added')

const result = computed(() => {
  if (!dataA.value || !dataB.value) return null
  return diffCsvData(dataA.value, dataB.value, keyCols.value.length ? keyCols.value : null)
})

const keyOptions = computed(() => dataA.value?.header ?? [])
const onA = async (list: File[]) => {
  fileA.value = list[0] ?? null
  dataA.value = null
  if (fileA.value) await loadA()
}
const onB = async (list: File[]) => {
  fileB.value = list[0] ?? null
  dataB.value = null
  if (fileB.value) await loadB()
}

const loadOne = async (f: File): Promise<CsvData> => {
  const lower = f.name.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const { readXlsx } = await import('@/lib/officeEngine')
    const s = (await readXlsx(f))[0]
    return { header: s.header, rows: s.rows }
  }
  return parseCsvAsync(await f.text())
}

const loadA = async () => {
  try {
    dataA.value = await loadOne(fileA.value!)
  } catch (e) {
    toast.err(`文件 1 解析失败：${(e as Error).message}`)
  }
}
const loadB = async () => {
  try {
    dataB.value = await loadOne(fileB.value!)
  } catch (e) {
    toast.err(`文件 2 解析失败：${(e as Error).message}`)
  }
}

const compare = async () => {
  loading.value = true
  try {
    if (!dataA.value) await loadA()
    if (!dataB.value) await loadB()
    if (!dataA.value || !dataB.value) {
      toast.warn('请选择两个文件')
      return
    }
    tab.value = 'added'
    const r = result.value
    if (r && !r.added.length && !r.removed.length && !r.changed.length) {
      toast.ok('两个文件内容完全一致')
    }
  } finally {
    loading.value = false
  }
}

const dlReport = () => {
  const r = result.value
  if (!r) return
  const header = ['差异类型', ...dataA.value!.header]
  const rows: string[][] = [
    ...r.added.map((x) => ['新增', ...x]),
    ...r.removed.map((x) => ['删除', ...x]),
    ...r.changed.map((c) => ['修改', c.key, `${c.col}: ${c.before} → ${c.after}`]),
  ]
  saveText(rowsToCsv(header, rows), '对比报告.csv', 'text/csv;charset=utf-8')
}

const nameA = computed(() => (fileA.value ? baseName(fileA.value.name) : '旧文件'))
const nameB = computed(() => (fileB.value ? baseName(fileB.value.name) : '新文件'))
</script>

<template>
  <div>
    <div class="grid-2">
      <div>
        <div class="label">旧文件 / 基准</div>
        <FileDrop accept=".csv,.tsv,.txt,.xlsx,.xls" :multiple="false" :label="`选择文件 1（${nameA}）`" @files="onA" />
      </div>
      <div>
        <div class="label">新文件 / 待对比</div>
        <FileDrop accept=".csv,.tsv,.txt,.xlsx,.xls" :multiple="false" :label="`选择文件 2（${nameB}）`" @files="onB" />
      </div>
    </div>

    <template v-if="dataA && dataB">
      <div class="field mt-2">
        <label class="f-label">关键列（不选则按整行对比；按住 Ctrl 可多选）</label>
        <select v-model="keyCols" class="select" multiple size="3">
          <option v-for="(h, i) in keyOptions" :key="i" :value="i">{{ h }}</option>
        </select>
      </div>
      <button class="btn btn-primary mt-2" :disabled="loading" @click="compare">
        <Loader2 v-if="loading" :size="16" class="spin" />
        <GitCompare v-else :size="16" />
        开始对比
      </button>

      <template v-if="result">
        <div class="row row-wrap mt-2">
          <span class="badge ok-badge"><PlusCircle :size="12" /> 新增 {{ result.added.length }}</span>
          <span class="badge del-badge"><MinusCircle :size="12" /> 删除 {{ result.removed.length }}</span>
          <span class="badge chg-badge"><Edit3 :size="12" /> 修改 {{ result.changed.length }}</span>
          <button class="btn btn-sm" @click="dlReport"><Download :size="14" /> 下载报告</button>
        </div>

        <div class="tabs mt-2">
          <button class="tab" :class="{ active: tab === 'added' }" @click="tab = 'added'">新增（{{ result.added.length }}）</button>
          <button class="tab" :class="{ active: tab === 'removed' }" @click="tab = 'removed'">删除（{{ result.removed.length }}）</button>
          <button class="tab" :class="{ active: tab === 'changed' }" @click="tab = 'changed'">修改（{{ result.changed.length }}）</button>
        </div>

        <div v-if="tab === 'added' && result.added.length" class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr><th v-for="(h, i) in dataA.header" :key="i">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in result.added.slice(0, 200)" :key="ri">
                <td v-for="(_, ci) in dataA.header" :key="ci" class="cell-ok">{{ r[ci] ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="tab === 'removed' && result.removed.length" class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr><th v-for="(h, i) in dataA.header" :key="i">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in result.removed.slice(0, 200)" :key="ri">
                <td v-for="(_, ci) in dataA.header" :key="ci" class="cell-del">{{ r[ci] ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="tab === 'changed' && result.changed.length" class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr><th>键值</th><th>列</th><th>旧值</th><th>新值</th></tr>
            </thead>
            <tbody>
              <tr v-for="(c, ri) in result.changed.slice(0, 200)" :key="ri">
                <td class="mono">{{ c.key.replace(/\u0001/g, ' | ') }}</td>
                <td>{{ c.col }}</td>
                <td class="cell-del">{{ c.before }}</td>
                <td class="cell-ok">{{ c.after }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="muted small mt-2">该分类下没有差异。</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 6px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.field {
  display: grid;
  gap: 6px;
}
.f-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}
select.select[multiple] {
  height: auto;
  min-height: 84px;
}
.ok-badge {
  background: rgba(52, 211, 153, 0.1);
  color: var(--ok);
}
.del-badge {
  background: rgba(248, 113, 113, 0.1);
  color: var(--err);
}
.chg-badge {
  background: rgba(251, 191, 36, 0.1);
  color: var(--warn);
}
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 14px;
  font-size: 13.5px;
  color: var(--text-2);
  cursor: pointer;
}
.tab.active {
  color: var(--accent-text);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.cell-ok {
  background: rgba(52, 211, 153, 0.06);
}
.cell-del {
  background: rgba(248, 113, 113, 0.06);
}
</style>
