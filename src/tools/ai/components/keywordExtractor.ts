/**
 * 关键词提取纯逻辑（keyword-extractor 组件的可测性提取）。
 * 本地 TF-IDF（rx3 正词召回修复：仅检查候选词首尾虚词字符，保住 中国/智能 等完整词）；
 * 输出做包含/公共子串去重，避免「机器学习/机器」同时上榜。
 */
import { splitSentences } from '@/lib/nlpEngine'

/** 词首虚词字符（出现在候选词首时视为碎片） */
const EDGE_HEAD_STOP = new Set('的了和是与就都在不有我你他她这那也被把让给向对于从以为之其或并且很挺更最又再才只等吧吗呢啊呀哦嗯'.split('').filter(Boolean))
/** 词尾虚词字符（不出现在词尾的合法字如 能/来/去/说/个 不列入，保住 智能/起来/出去 这类完整词） */
const EDGE_TAIL_STOP = new Set('的了和是与就都在不有我你他她这那也被把让给向对于从以为之其或并且只等吧吗呢啊呀哦嗯着过地得上中里外'.split('').filter(Boolean))

/** 候选词：英文按词，中文按 2–6 字滑窗；仅首尾字符做虚词检查 */
export function keywordTokens(s: string): string[] {
  const en = s.match(/[a-zA-Z][a-zA-Z0-9'-]+/g) ?? []
  const cn = s.match(/[\u4e00-\u9fff]+/g) ?? []
  const cnTokens: string[] = []
  for (const seg of cn) {
    if (seg.length === 1) {
      cnTokens.push(seg)
      continue
    }
    for (let len = 2; len <= Math.min(6, seg.length); len++) {
      for (let i = 0; i + len <= seg.length; i++) cnTokens.push(seg.slice(i, i + len))
    }
  }
  return [...en, ...cnTokens]
    .map((t) => t.toLowerCase())
    .filter((t) => !/^\d+$/.test(t) && t.length >= 2)
    .filter((t) => {
      if (!/[\u4e00-\u9fff]/.test(t)) return true
      return !EDGE_HEAD_STOP.has(t[0]) && !EDGE_TAIL_STOP.has(t[t.length - 1])
    })
}

/** 两词是否共享长度 ≥ k 的连续公共子串 */
export function sharesSubstring(a: string, b: string, k: number): boolean {
  for (let i = 0; i + k <= b.length; i++) {
    if (a.includes(b.slice(i, i + k))) return true
  }
  return false
}

export interface Kw {
  word: string
  score: number
  count: number
}

/** TF-IDF 打分 + 去重，取前 n 个关键词 */
export function topKeywords(src: string, n = 10): Kw[] {
  const s = src.trim()
  if (!s) return []
  const sentences = splitSentences(s)
  const tokensPerSent = sentences.map((x) => keywordTokens(x))
  const tf = new Map<string, number>()
  const df = new Map<string, number>()
  for (const toks of tokensPerSent) {
    const seen = new Set<string>()
    for (const t of toks) {
      tf.set(t, (tf.get(t) ?? 0) + 1)
      if (!seen.has(t)) {
        seen.add(t)
        df.set(t, (df.get(t) ?? 0) + 1)
      }
    }
  }
  const N = Math.max(1, tokensPerSent.length)
  const scored = [...tf.entries()]
    .filter(([w]) => !/^\d+$/.test(w))
    .map(([w, count]) => ({
      word: w,
      count,
      score: count * Math.log(1 + N / Math.max(1, df.get(w) ?? 1)) * Math.min(2.5, w.length / 2),
    }))
    .sort((a, b) => b.score - a.score || b.word.length - a.word.length || a.word.localeCompare(b.word))
  const out: Kw[] = []
  const want = Math.max(1, Math.min(30, Math.round(Number(n) || 10)))
  for (const x of scored) {
    if (out.some((o) => o.word.includes(x.word) || x.word.includes(o.word))) continue
    if (x.word.length >= 3 && out.some((o) => sharesSubstring(o.word, x.word, 3))) continue
    out.push(x)
    if (out.length >= want) break
  }
  return out
}

/** 一步到位：文本 → 编号清单文本（测试与组件共用） */
export function extractKeywordsText(src: string, n = 10): string {
  return topKeywords(src, n).map((k, i) => `${i + 1}. ${k.word}（权重 ${k.score.toFixed(2)}）`).join('\n')
}
