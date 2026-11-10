<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { fetchDataset } from '@/lib/utilExt'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Univ { n: string; prov: string; type: string; tags: string[] }
const all = ref<Univ[]>([])
const loading = ref(true)
const query = ref('')
const prov = ref('')
const type = ref('')
const tag = ref('')

onMounted(async () => {
  try {
    all.value = await fetchDataset<Univ[]>('universities')
  } catch (e) {
    toast.err(`高校数据加载失败：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
})

const provs = computed(() => [...new Set(all.value.map((u) => u.prov))].sort())
const types = computed(() => [...new Set(all.value.map((u) => u.type))].sort())
const TAGS = ['985', '211', '双一流']

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  return all.value
    .filter((u) => (!q || u.n.toLowerCase().includes(q)) && (!prov.value || u.prov === prov.value) && (!type.value || u.type === type.value) && (!tag.value || u.tags.includes(tag.value)))
    .slice(0, 300)
})

const reset = () => {
  query.value = prov.value = type.value = tag.value = ''
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <Search :size="16" />
        <input v-model="query" class="input grow" style="max-width: 240px" placeholder="搜索校名…" />
        <select v-model="prov" class="input"><option value="">全部省份</option><option v-for="p in provs" :key="p" :value="p">{{ p }}</option></select>
        <select v-model="type" class="input"><option value="">全部类别</option><option v-for="t in types" :key="t" :value="t">{{ t }}</option></select>
        <select v-model="tag" class="input"><option value="">全部标签</option><option v-for="t in TAGS" :key="t" :value="t">{{ t }}</option></select>
        <button class="btn btn-sm" @click="reset">重置</button>
      </div>
      <p class="hint mt-1">{{ loading ? '数据加载中…' : `公办本科 ${all.length} 所（教育部名单口径）· 命中 ${results.length} 所 · 纯静态数据，不联网` }}</p>
    </div>

    <div v-if="!loading" class="grid mt-2">
      <div v-for="u in results" :key="u.n" class="card">
        <b class="nm">{{ u.n }}</b>
        <div class="meta">
          <span>{{ u.prov }}</span><span>·</span><span>{{ u.type }}</span>
        </div>
        <div class="tags">
          <span v-for="t in u.tags" :key="t" class="tag" :class="{ star: t === '985' }">{{ t }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.grow { flex: 1; }
.hint { font-size: 12px; color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; max-height: 520px; overflow: auto; padding-bottom: 8px; }
.card { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; }
.nm { font-size: 14px; }
.meta { font-size: 12px; color: var(--muted); margin: 4px 0; display: flex; gap: 6px; }
.tags { display: flex; gap: 4px; flex-wrap: wrap; }
.tag { font-size: 10px; padding: 1px 7px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.14)); }
.tag.star { background: rgba(245, 158, 11, .2); color: #b45309; }
</style>
