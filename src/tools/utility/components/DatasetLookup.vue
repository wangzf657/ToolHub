<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Copy, Loader2 } from 'lucide-vue-next'
import { fetchDataset } from '@/lib/utilExt'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 通用数据集查询壳：搜索 + 列表展示（成语/歇后语/诗词/音标/垃圾分类等共用） */
export interface LookupConfig {
  dataset: string
  sizeHint: string // 首次加载体积提示
  placeholder: string
  /** 主键（大字展示） */
  primary: string
  /** 次要字段（小字行） */
  subs: { key: string; label: string }[]
  /** 参与搜索的字段 */
  searchKeys: string[]
  /** 详情字段（可展开） */
  detailKeys?: { key: string; label: string }[]
  /** 随机展示（卡片）开关 */
  random?: boolean
}

const props = defineProps<{ cfg: LookupConfig }>()

const toast = useToast()
const query = ref('')
const items = ref<Record<string, string>[]>([])
const loading = ref(true)
const loadErr = ref('')
const ready = ref(false)
const expanded = ref(-1)

const load = async () => {
  loading.value = true
  loadErr.value = ''
  try {
    items.value = (await fetchDataset<Record<string, string>[]>(props.cfg.dataset)) as never
    ready.value = true
  } catch (e) {
    loadErr.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.cfg.dataset, load)

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const pool = items.value
  if (!q) return pool.slice(0, 50)
  const out = []
  for (let i = 0; i < pool.length && out.length < 80; i++) {
    const it = pool[i]!
    if (props.cfg.searchKeys.some((k) => String(it[k] ?? '').toLowerCase().includes(q))) out.push(it)
  }
  return out
})

const randomPick = () => {
  if (!items.value.length) return
  const it = items.value[Math.floor(Math.random() * items.value.length)]!
  query.value = String(it[props.cfg.primary] ?? '')
}

const doCopy = async (s: string) => {
  const ok = await copyText(s)
  ok ? toast.ok('已复制') : toast.err('复制失败')
}

const fullText = (it: Record<string, string>) => {
  const parts = [String(it[props.cfg.primary] ?? '')]
  for (const d of props.cfg.detailKeys ?? []) parts.push(`${d.label}：${fmtVal(it[d.key])}`)
  return parts.filter(Boolean).join('\n')
}

/** 数组换行、其余字符串化 */
const fmtVal = (v: unknown): string => (Array.isArray(v) ? v.join('\n') : String(v ?? '') || '—')
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row gap">
        <Search :size="16" />
        <input v-model="query" class="input grow" :placeholder="cfg.placeholder" />
        <button v-if="cfg.random" class="btn btn-sm" title="随机来一条" @click="randomPick">🎲 随机</button>
      </div>
      <p class="hint mt-1">
        {{ loading ? '数据加载中…' : loadErr ? `加载失败：${loadErr}` : `内置 ${items.length} 条 · ${cfg.sizeHint} · 已本地缓存，仅本次会话加载一次` }}
        <Loader2 v-if="loading" :size="13" class="spin inline" />
      </p>
    </div>

    <div v-if="ready" class="mt-2">
      <p class="hint mb-2">{{ query ? `匹配 ${results.length} 条` : `最近 ${results.length} 条（输入关键词过滤）` }}</p>
      <div class="list">
        <div v-for="(it, i) in results" :key="i" class="item" :class="{ open: expanded === i }">
          <div class="head" @click="expanded = expanded === i ? -1 : i">
            <b class="primary">{{ it[cfg.primary] }}</b>
            <!-- 空字段兜底显示占位（如 ECDICT 部分缩略语无英美音标），避免渲染成空白 -->
            <span v-for="s in cfg.subs" :key="s.key" class="sub">{{ it[s.key] || '—' }}</span>
          </div>
          <div v-if="expanded === i" class="detail">
            <p v-for="d in cfg.detailKeys ?? []" :key="d.key"><b>{{ d.label }}：</b><span class="pre">{{ fmtVal(it[d.key]) }}</span></p>
            <button class="btn btn-sm" @click="doCopy(fullText(it))"><Copy :size="13" /> 复制全文</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.grow { flex: 1; }
.hint { font-size: 12px; color: var(--muted); }
.inline { vertical-align: -2px; }
.list { display: flex; flex-direction: column; gap: 6px; max-height: 480px; overflow: auto; }
/* flex-shrink:0 必须保留：flex 子项带 overflow:hidden 时自动最小尺寸失效，
   缺失会让宽泛查询的大量结果被均分压扁成细线而非撑出滚动（REG-01） */
.item { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; flex-shrink: 0; }
.head { padding: 10px 14px; cursor: pointer; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.head:hover { background: var(--surface-2, rgba(127,127,127,.06)); }
.primary { font-size: 16px; color: var(--accent-text); }
.sub { font-size: 12px; color: var(--muted); }
.detail { padding: 4px 14px 12px; font-size: 13.5px; line-height: 1.8; border-top: 1px dashed var(--border); }
.detail p { margin: 6px 0; }
.pre { white-space: pre-line; }
</style>
