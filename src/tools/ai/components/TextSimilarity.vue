<script setup lang="ts">
import { computed, ref } from 'vue'
import { GitCompare, ArrowLeftRight, Wand2 } from 'lucide-vue-next'
import { tokenizeWords } from '@/lib/textEngine'

const a = ref('')
const b = ref('')
const tab = ref<'metric' | 'diff'>('metric')
/** rx5 疑似重复判定阈值三档 */
const threshold = ref<'0.9' | '0.8' | '0.7'>('0.8')

// rx2 示例与交换
const fillExample = () => {
  a.value = `第 1 行：ToolHub 是纯浏览器端工具箱
第 2 行：文件永远不上传服务器
第 3 行：支持图片、PDF、音视频
第 4 行：内置 520 个常用工具
第 5 行：离线也能打开已缓存的页面`
  b.value = `第 1 行：ToolHub 是纯浏览器端工具箱
第 2 行：文件不会上传到任何服务器
第 3 行：支持图片、PDF、音视频
第 4 行：收录 520 个常用小工具
第 5 行：断网也能打开已缓存的页面`
}
const swap = () => {
  const t = a.value
  a.value = b.value
  b.value = t
}

/** 编辑距离（Levenshtein，O(n·m)） */
const editDistance = (x: string, y: string): number => {
  const m = x.length
  const n = y.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n] ?? 0
}

// rx4 长文抽样：每 500 字取 200 字段，按比例折算编辑距离估计值
const SAMPLE_STEP = 500
const SAMPLE_LEN = 200
const sampleOf = (s: string): { text: string; frac: number } => {
  const parts: string[] = []
  let taken = 0
  for (let i = 0; i < s.length; i += SAMPLE_STEP) {
    parts.push(s.slice(i, i + SAMPLE_LEN))
    taken += Math.min(SAMPLE_LEN, s.length - i)
  }
  return { text: parts.join('\n'), frac: taken / Math.max(1, s.length) }
}

