/**
 * 关键词密度统计纯逻辑（keyword-density-checker 组件的可测性提取）。
 * 1–3 词组密度（口径与 nlpEngine.keywordDensity 一致，参数化停用词开关）+ 目标词判级（rx1）。
 */
import { STOPWORDS } from '@/lib/textEngine'

export interface DensityItem {
  phrase: string
  count: number
  len: number
  density: number
}

export interface DensityOpts {
  n1?: boolean
  n2?: boolean
  n3?: boolean
  stopwords?: boolean
}

/** 本地 1–3 词组密度统计（仅返回出现 ≥2 次的词组，按次数排序，最多 30 条） */
export function densityItems(src: string, opts: DensityOpts = {}): DensityItem[] {
  const { n1 = true, n2 = true, n3 = true, stopwords = true } = opts
  const clean = src.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const totalWords = (clean.match(/[\u4e00-\u9fff]|[a-zA-Z]+/g) ?? []).length
  const map = new Map<string, { count: number; len: number }>()
  const put = (g: string, len: number) => map.set(g, { count: (map.get(g)?.count ?? 0) + 1, len: map.get(g)?.len ?? len })
  const ngrams = [n1 ? 1 : 0, n2 ? 2 : 0, n3 ? 3 : 0].filter(Boolean)
  for (const n of ngrams) {
    if (n === 1) {
      const tokens = clean.match(/[\u4e00-\u9fff]|[a-zA-Z]+/g) ?? []
      for (const t of tokens) {
        if (t.length < 2) continue
        if (stopwords && STOPWORDS.has(t.toLowerCase())) continue
        put(t, 1)
      }
    } else {
      const cn = clean.match(/[\u4e00-\u9fff]+/g) ?? []
      for (const seg of cn) {
        for (let i = 0; i + n <= seg.length; i++) put(seg.slice(i, i + n), n)
      }
      const enTokens = clean.match(/[a-zA-Z]+/g) ?? []
      for (let i = 0; i + n <= enTokens.length; i++) put(enTokens.slice(i, i + n).join(' ').toLowerCase(), n)
    }
  }
  return [...map.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([phrase, v]) => ({ phrase, count: v.count, len: v.len, density: (v.count * v.len * 100) / Math.max(1, totalWords) }))
    .sort((a, b) => b.count - a.count || b.density - a.density)
    .slice(0, 30)
}

export type DensityGrade = '偏低' | '健康' | '堆砌风险'

export interface TargetStat {
  count: number
  density: number
  grade: DensityGrade
}

/** rx1 目标词模式：次数、密度与判级（偏低 <0.5% / 健康 0.5–2.5% / 堆砌 >2.5%） */
export function targetStatOf(src: string, target: string): TargetStat | null {
  const t = target.trim()
  const clean = src.replace(/\s+/g, ' ').trim()
  if (!t || !clean) return null
  const count = clean.split(t).length - 1
  if (!count) return { count: 0, density: 0, grade: '偏低' }
  const gramLen = (t.match(/[\u4e00-\u9fff]|[a-zA-Z]+/g) ?? []).length || 1
  const totalWords = (clean.match(/[\u4e00-\u9fff]|[a-zA-Z]+/g) ?? []).length
  const density = (count * gramLen * 100) / Math.max(1, totalWords)
  const grade: DensityGrade = density > 2.5 ? '堆砌风险' : density >= 0.5 ? '健康' : '偏低'
  return { count, density, grade }
}
