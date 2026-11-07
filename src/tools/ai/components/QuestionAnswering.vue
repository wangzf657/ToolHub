<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, MessageCircleQuestion } from 'lucide-vue-next'
import { answerFromPassage } from '@/lib/nlpEngine'

const passage = ref(`ToolHub 是一个纯本地的在线工具箱，收录了图片、PDF、音视频、数据处理与 AI 等多个分类的工具。
所有计算都在浏览器内完成，文件不会被上传到任何服务器，因此非常适合同事之间分享使用。
项目由张伟在 2024 年创立，最初只有 10 个小工具，如今已超过 300 个。
其中使用最多的是 PDF 合并和图片压缩，月访问量达到 80 万。`)

const question = ref('ToolHub 是谁创立的？')
const asked = ref('')
const hasAsked = ref(false)

const answer = computed(() => (hasAsked.value ? answerFromPassage(passage.value, asked.value) : null))

const doAsk = () => {
  const q = question.value.trim()
  if (!passage.value.trim()) {
    asked.value = ''
    hasAsked.value = true
    return
  }
  asked.value = q
  hasAsked.value = true
}

/* ---------- 在资料中高亮答案句（先转义再包裹） ---------- */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const passageHtml = computed(() => {
  const src = passage.value
  const a = answer.value?.answer
  if (!a) return esc(src)
  const idx = src.indexOf(a)
  if (idx < 0) return esc(src)
  return `${esc(src.slice(0, idx))}<mark class="hl">${esc(a)}</mark>${esc(src.slice(idx + a.length))}`
})
</script>

<template>
  <div>
    <div class="notice notice-info">本地匹配算法直接从你粘贴的资料中抽取答案句，文本不出浏览器。</div>

    <div class="mt-2">
      <label class="field-label">资料（粘贴一段或几段文本）</label>
      <textarea v-model="passage" class="textarea" style="min-height: 130px"></textarea>
    </div>

    <div class="row mt-2">
      <input
        v-model="question"
        class="input grow"
        placeholder="输入问题，如「创始人是谁」「月访问量多少」"
        @keydown.enter="doAsk"
      />
      <button class="btn btn-primary" :disabled="!passage.trim() || !question.trim()" @click="doAsk">
        <Search :size="16" /> 提取答案
      </button>
    </div>

    <template v-if="hasAsked">
      <div v-if="answer" class="answer mt-2">
        <span class="a-icon"><MessageCircleQuestion :size="18" /></span>
        <div>
          <div class="a-q">问：{{ asked }}</div>
          <div class="a-text">{{ answer.answer }}</div>
        </div>
      </div>
      <div v-else class="notice notice-warn mt-2">
        没有从资料中找到与「{{ asked }}」相关的答案句。试试换一种问法，把问题里的关键词写得更接近原文用词。
      </div>

      <div class="mt-2">
        <h4 class="sec-title">资料原文（答案句已高亮）</h4>
        <div class="passage" v-html="passageHtml"></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
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
.a-q { font-size: 12.5px; color: var(--text-3); margin-bottom: 4px; }
.a-text { font-size: 16px; font-weight: 600; line-height: 1.6; }
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); }
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
