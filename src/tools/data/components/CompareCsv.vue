<script setup lang="ts">
import { computed, ref } from 'vue'
import { GitCompare, Loader2, Download, PlusCircle, MinusCircle, Edit3, X } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { parseCsvAsync, diffCsvData, rowsToCsv, type CsvData } from '@/lib/csvEngine'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** CSV 文件对比：diffCsvData → 新增/删除/修改 + 修改行上下文展开 + 忽略列 + 重复键警示 */
const toast = useToast()
const fileA = ref<File | null>(null)
const fileB = ref<File | null>(null)
const dataA = ref<CsvData | null>(null)
const dataB = ref<CsvData | null>(null)
const loading = ref(false)
const keyCols = ref<number[]>([]) // 空 = 整行作为键
const ignoreCols = ref<number[]>([]) // 忽略列：不参与对比，也不入展示
const tab = ref<'added' | 'removed' | 'changed'>('added')
const dupDismissed = ref(false)
const expandedKey = ref('')

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

/* ---------- 忽略列投影：对比与展示都用投影后的数据 ---------- */
const keep = computed(() => (dataA.value?.header ?? []).map((_, i) => i).filter((i) => !ignoreCols.value.includes(i)))
const projA = computed<CsvData | null>(() => {
  const d = dataA.value
  if (!d) return null
  if (!ignoreCols.value.length) return d
  return { header: keep.value.map((i) => d.header[i]), rows: d.rows.map((r) => keep.value.map((i) => r[i] ?? '')) }
})
const projB = computed<CsvData | null>(() => {
  const d = dataB.value
  if (!d) return null
  if (!ignoreCols.value.length) return d
  return { header: keep.value.map((i) => d.header[i] ?? ''), rows: d.rows.map((r) => keep.value.map((i) => r[i] ?? '')) }
})
const projKeys = computed(() => keyCols.value.filter((i) => keep.value.includes(i)).map((i) => keep.value.indexOf(i)))
const keyOf = (r: string[]) => (projKeys.value.length ? projKeys.value.map((i) => r[i]).join('\u0001') : r.join('\u0001'))

const result = computed(() => {
  if (!projA.value || !projB.value) return null
  return diffCsvData(projA.value, projB.value, projKeys.value.length ? projKeys.value : null)
})

const keyOptions = computed(() => dataA.value?.header ?? [])
const toggleKey = (i: number) => {
  keyCols.value = keyCols.value.includes(i) ? keyCols.value.filter((x) => x !== i) : [...keyCols.value, i]
}
const toggleIgnore = (i: number) => {
  ignoreCols.value = ignoreCols.value.includes(i) ? ignoreCols.value.filter((x) => x !== i) : [...ignoreCols.value, i]
  keyCols.value = keyCols.value.filter((x) => x !== i)
}

