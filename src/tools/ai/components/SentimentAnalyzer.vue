<script setup lang="ts">
import { computed, ref } from 'vue'
import { sentiment, splitSentences, type SentimentResult } from '@/lib/nlpEngine'

const text = ref(`手机整体不错，屏幕清晰、续航给力，拍照效果超出预期。
但是售后太敷衍了，问题描述了很久也没解决，有点失望。`)

const result = computed<SentimentResult>(() => sentiment(text.value))

const labelClass = computed(() =>
  result.value.label === '正面' ? 'pos' : result.value.label === '负面' ? 'neg' : 'mid',
)

/** 仪表条位置：-1..1 → 0..100% */
const gaugePct = computed(() => ((result.value.score + 1) / 2) * 100)

/** 多句模式：逐句评分 */
const sentenceRows = computed(() =>
  splitSentences(text.value)
    .map((s, i) => ({ idx: i + 1, text: s, ...sentiment(s) })),
)

const SAMPLE_HINT = '试试输入一条商品评价，例如「物流很快，包装精美，非常满意」'
</script>

<template>
  <div>
    <div class="notice notice-info">
      本地中文情感词典 + 规则模型即时分析，无需联网、文本不上传。{{ SAMPLE_HINT }}
    </div>

    <textarea v-model="text" class="textarea mt-2" style="min-height: 130px" placeholder="粘贴要分析的评价、评论或文本…"></textarea>

    <!-- 总体结果 -->
    <div class="verdict" :class="labelClass">
      <div class="v-left">
        <span class="v-label">整体倾向</span>
        <strong class="v-word" :class="labelClass">{{ result.label }}</strong>
      </div>
      <div class="v-gauge">
        <div class="gauge-track">
          <span class="gauge-fill" :style="{ left: `${gaugePct}%` }"></span>
          <span class="gauge-mid"></span>
        </div>
        <div class="gauge-labels">
          <span>负面 −1</span><span>当前分数 {{ result.score.toFixed(2) }}</span><span>正面 +1</span>
        </div>
      </div>
    </div>

    <!-- 命中词 -->
    <div v-if="result.positive.length || result.negative.length" class="words mt-2">
      <div v-if="result.positive.length" class="word-group">
        <span class="w-title pos-text">正面词（{{ result.positive.length }}）</span>
        <span v-for="w in result.positive" :key="`p-${w}`" class="chip pos">{{ w }}</span>
      </div>
      <div v-if="result.negative.length" class="word-group">
        <span class="w-title neg-text">负面词（{{ result.negative.length }}）</span>
        <span v-for="w in result.negative" :key="`n-${w}`" class="chip neg">{{ w }}</span>
      </div>
    </div>
    <div v-else class="notice notice-warn mt-2">未命中任何情感词，判断为中性。词典以中文口语评价词为主。</div>

    <!-- 多句模式 -->
    <div v-if="sentenceRows.length > 1" class="mt-2">
      <h4 class="sec-title">逐句分析（{{ sentenceRows.length }} 句）</h4>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>句子</th><th>倾向</th><th>分数</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in sentenceRows" :key="r.idx">
              <td>{{ r.idx }}</td>
              <td class="sentence">{{ r.text }}</td>
              <td><span class="mini-tag" :class="r.label === '正面' ? 'pos' : r.label === '负面' ? 'neg' : 'mid'">{{ r.label }}</span></td>
              <td :class="r.score > 0 ? 'pos-text' : r.score < 0 ? 'neg-text' : ''">{{ r.score.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verdict {
  display: flex;
  gap: 24px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 20px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  flex-wrap: wrap;
}
.v-left { display: grid; gap: 2px; }
.v-label { font-size: 12px; color: var(--text-3); }
.v-word { font-size: 34px; line-height: 1.1; }
.v-word.pos { color: var(--ok); }
.v-word.neg { color: var(--err); }
.v-word.mid { color: var(--text-2); }
.v-gauge { flex: 1; min-width: 220px; }
.gauge-track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ef444455, #fbbf2455 50%, #34d39955);
}
.gauge-fill {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--accent-text);
  border: 3px solid var(--panel-solid);
  box-shadow: 0 0 0 1px var(--border);
}
.gauge-mid {
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: var(--text-3);
  opacity: 0.5;
}
.gauge-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 6px;
}
.words { display: grid; gap: 8px; }
.word-group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.w-title { font-size: 12.5px; font-weight: 600; margin-right: 4px; }
.pos-text { color: var(--ok); }
.neg-text { color: var(--err); }
.chip.pos { border-color: rgba(52, 211, 153, 0.4); color: var(--ok); }
.chip.neg { border-color: rgba(239, 68, 68, 0.4); color: var(--err); }
.sec-title { margin: 0 0 8px; font-size: 14px; color: var(--text-2); }
.sentence { white-space: normal !important; max-width: none !important; }
.mini-tag {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
}
.mini-tag.pos { background: rgba(52, 211, 153, 0.14); color: var(--ok); }
.mini-tag.neg { background: rgba(239, 68, 68, 0.14); color: var(--err); }
.mini-tag.mid { background: var(--accent-soft); color: var(--text-3); }
</style>
