<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2, Trophy, Download } from 'lucide-vue-next'
import { similarity } from '@/lib/nlpEngine'
import { tokenizeWords } from '@/lib/textEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const view = ref<'single' | 'batch'>('single')

const text = ref('这个手机用了一周就发烫严重，客服还一直拖，真是不推荐买。')

interface LabelItem {
  label: string
  example: string
}

const labels = ref<LabelItem[]>([
  { label: '好评', example: '' },
  { label: '差评', example: '' },
  { label: '咨询', example: '' },
  { label: '吐槽', example: '' },
])

const multiLabel = ref(false) // rx3 允许多标签（阈值 0.6×top1）

const addLabel = () => {
  if (labels.value.length >= 10) {
    toast.warn('最多支持 10 个标签')
    return
  }
  labels.value.push({ label: '', example: '' })
}

/** 内置同义扩展词：为常见标签自动补充，提高区分度 */
const AUTO: Record<string, string> = {
  好评: '好 满意 喜欢 赞 不错 推荐 划算 超预期',
  差评: '差 失望 不满 后悔 难用 不推荐 别买',
  咨询: '请问 想知道 咨询 询问 多少 怎么 如何',
  吐槽: '无语 离谱 服了 吐槽 难受 没办法',
  投诉: '投诉 维权 退款 客服 投诉无门',
  建议: '建议 希望 改进 可以加 期待',
  正面: '好 优秀 满意 推荐 出色',
  负面: '差 垃圾 失望 难用 坑',
  新闻: '报道 发布 官方 宣布 近日',
  情感: '喜欢 心动 想念 在一起',
}
const expandOf = (l: string) => AUTO[l.trim()] ?? ''

interface Scored {
  label: string
  score: number
  /** rx4 命中解释：文本中实际出现的标签/扩展词/示例词 */
  hits: string[]
  /** 是否判定为命中（单标签=仅 top1；多标签=≥0.6×top1） */
  matched: boolean
}

const classifyOne = (t: string): Scored[] => {
  if (!t.trim()) return []
  const rows = labels.value
    .filter((l) => l.label.trim())
    .map((l) => {
      const probe = [l.label.trim(), expandOf(l.label), l.example.trim()].filter(Boolean).join(' ')
      const vocab = [l.label.trim(), ...expandOf(l.label).split(/\s+/), ...tokenizeWords(l.example.toLowerCase())]
      const tl = t.toLowerCase()
      const hits = [...new Set(vocab.filter((w) => w && tl.includes(w)))]
      return { label: l.label.trim(), score: similarity(t, probe), hits }
    })
    .sort((a, b) => b.score - a.score)
  const top = rows[0]?.score ?? 0
  const th = top * 0.6
  return rows.map((r, i) => ({ ...r, matched: multiLabel.value ? r.score >= th && r.score > 0 : i === 0 && r.score > 0 }))
}

const scored = computed<Scored[]>(() => classifyOne(text.value))
const maxScore = computed(() => Math.max(0.0001, ...scored.value.map((s) => s.score)))
const totalScore = computed(() => scored.value.reduce((s, x) => s + x.score, 0))
const confidence = (s: number) => (totalScore.value > 0 ? (s / totalScore.value) * 100 : 0)
// rx2 低置信警告：top1 原始相似度 < 0.15
const lowConf = computed(() => scored.value.length > 0 && scored.value[0].score < 0.15)

/* rx5 批量模式：逐行分类 + CSV 导出 */
const batchText = ref('')
interface BatchRow {
  no: number
  line: string
  top: Scored[]
  matchedLabels: string
}
const batchRows = computed<BatchRow[]>(() =>
  batchText.value
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const rows = classifyOne(line)
      return { no: i + 1, line, top: rows, matchedLabels: rows.filter((r) => r.matched).map((r) => r.label).join('/') || '—' }
    }),
)
const downloadCsv = () => {
  if (!batchRows.value.length) {
    toast.warn('请先粘贴要批量分类的文本（每行一条）')
    return
  }
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = [
    '行号,判定标签,归一化置信度%,原始相似度,原文',
    ...batchRows.value.map((r) => {
      const t1 = r.top[0]
      return [r.no, esc(r.matchedLabels), t1 ? confidence(t1.score).toFixed(1) : '', t1 ? t1.score.toFixed(3) : '', esc(r.line)].join(',')
    }),
  ]
  saveText('\ufeff' + rows.join('\n'), '文本归类批量结果.csv', 'text/csv;charset=utf-8')
  toast.ok('CSV 已开始下载')
}
</script>

