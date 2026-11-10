<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { fetchDataset } from '@/lib/utilExt'
import { periodicPos, PERIODIC_CAT_COLORS } from '@/lib/utilData'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface El { z: number; sym: string; name: string; mass: string; cat: string; shells: number[]; melt: number | null; boil: number | null; year: string }
const els = ref<El[]>([])
const loading = ref(true)
const selected = ref<El | null>(null)
const filterCat = ref('')
const query = ref('')

onMounted(async () => {
  try {
    els.value = await fetchDataset<El[]>('periodic')
  } catch (e) {
    toast.err(`元素数据加载失败：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
})

const cats = computed(() => [...new Set(els.value.map((e) => e.cat))])

const matched = computed(() => {
  const q = query.value.trim().toLowerCase()
  const byQuery = (e: El) => !q || e.name.includes(q) || e.sym.toLowerCase() === q || String(e.z) === q
  const byCat = (e: El) => !filterCat.value || e.cat === filterCat.value
  return els.value.filter((e) => byQuery(e) && byCat(e))
})

const dim = (e: El) => !matched.value.includes(e)

const detail = computed(() => {
  const e = selected.value
  if (!e) return []
  return [
    { l: '原子序数', v: String(e.z) },
    { l: '相对原子质量', v: e.mass },
    { l: '类别', v: e.cat },
    { l: '电子层排布', v: e.shells.join(', ') },
    { l: '熔点', v: e.melt === null ? '—' : `${e.melt} K` },
    { l: '沸点', v: e.boil === null ? '—' : `${e.boil} K` },
    { l: '发现', v: e.year || '—' },
  ]
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <input v-model="query" class="input grow" style="max-width: 220px" placeholder="搜索：中文名/符号/原子序数" />
        <select v-model="filterCat" class="input">
          <option value="">全部类别</option>
          <option v-for="c in cats" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="legend mt-2">
        <span v-for="c in cats" :key="c" class="lg" :style="{ background: (PERIODIC_CAT_COLORS[c] ?? '#888') + '33', borderColor: PERIODIC_CAT_COLORS[c] ?? '#888' }" @click="filterCat = filterCat === c ? '' : c" :class="{ on: filterCat === c }">{{ c }}</span>
      </div>
      <p class="hint mt-1">{{ loading ? '数据加载中…' : `118 个元素 · 点击查看详情，点图例按类别筛选` }}</p>
    </div>

    <div class="table mt-2" v-if="!loading">
      <template v-for="e in els" :key="e.z">
        <button
          class="el"
          :class="{ dim: dim(e) }"
          :style="{ gridColumn: periodicPos(e.z).col, gridRow: periodicPos(e.z).row, borderColor: PERIODIC_CAT_COLORS[e.cat] ?? '#888' }"
          @click="selected = e"
        >
          <i>{{ e.z }}</i>
          <b>{{ e.sym }}</b>
          <span>{{ e.name }}</span>
        </button>
      </template>
      <span class="placeholder-slot" style="grid-column: 3; grid-row: 6">57-71</span>
      <span class="placeholder-slot" style="grid-column: 3; grid-row: 7">89-103</span>
    </div>

    <div v-if="selected" class="detail mt-2" :style="{ borderColor: PERIODIC_CAT_COLORS[selected.cat] ?? '#888' }">
      <button class="close" @click="selected = null"><X :size="16" /></button>
      <h3 class="d-sym" :style="{ color: PERIODIC_CAT_COLORS[selected.cat] }">{{ selected.sym }} <small>{{ selected.name }}</small></h3>
      <p v-for="d in detail" :key="d.l" class="d-row"><b>{{ d.l }}：</b>{{ d.v }}</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.grow { flex: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 5px; }
.lg { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid transparent; cursor: pointer; }
.lg.on { outline: 2px solid var(--accent); }
.hint { font-size: 12px; color: var(--muted); }
.table { display: grid; grid-template-columns: repeat(18, minmax(30px, 1fr)); grid-template-rows: repeat(10, minmax(30px, 1fr)); gap: 2px; overflow-x: auto; min-width: 700px; }
.el { aspect-ratio: 0.92; border: 1px solid; border-radius: 5px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: var(--panel-solid, transparent); padding: 0; }
.el i { font-style: normal; font-size: 8px; color: var(--muted); }
.el b { font-size: 13px; }
.el span { font-size: 8px; }
.el.dim { opacity: 0.18; }
.el:hover { box-shadow: 0 0 0 2px var(--accent); }
.placeholder-slot { display: grid; place-items: center; font-size: 9px; color: var(--muted); border: 1px dashed var(--border); border-radius: 5px; }
.detail { padding: 14px 16px; border: 2px solid; border-radius: 12px; max-width: 420px; position: relative; }
.close { position: absolute; top: 8px; right: 8px; border: none; background: none; cursor: pointer; color: var(--muted); }
.d-sym { font-size: 26px; margin-bottom: 8px; }
.d-sym small { font-size: 14px; color: var(--muted); }
.d-row { font-size: 13px; margin: 4px 0; }
@media (max-width: 760px) { .table { grid-template-columns: repeat(18, 34px); grid-template-rows: repeat(10, 34px); } }
</style>
