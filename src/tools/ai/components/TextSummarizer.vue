<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { rankSentences, selectSentences, type RankedSentence } from './summarizer'

const text = ref('')
const mode = ref<'count' | 'chars'>('count')
const count = ref(3)
const targetChars = ref(200)

// 防抖 200ms：长文逐键重算卡顿
const parsed = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (parsed.value = v), 200)
})

const selected = computed<RankedSentence[]>(() =>
  selectSentences(rankSentences(parsed.value), mode.value, Number(count.value) || 3, Number(targetChars.value) || 200),
)

const summary = computed(() => selected.value.map((r) => r.s).join(''))

// rx3 压缩比展示
const ratio = computed(() => {
  const x = parsed.value.replace(/\s+/g, '').length
  const y = summary.value.length
  if (!x || !y) return null
  return { x, y, z: Math.round((1 - y / x) * 100) }
})

const ta = ref<HTMLTextAreaElement | null>(null)
// rx4 定位原文：点选摘要句后在输入框内选中对应片段
const locate = (r: RankedSentence) => {
  const el = ta.value
  if (!el) return
  // 输入原文里匹配句子（忽略空白差异）：从句首字符向后扫描
  const src = text.value
  const head = r.s.slice(0, Math.min(12, r.s.length))
  const pos = src.indexOf(head)
  if (pos < 0) return
  el.focus()
  el.setSelectionRange(pos, pos + r.s.length)
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      <b>抽取式摘要（本地规则）</b>——只从原文挑选关键句、不改写原文；分句与打分全部在浏览器内完成。
    </div>

    <textarea ref="ta" v-model="text" class="textarea mono mt-2" style="min-height: 170px" placeholder="粘贴长文章、报告或段落…"></textarea>

    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'count' }" @click="mode = 'count'">按句数</button>
      <button class="chip" :class="{ active: mode === 'chars' }" @click="mode = 'chars'">按目标字数</button>
      <input v-if="mode === 'count'" v-model.number="count" type="number" min="1" max="20" class="input w-num" />
      <input v-else v-model.number="targetChars" type="number" min="50" step="50" class="input w-num" />
      <span v-if="mode === 'chars'" class="hint">摘要字数将落在目标值的约 75%~130% 区间</span>
    </div>

    <ResultBox v-if="summary" class="mt-2" :model-value="summary" title="摘要" :min-height="'120px'" />

    <div v-if="ratio" class="ratio mt-1">
      原文 {{ ratio.x }} 字 → 摘要 {{ ratio.y }} 字（压缩 {{ ratio.z }}%）
    </div>

    <!-- rx4 定位原文模式 -->
    <div v-if="selected.length" class="sent-grid mt-2">
      <button v-for="r in selected" :key="r.i" class="sent-chip" title="点击定位原文" @click="locate(r)">
        <span class="no">{{ r.i + 1 }}</span>{{ r.s }}
      </button>
    </div>
    <p v-if="selected.length" class="hint mt-1">点击任一摘要句可在上方原文中高亮定位。</p>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 8px; }
.row-wrap { flex-wrap: wrap; }
.w-num { width: 110px; }
.ratio { font-size: 13px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.sent-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
@media (max-width: 720px) { .sent-grid { grid-template-columns: 1fr; } }
.sent-chip {
  display: flex;
  gap: 8px;
  align-items: baseline;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 7px 10px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--text-1);
  cursor: pointer;
}
.sent-chip:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, transparent); }
.no { flex: none; font-size: 11px; color: var(--text-3); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
