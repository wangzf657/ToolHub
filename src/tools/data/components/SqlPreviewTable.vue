<script setup lang="ts">
/**
 * SQLite 查看器的通用预览表：表头吸顶 + 横向滚动 + 单元格格式化。
 * raw=true 时按原样字符串渲染（结构表）；false 时格式化 NULL/BLOB（数据表）。
 */
const props = withDefaults(
  defineProps<{
    headers: string[]
    rows: unknown[][]
    raw?: boolean
    maxHeight?: number
  }>(),
  { raw: false, maxHeight: 340 },
)

const fmtCell = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL'
  if (v instanceof Uint8Array) return `BLOB(${v.length}B)`
  return String(v)
}
const isNull = (v: unknown) => v === null || v === undefined
</script>

<template>
  <div class="tbl-wrap" :style="{ maxHeight: maxHeight + 'px' }">
    <table class="tbl">
      <thead>
        <tr>
          <th v-for="h in headers" :key="h">{{ h }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="i">
          <td v-for="(c, j) in r" :key="j" :class="{ null: !raw && isNull(c) }">{{ raw ? String(c ?? '') : fmtCell(c) }}</td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="Math.max(1, headers.length)" class="empty">（无数据行）</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tbl-wrap {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.tbl th,
.tbl td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tbl th {
  position: sticky;
  top: 0;
  background: var(--bg-soft, rgba(127, 127, 127, 0.08));
  font-weight: 600;
}
td.null {
  color: var(--text-3);
  font-style: italic;
}
td.empty {
  color: var(--text-3);
  text-align: center;
  padding: 14px;
}
</style>