<template>
  <div>
    <div class="notice notice-info">
      <b>词汇相似度零样本（非神经网络）</b>：给出一组自定义标签，引擎计算文本与每个标签（含同义扩展词与示例句）的词汇匹配度并排序。
      内置扩展词覆盖常见标签，其他标签请填示例句。
    </div>

    <div class="row row-wrap mt-2 mb-2">
      <button class="chip" :class="{ active: view === 'single' }" @click="view = 'single'">单条文本</button>
      <button class="chip" :class="{ active: view === 'batch' }" @click="view = 'batch'">批量（每行一条）</button>
    </div>

    <template v-if="view === 'single'">
      <div class="mt-2">
        <label class="field-label">待分类文本</label>
        <textarea v-model="text" class="textarea" style="min-height: 100px" placeholder="粘贴一条评论、留言或短文…"></textarea>
      </div>
    </template>
    <template v-else>
      <div class="mt-2">
        <label class="field-label">批量文本（每行一条，逐行归类）</label>
        <textarea v-model="batchText" class="textarea" style="min-height: 130px" placeholder="第一行内容&#10;第二行内容&#10;…"></textarea>
        <div class="row mt-1">
          <button class="btn btn-primary btn-sm" :disabled="!batchRows.length" @click="downloadCsv"><Download :size="14" /> 下载 CSV（{{ batchRows.length }} 行）</button>
        </div>
        <table v-if="batchRows.length" class="data-table mt-2">
          <thead><tr><th>行号</th><th>判定标签</th><th>置信度</th><th>原文</th></tr></thead>
          <tbody>
            <tr v-for="r in batchRows" :key="r.no">
              <td>{{ r.no }}</td>
              <td>{{ r.matchedLabels }}</td>
              <td>{{ r.top[0] ? `${confidence(r.top[0].score).toFixed(1)}%｜${r.top[0].score.toFixed(3)}` : '—' }}</td>
              <td class="line-cell">{{ r.line }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="mt-2">
      <div class="row">
        <label class="field-label">标签集合（可加示例句提升区分度）</label>
        <label class="check ml-auto"><input v-model="multiLabel" type="checkbox" /> 允许多标签（≥0.6×top1 即命中）</label>
      </div>
      <div v-for="(l, i) in labels" :key="i" class="label-row">
        <input v-model="l.label" class="input w-label" placeholder="标签，如 好评" />
        <input v-model="l.example" class="input grow" placeholder="示例句（可选），如 物流很快非常满意" />
        <button class="icon-btn danger" title="删除" aria-label="删除" @click="labels.splice(i, 1)"><Trash2 :size="14" /></button>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="addLabel"><Plus :size="14" /> 添加标签</button>
    </div>

    <template v-if="view === 'single' && scored.length">
      <div class="mt-2">
        <h4 class="sec-title">分类结果</h4>
        <div class="result-top" :class="{ warn: lowConf }">
          <span class="trophy"><Trophy :size="16" /></span>
          最可能属于：<b class="top-label">{{ scored[0].label }}</b>
          <span class="conf">归一化 {{ confidence(scored[0].score).toFixed(1) }}%｜原始相似度 {{ scored[0].score.toFixed(3) }}</span>
        </div>
        <div v-if="lowConf" class="notice notice-warn mb-2">
          最高原始相似度仅 {{ scored[0].score.toFixed(3) }}（&lt;0.15）：文本可能不属于任何已设标签，或标签缺少覆盖词——建议为标签补一条贴近原文用词的示例句。
        </div>
        <div v-for="s in scored" :key="s.label" class="score-row" :class="{ hit: s.matched }">
          <span class="s-label" :title="s.label">{{ s.label }}<b v-if="s.matched && s.hits.length" class="hit-dot">命中</b></span>
          <span class="s-track">
            <span class="s-fill" :style="{ width: `${(s.score / maxScore) * 100}%` }"></span>
          </span>
          <span class="s-num">归一化 {{ confidence(s.score).toFixed(1) }}%｜原始 {{ s.score.toFixed(3) }}</span>
        </div>
        <!-- rx4 命中解释 -->
        <div v-for="s in scored" v-show="s.hits.length" :key="`h-${s.label}`" class="hits-row">
          <span class="hits-label">{{ s.label }}：</span>
          <span v-for="w in s.hits" :key="w" class="chip hit-chip">{{ w }}</span>
        </div>
      </div>
      <p class="hint mt-1">
        计算口径：文本与「标签 + 同义扩展词 + 示例句」的词汇余弦相似度，再在标签间归一化；原始相似度为未归一化分值，可核对。
        多标签模式下 ≥0.6×top1 的标签同时判定命中。
      </p>
    </template>
    <div v-else-if="view === 'single'" class="notice notice-warn mt-2">请填写待分类文本，并至少保留一个非空标签。</div>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 10px; }
.row-wrap { flex-wrap: wrap; }
.ml-auto { margin-left: auto; }
.check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.label-row { display: flex; gap: 8px; margin-bottom: 8px; }
.w-label { width: 160px; flex: none; }
.icon-btn { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer; }
.icon-btn.danger:hover { border-color: var(--err); color: var(--err); }
.sec-title { margin: 0 0 8px; font-size: 13.5px; color: var(--text-2); }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.line-cell { white-space: normal !important; font-size: 12px; }
.result-top { display: flex; align-items: center; gap: 8px; border: 1px solid var(--accent); background: var(--accent-soft); border-radius: 12px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; flex-wrap: wrap; }
.result-top.warn { border-color: var(--warn); background: rgba(251, 191, 36, 0.08); }
.trophy { color: #f59e0b; display: grid; place-items: center; }
.top-label { font-size: 17px; color: var(--accent-text); }
.conf { margin-left: auto; font-size: 12px; color: var(--text-3); }
.score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.score-row.hit .s-label { color: var(--accent-text); font-weight: 700; }
.hit-dot { margin-left: 6px; font-size: 10px; background: var(--accent); color: #fff; border-radius: 999px; padding: 1px 6px; font-weight: 600; }
.s-label { flex: none; width: 150px; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; color: var(--text-2); }
.s-track { flex: 1; height: 16px; border-radius: 999px; background: var(--border); overflow: hidden; }
.s-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), #34d399); transition: width 0.25s ease; }
.s-num { flex: none; width: 190px; font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; text-align: right; }
.hits-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0 0 6px 160px; }
.hits-label { font-size: 12px; color: var(--text-3); }
.hit-chip { font-size: 11.5px; padding: 0 8px; }
.hint { font-size: 12px; color: var(--text-3); }
</style>
