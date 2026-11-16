<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Copy, Loader2, Volume2 } from 'lucide-vue-next'
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
  /** 语料边界披露（首屏 hint 下方一行） */
  emptyTip?: string
  /** 零结果兜底文案，{q} 会替换为当前关键词 */
  zeroTip?: string
  /** 详情内发音按钮（如英音/美音，speechSynthesis 朗读指定字段） */
  speak?: { key: string; label: string; lang: string }[]
  /** 收藏开关：传 localStorage key 片段即启用（条目星标 + 收藏区置顶 + 一键复制全部） */
  favKey?: string
  /** 空态快捷查询 chips（如垃圾分类「易错 Top」入口） */
  quickChips?: { label: string; value: string }[]
}

const MAX_SHOW = 80

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
  for (let i = 0; i < pool.length && out.length < MAX_SHOW; i++) {
    const it = pool[i]!
    if (props.cfg.searchKeys.some((k) => String(it[k] ?? '').toLowerCase().includes(q))) out.push(it)
  }
  return out
})

/** 命中截断披露：达到上限时如实说明，避免用户误以为只有这些 */
const truncated = computed(() => query.value.trim() !== '' && results.value.length >= MAX_SHOW)

/** 零结果兜底（如垃圾分类给出投放原则建议；诗词声明语料边界） */
const zeroTip = computed(() => {
  if (!query.value.trim() || results.value.length > 0 || !props.cfg.zeroTip) return ''
  return props.cfg.zeroTip.replace('{q}', query.value.trim())
})

/* ---------- 详情发音：speechSynthesis 按语种朗读，先 cancel 防叠音 ---------- */
const speakUnsupported = typeof window !== 'undefined' && !('speechSynthesis' in window)
const speakTip = ref('')
const doSpeak = (word: string, lang: string) => {
  if (speakUnsupported) {
    speakTip.value = '当前浏览器不支持语音朗读，请使用 Chrome / Edge'
    return
  }
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(word)
    u.lang = lang
    u.rate = 0.9
    window.speechSynthesis.speak(u)
  } catch {
    speakTip.value = '语音朗读启动失败，请重试'
  }
}

/* ---------- 收藏与查询历史（按 dataset 隔离） ---------- */
const favList = ref<string[]>([])
const histList = ref<string[]>([])
const loadFavState = () => {
  if (!props.cfg.favKey) return
  try {
    favList.value = JSON.parse(localStorage.getItem(`toolhub.favs.${props.cfg.favKey}`) || '[]') as string[]
  } catch {
    favList.value = []
  }
  try {
    histList.value = JSON.parse(localStorage.getItem(`toolhub.lookup-history.${props.cfg.favKey}`) || '[]') as string[]
  } catch {
    histList.value = []
  }
}
loadFavState()
watch(() => props.cfg.favKey, loadFavState)

const isFav = (it: Record<string, string>) => favList.value.includes(String(it[props.cfg.primary] ?? ''))
const toggleFav = (it: Record<string, string>) => {
  const key = String(it[props.cfg.primary] ?? '')
  if (!key) return
  favList.value = favList.value.includes(key) ? favList.value.filter((x) => x !== key) : [key, ...favList.value]
  try {
    localStorage.setItem(`toolhub.favs.${props.cfg.favKey}`, JSON.stringify(favList.value))
  } catch {
    /* 忽略 */
  }
  toast.ok(favList.value.includes(key) ? `已收藏「${key}」` : `已取消收藏「${key}」`)
}
const copyFavs = async () => {
  const favItems = items.value.filter((it) => favList.value.includes(String(it[props.cfg.primary] ?? '')))
  const text = favItems.map((it) => fullText(it)).join('\n\n')
  const ok = await copyText(text)
  ok ? toast.ok(`已复制全部 ${favItems.length} 条收藏`) : toast.err('复制失败')
}

