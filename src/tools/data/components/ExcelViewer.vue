<script setup lang="ts">
/** Excel 在线预览：多 sheet 标签 + 分页只读表格 + 单元格复制 + 另存 CSV + 搜索/跳行/公式原文 */
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, Copy, Download, Search } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { readXlsx, type SheetData } from '@/lib/officeEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const sheets = ref<SheetData[]>([])
const active = ref(0)
const fileName = ref('')
const busy = ref(false)
const copiedCell = ref('')
/** 原始文件引用（公式视图需要二次解析） */
const lastFile = ref<File | null>(null)

const WINDOW = 500
/** 渲染窗口起点（0 基行号） */
const viewStart = ref(0)
/** 全文搜索（含匹配，作用于全部已解析数据） */
const keyword = ref('')
/** 跳到行输入 */
const jumpInput = ref<number | null>(null)
/** 值 | 公式 视图 */
const formulaMode = ref(false)
/** 公式表：sheet 名 → 单元格地址 → 公式串（首次切换时懒解析） */
const formulas = ref<Map<string, Map<string, string>>>(new Map())

const current = computed(() => sheets.value[active.value])
const total = computed(() => current.value?.rows.length ?? 0)
const kw = computed(() => keyword.value.trim().toLowerCase())

/** 当前展示行（携带原始行号）：搜索态全量过滤，否则按窗口分页 */
const viewRows = computed<{ idx: number; row: string[] }[]>(() => {
  const d = current.value
  if (!d) return []
  if (kw.value) {
    return d.rows
      .map((row, idx) => ({ idx, row }))
      .filter(({ row }) => row.some((c) => (c ?? '').toLowerCase().includes(kw.value)))
      .slice(0, WINDOW)
  }
  return d.rows.slice(viewStart.value, viewStart.value + WINDOW).map((row, i) => ({ idx: viewStart.value + i, row }))
})
const searchCount = computed(() => {
  const d = current.value
  if (!d || !kw.value) return 0
  return d.rows.filter((row) => row.some((c) => (c ?? '').toLowerCase().includes(kw.value))).length
})

const onFiles = async (files: File[]) => {
  if (!files.length) return
  busy.value = true
  const f = files[0]
  if (f.size > 20 * 1024 * 1024) {
    toast.warn(`大文件解析约需 ${Math.max(5, Math.round((f.size / 1048576) * 0.6))} 秒，请稍候…`)
  }
  try {
    lastFile.value = f
    const data = await readXlsx(f)
    if (!data.length) {
      toast.err('文件里没有数据')
      return
    }
    sheets.value = data
    active.value = 0
    viewStart.value = 0
    keyword.value = ''
    formulaMode.value = false
    formulas.value = new Map()
    fileName.value = f.name
    toast.ok(`已载入 ${data.length} 个 sheet`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败，请确认是 .xlsx/.xls 文件')
  } finally {
    busy.value = false
  }
}

const pickSheet = (i: number) => {
  active.value = i
  viewStart.value = 0
  keyword.value = ''
}

const cellCopy = async (r: number, c: number, v: string) => {
  const okFlag = await navigator.clipboard.writeText(v).then(() => true).catch(() => false)
  if (okFlag) {
    copiedCell.value = `${r}:${c}`
    setTimeout(() => (copiedCell.value = ''), 1000)
  }
}

const jumpTo = () => {
  const n = Math.floor(jumpInput.value ?? 0)
  if (!n || n < 1) return toast.warn('请输入要跳转的行号（1 起）')
  if (n > total.value) return toast.warn(`该表共 ${total.value} 行，无法跳到第 ${n} 行`)
  keyword.value = ''
  viewStart.value = Math.min(total.value - 1, n - 1)
  toast.ok(`已定位到第 ${n} 行附近`)
}

/* 公式原文：懒加载二次解析工作簿，收集含公式的单元格 */
const ensureFormulas = async () => {
  if (!formulaMode.value || !lastFile.value || formulas.value.size) return
  try {
    const XLSX = await import('xlsx')
    const wbBuf = await lastFile.value.arrayBuffer()
    const wb = XLSX.read(wbBuf, { type: 'array', cellFormula: true })
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      const m = new Map<string, string>()
      for (const addr of Object.keys(ws)) {
        if (addr.startsWith('!')) continue
        const cell = ws[addr] as { f?: string }
        if (cell?.f) m.set(addr, cell.f)
      }
      formulas.value.set(name, m)
    }
  } catch {
    /* 公式解析失败不影响值视图 */
  }
}

/** 列号 → Excel 列名（0→A，26→AA） */
const colName = (n: number): string => {
  let s = ''
  let c = n
  while (c >= 0) {
    s = String.fromCharCode(65 + (c % 26)) + s
    c = Math.floor(c / 26) - 1
  }
  return s
}

