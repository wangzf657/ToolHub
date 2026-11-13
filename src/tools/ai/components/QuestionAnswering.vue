<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, MessageCircleQuestion, Copy, Check } from 'lucide-vue-next'
import { splitSentences } from '@/lib/nlpEngine'
import { tokenizeWords, STOPWORDS } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const passage = ref(`ToolHub 是一个纯本地的在线工具箱，收录了图片、PDF、音视频、数据处理与 AI 等多个分类的工具。
所有计算都在浏览器内完成，文件不会被上传到任何服务器，因此非常适合同事之间分享使用。
项目由张伟在 2024 年创立，最初只有 10 个小工具，如今已超过 300 个。
其中使用最多的是 PDF 合并和图片压缩，月访问量达到 80 万。`)

const question = ref('ToolHub 是谁创立的？')
const asked = ref('')
const hasAsked = ref(false)
/** rx4 资料修改后答案失效提示 */
const stale = ref(false)
const copied = ref(false)
watch(passage, () => (stale.value = true))

interface Cand {
  text: string
  score: number
}

/** 本地候选打分（先验改为真 alternation，修复 [先生|女士|…] 字符类误加分） */
const candidates = computed<Cand[]>(() => {
  const q = asked.value
  if (!hasAsked.value || !q) return []
  const qToks = tokenizeWords(q.toLowerCase())
  const scored = splitSentences(passage.value).map((s) => {
    const toks = tokenizeWords(s.toLowerCase())
    let score = 0
    for (const t of qToks) {
      if (STOPWORDS.has(t) || !t) continue
      if (toks.some((x) => x.includes(t) || t.includes(x))) score += t.length > 1 ? 2 : 1
    }
    if (/谁/.test(q) && /(先生|女士|博士|教授|总经理|作者|创始人)/.test(s)) score += 2
    if (/多少|几/.test(q) && /\d/.test(s)) score += 2
    if (/什么时候|何时|哪年/.test(q) && /\d{4}|\d+月/.test(s)) score += 2
    if (/哪里|哪儿|在哪/.test(q) && /(位于|在.+市|省|国|路|街)/.test(s)) score += 2
    return { text: s, score }
  })
  return scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
})

const answer = computed(() => candidates.value[0] ?? null)

// rx2 最小答案片段：「多少/几」问型从答案句截取数字串前置展示
const keyFact = computed(() => {
  const q = asked.value
  const a = answer.value?.text
  if (!a || !/多少|几/.test(q)) return ''
  const m = a.match(/[¥￥$€]?\s?\d[\d,，]*(?:\.\d+)?\s*(?:万|亿|千|k|K|m|M)?(?:元|美元|人次|人|次|个|条|款|年)?/)
  return m ? m[0].trim() : ''
})

const doAsk = () => {
  const q = question.value.trim()
  if (!passage.value.trim()) {
    asked.value = ''
    hasAsked.value = true
    return
  }
  asked.value = q
  hasAsked.value = true
  stale.value = false
  copied.value = false
}

