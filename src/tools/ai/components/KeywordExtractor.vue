<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { splitSentences } from '@/lib/nlpEngine'
import { useToast } from '@/composables/useToast'
import { topKeywords, type Kw } from './keywordExtractor'

const toast = useToast()

const text = ref('')
const n = ref(10)
const autoRun = ref(true) // rx2 粘贴即提取（默认开）

// rx2 自动执行：300ms 防抖（开关关闭时用按钮手动提取）
const parsed = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (v) => {
  if (!autoRun.value) return
  clearTimeout(timer)
  timer = setTimeout(() => (parsed.value = v), 300)
})
const runNow = () => (parsed.value = text.value)

// 纯逻辑在 ./keywordExtractor（可测性提取，与测试同源）：TF-IDF 打分 + 包含/公共子串去重
const keywords = computed<Kw[]>(() => topKeywords(parsed.value, Number(n.value) || 10))

const maxScore = computed(() => keywords.value[0]?.score ?? 1)

// rx4 出处回跳：每个关键词展开显示 1 条出处句并高亮该词
const expanded = ref<string>('')
const toggleSrc = (word: string) => (expanded.value = expanded.value === word ? '' : word)
const sourceOf = (word: string) => splitSentences(parsed.value).find((s) => s.toLowerCase().includes(word)) ?? ''
/** 把出处句拆成 前/词/后 三段用于高亮 */
const srcParts = (word: string) => {
  const s = sourceOf(word)
  const idx = s.toLowerCase().indexOf(word)
  if (idx < 0) return { before: s, hit: '', after: '' }
  return { before: s.slice(0, idx), hit: s.slice(idx, idx + word.length), after: s.slice(idx + word.length) }
}

const copyList = async () => {
  if (!keywords.value.length) return
  const t = keywords.value.map((k, i) => `${i + 1}. ${k.word}（权重 ${k.score.toFixed(2)}）`).join('\n')
  const { copyText } = await import('@/lib/download')
  if (await copyText(t)) toast.ok('关键词清单已复制')
  else toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      <b>本地 TF-IDF 统计法（非大模型）</b>——按词频与句间分布计算权重，即时可用、完全离线。
    </div>

    <textarea v-model="text" class="textarea mono mt-2" style="min-height: 150px" placeholder="粘贴文本…"></textarea>

    <div class="row row-wrap mt-2">
      <label class="check"><input v-model="autoRun" type="checkbox" /> 粘贴即提取（0.3 秒自动）</label>
      <span class="opt-label">数量</span>
      <input v-model.number="n" type="number" min="1" max="30" class="input w-num" />
      <button v-if="!autoRun" class="btn btn-primary btn-sm" @click="runNow">提取关键词</button>
      <button class="btn btn-ghost btn-sm" @click="copyList">复制清单</button>
    </div>

    <!-- rx1 权重可视化卡片网格 -->
    <div v-if="keywords.length" class="kw-grid mt-2">
      <div v-for="(k, i) in keywords" :key="k.word" class="kw-card" :class="{ open: expanded === k.word }" @click="toggleSrc(k.word)">
        <div class="kw-head">
          <span class="kw-no">{{ i + 1 }}</span>
          <span class="kw-word">{{ k.word }}</span>
          <span class="kw-score">{{ k.score.toFixed(2) }}</span>
        </div>
        <div class="kw-bar-track"><div class="kw-bar" :style="{ width: `${Math.max(3, (k.score / maxScore) * 100)}%` }"></div></div>
        <div v-if="expanded === k.word" class="kw-src">
          <template v-if="sourceOf(k.word)">
            {{ srcParts(k.word).before }}<mark class="kw-hit">{{ srcParts(k.word).hit }}</mark>{{ srcParts(k.word).after }}
          </template>
          <span v-else class="kw-none">（未在原句中找到出处）</span>
        </div>
      </div>
    </div>
    <div v-else-if="parsed.trim()" class="notice notice-warn mt-2">未提取到关键词，试试更长或重复主题的文本。</div>
    <p v-if="keywords.length" class="hint mt-1">点击卡片展开该词的一条出处原句（高亮命中位置）。</p>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 10px; }
.row-wrap { flex-wrap: wrap; }
.check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.opt-label { font-size: 13px; color: var(--text-3); }
.w-num { width: 90px; }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.kw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
.kw-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 11px;
  cursor: pointer;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.kw-card:hover, .kw-card.open { border-color: var(--accent); }
.kw-head { display: flex; align-items: baseline; gap: 8px; }
.kw-no { font-size: 11px; color: var(--text-3); flex: none; }
.kw-word { font-weight: 600; color: var(--text-1); font-size: 14px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kw-score { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; flex: none; }
.kw-bar-track { margin-top: 6px; height: 7px; border-radius: 999px; background: color-mix(in srgb, var(--text-3) 18%, transparent); overflow: hidden; }
.kw-bar { height: 100%; border-radius: 999px; background: var(--accent); }
.kw-src { margin-top: 7px; font-size: 12px; color: var(--text-2); line-height: 1.5; max-height: 90px; overflow: auto; }
.kw-hit { background: rgba(251, 191, 36, 0.45); color: inherit; border-radius: 3px; padding: 0 2px; }
.kw-none { color: var(--text-3); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
