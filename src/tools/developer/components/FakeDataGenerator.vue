<script setup lang="ts">
import { ref } from 'vue'
import { Users, Download } from 'lucide-vue-next'
import { fakeRows, FAKE_FIELDS } from '@/lib/jsEngine'
import { rowsToCsv } from '@/lib/csvEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const selected = ref<string[]>(['fullName', 'email', 'phone', 'city', 'address'])
const count = ref(10)
const rows = ref<string[][]>([])
const header = ref<string[]>([])

const toggle = (key: string) => {
  const i = selected.value.indexOf(key)
  if (i > -1) selected.value.splice(i, 1)
  else selected.value.push(key)
}

const generate = () => {
  if (!selected.value.length) return toast.warn('请至少选择一个字段')
  const n = Math.floor(count.value)
  if (!n || n < 1 || n > 1000) return toast.err('行数需在 1-1000 之间')
  const cols = selected.value.map((k) => FAKE_FIELDS.find((f) => f.key === k) ?? { key: k, label: k })
  const r = fakeRows(n, cols)
  header.value = r.header
  rows.value = r.rows
  toast.ok(`已生成 ${n} 行 × ${cols.length} 列假数据`)
}

const downloadJson = () => {
  const objects = rows.value.map((r) => Object.fromEntries(header.value.map((h, i) => [h, r[i] ?? ''])))
  saveText(JSON.stringify(objects, null, 2), 'fake-data.json', 'application/json')
  toast.ok('已下载 JSON')
}

const downloadCsv = () => {
  saveText(rowsToCsv(header.value, rows.value), 'fake-data.csv', 'text/csv;charset=utf-8')
  toast.ok('已下载 CSV')
}
</script>

<template>
  <div class="fake-data">
    <div class="fields-panel">
      <span class="field-label">选择字段（{{ selected.length }}/{{ FAKE_FIELDS.length }}）</span>
      <div class="field-chips">
        <label v-for="f in FAKE_FIELDS" :key="f.key" class="chip" :class="{ active: selected.includes(f.key) }">
          <input type="checkbox" :checked="selected.includes(f.key)" style="display: none" @change="toggle(f.key)" />
          {{ f.label }}
        </label>
      </div>
    </div>

    <div class="row row-wrap mt-3" style="gap: 12px; align-items: end">
      <div>
        <span class="field-label">行数</span>
        <input v-model.number="count" type="number" class="input mono" style="width: 110px" min="1" max="1000" />
      </div>
      <button class="btn btn-primary" @click="generate"><Users :size="16" /> 生成假数据</button>
      <template v-if="rows.length">
        <button class="btn btn-ghost btn-sm" @click="downloadJson"><Download :size="14" /> JSON</button>
        <button class="btn btn-ghost btn-sm" @click="downloadCsv"><Download :size="14" /> CSV</button>
      </template>
    </div>

    <div v-if="rows.length" class="table-wrap mt-3">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th v-for="h in header" :key="h">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows.slice(0, 50)" :key="i">
            <td class="muted">{{ i + 1 }}</td>
            <td v-for="(c, j) in r" :key="j" class="mono">{{ c }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="rows.length > 50" class="muted small mt-1">仅预览前 50 行，下载可获取全部 {{ rows.length }} 行。</p>
    </div>

    <p class="notice notice-info mt-3 small">数据由本地算法随机拼装（真实姓氏 + 常用字、规范格式邮箱/手机号），仅用于接口调试与测试填充，请勿冒充真实身份。</p>
  </div>
</template>

<style scoped>
.field-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-chips .chip {
  cursor: pointer;
  user-select: none;
}
</style>
