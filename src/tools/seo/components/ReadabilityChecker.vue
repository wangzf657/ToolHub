<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import { readability } from '@/lib/nlpEngine'
import { cnLevelLabel } from './readabilityReport'

const text = ref('')

// 防抖 200ms，避免长文逐键重算
const parsed = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (parsed.value = v), 200)
})

const result = computed(() => (parsed.value.trim() ? readability(parsed.value) : null))

/** rx2 等级口径重校准：中文按句均字数简化估分（标签逻辑在 ./readabilityReport，与测试同源） */
const levelLabel = computed(() => {
  const r = result.value
  if (!r) return ''
  return cnLevelLabel(r)
})

const scoreColor = computed(() => {
  const s = result.value?.score ?? 0
  return s > 60 ? '#34d399' : s >= 40 ? '#d97706' : '#ef4444'
})

// rx3 逐句列表：带原文偏移，长句分级标色（>25 黄、>40 红）
interface SentItem {
  s: string
  start: number
  end: number
  count: number
  grade: 'ok' | 'warn' | 'bad'
}
const sentCount = (s: string) => ((s.match(/[\u4e00-\u9fff]/g) ?? []).length + (s.match(/[a-zA-Z]+/g) ?? []).length)

const sentences = computed<SentItem[]>(() => {
  const src = parsed.value
  if (!src.trim()) return []
  const out: SentItem[] = []
  let seg = ''
  let segStart = 0
  const flush = () => {
    const s = seg.trim()
    if (s.length > 1) {
      const start = segStart + (seg.length - seg.trimStart().length)
      const count = sentCount(s)
      out.push({ s, start, end: start + s.length, count, grade: count > 40 ? 'bad' : count > 25 ? 'warn' : 'ok' })
    }
    seg = ''
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (!seg.trim()) segStart = i
    seg += ch
    const next = src[i + 1] ?? ''
    const boundary = /[。！？!?；;]/.test(ch) || (ch === '.' && /\s/.test(next) && /[A-Z\u4e00-\u9fff]/.test(next.trim()[0] ?? ''))
    if (boundary) flush()
  }
  flush()
  return out
})

const ta = ref<HTMLTextAreaElement | null>(null)
// 点击长句滚动定位：在输入框内选中对应片段，光标即句首
const locate = (it: SentItem) => {
  const el = ta.value
  if (!el) return
  el.focus()
  el.setSelectionRange(it.start, it.end)
}

const avgOf = (items: SentItem[]) => (items.length ? items.reduce((n, it) => n + it.count, 0) / items.length : 0)

// rx5 家族互链：原文带给字数统计
const handoffLink = computed(() => `/t/word-counter?text=${encodeURIComponent(text.value.slice(0, 50000))}`)
</script>

<template>
  <div>
    <textarea ref="ta" v-model="text" class="textarea mono" style="min-height: 150px" placeholder="粘贴要评估的文本…"></textarea>

    <template v-if="result">
      <!-- rx4 环形仪表：分数 0-100，绿/黄/红三级 -->
      <div class="dash mt-2">
        <svg viewBox="0 0 120 120" class="ring" role="img" :aria-label="`可读性 ${Math.round(result.score)} 分`">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="12" />
          <circle
            cx="60" cy="60" r="50" fill="none" :stroke="scoreColor" stroke-width="12" stroke-linecap="round"
            :stroke-dasharray="`${(result.score / 100) * 314} 314`" transform="rotate(-90 60 60)"
          />
          <text x="60" y="57" text-anchor="middle" class="ring-num">{{ Math.round(result.score) }}</text>
          <text x="60" y="76" text-anchor="middle" class="ring-sub">/ 100</text>
        </svg>
        <div class="dash-side">
          <div class="lvl" :style="{ color: scoreColor }">{{ levelLabel }}</div>
          <div class="stat">句子数 {{ result.sentences }} · 字词数 {{ result.words }} · 句均 {{ result.avgSentenceLen.toFixed(1) }} {{ result.mode === 'cn' ? '字/句' : '词/句' }}</div>
          <div class="stat">长句 {{ sentences.filter((s) => s.grade !== 'ok').length }} 句（&gt;25 字黄显，&gt;40 字红显）</div>
          <!-- rx2 口径常驻披露 -->
          <p class="caliber">
            口径：{{ result.mode === 'cn'
              ? '中文按句均字数简化估分——30 字/句以内每字扣 0.9 分，超出部分每字扣 0.45 分，不套用英文 Flesch 公式'
              : '英文按句均词长与平均词长综合罚分估分' }}。
          </p>
        </div>
      </div>

      <!-- rx3 逐句列表 -->
      <div v-if="sentences.length" class="sent-list mt-2">
        <button v-for="(it, i) in sentences" :key="i" class="sent" :class="`g-${it.grade}`" :title="it.grade === 'ok' ? '长度适中，点击定位原文' : '句子偏长，点击定位原文'" @click="locate(it)">
          <span class="sent-no">{{ i + 1 }}</span>
          <span class="sent-text">{{ it.s }}</span>
          <span class="sent-len">{{ it.count }} 字</span>
        </button>
      </div>
      <p class="hint mt-1">点击任一句子可在上方输入框定位到原文对应位置。</p>
    </template>
    <div v-else class="notice notice-info mt-2">粘贴文本后自动评分；句子按中文句读切分，长句标色提示拆分。</div>

    <div v-if="text.trim()" class="family mt-2">
      <router-link class="mini-link" :to="handoffLink"><ExternalLink :size="13" /> 看更细的字数统计 → 字数统计工具（原文自动带入）</router-link>
    </div>
  </div>
</template>

<style scoped>
.dash { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
.ring { width: 132px; height: 132px; flex: none; }
.ring-num { font-size: 30px; font-weight: 700; fill: var(--text-1); }
.ring-sub { font-size: 12px; fill: var(--text-3); }
.dash-side { min-width: 220px; flex: 1; }
.lvl { font-size: 19px; font-weight: 700; }
.stat { margin-top: 5px; font-size: 13px; color: var(--text-2); }
.caliber { margin: 8px 0 0; font-size: 12px; color: var(--text-3); }
.sent-list { display: grid; gap: 5px; }
.sent {
  display: flex;
  align-items: baseline;
  gap: 8px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 7px 10px;
  background: none;
  font: inherit;
  cursor: pointer;
}
.sent:hover { border-color: var(--accent); }
.sent-no { flex: none; font-size: 11px; color: var(--text-3); min-width: 20px; }
.sent-text { flex: 1; font-size: 13.5px; color: var(--text-1); }
.sent-len { flex: none; font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.g-warn { border-color: rgba(251, 191, 36, 0.55); background: rgba(251, 191, 36, 0.07); }
.g-bad { border-color: var(--err); background: rgba(248, 113, 113, 0.08); }
.g-bad .sent-len { color: var(--err); font-weight: 700; }
.family { display: flex; }
.mini-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--accent); }
.mini-link:hover { text-decoration: underline; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
