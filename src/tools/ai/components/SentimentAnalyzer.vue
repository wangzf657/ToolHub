<script setup lang="ts">
import { computed, ref } from 'vue'
import { splitSentences } from '@/lib/nlpEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const view = ref<'single' | 'batch'>('single')

/* ---------------- 本地词典（与 nlpEngine 同源；名词/形容词分组供方面弱化） ---------------- */
const ADJ_POS = new Set(
  ('好 很好 优秀 出色 完美 满意 喜欢 爱 棒 强 推荐 赞 值得 顺利 快 高兴 开心 惊喜 便宜 划算 清晰 流畅 稳定 安全 方便 简单 智能 好用 专业 耐心 热情 舒服 轻薄 还行 不错 极佳 超预期 好评 高效 精美 真香 干净 整洁 及时 周到 体贴 值 给力').split(/\s+/),
)
/** 方面名词：仅当同句无形容词类情感词时计 0.5 分（rx1 弱化） */
const ASPECT_NOUNS = new Set('续航 拍照 音质 性价比 售后 外观 电池 包装 物流 质量 做工 颜值 信号 散热'.split(/\s+/))
const ADJ_NEG = new Set(
  ('差 垃圾 不好 差劲 失望 后悔 坑 骗 假 冒 伪劣 卡顿 卡 慢 贵 难用 难受 难看 难听 丑 坏 破 漏水 发热 掉漆 褪色 色差 瑕疵 划痕 异味 噪音 投诉 退货 换货 维修 拖延 态度差 敷衍 骗局 虚假 缩水 阉割 翻车 崩溃 死机 断连 断货 缺货 骗人 服了 无语 离谱 扯皮 霸王条款 过敏 不推荐 别买 避雷 踩雷 踩坑 血亏 亏 惨 不值 一般般 凑合 勉强').split(/\s+/),
)
const INTENSIFIERS = new Set(['很', '非常', '特别', '超', '太', '极', '十分', '相当', '蛮', '挺', '更', '最', '真的', '实在'])

interface Hit {
  word: string
  kind: 'adj' | 'noun'
  base: number
  val: number
  negated: boolean
  boosted: boolean
  reason: string
}

/** 单句分析：返回命中明细与净分（rx1/rx2 核心逻辑） */
function analyzeSentence(s: string): { hits: Hit[]; score: number } {
  const chars = [...s]
  const hits: Hit[] = []
  const scan = (set: Set<string>, kind: Hit['kind'], base: number) => {
    for (let i = 0; i < chars.length; i++) {
      let matched = ''
      for (let len = 4; len >= 1; len--) {
        const w = chars.slice(i, i + len).join('')
        if (set.has(w)) {
          matched = w
          break
        }
      }
      if (!matched) continue
      const window = chars.slice(Math.max(0, i - 2), i).join('')
      const negated = /[不没无非别莫未]/.test(window)
      const boosted = !negated && [...window].some((c) => INTENSIFIERS.has(c))
      let val = base * (negated ? -1 : 1) * (boosted ? 1.5 : 1)
      hits.push({
        word: matched, kind, base, val, negated, boosted,
        reason: `命中「${matched}」${negated ? '；前 2 字含否定词 → 翻转' : ''}${boosted ? '；前 2 字含程度副词 → ×1.5' : ''}${kind === 'noun' ? '；方面名词权重 0.5' : ''}`,
      })
      i += matched.length - 1
    }
  }
  scan(ADJ_POS, 'adj', 1)
  scan(ADJ_NEG, 'adj', -1)
  // rx1：同句已有形容词类情感词时，方面名词不计分
  const hasAdj = hits.some((h) => h.kind === 'adj')
  if (!hasAdj) scan(ASPECT_NOUNS, 'noun', 0.5)
  const score = hits.reduce((n, h) => n + h.val, 0)
  return { hits, score }
}

function verdictOf(score: number) {
  const norm = Math.max(-1, Math.min(1, score / 6))
  const label = norm > 0.08 ? '正面' : norm < -0.08 ? '负面' : '中性'
  const strength = Math.abs(norm) < 0.08 ? '' : Math.abs(norm) <= 0.25 ? '弱倾向' : Math.abs(norm) <= 0.5 ? '中倾向' : '强倾向'
  return { norm, label, strength }
}

/* ---------------- 单文本模式 ---------------- */
const text = ref(`手机整体不错，屏幕清晰、续航给力，拍照效果超出预期。
但是售后太敷衍了，问题描述了很久也没解决，有点失望。`)

