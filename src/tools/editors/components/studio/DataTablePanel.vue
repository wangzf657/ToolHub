<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpDown, SortAsc, SortDesc } from 'lucide-vue-next'
import type { Dataset } from './dataShared'

/** 数据表面板：全文搜索 + 列排序 + 前 N 行 */
const props = defineProps<{ dataset: Dataset }>()

const keyword = ref('')
const limit = ref(50)
type SortDir = 'none' | 'asc' | 'desc'
const sortCol = ref<number | null>(null)
const sortDir = ref<SortDir>('none')

const limits = [20, 50, 100, 200]

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.dataset.rows
  return props.dataset.rows.filter((r) => r.some((c) => (c ?? '').toLowerCase().includes(kw)))
})

const sorted = computed(() => {
  if (sortCol.value === null || sortDir.value === 'none') return filtered.value
  const ci = sortCol.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const x = a[ci] ?? ''
    const y = b[ci] ?? ''
    const nx = parseFloat(x)
    const ny = parseFloat(y)
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) return (nx - ny) * dir
    return x.localeCompare(y, 'zh-CN') * dir
  })
})

const shown = computed(() => sorted.value.slice(0, limit.value))

const toggleSort = (i: number) => {
  if (sortCol.value !== i) {
    sortCol.value = i
    sortDir.value = 'asc'
  } else if (sortDir.value === 'asc') {
    sortDir.value = 'desc'
  } else {
    sortCol.value = null
    sortDir.value = 'none'
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap">
      <input v-model="keyword" class="input search" placeholder="全文搜索过滤…" />
      <label class="check">
        显示行数
        <select v-model.number="limit" class="select" style="width: 92px">
          <option v-for="n in limits" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <span class="badge">{{ filtered.length }} / {{ dataset.rows.length }} 行</span>
    </div>

    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead>
          <tr>
            <th class="idx">#</th>
            <th v-for="(h, i) in dataset.header" :key="i" class="sortable" @click="toggleSort(i)">
              <span class="th-inner">
                {{ h }}
                <SortAsc v-if="sortCol === i && sortDir === 'asc'" :size="12" />
                <SortDesc v-else-if="sortCol === i && sortDir === 'desc'" :size="12" />
                <ArrowUpDown v-else :size="11" class="idle" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, ri) in shown" :key="ri">
            <td class="idx">{{ ri + 1 }}</td>
            <td v-for="(_, ci) in dataset.header" :key="ci">{{ r[ci] ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="sorted.length > shown.length" class="muted small mt-1">
      仅显示前 {{ shown.length }} 行（共 {{ sorted.length }} 行匹配）
    </p>
  </div>
</template>

<style scoped>
.search {
  max-width: 260px;
}
.sortable {
  cursor: pointer;
  user-select: none;
}
.sortable:hover {
  color: var(--text);
}
.th-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.idle {
  opacity: 0.35;
}
.idx {
  color: var(--text-3);
  font-size: 12px;
  min-width: 40px;
}
</style>