const ngrams = (s: string, n = 2): Map<string, number> => {
  const clean = s.replace(/\s+/g, '')
  const map = new Map<string, number>()
  for (let i = 0; i <= clean.length - n; i++) {
    const key = clean.slice(i, i + n)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

const cosineOf = (x: Map<string, number>, y: Map<string, number>): number => {
  let dot = 0
  let nx = 0
  let ny = 0
  for (const [, v] of x) nx += v * v
  for (const [k, v] of y) {
    ny += v * v
    const xv = x.get(k)
    if (xv) dot += xv * v
  }
  if (!nx || !ny) return 0
  return dot / Math.sqrt(nx * ny)
}

const jaccardOf = (x: Set<string>, y: Set<string>): number => {
  let inter = 0
  for (const k of x) if (y.has(k)) inter++
  const uni = x.size + y.size - inter
  return uni ? inter / uni : 0
}

// rx3 词级指标按口径实现为真正的 2-gram 词频重合（Dice 系数）
const word2gramDice = (x: string, y: string): number => {
  const gramOf = (s: string) => {
    const ws = tokenizeWords(s)
    const m = new Map<string, number>()
    for (let i = 0; i + 1 < ws.length; i++) {
      const k = `${ws[i]} ${ws[i + 1]}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }
  const gx = gramOf(x)
  const gy = gramOf(y)
  let sx = 0
  let sy = 0
  for (const [, v] of gx) sx += v
  for (const [, v] of gy) sy += v
  if (!sx || !sy) return 0
  let inter = 0
  for (const [k, v] of gx) inter += Math.min(v, gy.get(k) ?? 0)
  return (2 * inter) / (sx + sy)
}

const result = computed(() => {
  const ta = a.value.trim()
  const tb = b.value.trim()
  if (!ta || !tb) return null
  const ga = ngrams(ta)
  const gb = ngrams(tb)
  const cosine = cosineOf(ga, gb)
  const jac = jaccardOf(new Set(ga.keys()), new Set(gb.keys()))
  const w2g = word2gramDice(ta, tb)
  let ed: number
  let edSampled = false
  if (ta.length > 4000 || tb.length > 4000) {
    const sa = sampleOf(ta)
    const sb = sampleOf(tb)
    const raw = editDistance(sa.text, sb.text)
    // 抽样比例折算回全长估计（启发式）
    const f = Math.min(sa.frac, sb.frac) || 1
    ed = Math.round(raw / f)
    edSampled = true
  } else {
    ed = editDistance(ta, tb)
  }
  const avg = (cosine + jac + w2g) / 3
  const th = Number(threshold.value)
  const level = avg >= th ? '高度相似（疑似重复/改写）' : avg >= 0.5 ? '中等相似（主题相关）' : avg >= 0.25 ? '弱相似' : '基本不相关'
  return { cosine, jac, w2g, ed, edSampled, avg, level, th }
})

/* rx1 差异对比 Tab：行级 diff（与 developer/TextDiff 同用 diff 库） */
interface DiffRow {
  type: 'same' | 'add' | 'del'
  text: string
}
const diffRows = ref<DiffRow[]>([])
const diffStats = ref({ add: 0, del: 0, same: 0 })
const buildDiff = async () => {
  const { diffLines } = await import('diff')
  const parts = diffLines(a.value, b.value)
  const out: DiffRow[] = []
  let add = 0
  let del = 0
  let same = 0
  for (const part of parts) {
    const kind: DiffRow['type'] = part.added ? 'add' : part.removed ? 'del' : 'same'
    for (const line of (part.value ?? '').replace(/\n$/, '').split('\n')) {
      if (kind === 'add') add++
      else if (kind === 'del') del++
      else same++
      out.push({ type: kind, text: line })
    }
  }
  diffRows.value = out
  diffStats.value = { add, del, same }
}
const showDiff = () => {
  tab.value = 'diff'
  void buildDiff()
}

const pct = (v: number) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%`
</script>

<template>
  <div>
    <div class="two">
      <div>
        <div class="row">
          <span class="field-label">文本 A</span>
          <button class="swap-btn" title="交换 A/B" aria-label="交换 A/B" @click="swap"><ArrowLeftRight :size="14" /></button>
        </div>
        <textarea v-model="a" class="input area" rows="6" placeholder="粘贴第一段文本…"></textarea>
      </div>
      <div>
        <span class="field-label">文本 B</span>
        <textarea v-model="b" class="input area" rows="6" placeholder="粘贴第二段文本…"></textarea>
      </div>
    </div>

    <div v-if="!a.trim() && !b.trim()" class="row mt-2">
      <button class="btn btn-ghost btn-sm" @click="fillExample"><Wand2 :size="14" /> 填入示例（含 3 处改写）</button>
    </div>

    <template v-if="result">
      <div class="row row-wrap mt-2">
        <button class="chip" :class="{ active: tab === 'metric' }" @click="tab = 'metric'">指标</button>
        <button class="chip" :class="{ active: tab === 'diff' }" @click="showDiff">差异对比</button>
        <span class="th-label">疑似重复线：</span>
        <button v-for="t in ['0.9', '0.8', '0.7']" :key="t" class="chip" :class="{ active: threshold === t }" @click="threshold = t as '0.9'">
          {{ t === '0.9' ? '严格 0.9' : t === '0.8' ? '标准 0.8' : '宽松 0.7' }}
        </button>
      </div>

      <!-- 指标视图 -->
      <template v-if="tab === 'metric'">
        <div class="verdict mt-2" :class="result.avg >= result.th ? 'hi' : result.avg >= 0.5 ? 'mid' : ''">
          <GitCompare :size="18" />
          <b>{{ result.level }}</b>
          <span class="th-note">（判定线 {{ result.th.toFixed(2) }}）</span>
        </div>
        <div class="stat-grid mt-2">
          <div class="stat primary" title="三指标等权平均：字符 2-gram 余弦 + Jaccard 片段交集 + 词级 2-gram 词频重合">
            <span class="v">{{ pct(result.avg) }}</span><span class="l">综合相似度 ⓘ</span>
          </div>
          <div class="stat"><span class="v">{{ pct(result.cosine) }}</span><span class="l">字符 2-gram 余弦</span></div>
          <div class="stat"><span class="v">{{ pct(result.jac) }}</span><span class="l">Jaccard（片段交集）</span></div>
          <div class="stat" title="相邻词 2-gram 的词频重合度（Dice 系数），语序调换后下降"><span class="v">{{ pct(result.w2g) }}</span><span class="l">词频重合（2-gram）</span></div>
          <div class="stat" :title="result.edSampled ? '长文抽样估计：每 500 字取 200 字段，按比例折算' : 'Levenshtein 编辑距离，越小越像'">
            <span class="v">{{ result.edSampled ? `约 ${result.ed.toLocaleString()}` : result.ed.toLocaleString() }}</span>
            <span class="l">编辑距离{{ result.edSampled ? '（抽样估计）' : '（越小越像）' }}</span>
          </div>
        </div>
        <p class="hint mt-2">
          口径：综合分 = 三指标等权平均；词级为 2-gram 词频重合（Dice）。编辑距离超 4000 字自动降级为抽样估计（每 500 字取 200 字段）。
          纯本地词频算法（非语义模型），语序调换后数值会明显变化。
        </p>
      </template>

      <!-- rx1 差异对比视图 -->
      <template v-else>
        <div class="diff-stats mt-2">新增 {{ diffStats.add }} 行 · 删除 {{ diffStats.del }} 行 · 相同 {{ diffStats.same }} 行</div>
        <div class="diff mt-1">
          <div v-for="(r, i) in diffRows" :key="i" class="d-row" :class="r.type">
            <span class="d-mark">{{ r.type === 'add' ? '+' : r.type === 'del' ? '−' : '=' }}</span>
            <span class="d-text">{{ r.text }}</span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.row { display: flex; align-items: center; gap: 8px; }
.row-wrap { flex-wrap: wrap; }
.swap-btn { border: 1px solid var(--border); background: none; border-radius: 7px; width: 26px; height: 26px; display: grid; place-items: center; color: var(--text-2); cursor: pointer; }
.swap-btn:hover { border-color: var(--accent); color: var(--text-1); }
.area { width: 100%; resize: vertical; font-family: inherit; }
.th-label { font-size: 12.5px; color: var(--text-3); margin-left: 8px; }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.verdict { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; }
.verdict.hi { border-color: var(--err); color: var(--err); }
.verdict.mid { border-color: #f59e0b; color: #b45309; }
.th-note { font-size: 12px; color: var(--text-3); }
.stat-grid { display: flex; gap: 10px; flex-wrap: wrap; }
.stat { padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; min-width: 110px; display: flex; flex-direction: column; gap: 2px; cursor: help; }
.stat .v { font-size: 19px; font-weight: 700; }
.stat .l { font-size: 11px; color: var(--text-3); }
.stat.primary { border-color: var(--accent); }
.stat.primary .v { color: var(--accent-text); }
.hint { font-size: 12px; color: var(--text-3); }
.diff-stats { font-size: 12.5px; color: var(--text-2); }
.diff { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; max-height: 420px; overflow-y: auto; font-family: var(--font-mono); font-size: 12.5px; }
.d-row { display: flex; gap: 8px; padding: 3px 12px; }
.d-row.add { background: rgba(52, 211, 153, 0.12); color: var(--ok); }
.d-row.del { background: rgba(248, 113, 113, 0.12); color: var(--err); }
.d-row.same { color: var(--text-2); }
.d-mark { flex: none; width: 14px; }
.d-text { white-space: pre-wrap; word-break: break-all; }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
</style>