const sentences = computed(() => splitSentences(text.value))
const allHits = computed<Hit[]>(() => {
  const out: Hit[] = []
  for (const s of sentences.value) out.push(...analyzeSentence(s).hits)
  return out.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
})
const total = computed(() => {
  let score = 0
  for (const s of sentences.value) score += analyzeSentence(s).score
  return verdictOf(score)
})
const vClass = computed(() => (total.value.label === '正面' ? 'pos' : total.value.label === '负面' ? 'neg' : 'mid'))
const gaugePct = computed(() => ((total.value.norm + 1) / 2) * 100)
const sentenceRows = computed(() =>
  sentences.value.map((s, i) => {
    const r = analyzeSentence(s)
    return { idx: i + 1, text: s, ...verdictOf(r.score), score: r.score }
  }),
)

/* ---------------- 批量模式（rx3） ---------------- */
const batchText = ref('')
const batchRows = computed(() =>
  batchText.value
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const r = analyzeSentence(line)
      const v = verdictOf(r.score)
      return { no: i + 1, line, ...v, score: r.score, words: r.hits.map((h) => h.word).join('、') || '—' }
    }),
)
const downloadCsv = () => {
  if (!batchRows.value.length) {
    toast.warn('请先粘贴要批量分析的文本（每行一条）')
    return
  }
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = [
    '行号,倾向,强度,分数,命中词,原文',
    ...batchRows.value.map((r) => [r.no, r.label, r.strength || '中性', r.norm.toFixed(3), esc(r.words), esc(r.line)].join(',')),
  ]
  saveText('\ufeff' + rows.join('\n'), '情感批量分析.csv', 'text/csv;charset=utf-8')
  toast.ok('CSV 已开始下载')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      本地中文情感词典 + 规则模型即时分析，无需联网、文本不上传。方面名词（如「续航」）权重已弱化，仅同句无形容词情感词时计 0.5 分。
    </div>

    <div class="row row-wrap mt-2 mb-2">
      <button class="chip" :class="{ active: view === 'single' }" @click="view = 'single'">单文本</button>
      <button class="chip" :class="{ active: view === 'batch' }" @click="view = 'batch'">批量（每行一条）</button>
    </div>

    <!-- 单文本 -->
    <template v-if="view === 'single'">
      <textarea v-model="text" class="textarea" style="min-height: 130px" placeholder="粘贴要分析的评价、评论或文本…"></textarea>

      <div class="verdict mt-2" :class="vClass">
        <div class="v-left">
          <span class="v-label">整体倾向</span>
          <strong class="v-word" :class="vClass">{{ total.label }}</strong>
          <span v-if="total.strength" class="v-strength">{{ total.strength }}</span>
        </div>
        <div class="v-gauge">
          <div class="gauge-track">
            <span class="gauge-fill" :style="{ left: `${gaugePct}%` }"></span>
            <span class="gauge-mid"></span>
          </div>
          <div class="gauge-labels">
            <span>负面 −1</span><span>当前分数 {{ total.norm.toFixed(2) }}</span><span>正面 +1</span>
          </div>
          <!-- rx5 口径说明 -->
          <p class="caliber">分数 = 命中词加权和 ÷ 6（形容词 ±1、方面名词 ±0.5，否定翻转、程度副词 ×1.5）；倾向判定阈值 ±0.08；强度分档 |分数| 0.08–0.25 弱 / 0.25–0.5 中 / &gt;0.5 强。</p>
        </div>
      </div>

      <div v-if="allHits.length" class="words mt-2">
        <div v-for="g in ['pos', 'neg']" :key="g" class="word-group">
          <template v-if="allHits.some((h) => (g === 'pos' ? h.val > 0 : h.val < 0))">
            <span class="w-title" :class="g === 'pos' ? 'pos-text' : 'neg-text'">{{ g === 'pos' ? '正面' : '负面' }}（{{ allHits.filter((h) => (g === 'pos' ? h.val > 0 : h.val < 0)).length }}）</span>
            <span
              v-for="(h, i) in allHits.filter((h) => (g === 'pos' ? h.val > 0 : h.val < 0))"
              :key="`${g}-${i}`"
              class="chip"
              :class="[g, { flipped: h.negated }]"
              :title="h.reason"
            >{{ h.word }}<b v-if="h.negated" class="flip-mark">翻</b><b v-else-if="h.kind === 'noun'" class="noun-mark">名</b></span>
          </template>
        </div>
      </div>
      <div v-else class="notice notice-warn mt-2">未命中任何情感词，判断为中性。词典以中文口语评价词为主。</div>
      <p v-if="allHits.length" class="hint mt-1">悬停词条可看推理过程（命中词 / 否定翻转 / 程度加强）；「翻」= 被否定词翻转，「名」= 方面名词弱权重。</p>

      <div v-if="sentenceRows.length > 1" class="mt-2">
        <h4 class="sec-title">逐句分析（{{ sentenceRows.length }} 句）</h4>
        <table class="data-table">
          <thead><tr><th>#</th><th>句子</th><th>倾向</th><th>分数</th></tr></thead>
          <tbody>
            <tr v-for="r in sentenceRows" :key="r.idx">
              <td>{{ r.idx }}</td>
              <td class="sentence">{{ r.text }}</td>
              <td><span class="mini-tag" :class="r.label === '正面' ? 'pos' : r.label === '负面' ? 'neg' : 'mid'">{{ r.label }}{{ r.strength ? `·${r.strength.slice(0, 1)}` : '' }}</span></td>
              <td :class="r.score > 0 ? 'pos-text' : r.score < 0 ? 'neg-text' : ''">{{ r.norm.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 批量 -->
    <template v-else>
      <textarea v-model="batchText" class="textarea" style="min-height: 150px" placeholder="每行粘贴一条评价，自动逐行判定倾向…"></textarea>
      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="!batchRows.length" @click="downloadCsv">下载 CSV（{{ batchRows.length }} 行）</button>
      </div>
      <table v-if="batchRows.length" class="data-table mt-2">
        <thead><tr><th>行号</th><th>倾向</th><th>强度</th><th>分数</th><th>命中词</th><th>原文</th></tr></thead>
        <tbody>
          <tr v-for="r in batchRows" :key="r.no">
            <td>{{ r.no }}</td>
            <td><span class="mini-tag" :class="r.label === '正面' ? 'pos' : r.label === '负面' ? 'neg' : 'mid'">{{ r.label }}</span></td>
            <td>{{ r.strength || '—' }}</td>
            <td :class="r.score > 0 ? 'pos-text' : r.score < 0 ? 'neg-text' : ''">{{ r.norm.toFixed(2) }}</td>
            <td class="words-cell">{{ r.words }}</td>
            <td class="sentence">{{ r.line }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 10px; }
.row-wrap { flex-wrap: wrap; }
.caliber { margin: 8px 0 0; font-size: 11.5px; color: var(--text-3); line-height: 1.5; }
.v-strength { font-size: 13px; color: var(--text-3); }
.verdict { display: flex; gap: 24px; align-items: center; border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); flex-wrap: wrap; }
.v-left { display: grid; gap: 2px; }
.v-label { font-size: 12px; color: var(--text-3); }
.v-word { font-size: 34px; line-height: 1.1; }
.v-word.pos { color: var(--ok); }
.v-word.neg { color: var(--err); }
.v-word.mid { color: var(--text-2); }
.v-gauge { flex: 1; min-width: 240px; }
.gauge-track { position: relative; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #ef444455, #fbbf2455 50%, #34d39955); }
.gauge-fill { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; border-radius: 999px; background: var(--accent-text); border: 3px solid var(--panel-solid); box-shadow: 0 0 0 1px var(--border); }
.gauge-mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--text-3); opacity: 0.5; }
.gauge-labels { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-3); margin-top: 6px; }
.words { display: grid; gap: 8px; }
.word-group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.w-title { font-size: 12.5px; font-weight: 600; margin-right: 4px; }
.pos-text { color: var(--ok); }
.neg-text { color: var(--err); }
.chip.pos { border-color: rgba(52, 211, 153, 0.4); color: var(--ok); }
.chip.neg { border-color: rgba(239, 68, 68, 0.4); color: var(--err); }
.flip-mark, .noun-mark { font-size: 9.5px; margin-left: 3px; border-radius: 999px; padding: 0 4px; background: rgba(127, 127, 127, 0.18); }
.sec-title { margin: 0 0 8px; font-size: 14px; color: var(--text-2); }
.sentence { white-space: normal !important; max-width: none !important; }
.words-cell { white-space: normal !important; font-size: 12px; }
.mini-tag { font-size: 12px; padding: 1px 8px; border-radius: 999px; }
.mini-tag.pos { background: rgba(52, 211, 153, 0.14); color: var(--ok); }
.mini-tag.neg { background: rgba(239, 68, 68, 0.14); color: var(--err); }
.mini-tag.mid { background: var(--accent-soft); color: var(--text-3); }
.hint { font-size: 12px; color: var(--text-3); }
</style>