const doCopy = async () => {
  if (!answer.value) return
  if (await copyText(answer.value.text)) {
    copied.value = true
    toast.ok('答案句已复制')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

/* ---------- 在资料中高亮最佳答案句（先转义再包裹） ---------- */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const passageHtml = computed(() => {
  const src = passage.value
  const a = answer.value?.text
  if (!a) return esc(src)
  const idx = src.indexOf(a)
  if (idx < 0) return esc(src)
  return `${esc(src.slice(0, idx))}<mark class="hl">${esc(a)}</mark>${esc(src.slice(idx + a.length))}`
})
</script>

<template>
  <div>
    <div class="notice notice-info">本地匹配算法直接从你粘贴的资料中抽取答案句，文本不出浏览器；答案给出 Top-3 候选与分数条。</div>

    <div class="mt-2">
      <label class="field-label">资料（粘贴一段或几段文本）</label>
      <textarea v-model="passage" class="textarea" style="min-height: 130px"></textarea>
    </div>

    <div class="row mt-2">
      <input
        v-model="question"
        class="input grow"
        placeholder="输入问题，如「创始人是谁」「月访问量多少」「什么时候创立」"
        @keydown.enter="doAsk"
      />
      <button class="btn btn-primary" :disabled="!passage.trim() || !question.trim()" @click="doAsk">
        <Search :size="16" /> 提取答案
      </button>
    </div>

    <template v-if="hasAsked">
      <!-- rx4 失效提示 -->
      <div v-if="stale && answer" class="notice notice-warn mt-2">资料已修改，以下答案基于旧内容——请重新提问刷新。</div>

      <div v-if="answer" class="answer mt-2">
        <span class="a-icon"><MessageCircleQuestion :size="18" /></span>
        <div class="a-main">
          <div class="a-q">问：{{ asked }}</div>
          <div v-if="keyFact" class="a-fact">答案要点：<b>{{ keyFact }}</b></div>
          <div class="a-text">{{ answer.text }}</div>
        </div>
        <button class="a-copy" :title="copied ? '已复制' : '复制答案句'" @click="doCopy">
          <Check v-if="copied" :size="14" color="#34d399" />
          <Copy v-else :size="14" />
        </button>
      </div>
      <div v-else class="notice notice-warn mt-2">
        没有从资料中找到与「{{ asked }}」相关的答案句。试试换一种问法，把问题里的关键词写得更接近原文用词。
      </div>

      <!-- rx1 候选列表与分数条 -->
      <div v-if="candidates.length > 1" class="mt-2">
        <h4 class="sec-title">候选答案（按匹配分排序）</h4>
        <div v-for="(c, i) in candidates" :key="i" class="cand" :class="{ best: i === 0 }">
          <span class="cand-no">候选 {{ i + 1 }}</span>
          <span class="cand-text">{{ c.text }}</span>
          <span class="cand-score">
            <span class="cand-track"><span class="cand-fill" :style="{ width: `${Math.min(100, (c.score / Math.max(...candidates.map((x) => x.score))) * 100)}%` }"></span></span>
            <span class="cand-num">{{ c.score }} 分</span>
          </span>
        </div>
      </div>

      <div class="mt-2">
        <h4 class="sec-title">资料原文（最佳答案句已高亮）</h4>
        <div class="passage" v-html="passageHtml"></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.row { display: flex; gap: 10px; }
.answer {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 12px;
  padding: 14px 16px;
}
.a-icon { color: var(--accent-text); flex: none; margin-top: 2px; }
.a-main { flex: 1; min-width: 0; }
.a-q { font-size: 12.5px; color: var(--text-3); margin-bottom: 4px; }
.a-fact { font-size: 14px; color: var(--text-2); margin-bottom: 4px; }
.a-fact b { color: var(--accent-text); font-size: 17px; }
.a-text { font-size: 15.5px; font-weight: 600; line-height: 1.6; }
.a-copy { flex: none; border: 1px solid var(--border); background: none; border-radius: 8px; width: 30px; height: 30px; display: grid; place-items: center; color: var(--text-2); cursor: pointer; }
.a-copy:hover { border-color: var(--accent); color: var(--text-1); }
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); }
.cand { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; margin-bottom: 6px; }
.cand.best { border-color: var(--accent); }
.cand-no { flex: none; font-size: 11.5px; color: var(--text-3); font-weight: 700; }
.cand-text { flex: 1; font-size: 13px; color: var(--text-2); min-width: 0; word-break: break-all; }
.cand-score { flex: none; display: flex; align-items: center; gap: 8px; }
.cand-track { width: 90px; height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; display: inline-block; }
.cand-fill { display: block; height: 100%; background: var(--accent); }
.cand-num { font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.passage {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 2;
  white-space: pre-wrap;
  word-break: break-word;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.passage :deep(.hl) {
  background: rgba(250, 204, 21, 0.35);
  color: inherit;
  border-radius: 3px;
  padding: 0 2px;
}
</style>