/* ---------- 重复键警示（载入即检） ---------- */
const dupWarn = computed(() => {
  if (!projA.value || !projB.value) return null
  const dup = (d: CsvData) => {
    const m = new Map<string, number>()
    for (const r of d.rows) {
      const k = keyOf(r)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    let n = 0
    for (const c of m.values()) if (c > 1) n += c - 1
    return n
  }
  return { a: dup(projA.value), b: dup(projB.value) }
})
const keyName = computed(() => {
  if (!keyCols.value.length) return '整行'
  return keyCols.value.map((i) => keyOptions.value[i] ?? `列${i + 1}`).join('、')
})

/* ---------- 修改行上下文：按键分组，可展开看新旧两整行 ---------- */
interface ChgGroup {
  key: string
  changes: { col: string; before: string; after: string }[]
  rowA: string[]
  rowB: string[]
}
const changedGroups = computed<ChgGroup[]>(() => {
  const r = result.value
  if (!r || !projA.value || !projB.value) return []
  const mapA = new Map(projA.value.rows.map((row) => [keyOf(row), row]))
  const mapB = new Map(projB.value.rows.map((row) => [keyOf(row), row]))
  const byKey = new Map<string, ChgGroup>()
  for (const c of r.changed) {
    let g = byKey.get(c.key)
    if (!g) {
      g = { key: c.key, changes: [], rowA: mapA.get(c.key) ?? [], rowB: mapB.get(c.key) ?? [] }
      byKey.set(c.key, g)
    }
    g.changes.push({ col: c.col, before: c.before, after: c.after })
  }
  return [...byKey.values()]
})
const cellChanged = (g: ChgGroup, i: number) => (g.rowA[i] ?? '') !== (g.rowB[i] ?? '')
const toggleExpand = (k: string) => (expandedKey.value = expandedKey.value === k ? '' : k)

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
    dupDismissed.value = false
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
  const header = ['差异类型', ...projA.value!.header]
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
      <div v-if="dupWarn && !dupDismissed && (dupWarn.a || dupWarn.b)" class="notice notice-warn mt-2 small dup-warn">
        <span class="grow">
          <template v-if="dupWarn.a">文件 1 的「{{ keyName }}」存在 {{ dupWarn.a }} 个重复键值</template>
          <template v-if="dupWarn.a && dupWarn.b">；</template>
          <template v-if="dupWarn.b">文件 2 的「{{ keyName }}」存在 {{ dupWarn.b }} 个重复键值</template>
          ——重复键会影响按键对比的准确性。
        </span>
        <button class="btn btn-ghost btn-sm" @click="dupDismissed = true"><X :size="13" /> 知道了</button>
      </div>

      <div class="field mt-2">
        <label class="f-label">关键列（不选则按整行对比，点选即重算）</label>
        <div class="row row-wrap" style="gap: 6px">
          <label v-for="(h, i) in keyOptions" :key="'k' + i" class="chip key-chip" :class="{ on: keyCols.includes(i) }">
            <input type="checkbox" :checked="keyCols.includes(i)" @change="toggleKey(i)" /> {{ h }}
          </label>
        </div>
      </div>
      <div class="field mt-2">
        <label class="f-label">忽略列（该列变化不计入修改，如「更新时间」）</label>
        <div class="row row-wrap" style="gap: 6px">
          <label v-for="(h, i) in keyOptions" :key="'i' + i" class="chip key-chip" :class="{ on: ignoreCols.includes(i) }">
            <input type="checkbox" :checked="ignoreCols.includes(i)" @change="toggleIgnore(i)" /> {{ h }}
          </label>
        </div>
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
          <span class="badge chg-badge"><Edit3 :size="12" /> 修改 {{ changedGroups.length }}</span>
          <button class="btn btn-sm" @click="dlReport"><Download :size="14" /> 下载报告</button>
        </div>

        <div class="tabs mt-2">
          <button class="tab" :class="{ active: tab === 'added' }" @click="tab = 'added'">新增（{{ result.added.length }}）</button>
          <button class="tab" :class="{ active: tab === 'removed' }" @click="tab = 'removed'">删除（{{ result.removed.length }}）</button>
          <button class="tab" :class="{ active: tab === 'changed' }" @click="tab = 'changed'">修改（{{ changedGroups.length }}）</button>
        </div>

        <p v-if="(tab === 'added' && result.added.length > 200) || (tab === 'removed' && result.removed.length > 200) || (tab === 'changed' && changedGroups.length > 200)" class="muted small mt-1">
          仅预览前 200 条，共 {{ tab === 'added' ? result.added.length : tab === 'removed' ? result.removed.length : changedGroups.length }} 条，完整内容请下载报告。
        </p>

        <div v-if="tab === 'added' && result.added.length" class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr><th v-for="(h, i) in projA!.header" :key="i">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in result.added.slice(0, 200)" :key="ri">
                <td v-for="(_, ci) in projA!.header" :key="ci" class="cell-ok">{{ r[ci] ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="tab === 'removed' && result.removed.length" class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr><th v-for="(h, i) in projA!.header" :key="i">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in result.removed.slice(0, 200)" :key="ri">
                <td v-for="(_, ci) in projA!.header" :key="ci" class="cell-del">{{ r[ci] ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="tab === 'changed' && changedGroups.length" class="mt-1">
          <div v-for="g in changedGroups.slice(0, 200)" :key="g.key" class="chg-card">
            <button class="chg-head mono" @click="toggleExpand(g.key)">
              <span class="grow">{{ g.key.replace(/\u0001/g, ' | ') }}</span>
              <span class="muted small">{{ g.changes.length }} 处变化 · {{ expandedKey === g.key ? '收起' : '展开上下文' }}</span>
            </button>
            <div v-if="expandedKey === g.key" class="chg-body">
              <p class="small muted mb-1">变化列：{{ g.changes.map((c) => c.col).join('、') }}</p>
              <table class="data-table">
                <thead>
                  <tr><th></th><th v-for="(h, i) in projA!.header" :key="i">{{ h }}</th></tr>
                </thead>
                <tbody>
                  <tr><td class="cell-del">旧</td><td v-for="(v, i) in g.rowA" :key="'a' + i" :class="{ 'cell-chg': cellChanged(g, i) }">{{ v }}</td></tr>
                  <tr><td class="cell-ok">新</td><td v-for="(v, i) in g.rowB" :key="'b' + i" :class="{ 'cell-chg': cellChanged(g, i) }">{{ v }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
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
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.field { display: grid; gap: 6px; }
.f-label { font-size: 12.5px; font-weight: 600; color: var(--text-2); }
.key-chip { cursor: pointer; }
.key-chip.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 600; }
.dup-warn { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ok-badge { background: rgba(52, 211, 153, 0.1); color: var(--ok); }
.del-badge { background: rgba(248, 113, 113, 0.1); color: var(--err); }
.chg-badge { background: rgba(251, 191, 36, 0.1); color: var(--warn); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); }
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 14px;
  font-size: 13.5px;
  color: var(--text-2);
  cursor: pointer;
}
.tab.active { color: var(--accent-text); border-bottom-color: var(--accent); font-weight: 600; }
.cell-ok { background: rgba(52, 211, 153, 0.06); }
.cell-del { background: rgba(248, 113, 113, 0.06); }
.cell-chg { background: rgba(251, 191, 36, 0.22); font-weight: 600; }
.chg-card { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 6px; overflow: hidden; }
.chg-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  cursor: pointer;
  text-align: left;
  font-size: 12.5px;
}
.chg-body { padding: 8px 12px 12px; }
</style>
