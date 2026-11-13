<script setup lang="ts">
/** 正则测试器：匹配高亮 / 替换预演 / 匹配列表行:列回跳 / 预设前置 / 报错人话化。
 *  与 regex-visualizer 互链：读 query.re / query.fl 回显表达式。 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Regex, FlaskConical } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { humanizeRegexError } from './regexExplain'

const toast = useToast()
const route = useRoute()
const pattern = ref('\\d+')
const flags = ref({ g: true, i: false, m: false, s: false, u: false })
const text = ref('订单 A1001，金额 239 元；订单 B2002，金额 99 元。')
const tab = ref<'match' | 'replace'>('match')
const replaceWith = ref('')
/** 双区扩展：测试文本与高亮区加大（看长日志用） */
const expanded = ref(false)

const flagStr = computed(() => Object.entries(flags.value).filter(([, v]) => v).map(([k]) => k).join(''))

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 行:列（1 基） */
const lineCol = (idx: number) => {
  const before = text.value.slice(0, idx)
  const line = before.split('\n').length
  const col = idx - before.lastIndexOf('\n')
  return { line, col }
}

const state = computed(() => {
  if (!pattern.value) return { ok: false as const, error: '', html: escapeHtml(text.value), matches: [] as MatchInfo[], repHtml: '', repCount: 0 }
  try {
    const re = new RegExp(pattern.value, flagStr.value)
    const matches: MatchInfo[] = []
    if (re.global) {
      for (const m of text.value.matchAll(re)) {
        matches.push({ index: m.index ?? 0, value: m[0], groups: m.slice(1).map((g) => g ?? '（空）'), ...lineCol(m.index ?? 0) })
        if (matches.length >= 500) break
      }
    } else {
      const m = re.exec(text.value)
      if (m) matches.push({ index: m.index, value: m[0], groups: m.slice(1).map((g) => g ?? '（空）'), ...lineCol(m.index) })
    }
    // 高亮 HTML（mark 带 data-mi，供列表点击回跳）
    let html = ''
    let pos = 0
    for (let i = 0; i < matches.length; i++) {
      const mt = matches[i]
      html += escapeHtml(text.value.slice(pos, mt.index))
      html += `<mark data-mi="${i}">${escapeHtml(mt.value)}</mark>`
      pos = mt.index + mt.value.length
      if (mt.value.length === 0) {
        // 零宽匹配：该字符不参与高亮，避免覆盖偏移错乱
        html += escapeHtml(text.value[mt.index] ?? '')
        pos = mt.index + 1
      }
    }
    html += escapeHtml(text.value.slice(pos))
    // 替换预演：命中片段替换为 replaceWith 并高亮
    let repHtml = ''
    let rpos = 0
    for (const mt of matches) {
      repHtml += escapeHtml(text.value.slice(rpos, mt.index))
      repHtml += `<ins>${escapeHtml(replaceWith.value)}</ins>`
      rpos = mt.index + mt.value.length
    }
    repHtml += escapeHtml(text.value.slice(rpos))
    return { ok: true as const, error: '', html, matches, repHtml, repCount: matches.length }
  } catch (e) {
    const raw = (e as Error).message
    return { ok: false as const, error: humanizeRegexError(raw) || raw, html: escapeHtml(text.value), matches: [] as MatchInfo[], repHtml: escapeHtml(text.value), repCount: 0 }
  }
})

interface MatchInfo {
  index: number
  value: string
  groups: string[]
  line: number
  col: number
}

