<script setup lang="ts">
/** JSON 转 Excel：对象数组拍平为列，嵌套可选 a.b.c 拍平，多数组自动分 sheet */
import { ref } from 'vue'
import { Loader2, Sheet } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { rowsToXlsx } from '@/lib/officeEngine'
import { validateJson } from '@/lib/jsEngine'
import { localizeJsonError } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const flatten = ref(true)
const busy = ref(false)
const sheetInfo = ref('')

const onFiles = async (files: File[]) => {
  if (!files.length) return
  input.value = (await files[0].text()).slice(0, 2000000)
  toast.ok('已载入 JSON 文件')
}

/** 取出首个数组（顶层或常见包装 {list:[]} {data:[]} {items:[]}） */
function pickArrays(data: unknown): { name: string; rows: Record<string, unknown>[] }[] {
  if (Array.isArray(data)) return [{ name: 'Sheet1', rows: data as Record<string, unknown>[] }]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const wrapper = ['list', 'data', 'items', 'rows', 'records', 'result'].find((k) => Array.isArray(obj[k]))
    if (wrapper) return [{ name: wrapper, rows: obj[wrapper] as Record<string, unknown>[] }]
    // 顶层多个数组字段 → 多 sheet
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

const run = async () => {
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
  busy.value = true
  try {
    const sheets = pickArrays(data)
    const used = new Set<string>()
    const built: { name: string; header: string[]; rows: (string | number)[][] }[] = sheets.map((s, idx) => {
      const rows = (flatten.value ? s.rows.map((r) => flattenRow(r as Record<string, unknown>)) : (s.rows as Record<string, unknown>[]))
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
      let name = s.name || `Sheet${idx + 1}`
      let i = 2
      while (used.has(name)) name = `${s.name}-${i++}`
      used.add(name)
      return {
        name: name.slice(0, 28),
        header: keys,
        rows: rows.map((r) => keys.map((k) => (r[k] == null ? '' : (r[k] as string | number)))),
      }
    })
    const { saveBlob } = await import('@/lib/download')
    if (built.length === 1) {
      const s = built[0]
      saveBlob(await rowsToXlsx(s.header, s.rows, s.name), `${s.name}.xlsx`)
      sheetInfo.value = `1 个 sheet · ${s.rows.length} 行 × ${s.header.length} 列`
      toast.ok('Excel 已生成')
      return
    }
    // 多 sheet：组合一个工作簿导出
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    for (const s of built) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([s.header, ...s.rows]), s.name)
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'json-to-excel.xlsx')
    sheetInfo.value = `${built.length} 个 sheet · ${built.map((s) => s.rows.length).join('+')} 行`
    toast.ok(`已生成 ${built.length} 个 sheet`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
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
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <Sheet v-else :size="16" /> 生成 Excel
      </button>
      <span v-if="sheetInfo" class="muted small">{{ sheetInfo }}</span>
    </div>
    <div class="mt-2">
      <span class="field-label">JSON 输入</span>
      <textarea v-model="input" class="textarea mono" style="min-height: 220px" spellcheck="false" placeholder='[{"name":"张三","age":28,"addr":{"city":"北京"}}] 或 {"data":[…]}'></textarea>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: flex;
  align-items: center;
  gap: 6px;
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
