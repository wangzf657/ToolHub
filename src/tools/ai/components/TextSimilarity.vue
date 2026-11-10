<script setup lang="ts">
import { computed, ref } from 'vue'
import { GitCompare } from 'lucide-vue-next'
import { similarity } from '@/lib/nlpEngine'

const a = ref('')
const b = ref('')

/** 编辑距离（Levenshtein，O(n·m)，限长防卡） */
const editDistance = (x: string, y: string): number => {
  if (x.length > 4000 || y.length > 4000) return -1
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

const result = computed(() => {
  const ta = a.value.trim()
  const tb = b.value.trim()
  if (!ta || !tb) return null
  const ga = ngrams(ta)
  const gb = ngrams(tb)
  const cosine = cosineOf(ga, gb)
  const jac = jaccardOf(new Set(ga.keys()), new Set(gb.keys()))
  const ed = editDistance(ta, tb)
  const lex = similarity(ta, tb) // nlpEngine 词级相似度
  const avg = (cosine + jac + Math.max(0, lex)) / 3
  const level = avg >= 0.8 ? '高度相似（疑似重复/改写）' : avg >= 0.5 ? '中等相似（主题相关）' : avg >= 0.25 ? '弱相似' : '基本不相关'
  return { cosine, jac, ed, lex, avg, level }
})

const pct = (v: number) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%`
</script>

<template>
  <div>
    <div class="two">
      <div>
        <span class="field-label">文本 A</span>
        <textarea v-model="a" class="input area" rows="6" placeholder="粘贴第一段文本…"></textarea>
      </div>
      <div>
        <span class="field-label">文本 B</span>
        <textarea v-model="b" class="input area" rows="6" placeholder="粘贴第二段文本…"></textarea>
      </div>
    </div>

    <div v-if="result" class="mt-2">
      <div class="verdict" :class="result.avg >= 0.8 ? 'hi' : result.avg >= 0.5 ? 'mid' : ''">
        <GitCompare :size="18" />
        <b>{{ result.level }}</b>
      </div>
      <div class="stat-grid mt-2">
        <div class="stat primary"><span class="v">{{ pct(result.avg) }}</span><span class="l">综合相似度</span></div>
        <div class="stat"><span class="v">{{ pct(result.cosine) }}</span><span class="l">字符 2-gram 余弦</span></div>
        <div class="stat"><span class="v">{{ pct(result.jac) }}</span><span class="l">Jaccard（片段交集）</span></div>
        <div class="stat"><span class="v">{{ pct(Math.max(0, result.lex)) }}</span><span class="l">词级相似（中文分词）</span></div>
        <div class="stat"><span class="v">{{ result.ed >= 0 ? result.ed : '>4000 字' }}</span><span class="l">编辑距离（越小越像）</span></div>
      </div>
      <p class="hint mt-2">口径：字符 n-gram 余弦对中文改写最敏感；Jaccard 衡量片段重合；编辑距离超长文本（>4000 字）不计算。纯本地词频算法（非语义模型），语序调换后数值会明显变化。</p>
    </div>
  </div>
</template>

<style scoped>
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.area { width: 100%; resize: vertical; font-family: inherit; }
.verdict { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; }
.verdict.hi { border-color: var(--err); color: var(--err); }
.verdict.mid { border-color: #f59e0b; color: #b45309; }
.stat-grid { display: flex; gap: 10px; flex-wrap: wrap; }
.stat { padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; min-width: 110px; display: flex; flex-direction: column; gap: 2px; }
.stat .v { font-size: 19px; font-weight: 700; }
.stat .l { font-size: 11px; color: var(--muted); }
.stat.primary { border-color: var(--accent); }
.stat.primary .v { color: var(--accent-text); }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
</style>
