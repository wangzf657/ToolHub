<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Copy, Eraser } from 'lucide-vue-next'
import { textStats } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()

/* ---------- 输入：支持 ?text= 带参预填（seo / readability-checker 互链），统计 200ms 防抖 ---------- */
const text = ref('')
const qtext = route.query.text
if (typeof qtext === 'string' && qtext) text.value = qtext

const debounced = ref(text.value)
let dTimer: number | null = null
const onInput = () => {
  if (dTimer !== null) window.clearTimeout(dTimer)
  dTimer = window.setTimeout(() => {
    debounced.value = text.value
    dTimer = null
  }, 200)
}
const s = computed(() => textStats(debounced.value))

const tiles = computed(() => [
  { label: '总字数', value: s.value.words, hint: '汉字 + 英文单词' },
  { label: '字符数', value: s.value.chars, hint: '含空格与换行' },
  { label: '字符（不含空格）', value: s.value.charsNoSpaces, hint: '去除所有空白' },
  { label: '中文汉字', value: s.value.cjk, hint: '中日韩统一表意文字' },
  { label: '英文单词', value: s.value.englishWords, hint: '字母数字连续串' },
  { label: '行数', value: s.value.lines, hint: '按换行计' },
  { label: '句子数', value: s.value.sentences, hint: '按 。.!? 计' },
  { label: '段落数', value: s.value.paragraphs, hint: '按空行分隔' },
  { label: '预计阅读时长', value: s.value.readingMinutes, hint: '按 300 字/分钟' },
])

/* ---------- 高频词 Top10（≥50 字显示）：英文整词 + 中文二元组，剔除常见虚词 ---------- */
const STOP = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'])
const topWords = computed(() => {
  const t = debounced.value
  if (t.length < 50) return []
  const freq = new Map<string, number>()
  let total = 0
  for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    total++
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  const cjk = t.replace(/[^\u4e00-\u9fff]/g, '')
  for (let i = 0; i < cjk.length - 1; i++) {
    const bg = cjk.slice(i, i + 2)
    if (STOP.has(bg)) continue
    total++
    freq.set(bg, (freq.get(bg) ?? 0) + 1)
  }
  return [...freq.entries()]
    .filter(([w]) => w.length > 1 || /^[a-z]{2,}$/.test(w))
    .filter(([w]) => !STOP.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w, n]) => ({ w, n, pct: total ? ((n / total) * 100).toFixed(1) : '0' }))
})

/* ---------- 平台字数上限对标 ---------- */
const PLATFORMS = [
  { k: 'off', label: '不限', max: 0 },
  { k: 'weibo', label: '微博', max: 140 },
  { k: 'xhs', label: '小红书', max: 1000 },
  { k: 'x', label: 'X（推特）', max: 280 },
]
const platform = ref('off')
const plat = computed(() => PLATFORMS.find((p) => p.k === platform.value) ?? PLATFORMS[0])
const usedChars = computed(() => s.value.chars)

/* ---------- 复制统计 ---------- */
const copied = ref(false)
const copyStats = async () => {
  const lines = tiles.value.map((t) => `${t.label}：${t.value}`)
  const okFlag = await copyText(lines.join('\n'))
  if (okFlag) {
    copied.value = true
    toast.ok('统计结果已复制到剪贴板')
    setTimeout(() => (copied.value = false), 1500)
  } else toast.err('复制失败，请手动选择复制')
}

const clear = () => {
  text.value = ''
  debounced.value = ''
}
</script>

<template>
  <div>
    <div class="io-head">
      <span class="io-title">输入文本（实时统计）</span>
      <div class="row" style="gap: 8px">
        <button class="btn btn-ghost btn-sm" :disabled="!text" @click="copyStats">
          <Copy v-if="!copied" :size="14" /><span v-else style="color: var(--ok)">✓</span> 复制统计
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="!text" @click="clear"><Eraser :size="14" /> 清空</button>
      </div>
    </div>
    <textarea
      v-model="text" class="textarea mono mt-1 compact-input" placeholder="在此粘贴或输入要统计的文本…"
      @input="onInput"
    ></textarea>

    <div class="tiles mt-2">
      <div v-for="t in tiles" :key="t.label" class="tile">
        <span class="tile-num">{{ t.value }}</span>
        <span class="tile-label">{{ t.label }}</span>
        <span class="tile-hint">{{ t.hint }}</span>
      </div>
    </div>

    <div class="plat-row mt-2">
      <span class="io-title">字数上限对标</span>
      <button v-for="p in PLATFORMS" :key="p.k" class="chip" :class="{ active: platform === p.k }" @click="platform = p.k">
        {{ p.label }}
      </button>
      <span v-if="plat.max > 0" class="plat-count" :class="{ over: usedChars > plat.max }">
        {{ usedChars }} / {{ plat.max }} · 剩余 {{ Math.max(0, plat.max - usedChars) }}
        <template v-if="usedChars > plat.max">（已超出 {{ usedChars - plat.max }} 字）</template>
      </span>
    </div>

    <div v-if="topWords.length" class="mt-2">
      <div class="io-head"><span class="io-title">高频词 Top10</span></div>
      <table class="freq-table mt-1">
        <thead><tr><th>词</th><th>次数</th><th>占比</th></tr></thead>
        <tbody>
          <tr v-for="r in topWords" :key="r.w">
            <td class="mono">{{ r.w }}</td>
            <td class="mono">{{ r.n }}</td>
            <td class="mono">{{ r.pct }}%</td>
          </tr>
        </tbody>
      </table>
      <p class="muted small">中文按相邻两字组合近似统计（无分词词典），英文按完整单词计；占比为该词次数 / 全部词元数。</p>
    </div>
  </div>
</template>

<style scoped>
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.compact-input {
  height: 140px;
  min-height: 140px;
  resize: vertical;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 8px;
}
@media (max-width: 1100px) {
  .tiles { grid-template-columns: repeat(5, 1fr); }
}
@media (max-width: 900px) {
  .tiles { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 560px) {
  .tiles { grid-template-columns: repeat(2, 1fr); }
}
.tile {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 9px 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  text-align: center;
}
.tile-num {
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--accent-text);
  line-height: 1.1;
}
.tile-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}
.tile-hint {
  font-size: 11px;
  color: var(--text-3);
}
.plat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.plat-count {
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.plat-count.over {
  color: var(--err);
  font-weight: 700;
}
.freq-table {
  width: 100%;
  max-width: 460px;
  border-collapse: collapse;
  font-size: 13px;
}
.freq-table th,
.freq-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.freq-table th {
  color: var(--text-3);
  font-weight: 600;
}
</style>
