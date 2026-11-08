<script setup lang="ts">
/** Excel 在线预览：多 sheet 标签 + 分页只读表格 + 单元格复制 + 另存 CSV */
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, Copy, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { readXlsx, type SheetData } from '@/lib/officeEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const sheets = ref<SheetData[]>([])
const active = ref(0)
const limit = ref(200)
const fileName = ref('')
const busy = ref(false)
const copiedCell = ref('')

const current = computed(() => sheets.value[active.value])
const rows = computed(() => current.value?.rows.slice(0, limit.value) ?? [])
const total = computed(() => current.value?.rows.length ?? 0)

const onFiles = async (files: File[]) => {
  if (!files.length) return
  busy.value = true
  try {
    const data = await readXlsx(files[0])
    if (!data.length) {
      toast.err('文件里没有数据')
      return
    }
    sheets.value = data
    active.value = 0
    limit.value = 200
    fileName.value = files[0].name
    toast.ok(`已载入 ${data.length} 个 sheet`)
  } catch (e) {
    toast.err((e as Error).message || '解析失败，请确认是 .xlsx/.xls 文件')
  } finally {
    busy.value = false
  }
}

const pickSheet = (i: number) => {
  active.value = i
  limit.value = 200
}

const cellCopy = async (r: number, c: number, v: string) => {
  const okFlag = await navigator.clipboard.writeText(v).then(() => true).catch(() => false)
  if (okFlag) {
    copiedCell.value = `${r}:${c}`
    setTimeout(() => (copiedCell.value = ''), 1000)
  }
}

const saveCsv = () => {
  if (!current.value) return
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [current.value.header.map(esc).join(','), ...rows.value.map((r) => r.map(esc).join(','))]
  saveText('\ufeff' + lines.join('\n'), `${fileName.value.replace(/\.(xlsx|xls)$/i, '') || 'sheet'}.csv`, 'text/csv;charset=utf-8')
  toast.ok('已按当前 sheet 另存 CSV')
}
</script>

<template>
  <div>
    <FileDrop v-if="!sheets.length && !busy" accept=".xlsx,.xls" :multiple="false" label="拖入 Excel 文件（.xlsx / .xls）" hint="只读预览 · 单元格点击复制 · 可另存 CSV · 全部本地处理" @files="onFiles" />
    <div v-if="busy" class="muted small mt-2">正在解析…</div>

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

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="row-no">#</th>
              <th v-for="(h, ci) in current.header" :key="ci">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in rows" :key="ri">
              <td class="row-no">{{ ri + 1 }}</td>
              <td
                v-for="(v, ci) in r"
                :key="ci"
                :title="`${current.header[ci]} = ${v}`"
                @click="cellCopy(ri, ci, String(v))"
              >
                {{ v }}<Copy v-if="copiedCell === `${ri}:${ci}`" :size="11" class="cell-copied" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="row mt-2" style="align-items: center">
        <button v-if="limit < total" class="btn btn-soft btn-sm" @click="limit += 500"><ChevronRight :size="14" /> 加载更多（已显示 {{ limit }}/{{ total }}）</button>
        <span v-else class="muted small">已全部显示（{{ total }} 行 × {{ current.header.length }} 列）</span>
        <span class="grow"></span>
        <span v-if="limit < total" class="muted small"><ChevronLeft :size="12" /> 大表格分页渲染，防卡顿</span>
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
</style>
