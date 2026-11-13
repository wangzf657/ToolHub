/**
 * 可读性报告纯逻辑（readability-checker 组件的可测性提取）。
 * 口径 = nlpEngine.readability + 中文等级标签重校准（rx2：按句均字数描述，不套用 Flesch 学段话术）。
 */
import { readability } from '@/lib/nlpEngine'

export type ReadabilityResult = ReturnType<typeof readability>

/** 中文口径等级标签 */
export function cnLevelLabel(r: ReadabilityResult): string {
  if (r.mode === 'cn') {
    return r.score > 80 ? '很容易（短句白话）' : r.score > 60 ? '容易（句子适中）' : r.score > 40 ? '中等（长句偏多）' : r.score > 20 ? '较难（长句密集）' : '很难（长句为主）'
  }
  return r.level
}

/** 一步到位：文本 → 多行可读性报告（测试与组件共用） */
export function readabilitySummary(src: string): string {
  const t = src.trim()
  if (!t) return ''
  const r = readability(t)
  const cn = r.mode === 'cn'
  const lines = [
    `综合可读性评分：${r.score.toFixed(0)} / 100（${cn ? cnLevelLabel(r) : r.level}）`,
    `句子数：${r.sentences}`,
    `字词数：${r.words}`,
    cn ? `句均字数：${r.avgSentenceLen.toFixed(1)} 字/句` : `平均句长：${r.avgSentenceLen.toFixed(1)} 词/句`,
  ]
  if (cn) lines.push('口径说明：中文文本按「句均字数」简化估分，不套用英文 Flesch 公式。')
  return lines.join('\n')
}
