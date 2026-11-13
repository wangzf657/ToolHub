<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Send, FileText, Quote, History, AlertTriangle } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { pdfPageTexts } from '@/lib/pdfEngine'
import { splitSentences } from '@/lib/nlpEngine'
import { tokenizeWords, STOPWORDS } from '@/lib/textEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Sent {
  text: string
  page: number
  idx: number
  tokSet: Set<string>
  tokArr: string[]
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
/** rx4 问答历史（问题 + Top3 引用 + 页码，可回看） */
interface QaTurn {
  q: string
  list: Sent[]
  ts: number
}
const history = ref<QaTurn[]>([])
const openTurn = ref<number>(-1)
/** rx5 引用上下文展开状态（按引用 idx 记录） */
const ctxOpen = ref<Set<number>>(new Set())

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  busy.value = true
  fileName.value = file.name
  progress.value = '正在提取 PDF 文本（大文件可能需要十几秒）…'
  try {
    const pages = await pdfPageTexts(file)
    pageCount.value = pages.length
    progress.value = '正在切分句子并预分词建索引…'
    const all: Sent[] = []
    let idx = 0
    pages.forEach((p, i) => {
      for (const s of splitSentences(p)) {
        const toks = tokenizeWords(s.toLowerCase())
        // rx3 提问缓存：索引时预 tokenize 存 Map，提问时不再逐句重切
        all.push({ text: s, page: i + 1, idx: idx++, tokSet: new Set(toks), tokArr: toks, score: 0 })
      }
    })
    sents.value = all
    results.value = []
    asked.value = ''
    history.value = []
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

/** 缓存版相似度（口径与 nlpEngine.similarity 一致） */
const simCached = (qTok: Set<string>, s: Sent): number => {
  if (!qTok.size || !s.tokSet.size) return 0
  let inter = 0
  for (const w of qTok) if (s.tokSet.has(w)) inter++
  return inter / Math.sqrt(qTok.size * s.tokSet.size)
}

/** 本地问答先验（真 alternation 修复版，替代 nlpEngine.answerFromPassage 的字符类误匹配） */
const answerLocal = (q: string, qTok: string[]): Sent | null => {
  let best: { s: Sent; score: number } | null = null
  for (const s of sents.value) {
    let score = 0
    for (const t of qTok) {
      if (STOPWORDS.has(t) || !t) continue
      if (s.tokSet.has(t)) {
        score += t.length > 1 ? 2 : 1
        continue
      }
      if (s.tokArr.some((x) => x.includes(t) || t.includes(x))) score += t.length > 1 ? 2 : 1
    }
    if (/谁/.test(q) && /(先生|女士|博士|教授|总经理|作者|创始人)/.test(s.text)) score += 2
    if (/多少|几/.test(q) && /\d/.test(s.text)) score += 2
    if (/什么时候|何时|哪年/.test(q) && /\d{4}|\d+月/.test(s.text)) score += 2
    if (/哪里|哪儿|在哪/.test(q) && /(位于|在.+市|省|国|路|街)/.test(s.text)) score += 2
    if (!best || score > best.score) best = { s, score }
  }
  return best && best.score > 0 ? best.s : null
}

const ask = () => {
  const q = question.value.trim()
  if (!q || !sents.value.length) return
  const prevQ = asked.value
  const prevList = results.value
  const qToks = tokenizeWords(q.toLowerCase())
  const qTokSet = new Set(qToks)
  // 缓存版相似度打分，取 top3
  const scored: Sent[] = sents.value.map((s) => ({ ...s, score: simCached(qTokSet, s) })).sort((a, b) => b.score - a.score)
  const list = scored.filter((r) => r.score > 0.02).slice(0, 3)
  const ans = answerLocal(q, qToks)
  if (ans) {
    let hit = list.findIndex((r) => r.text === ans.text)
    if (hit > 0) {
      const [it] = list.splice(hit, 1)
      list.unshift(it)
    } else if (hit < 0) {
      const src = sents.value.find((s) => s.text === ans.text)
      if (src) list.unshift({ ...src, score: Math.max(scored[0]?.score ?? 0, 0.5) })
    }
  }
  // rx4 上一轮问答转入历史（问题 + 引用一起存档）
  if (prevQ && prevList.length) {
    history.value = [{ q: prevQ, list: prevList, ts: Date.now() }, ...history.value].slice(0, 20)
  }
  asked.value = q
  results.value = list
  ctxOpen.value = new Set()
}

/** rx5 ±1 句上下文：取同页相邻句 */
const neighborOf = (s: Sent, delta: number): Sent | null => {
  const n = sents.value[s.idx + delta]
  return n && n.page === s.page ? n : null
}
const toggleCtx = (idx: number) => {
  const s = new Set(ctxOpen.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  ctxOpen.value = s
}

const rel = (s: number) => Math.min(100, Math.round(s * 120))
</script>

<template>
  <div>
    <!-- rx1 能力边界卡（X-架构天花板：诚实标注检索式问答与云端 ChatPDF 的差异） -->
    <div class="boundary">
      <div class="b-head"><AlertTriangle :size="15" /> 能力边界：检索式问答（本地规则）</div>
      <p class="b-body">
        本工具直接从 PDF 原文<b>引用最相关的句子</b>作答——不生成、不改写原文，也没有大模型参与；
        <b>不支持全文总结与多轮追问</b>。与 ChatPDF 类云端对话产品的差异：全程离线、文本不出浏览器、答案可回溯到页码，
        但问法需要使用文档中出现的原词。
      </p>
    </div>

    <div class="notice notice-info mt-1">
      上传 PDF 后全部解析与检索都在本地完成；扫描图片版 PDF 暂不支持（需 OCR）。
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
              <button class="ctx-btn" :class="{ on: ctxOpen.has(r.idx) }" @click="toggleCtx(r.idx)">±1 句上下文</button>
            </div>
            <p class="cite-text">{{ r.text }}</p>
            <template v-if="ctxOpen.has(r.idx)">
              <p v-if="neighborOf(r, -1)" class="cite-ctx">…{{ neighborOf(r, -1)!.text }}</p>
              <p v-if="neighborOf(r, 1)" class="cite-ctx">{{ neighborOf(r, 1)!.text }}…</p>
            </template>
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

      <!-- rx4 问答历史 -->
      <div v-if="history.length" class="hist mt-2">
        <h4 class="sec-title"><History :size="14" /> 历史问答（{{ history.length }}）</h4>
        <div v-for="t in history" :key="t.ts" class="turn">
          <button class="turn-head" @click="openTurn = openTurn === t.ts ? -1 : t.ts">
            <span class="turn-q">{{ t.q }}</span>
            <span class="turn-meta">{{ t.list.length }} 条引用 · {{ new Date(t.ts).toLocaleTimeString() }}</span>
          </button>
          <div v-if="openTurn === t.ts" class="turn-body">
            <div v-for="(r, i) in t.list" :key="i" class="turn-cite">
              <span class="cite-page">第 {{ r.page }} 页</span>
              <span class="turn-text">{{ r.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.spin { animation: spin 0.9s linear infinite; display: inline-block; vertical-align: -2px; }
@keyframes spin { to { transform: rotate(360deg); } }
.boundary {
  border: 1px solid rgba(217, 119, 6, 0.45);
  background: rgba(251, 191, 36, 0.07);
  border-radius: 12px;
  padding: 12px 14px;
}
.b-head { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; color: var(--warn); }
.b-body { margin: 7px 0 0; font-size: 13px; color: var(--text-2); line-height: 1.7; }
.doc-bar { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 13px; color: var(--text-2); }
.doc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row { display: flex; gap: 10px; }
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); display: flex; align-items: center; gap: 6px; }
.cite { border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); }
.cite.primary { border-left-color: #34d399; }
.cite-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.cite-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--accent-text); font-weight: 700; }
.cite-page { font-size: 11.5px; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--text-2); }
.cite-best { font-size: 11.5px; color: var(--ok); font-weight: 700; }
.ctx-btn { margin-left: auto; border: 1px dashed var(--border); background: none; border-radius: 7px; padding: 2px 9px; font-size: 11.5px; color: var(--text-3); cursor: pointer; }
.ctx-btn.on, .ctx-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.cite-text { margin: 0 0 8px; font-size: 14px; line-height: 1.8; color: var(--text-1); }
.cite-ctx { margin: 0 0 6px; font-size: 12.5px; line-height: 1.7; color: var(--text-3); border-left: 2px solid var(--border); padding-left: 10px; }
.cite-sim { display: flex; align-items: center; gap: 10px; }
.sim-track { flex: 1; max-width: 260px; height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; }
.sim-fill { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.sim-num { font-size: 12px; color: var(--text-3); }
.hist { display: grid; gap: 8px; }
.turn { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.turn-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: none; border: none; cursor: pointer; font: inherit; text-align: left; }
.turn-head:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.turn-q { flex: 1; font-size: 13.5px; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.turn-meta { flex: none; font-size: 11.5px; color: var(--text-3); }
.turn-body { padding: 4px 12px 10px; display: grid; gap: 6px; }
.turn-cite { display: flex; gap: 8px; align-items: baseline; font-size: 12.5px; color: var(--text-2); line-height: 1.6; }
.turn-cite .cite-page { flex: none; }
.turn-text { word-break: break-all; }
</style>
