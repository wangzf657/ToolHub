<script setup lang="ts">
import { ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const recent = ref<string[]>(JSON.parse(localStorage.getItem('toolhub-symbols') ?? '[]') as string[])

const GROUPS: { name: string; items: string[] }[] = [
  { name: '常用箭头', items: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇒', '➔', '➜', '➤', '⤴', '⤵', '↵', '⇋', '⇄', '↺', '↻', '⇈', '⇊'] },
  { name: '数学符号', items: ['＋', '－', '×', '÷', '±', '√', '≈', '≠', '≡', '≤', '≥', '∞', '∑', '∏', '∫', '∂', '∇', '∈', '∉', '⊂', '⊃', '∪', '∩', '∅', '∴', '∵', '‰', '‱', '°', '℃', '℉', '∠', '⊥', '∥', 'π', 'μ', 'Ω', 'α', 'β', 'γ', 'θ', 'λ', 'Δ', 'Σ', 'Φ', 'δ'] },
  { name: '几何与形状', items: ['▲', '△', '▼', '▽', '◆', '◇', '■', '□', '●', '○', '◉', '◎', '★', '☆', '✦', '✧', '⬟', '⬢', '⬡', '⬣'] },
  { name: '星号与装饰', items: ['✦', '✧', '✩', '✪', '✫', '✬', '✭', '✮', '✯', '❋', '❊', '❉', '❈', '❇', '❆', '✺', '❁', '❀', '✿', '❃', '❂', '✱', '✲', '✳', '✴', '✵'] },
  { name: '勾选与打叉', items: ['✓', '✔', '☑', '✅', '✗', '✘', '☒', '❌', 'ⓘ', '❗', '❓', '⚠', '★'] },
  { name: '序号编号', items: ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑴', '⑵', '⑶', '⒈', '⒉', '⒊', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', '⓵', '⓶', '⓷', '❶', '❷', '❸', '🄰', '🄱'] },
  { name: '单位与货币', items: ['¥', '￥', '€', '£', '₩', '₽', '₹', '§', '¶', '†', '‡', '©', '®', '™', '℗', '№', 'º', 'ª', '㎜', '㎝', '㎡', '㎏', '㏄'] },
  { name: '括号书名', items: ['「」', '『』', '【】', '〖〗', '〔〕', '《》', '〈〉', '（）', '［］', '｛｝', '＂', '＇', '„', '‹›', '«»'] },
  { name: '标点分隔', items: ['·', '…', '—', '–', '·', '‥', '∴', '⸺', '＿', '‿', '⁀', '︴', '︵', '︶', '｜', '‖', '¦'] },
  { name: '牌与方块', items: ['♠', '♣', '♥', '♦', '♤', '♧', '♡', '♢', '♩', '♪', '♫', '♬', '♭', '♮', '♯'] },
  { name: '线框花边', items: ['─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼', '═', '║', '╔', '╗', '╚', '╝', '△', '▽', '✃', '✄', '⌘', '⌥', '⇧', '⌫'] },
]

const query = ref('')

const filtered = () => {
  const q = query.value.trim()
  if (!q) return GROUPS
  return GROUPS.map((g) => ({ name: g.name, items: g.items.filter((i) => i.includes(q)) })).filter((g) => g.items.length)
}

const pick = async (s: string) => {
  const ok = await copyText(s)
  if (ok) {
    toast.ok(`已复制 ${s}`)
    recent.value = [s, ...recent.value.filter((x) => x !== s)].slice(0, 14)
    localStorage.setItem('toolhub-symbols', JSON.stringify(recent.value))
  } else toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row gap">
        <Search :size="15" />
        <input v-model="query" class="input grow" placeholder="搜索符号（如 箭头？输入 →；按名称搜索分组）" />
      </div>
      <div v-if="recent.length" class="mt-2">
        <span class="field-label">最近使用</span>
        <div class="chips mt-1">
          <button v-for="s in recent" :key="s" class="sym-btn recent" @click="pick(s)">{{ s }}</button>
        </div>
      </div>
    </div>

    <div v-for="g in filtered()" :key="g.name" class="mt-2">
      <h4 class="h4">{{ g.name }}</h4>
      <div class="chips">
        <button v-for="(s, i) in g.items" :key="`${s}-${i}`" class="sym-btn" @click="pick(s)">{{ s }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 8px; align-items: center; }
.grow { flex: 1; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.sym-btn { min-width: 40px; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 16px; color: var(--text); }
.sym-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
.sym-btn.recent { font-size: 18px; }
.h4 { margin: 10px 0 8px; font-size: 13px; color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); }
</style>