const cellDisplay = (rowIdx: number, colIdx: number, v: string): string => {
  if (!formulaMode.value) return v
  const addr = `${colName(colIdx)}${rowIdx + 2}` // +2：表头占第 1 行
  const f = formulas.value.get(current.value?.name ?? '')?.get(addr)
  return f ? `=${f}` : v
}

const saveCsv = () => {
  if (!current.value) return
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [current.value.header.map(esc).join(','), ...current.value.rows.map((r) => r.map(esc).join(','))]
  saveText('\ufeff' + lines.join('\n'), `${fileName.value.replace(/\.(xlsx|xls)$/i, '') || 'sheet'}.csv`, 'text/csv;charset=utf-8')
  toast.ok('已按当前 sheet 另存 CSV（全部行）')
}
</script>

<template>
  <div>
    <FileDrop v-if="!sheets.length && !busy" accept=".xlsx,.xls" :multiple="false" label="拖入 Excel 文件（.xlsx / .xls）" hint="只读预览 · 单元格点击复制 · 可另存 CSV · 全部本地处理" @files="onFiles" />
    <div v-if="busy" class="muted small mt-2">正在解析…（大文件需数秒）</div>

    <div v-if="sheets.length">
      <div class="row row-wrap mb-2" style="gap: 6px; align-items: center">
        <button
          v-for="(s, i) in sheets"
          :key="s.name"
          class="chip"
          :class="{ active: active === i }"
          @click="pickSheet(i)"
        >{{ s.name }}（{{ s.rows.length }}）</button>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="saveCsv"><Download :size="14" /> 另存 CSV</button>
      </div>

      <div class="row row-wrap mb-2" style="gap: 8px; align-items: center">
        <span class="search-box">
          <Search :size="13" />
          <input v-model="keyword" class="input" style="max-width: 220px" placeholder="全表搜索（包含匹配）" />
          <span v-if="kw" class="small hit-badge">{{ searchCount }} 行匹配</span>
        </span>
        <span class="jump-box">
          <input v-model.number="jumpInput" type="number" min="1" class="input mono" style="width: 110px" placeholder="跳到行" @keyup.enter="jumpTo" />
          <button class="btn btn-ghost btn-sm" @click="jumpTo">跳转</button>
        </span>
        <span class="check small">
          <button class="chip" :class="{ on: !formulaMode }" @click="formulaMode = false">值</button>
          <button class="chip" :class="{ on: formulaMode }" @click="formulaMode = true; void ensureFormulas()">公式</button>
        </span>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="row-no">#</th>
              <th v-for="(h, ci) in current.header" :key="ci">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vr in viewRows" :key="vr.idx">
              <td class="row-no">{{ vr.idx + 1 }}</td>
              <td
                v-for="(v, ci) in vr.row"
                :key="ci"
                :title="`${current.header[ci]} = ${v}`"
                @click="cellCopy(vr.idx, ci, String(v))"
              >
                {{ cellDisplay(vr.idx, ci, String(v)) }}<Copy v-if="copiedCell === `${vr.idx}:${ci}`" :size="11" class="cell-copied" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="row mt-2" style="align-items: center">
        <template v-if="kw">
          <span class="muted small">搜索态：显示前 {{ viewRows.length }} 行匹配（共 {{ searchCount }} 行）</span>
        </template>
        <template v-else>
          <button v-if="viewStart > 0" class="btn btn-soft btn-sm" @click="viewStart = Math.max(0, viewStart - WINDOW)"><ChevronLeft :size="14" /> 上一页</button>
          <button v-if="viewStart + WINDOW < total" class="btn btn-soft btn-sm" @click="viewStart += WINDOW"><ChevronRight :size="14" /> 下一页（已到第 {{ Math.min(total, viewStart + WINDOW) }} 行 / 共 {{ total }}）</button>
          <span v-if="viewStart + WINDOW >= total && total" class="muted small">已到最后（{{ total }} 行 × {{ current.header.length }} 列）</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tbl-wrap {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: auto;
  max-height: 460px;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th,
.tbl td {
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  padding: 6px 10px;
  text-align: left;
  white-space: nowrap;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tbl th {
  position: sticky;
  top: 0;
  background: var(--panel-solid);
  color: var(--text-2);
  font-weight: 600;
  z-index: 1;
}
.tbl td {
  cursor: copy;
}
.tbl td:hover {
  background: var(--accent-soft);
}
.row-no {
  color: var(--text-3);
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  position: sticky;
  left: 0;
  min-width: 36px;
}
.cell-copied {
  margin-left: 4px;
  color: var(--accent-text);
  vertical-align: middle;
}
.search-box,
.jump-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
}
.hit-badge {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 2px 10px;
  font-weight: 600;
}
.chip.on {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}
</style>
