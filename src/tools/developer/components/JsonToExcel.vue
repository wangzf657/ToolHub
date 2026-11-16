<script setup lang="ts">
/** JSON 转 Excel：对象数组拍平为列，嵌套可选 a.b.c 拍平，多数组自动分 sheet；先生成预览再确认下载 */
import { computed, ref } from 'vue'
import { Loader2, Download, Table2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { rowsToXlsx } from '@/lib/officeEngine'
import { validateJson, localizeJsonError } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const flatten = ref(true)
const busy = ref(false)
/** 预览数据：解析并建表后暂存，确认后才真正导出 */
interface SheetDraft {
  name: string
  header: string[]
  rows: (string | number)[][]
  checked: boolean
}
const drafts = ref<SheetDraft[]>([])
const preview = computed(() => drafts.value.find((d) => d.checked) ?? null)

const onFiles = async (files: File[]) => {
  if (!files.length) return
  const raw = await files[0].text()
  if (raw.length > 2000000) {
    input.value = raw.slice(0, 2000000)
    toast.warn('已截断至前 200 万字符（截断后 JSON 可能非法）')
  } else {
    input.value = raw
  }
}

/** 取出数组（顶层 / 包装 {list:[]} / 顶层数组字段 → 多 sheet） */
function pickArrays(data: unknown): { name: string; rows: Record<string, unknown>[] }[] {
  if (Array.isArray(data)) return [{ name: 'Sheet1', rows: data as Record<string, unknown>[] }]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const wrapper = ['list', 'data', 'items', 'rows', 'records', 'result'].find((k) => Array.isArray(obj[k]))
    if (wrapper) return [{ name: wrapper, rows: obj[wrapper] as Record<string, unknown>[] }]
    const out: { name: string; rows: Record<string, unknown>[] }[] = []
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') out.push({ name: k, rows: v as Record<string, unknown>[] })
    }
    if (out.length) return out
  }
  throw new Error('未找到对象数组：请提供 JSON 数组，或包含 list/data/items 数组字段的对象')
}

/** 嵌套对象拍平为 a.b.c 列名 */
function flattenRow(row: Record<string, unknown>, out: Record<string, unknown> = {}, prefix = ''): Record<string, unknown> {
  for (const [k, v] of Object.entries(row)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenRow(v as Record<string, unknown>, out, key)
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : (v as unknown)
  }
  return out
}

/** 单元格值兜底：对象/数组统一 JSON.stringify，不再留空白单元格 */
const cell = (v: unknown): string | number => {
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return v as string | number
}

/** 第一步：解析并生成预览（不导出） */
const prepare = () => {
  if (!input.value.trim()) return toast.warn('请粘贴 JSON 或载入文件')
  let data: unknown
  try {
    const check = validateJson(input.value)
    if (!check.ok) throw new Error(check.error ?? 'JSON 无效')
    data = JSON.parse(input.value)
  } catch (e) {
    toast.err(localizeJsonError((e as Error).message, input.value))
    return
  }
  try {
    const sheets = pickArrays(data)
    const used = new Set<string>()
    drafts.value = sheets.map((s, idx) => {
      const rows = flatten.value ? s.rows.map((r) => flattenRow(r as Record<string, unknown>)) : s.rows
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
      let name = s.name || `Sheet${idx + 1}`
      let i = 2
      while (used.has(name)) name = `${s.name}-${i++}`
      used.add(name)
      return {
        name: name.slice(0, 28),
        header: keys,
        rows: rows.map((r) => keys.map((k) => cell(r[k]))),
        checked: true,
      }
    })
    toast.ok(`已生成预览：${drafts.value.length} 个 sheet，确认无误后点击下载`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  }
}

/** 第二步：按勾选的 sheet 导出 xlsx */
const exportXlsx = async () => {
  const chosen = drafts.value.filter((d) => d.checked)
  if (!chosen.length) return toast.warn('请至少勾选一个 sheet')
  busy.value = true
  try {
    const { saveBlob } = await import('@/lib/download')
    if (chosen.length === 1) {
      const s = chosen[0]
      saveBlob(await rowsToXlsx(s.header, s.rows, s.name), `${s.name}.xlsx`)
      toast.ok('Excel 已下载')
      return
    }
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    for (const s of chosen) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([s.header, ...s.rows]), s.name)
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'json-to-excel.xlsx')
    toast.ok(`已下载 ${chosen.length} 个 sheet`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    busy.value = false
  }
}