watch(query, (q) => {
  const t = q.trim()
  if (!t || !props.cfg.favKey) return
  histList.value = [t, ...histList.value.filter((x) => x !== t)].slice(0, 10)
  try {
    localStorage.setItem(`toolhub.lookup-history.${props.cfg.favKey}`, JSON.stringify(histList.value))
  } catch {
    /* 忽略 */
  }
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
      <p v-if="cfg.emptyTip && ready" class="hint mt-1">{{ cfg.emptyTip }}</p>
      <div v-if="histList.length" class="row row-wrap mt-1" style="gap: 6px; align-items: center">
        <span class="hint">最近查询：</span>
        <button v-for="h in histList" :key="h" class="chip" @click="query = h">{{ h }}</button>
      </div>
      <div v-if="!query && cfg.quickChips?.length" class="row row-wrap mt-1" style="gap: 6px; align-items: center">
        <span class="hint">热门查询：</span>
        <button v-for="c in cfg.quickChips" :key="c.value" class="chip" @click="query = c.value">{{ c.label }}</button>
      </div>
      <div v-if="favList.length" class="row row-wrap mt-1" style="gap: 8px; align-items: center">
        <span class="hint">★ 已收藏 {{ favList.length }} 条</span>
        <button class="btn btn-ghost btn-sm" @click="query = ''">查看全部</button>
        <button class="btn btn-ghost btn-sm" @click="copyFavs">一键复制全部收藏</button>
        <span class="hint">（收藏的条目在列表中带 ★ 标）</span>
      </div>
    </div>

    <div v-if="ready" class="mt-2">
      <p class="hint mb-2">
        {{ query ? `匹配 ${results.length} 条${truncated ? '（仅显示前 80 条，请精简关键词）' : ''}` : `最近 ${results.length} 条（输入关键词过滤）` }}
      </p>
      <div v-if="results.length" class="list">
        <div v-for="(it, i) in results" :key="i" class="item" :class="{ open: expanded === i }">
          <div class="head" @click="expanded = expanded === i ? -1 : i">
            <b class="primary">{{ isFav(it) ? '★ ' : '' }}{{ it[cfg.primary] }}</b>
            <!-- 空字段兜底显示占位（如 ECDICT 部分缩略语无英美音标），避免渲染成空白 -->
            <span v-for="s in cfg.subs" :key="s.key" class="sub">{{ it[s.key] || '—' }}</span>
            <button
              v-if="cfg.favKey" class="fav-btn" :title="isFav(it) ? '取消收藏' : '收藏'"
              @click.stop="toggleFav(it)"
            >{{ isFav(it) ? '★' : '☆' }}</button>
          </div>
          <div v-if="expanded === i" class="detail">
            <p v-for="d in cfg.detailKeys ?? []" :key="d.key"><b>{{ d.label }}：</b><span class="pre">{{ fmtVal(it[d.key]) }}</span></p>
            <div v-if="cfg.speak?.length" class="row row-wrap" style="gap: 8px">
              <button
                v-for="sp in cfg.speak" :key="sp.lang" class="btn btn-sm"
                :title="`朗读 ${it[sp.key] ?? ''}`" @click="doSpeak(String(it[sp.key] ?? ''), sp.lang)"
              >
                <Volume2 :size="14" /> {{ sp.label }}
              </button>
              <span v-if="speakTip" class="hint">{{ speakTip }}</span>
            </div>
            <button class="btn btn-sm" @click="doCopy(fullText(it))"><Copy :size="13" /> 复制全文</button>
          </div>
        </div>
      </div>
      <div v-else-if="zeroTip" class="zero-tip">{{ zeroTip }}</div>
      <div v-else-if="query" class="hint">未找到与「{{ query.trim() }}」匹配的条目，可尝试更短关键词。</div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.grow { flex: 1; }
.hint { font-size: 12px; color: var(--muted); }
.inline { vertical-align: -2px; }
.list { display: flex; flex-direction: column; gap: 6px; max-height: clamp(320px, calc(100dvh - 340px), 760px); overflow: auto; }
.zero-tip { padding: 12px 16px; border: 1px solid rgba(217, 119, 6, 0.3); background: rgba(217, 119, 6, 0.07); border-radius: 10px; font-size: 13.5px; color: var(--text-2); }
.fav-btn { margin-left: auto; border: none; background: none; cursor: pointer; font-size: 15px; color: var(--text-3); padding: 2px 6px; }
.fav-btn:hover { color: #f59e0b; }
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
