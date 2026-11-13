/**
 * 可测性出口（仅供 scripts/tests 引擎级测试打包使用，不进入运行时依赖图）。
 * 组件与测试共用同一纯逻辑模块，保证「断言与 UI 完全同源」。
 */
export { summarizeText } from './ai/components/summarizer'
export { findIssues, applyFixes, correctGrammarText } from './ai/components/grammarRules'
export { paraphraseText, planReplacements, findMatches, SYNONYMS } from './ai/components/paraphraserCore'
export { topKeywords, extractKeywordsText, keywordTokens } from './ai/components/keywordExtractor'
export { readabilitySummary, cnLevelLabel } from './seo/components/readabilityReport'
export { densityItems, targetStatOf } from './seo/components/keywordDensityCore'
