/**
 * 文本摘要纯逻辑（text-summarizer 组件的可测性提取）。
 * 口径与 nlpEngine.summarize 一致：词频 + 位置 + 长度打分，抽取式只挑原句。
 */
import { splitSentences } from '@/lib/nlpEngine'
import { tokenizeWords, STOPWORDS } from '@/lib/textEngine'

export interface RankedSentence {
  s: string
  i: number
  score: number
  len: number
}

export type LengthMode = 'count' | 'chars'

/** 句子打分：词频归一 + 首段加权 + 位置中心余弦 */
export function rankSentences(src: string): RankedSentence[] {
  const sentences = splitSentences(src)
  const freq = new Map<string, number>()
  for (const s of sentences) {
    for (const w of tokenizeWords(s)) {
      const k = w.toLowerCase()
      if (STOPWORDS.has(k)) continue
      freq.set(k, (freq.get(k) ?? 0) + 1)
    }
  }
  const max = Math.max(...freq.values(), 1)
  return sentences.map((s, i) => {
    const words = tokenizeWords(s)
    let score = 0
    for (const w of words) score += (freq.get(w.toLowerCase()) ?? 0) / max
    score /= Math.sqrt(Math.max(1, words.length))
    if (i < sentences.length * 0.2) score *= 1.25
    score *= 1 + 0.3 * Math.cos((i / Math.max(1, sentences.length - 1)) * Math.PI)
    return { s, i, score, len: s.length }
  })
}

/** 按句数或目标字数选取摘要句（保持原文顺序）；目标字数落在 75%~130% 区间 */
export function selectSentences(ranked: RankedSentence[], mode: LengthMode, count: number, targetChars: number): RankedSentence[] {
  if (!ranked.length) return []
  if (mode === 'count') {
    const n = Math.max(1, Math.min(ranked.length, Math.round(count) || 3))
    return ranked.slice().sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i)
  }
  const target = Math.max(50, Math.round(targetChars) || 200)
  const byScore = ranked.slice().sort((a, b) => b.score - a.score)
  const out: RankedSentence[] = []
  let total = 0
  for (const r of byScore) {
    if (total >= target * 0.75) break
    if (out.length && total + r.len > target * 1.3) break
    out.push(r)
    total += r.len
  }
  return out.sort((a, b) => a.i - b.i)
}

/** 一步到位：文本 → 摘要串（测试与组件共用） */
export function summarizeText(src: string, opts: { mode?: LengthMode; count?: number; targetChars?: number } = {}): string {
  const selected = selectSentences(rankSentences(src), opts.mode ?? 'count', opts.count ?? 3, opts.targetChars ?? 200)
  return selected.map((r) => r.s).join('')
}