/** 匹配列表点击回跳：高亮区滚动到对应 mark 并闪烁 */
const jumpTo = (i: number) => {
  if (i < 0) return
  const el = document.querySelector(`.hl mark[data-mi="${i}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('flash')
  window.setTimeout(() => el.classList.remove('flash'), 1200)
}

const SNIPPETS: { label: string; re: string }[] = [
  { label: '邮箱', re: '[\\w.+-]+@[\\w-]+\\.[\\w.]+' },
  { label: 'URL', re: "https?://[^\\s<>\"']+" },
  { label: '手机号', re: '1[3-9]\\d{9}' },
  { label: 'IPv4', re: '(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)' },
  { label: '日期', re: '\\d{4}[-/]\\d{2}[-/]\\d{2}' },
  { label: '十六进制颜色', re: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b' },
]

const applySnippet = (re: string) => {
  pattern.value = re
  if (!flags.value.g) flags.value.g = true
  toast.ok(`已填入「${SNIPPETS.find((s) => s.re === re)?.label}」示例正则`)
}

/* ---------- 互链：regex-visualizer「去测试」带过来的表达式回显 ---------- */
onMounted(() => {
  const re = route.query.re
  if (typeof re === 'string' && re) {
    pattern.value = re
    toast.ok('已从正则可视化带入表达式')
  }
  const fl = route.query.fl
  if (typeof fl === 'string') {
    for (const k of Object.keys(flags.value)) (flags.value as Record<string, boolean>)[k] = fl.includes(k)
  }
})
</script>

<template>
  <div class="re-tester">
    <div class="row row-wrap" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0">正则表达式</span>
      <RouterLink class="btn btn-ghost btn-sm" :to="{ path: '/t/regex-visualizer', query: { re: pattern, fl: flagStr } }">
        <FlaskConical :size="13" /> 去可视化
      </RouterLink>
    </div>
    <div class="row" style="gap: 8px">
      <span class="slash mono">/</span>
      <input v-model="pattern" type="text" class="input mono grow" spellcheck="false" />
      <span class="slash mono">/</span>
      <code class="flagstr mono">{{ flagStr || '（无标志）' }}</code>
    </div>

    <div class="row mt-1" style="gap: 14px">
      <label v-for="(v, k) in flags" :key="k" class="check">
        <input v-model="flags[k]" type="checkbox" />
        <span class="mono">{{ k }}</span>
      </label>
      <span class="muted small">g 全局 · i 忽略大小写 · m 多行 · s 点匹配换行 · u Unicode</span>
    </div>

    <!-- 预设前置：速查 chips 紧跟 flags 行、测试文本之前 -->
    <div class="mt-3">
      <span class="field-label">常用正则速查（点击填入）</span>
      <div class="row row-wrap" style="gap: 8px">
        <button v-for="s in SNIPPETS" :key="s.label" class="chip" @click="applySnippet(s.re)">
          <Regex :size="13" style="vertical-align: -2px; margin-right: 4px" />{{ s.label }}
        </button>
      </div>
    </div>

    <div class="mt-3">
      <div class="row" style="justify-content: space-between; align-items: center">
        <span class="field-label">测试文本</span>
        <label class="check small"><input v-model="expanded" type="checkbox" /> 扩展区域（看长文本）</label>
      </div>
      <textarea v-model="text" class="textarea mono" :class="{ tall: expanded }"></textarea>
    </div>

    <div class="mt-2">
      <div class="row row-wrap" style="gap: 6px; align-items: center">
        <button class="chip tab-chip" :class="{ on: tab === 'match' }" @click="tab = 'match'">匹配</button>
        <button class="chip tab-chip" :class="{ on: tab === 'replace' }" @click="tab = 'replace'">替换</button>
        <template v-if="tab === 'replace'">
          <input v-model="replaceWith" type="text" class="input mono" style="min-width: 180px" placeholder="替换为（$1 引用捕获组）" />
          <span class="muted small">预演：{{ state.repCount }} 处将被替换（不会改原文本）</span>
        </template>
        <template v-else>
          <button class="btn btn-ghost btn-sm" :disabled="!state.matches.length" @click="jumpTo(0)">跳到第一处</button>
        </template>
      </div>
      <div v-if="tab === 'match'" class="hl mono mt-1" :class="{ tall: expanded }" v-html="state.html" @click="jumpTo(Number(($event.target as HTMLElement)?.closest?.('mark')?.getAttribute('data-mi') ?? -1))"></div>
      <div v-else class="hl mono mt-1" :class="{ tall: expanded }" v-html="state.repHtml"></div>
      <p v-if="tab === 'replace'" class="muted small mt-1" style="margin: 4px 0 0">黄色高亮 = 命中并被替换的片段；点击「匹配」页签可回看原文。</p>
    </div>

    <div v-if="!state.ok" class="notice notice-err mt-2">正则有误：{{ state.error }}</div>
    <div v-else class="notice mt-2" :class="state.matches.length ? 'notice-ok' : 'notice-info'">
      共匹配 <b>{{ state.matches.length }}</b> 处
      <template v-if="state.matches.some((m) => m.groups.length)">，第一个匹配的捕获组：{{ state.matches[0]!.groups.map((g, i) => `$${i + 1}=${g}`).join('，') }}</template>
    </div>

    <div v-if="state.matches.length && tab === 'match'" class="mt-2 match-table">
      <button v-for="(m, i) in state.matches.slice(0, 20)" :key="i" class="match-row mono" title="点击在高亮区定位该匹配" @click="jumpTo(i)">
        <span class="idx">#{{ i + 1 }}</span>
        <span class="val">{{ m.value }}</span>
        <span class="pos">行 {{ m.line }} 列 {{ m.col }}</span>
      </button>
      <p v-if="state.matches.length > 20" class="muted small mt-1">仅显示前 20 条…</p>
    </div>
  </div>
</template>

<style scoped>
.slash {
  font-size: 16px;
  color: var(--text-3);
  user-select: none;
}
.flagstr {
  font-size: 12.5px;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 6px;
  padding: 2px 8px;
  flex: none;
}
/* 双区弹性高度：默认视口口径，可勾选扩展 */
.textarea.tall,
.hl.tall {
  height: max(420px, calc(100vh - 420px));
  max-height: none;
}
.textarea {
  height: min(280px, max(160px, calc(100vh - 480px)));
}
.hl {
  height: min(280px, max(160px, calc(100vh - 480px)));
  overflow: auto;
}
.hl :deep(mark) {
  background: rgba(251, 191, 36, 0.35);
  color: inherit;
  border-radius: 3px;
  padding: 0 2px;
}
.hl :deep(mark.flash) {
  animation: flash-hit 0.35s ease 3;
}
@keyframes flash-hit {
  0%, 100% { background: rgba(251, 191, 36, 0.35); }
  50% { background: rgba(251, 146, 60, 0.85); }
}
.hl :deep(ins) {
  background: rgba(251, 191, 36, 0.4);
  color: inherit;
  text-decoration: none;
  border-radius: 3px;
  padding: 0 2px;
}
.tab-chip.on {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
}
.match-table {
  display: grid;
  gap: 5px;
}
.match-row {
  display: flex;
  gap: 10px;
  font-size: 12.5px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.match-row:hover {
  border-color: var(--accent);
}
.match-row .idx {
  color: var(--text-3);
  flex: none;
}
.match-row .val {
  color: var(--text);
  flex: 1;
  overflow-wrap: anywhere;
}
.match-row .pos {
  color: var(--text-3);
  flex: none;
}
</style>