const fillSample = () => {
  input.value = JSON.stringify(
    {
      users: [
        { id: 1, name: '张三', addr: { city: '北京', zip: '100000' } },
        { id: 2, name: '李四', addr: { city: '上海', zip: '200000' } },
      ],
      orders: [
        { orderId: 'A001', amount: 99.5, paid: true },
        { orderId: 'A002', amount: 42, paid: false },
      ],
    },
    null,
    2,
  )
}
</script>

<template>
  <div>
    <FileDrop accept=".json" :multiple="false" label="拖入 .json 文件，或直接粘贴" hint="对象数组 → Excel 表格 · 嵌套自动拍平 · 全部本地处理" @files="onFiles" />
    <div class="row row-wrap mt-2" style="gap: 16px; align-items: center">
      <label class="opt check">
        <input v-model="flatten" type="checkbox" />
        <span>嵌套对象拍平为 a.b.c 列名</span>
      </label>
      <button class="btn btn-primary" :disabled="busy" @click="prepare">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <Table2 v-else :size="16" /> 生成预览
      </button>
      <button class="btn btn-ghost btn-sm" @click="fillSample">填入示例（嵌套 + 多数组）</button>
    </div>
    <div class="mt-2">
      <span class="field-label">JSON 输入</span>
      <textarea v-model="input" class="textarea mono" style="min-height: 220px" spellcheck="false" placeholder='[{"name":"张三","age":28,"addr":{"city":"北京"}}] 或 {"data":[…]}'></textarea>
    </div>

    <!-- 预览区：首个勾选 sheet 的表格，弹性高度；下载按钮位于预览正下方 -->
    <div v-if="drafts.length" class="mt-3">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">导出内容（勾选需要的 sheet）</span>
        <label v-for="d in drafts" :key="d.name" class="check">
          <input v-model="d.checked" type="checkbox" />
          <span>{{ d.name }}（{{ d.rows.length }} 行 × {{ d.header.length }} 列）</span>
        </label>
      </div>
      <div v-if="preview" class="sheet-preview-wrap mt-2">
        <div class="sheet-preview">
          <table class="pv-table">
            <thead>
              <tr>
                <th v-for="h in preview.header" :key="h">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in preview.rows.slice(0, 50)" :key="i">
                <td v-for="(c, j) in r" :key="j" class="mono">{{ c }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="preview.rows.length > 50" class="muted small mt-1">预览仅显示前 50 行，导出包含全部 {{ preview.rows.length }} 行。</p>
        </div>
        <div class="row mt-2">
          <button class="btn btn-primary" :disabled="busy" @click="exportXlsx">
            <Loader2 v-if="busy" :size="16" class="spin" />
            <Download v-else :size="16" /> 下载 xlsx
          </button>
          <span v-if="preview" class="muted small">{{ preview.name }} · {{ preview.rows.length }} 行 × {{ preview.header.length }} 列</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sheet-preview-wrap {
  display: grid;
  gap: 4px;
}
.sheet-preview {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: auto;
  height: calc(100dvh - 460px);
  min-height: 300px;
  max-height: 640px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
}
.pv-table {
  border-collapse: collapse;
  font-size: 12.5px;
  min-width: 100%;
}
.pv-table th,
.pv-table td {
  border: 1px solid var(--border);
  padding: 5px 10px;
  text-align: left;
  white-space: nowrap;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-table th {
  background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
  position: sticky;
  top: 0;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
