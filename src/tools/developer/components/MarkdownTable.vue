<script setup lang="ts">
import { computed, ref } from 'vue'
import { Table2, Plus, Minus, Copy } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const cells = ref<string[][]>([
  ['功能', '说明', '状态'],
  ['本地处理', '数据不出浏览器', '✅'],
])
const align = ref<'left' | 'center' | 'right'>('left')
const copied = ref(false)

const addRow = () => cells.value.push(cells.value[0]?.map(() => '') ?? [''])
const addCol = () => cells.value.forEach((r) => r.push(''))
const removeRow = () => {
  if (cells.value.length > 1) cells.value.pop()
}
const removeCol = () => {
  if ((cells.value[0]?.length ?? 0) > 1) cells.value.forEach((r) => r.pop())
}

const md = computed(() => {
  const rows = cells.value
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.length))
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const sep = Array.from({ length: cols }, () => (align.value === 'center' ? ':---:' : align.value === 'right' ? '---:' : '---'))
  const width = Math.max(...rows.map((r) => Math.max(...r.map((c) => esc(c).length))), 5)
  const fmt = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => esc(r[i] ?? '').padEnd(width)).join(' | ')} |`
  return [fmt(rows[0] ?? []), fmt(sep), ...rows.slice(1).map((r) => fmt(r))].join('\n')
})

const doCopy = async () => {
  const okFlag = await copyText(md.value)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('Markdown 表格已复制')
  } else toast.err('复制失败')
}
</script>

<template>
  <div class="md-table">
    <div class="row row-wrap mb-2" style="gap: 10px; align-items: center">
      <button class="btn btn-ghost btn-sm" @click="addRow"><Plus :size="14" /> 加一行</button>
      <button class="btn btn-ghost btn-sm" @click="removeRow" :disabled="cells.length <= 1"><Minus :size="14" /> 减一行</button>
      <button class="btn btn-ghost btn-sm" @click="addCol"><Plus :size="14" /> 加一列</button>
      <button class="btn btn-ghost btn-sm" @click="removeCol" :disabled="(cells[0]?.length ?? 0) <= 1"><Minus :size="14" /> 减一列</button>
      <span class="grow"></span>
      <span class="field-label" style="margin: 0">对齐</span>
      <select v-model="align" class="select" style="width: 100px">
        <option value="left">左 :---</option>
        <option value="center">中 :---:</option>
        <option value="right">右 ---:</option>
      </select>
    </div>

    <div class="grid-wrap">
      <table class="edit-grid">
        <tr v-for="(row, ri) in cells" :key="ri" :class="{ head: ri === 0 }">
          <td v-for="(_, ci) in row" :key="ci">
            <input
              v-model="cells[ri]![ci]"
              type="text"
              :placeholder="ri === 0 ? `列头 ${ci + 1}` : ''"
              spellcheck="false"
            />
          </td>
        </tr>
      </table>
    </div>

    <div class="mt-3">
      <div class="row" style="align-items: center; margin-bottom: 6px">
        <span class="field-label" style="margin: 0"><Table2 :size="14" style="vertical-align: -2px" /> GFM 表格输出</span>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" @click="doCopy"><Copy :size="14" /> 复制表格</button>
      </div>
      <pre class="out mono">{{ md }}</pre>
    </div>
  </div>
</template>

<style scoped>
.grid-wrap {
  overflow-x: auto;
}
.edit-grid {
  border-collapse: collapse;
  width: 100%;
}
.edit-grid td {
  border: 1px solid var(--border);
  padding: 0;
}
.edit-grid tr.head td {
  background: var(--accent-soft);
}
.edit-grid input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13.5px;
  padding: 9px 12px;
  outline: none;
  min-width: 120px;
  font-family: inherit;
}
.edit-grid input:focus {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.out {
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
