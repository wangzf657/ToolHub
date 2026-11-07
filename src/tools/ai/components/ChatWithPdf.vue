<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Send, FileText, Quote } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { pdfPageTexts } from '@/lib/pdfEngine'
import { answerFromPassage, similarity, splitSentences } from '@/lib/nlpEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Sent {
  text: string
  page: number
  score: number
}

const busy = ref(false)
const progress = ref('')
const fileName = ref('')
const pageCount = ref(0)
const sents = ref<Sent[]>([])
const question = ref('')
const asked = ref('')
const results = ref<Sent[]>([])
let fullText = ''

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  busy.value = true
  fileName.value = file.name
  progress.value = '正在提取 PDF 文本（大文件可能需要十几秒）…'
  try {
    const pages = await pdfPageTexts(file)
    pageCount.value = pages.length
    progress.value = '正在切分句子建立索引…'
    const all: Sent[] = []
    pages.forEach((p, i) => {
      for (const s of splitSentences(p)) all.push({ text: s, page: i + 1, score: 0 })
    })
    sents.value = all
    fullText = pages.join('\n')
    results.value = []
    asked.value = ''
    if (!all.length) {
      toast.err('未提取到文本：该 PDF 可能是扫描图片版，需要 OCR 支持')
    } else {
      toast.ok(`解析完成：${pages.length} 页 / ${all.length} 句`)
    }
  } catch (e) {
    toast.err((e as Error).message || 'PDF 解析失败')
  } finally {
    busy.value = false
    progress.value = ''
  }
}

const ask = () => {
  const q = question.value.trim()
  if (!q || !sents.value.length) return
  asked.value = q
  // 对全部句子做相似度打分，取 top3
  const scored: Sent[] = sents.value
    .map((s) => ({ ...s, score: similarity(q, s.text) }))
    .sort((a, b) => b.score - a.score)
  const list = scored.filter((r) => r.score > 0.02).slice(0, 3)
  // 引擎问答结果若在候选之外，置顶补充
  const ans = answerFromPassage(fullText, q)
  if (ans) {
    let hit = list.findIndex((r) => r.text === ans.answer)
    if (hit > 0) {
      const [it] = list.splice(hit, 1)
      list.unshift(it)
    } else if (hit < 0) {
      const src = sents.value.find((s) => s.text === ans.answer)
      if (src) list.unshift({ ...src, score: Math.max(scored[0]?.score ?? 0, 0.5) })
    }
  }
  results.value = list
}

const rel = (s: number) => Math.min(100, Math.round(s * 120))
</script>

<template>
  <div>
    <div class="notice notice-info">
      上传 PDF 后全部解析与检索都在本地完成：句子级相似度匹配直接引用原文作答。扫描图片版 PDF 暂不支持（需 OCR）。
    </div>

    <FileDrop class="mt-2" accept="application/pdf,.pdf" :multiple="false" label="拖放 PDF 到此处，或点击选择" hint="文本仅在浏览器内处理，从不上传" @files="onFiles" />

    <div v-if="busy" class="notice notice-info mt-2"><Loader2 :size="14" class="spin" /> {{ progress }}</div>

    <template v-if="sents.length">
      <div class="doc-bar mt-2">
        <FileText :size="15" />
        <span class="doc-name">{{ fileName }}</span>
        <span class="chip">{{ pageCount }} 页</span>
        <span class="chip">{{ sents.length }} 句已索引</span>
      </div>

      <div class="row mt-2">
        <input
          v-model="question"
          class="input grow"
          placeholder="针对文档提问，如「文中提到的实验结果是什么」"
          @keydown.enter="ask"
        />
        <button class="btn btn-primary" :disabled="!!busy || !question.trim()" @click="ask"><Send :size="15" /> 提问</button>
      </div>

      <template v-if="asked">
        <h4 class="sec-title mt-2">「{{ asked }}」的引用答案</h4>
        <template v-if="results.length">
          <div v-for="(r, i) in results" :key="i" class="cite" :class="{ primary: i === 0 }">
            <div class="cite-head">
              <span class="cite-badge"><Quote :size="12" /> 引用 {{ i + 1 }}</span>
              <span class="cite-page">第 {{ r.page }} 页</span>
              <span v-if="i === 0" class="cite-best">最佳匹配</span>
            </div>
            <p class="cite-text">{{ r.text }}</p>
            <div class="cite-sim">
              <span class="sim-track"><span class="sim-fill" :style="{ width: `${rel(r.score)}%` }"></span></span>
              <span class="sim-num">相似度 {{ r.score.toFixed(2) }}</span>
            </div>
          </div>
        </template>
        <div v-else class="notice notice-warn mt-1">
          没有找到与问题相关的句子。试试用文档中出现的原词提问（换问法或缩短问题）。
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.spin { animation: spin 0.9s linear infinite; display: inline-block; vertical-align: -2px; }
@keyframes spin { to { transform: rotate(360deg); } }
.doc-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-2);
}
.doc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); }
.cite {
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.cite.primary { border-left-color: #34d399; }
.cite-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.cite-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--accent-text);
  font-weight: 700;
}
.cite-page {
  font-size: 11.5px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--text-2);
}
.cite-best {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--ok);
  font-weight: 700;
}
.cite-text {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text);
}
.cite-sim { display: flex; align-items: center; gap: 10px; }
.sim-track { flex: 1; max-width: 260px; height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; }
.sim-fill { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.sim-num { font-size: 12px; color: var(--text-3); }
</style>
