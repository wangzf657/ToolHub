<script setup lang="ts">
import { computed, ref } from 'vue'
import { Regex } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const pattern = ref('\\d+')
const flags = ref({ g: true, i: false, m: false, s: false, u: false })
const text = ref('订单 A1001，金额 239 元；订单 B2002，金额 99 元。')

const flagStr = computed(() => Object.entries(flags.value).filter(([, v]) => v).map(([k]) => k).join(''))

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const state = computed(() => {
  if (!pattern.value) return { ok: false as const, error: '', html: escapeHtml(text.value), matches: [], groups: [] as string[][] }
  try {
    const re = new RegExp(pattern.value, flagStr.value)
    const matches: { index: number; value: string; groups: string[] }[] = []
    if (re.global) {
      for (const m of text.value.matchAll(re)) {
        matches.push({ index: m.index ?? 0, value: m[0], groups: m.slice(1).map((g) => g ?? '（空）') })
        if (matches.length >= 500) break
      }
    } else {
      const m = re.exec(text.value)
      if (m) matches.push({ index: m.index, value: m[0], groups: m.slice(1).map((g) => g ?? '（空）') })
    }
    // 构建高亮 HTML
    let html = ''
    let pos = 0
    for (const mt of matches) {
      html += escapeHtml(text.value.slice(pos, mt.index))
      html += `<mark>${escapeHtml(mt.value)}</mark>`
      pos = mt.index + mt.value.length
      if (mt.value.length === 0) {
        // 零宽匹配：该字符不参与高亮，避免覆盖偏移错乱
        html += escapeHtml(text.value[mt.index] ?? '')
        pos = mt.index + 1
      }
    }
    html += escapeHtml(text.value.slice(pos))
    return { ok: true as const, error: '', html, matches, groups: matches.map((m) => m.groups) }
  } catch (e) {
    return { ok: false as const, error: (e as Error).message, html: escapeHtml(text.value), matches: [], groups: [] as string[][] }
  }
})

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
</script>

<template>
  <div class="re-tester">
    <span class="field-label">正则表达式</span>
    <div class="row" style="gap: 8px">
      <span class="slash mono">/</span>
      <input v-model="pattern" type="text" class="input mono grow" spellcheck="false" />
      <span class="slash mono">/</span>
      <code class="flagstr mono">{{ flagStr || '（无标志）' }}</code>
    </div>

    <p class="muted small" style="margin: 2px 0 0">
      想看这条正则的结构图？去 <RouterLink to="/t/regex-visualizer">正则可视化</RouterLink> 粘贴同一表达式生成铁路图。
    </p>

    <div class="row mt-1" style="gap: 14px">
      <label v-for="(v, k) in flags" :key="k" class="check">
        <input v-model="flags[k]" type="checkbox" />
        <span class="mono">{{ k }}</span>
      </label>
      <span class="muted small">g 全局 · i 忽略大小写 · m 多行 · s 点匹配换行 · u Unicode</span>
    </div>

    <div class="mt-3">
      <span class="field-label">测试文本</span>
      <textarea v-model="text" class="textarea mono" style="min-height: 120px"></textarea>
    </div>

    <div class="mt-2">
      <span class="field-label">实时匹配高亮</span>
      <div class="hl mono" v-html="state.html"></div>
    </div>

    <div v-if="!state.ok" class="notice notice-err mt-2">正则有误：{{ state.error }}</div>
    <div v-else class="notice mt-2" :class="state.matches.length ? 'notice-ok' : 'notice-info'">
      共匹配 <b>{{ state.matches.length }}</b> 处
      <template v-if="state.groups.some((g) => g.length)">，第一个匹配的捕获组：{{ state.groups[0]!.map((g, i) => `$${i + 1}=${g}`).join('，') }}</template>
    </div>

    <div v-if="state.matches.length" class="mt-2 match-table">
      <div v-for="(m, i) in state.matches.slice(0, 20)" :key="i" class="match-row mono">
        <span class="idx">#{{ i + 1 }}</span>
        <span class="val">{{ m.value }}</span>
        <span class="pos">位置 {{ m.index }}</span>
      </div>
      <p v-if="state.matches.length > 20" class="muted small mt-1">仅显示前 20 条…</p>
    </div>

    <div class="mt-3">
      <span class="field-label">常用正则速查（点击填入）</span>
      <div class="row row-wrap" style="gap: 8px">
        <button v-for="s in SNIPPETS" :key="s.label" class="chip" @click="applySnippet(s.re)">
          <Regex :size="13" style="vertical-align: -2px; margin-right: 4px" />{{ s.label }}
        </button>
      </div>
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
.hl {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  padding: 12px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 220px;
  overflow: auto;
}
.hl :deep(mark) {
  background: rgba(251, 191, 36, 0.35);
  color: inherit;
  border-radius: 3px;
  padding: 0 2px;
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
