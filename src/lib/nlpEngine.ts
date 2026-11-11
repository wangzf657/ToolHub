/**
 * 轻量中文 NLP 引擎：即时可用、完全离线。
 * 覆盖：分词、摘要（TextRank 抽取式）、关键词（TF-IDF）、情感（词典规则）、
 * 实体识别（规则）、情绪、问答抽取、改写、可读性、翻译（基础词库）。
 * AI 模型增强（可选）由 useModel 组合式另行懒加载。
 */
import { tokenizeWords, STOPWORDS } from './textEngine'

/* ---------------- 句子切分 ---------------- */

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[。！？!?；;])\s*|(?<=\.)\s+(?=[A-Z\u4e00-\u9fff])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
}

/* ---------------- 摘要（TextRank 抽取式） ---------------- */

export function summarize(text: string, sentenceCount = 3): { sentences: string[]; summary: string } {
  const sentences = splitSentences(text)
  if (sentences.length <= sentenceCount) {
    return { sentences, summary: sentences.join('') }
  }
  // 词频
  const freq = new Map<string, number>()
  for (const s of sentences) {
    for (const w of tokenizeWords(s)) {
      const k = w.toLowerCase()
      if (STOPWORDS.has(k)) continue
      freq.set(k, (freq.get(k) ?? 0) + 1)
    }
  }
  const max = Math.max(...freq.values(), 1)
  // 句子打分：词频 + 位置 + 长度
  const scored = sentences.map((s, i) => {
    const words = tokenizeWords(s)
    let score = 0
    for (const w of words) score += (freq.get(w.toLowerCase()) ?? 0) / max
    score /= Math.sqrt(Math.max(1, words.length))
    // 首段权重
    if (i < sentences.length * 0.2) score *= 1.25
    // 位置中心
    score *= 1 + 0.3 * Math.cos((i / (sentences.length - 1)) * Math.PI)
    return { s, i, score }
  })
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => a.i - b.i)
  return { sentences, summary: top.map((t) => t.s).join('') }
}

/* ---------------- 关键词 ---------------- */

/** 中文词级停用词：整词等于这些高频功能词时不是关键词（滑窗会产出这类碎片） */
const CN_STOP_WORDS = new Set(
  ('我们 你们 他们 它们 自己 什么 怎么 为什么 哪里 这个 那个 这些 那些 现在 已经 还有 因此 所以 但是 而且 并且 或者 如果 虽然 不过 于是 然后 当然 其实 也许 可能 应该 可以 能够 需要 知道 认为 时候 地方 东西 问题 事情 情况 方面 部分 进行 成为 使得 对于 关于 通过 根据 按照 由于 除了 并且 一下 一些 一定 一样 一直 一起 还是 就是 也是 不是 没有 不能 不会 不要 或者 以及 各种 各个 每 每个 其他 另外 例如 比如 其中 之间 之前 之后 以后 后来 首先 其次 最后 今天 明天 昨天').
    split(/\s+/),
)

/** 常见虚词字符：出现在候选词首/尾时视为碎片过滤 */
const CN_STOP_CHARS = new Set(
  '的了和是与就都在不有我你他她们这那也被把让给向对于从以为之其或并且很挺更最又再才只等吧吗呢啊呀哦嗯个上下中里外来说去看着过地得着之',
)

export function extractKeywords(text: string, n = 10): { word: string; score: number }[] {
  const sentences = splitSentences(text)
  const tokens = sentences.map((s) => keywordTokens(s))
  const tf = new Map<string, number>()
  const df = new Map<string, number>()
  for (const toks of tokens) {
    const seen = new Set<string>()
    for (const t of toks) {
      tf.set(t, (tf.get(t) ?? 0) + 1)
      if (!seen.has(t)) {
        seen.add(t)
        df.set(t, (df.get(t) ?? 0) + 1)
      }
    }
  }
  const N = Math.max(1, tokens.length)
  const scored = [...tf.entries()]
    .filter(([w]) => !/^\d+$/.test(w))
    .map(([w, count]) => ({
      word: w,
      // 平滑 IDF：即使词出现在所有句子（df = N）权重也不为 0；长度因子封顶 2.5，
      // 保证只出现一次的完整长词（5–6 字）不会压过出现两次的核心短词
      score: count * Math.log(1 + N / Math.max(1, df.get(w) ?? 1)) * Math.min(2.5, w.length / 2),
    }))
    // 同分时长词优先：完整词与少首字的滑窗碎片同分时，让完整词先入选（碎片随后被去重掉）
    .sort((a, b) => b.score - a.score || b.word.length - a.word.length || a.word.localeCompare(b.word))
  // 去重：包含关系 + 高度重叠（与已选词共享 ≥3 字连续子串的跨词碎片，如「工智能技」之于「人工智能」）
  const out: { word: string; score: number }[] = []
  for (const s of scored) {
    if (out.some((o) => o.word.includes(s.word) || s.word.includes(o.word))) continue
    if (s.word.length >= 3 && out.some((o) => sharesSubstring(o.word, s.word, 3))) continue
    out.push(s)
    if (out.length >= n) break
  }
  return out
}

/** 两词是否共享长度 ≥ k 的连续公共子串 */
function sharesSubstring(a: string, b: string, k: number): boolean {
  for (let i = 0; i + k <= b.length; i++) {
    if (a.includes(b.slice(i, i + k))) return true
  }
  return false
}

/** 关键词候选：英文按词，中文按 2–6 字滑窗（5–6 字保证「计算机视觉」类完整长词成为候选），并过滤首尾含虚词的碎片 */
function keywordTokens(s: string): string[] {
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
      // 任意位置含虚词字符的中文候选视为碎片（如「的时」「能的应用」）
      return ![...t].some((ch) => CN_STOP_CHARS.has(ch))
    })
}

/* ---------------- 情感分析（中文情感词典 + 规则） ---------------- */

const POS_WORDS = new Set(
  ('好 很好 优秀 出色 完美 满意 喜欢 爱 棒 强 推荐 赞 值得 顺利 快 高兴 开心 惊喜 便宜 划算 清晰 流畅 稳定 安全 方便 简单 智能 好用 售后 专业 耐心 热情 舒服 轻薄 续航 拍照 音质 性价比 还行 不错 优秀级 极佳 超预期 好评 满意度 高效 精美 真香 好评如潮 无可挑剔 值 干净 整洁 及时 周到 体贴 好评好评').split(
    /\s+/,
  ),
)
const NEG_WORDS = new Set(
  ('差 垃圾 不好 差劲 失望 后悔 坑 骗 假 冒 伪劣 卡顿 卡 慢 贵 难用 难受 难看 难听 丑 坏 破 漏水 发热 掉漆 褪色 色差 瑕疵 划痕 异味 噪音 售后差 投诉 退货 换货 维修 拖延 态度差 敷衍 骗局 虚假 缩水 阉割 翻车 翻车了 崩溃 死机 重启 断连 断货 缺货 骗人 服了 无语 离谱 扯皮 霸王条款 过敏 不推荐 别买 避雷 踩雷 踩坑 血亏 亏 惨 不值 一般般 凑合 勉强').split(
    /\s+/,
  ),
)
const INTENSIFIERS = new Set(['很', '非常', '特别', '超', '太', '极', '十分', '相当', '蛮', '挺', '更', '最', '真的', '实在'])
const NEGATIONS = new Set(['不', '没', '没有', '无', '非', '别', '莫', '未', '毫不', '并不', '从不'])

export interface SentimentResult {
  score: number // -1 .. 1
  label: '正面' | '负面' | '中性'
  positive: string[]
  negative: string[]
}

export function sentiment(text: string): SentimentResult {
  const chars = [...text]
  const pos: string[] = []
  const neg: string[] = []
  let score = 0
  const maxWordLen = 4
  for (let i = 0; i < chars.length; i++) {
    let matched = ''
    for (let len = maxWordLen; len >= 1; len--) {
      const w = chars.slice(i, i + len).join('')
      if (POS_WORDS.has(w) || NEG_WORDS.has(w)) {
        matched = w
        break
      }
    }
    if (!matched) continue
    let val = POS_WORDS.has(matched) ? 1 : -1
    // 否定翻转
    const window = chars.slice(Math.max(0, i - 2), i).join('')
    if (NEGATIONS.has([...window].slice(-1)[0] ?? '') || /不|没|无|非/.test(window)) val = -val
    // 程度副词加强
    if ([...window].some((c) => INTENSIFIERS.has(c))) val *= 1.5
    score += val
    if (val > 0) pos.push(matched)
    else neg.push(matched)
    i += matched.length - 1
  }
  const norm = Math.max(-1, Math.min(1, score / 6))
  return {
    score: norm,
    label: norm > 0.08 ? '正面' : norm < -0.08 ? '负面' : '中性',
    positive: [...new Set(pos)],
    negative: [...new Set(neg)],
  }
}

/* ---------------- 情绪识别 ---------------- */

const EMOTION_LEX: { emo: string; color: string; words: string[] }[] = [
  { emo: '喜悦', color: '#f59e0b', words: ['开心', '高兴', '快乐', '兴奋', '太好了', '哈哈', '太棒', '喜欢', '幸福', '满意', '惊喜', '笑'] },
  { emo: '悲伤', color: '#60a5fa', words: ['难过', '伤心', '哭', '遗憾', '失望', '低落', '痛苦', '想他', '想她', '怀念', '唉'] },
  { emo: '愤怒', color: '#ef4444', words: ['气死', '生气', '愤怒', '恶心', '烦', '滚', '无耻', '可恶', '忍无可忍', '离谱', '坑'] },
  { emo: '恐惧', color: '#8b5cf6', words: ['害怕', '担心', '恐惧', '紧张', '焦虑', '慌', '怕', '不安', '压力大'] },
  { emo: '爱', color: '#f472b6', words: ['爱', '想你', '爱你', '宝贝', '亲爱', '喜欢', '心动', '浪漫', '在一起'] },
  { emo: '惊讶', color: '#34d399', words: ['竟然', '居然', '卧槽', '天哪', '不会吧', '震惊', '没想到', '意外', '哇'] },
]

export interface EmotionResult {
  emotions: { emo: string; color: string; count: number }[]
  dominant: string | null
}

export function detectEmotion(text: string): EmotionResult {
  const hits = EMOTION_LEX.map((e) => ({
    emo: e.emo,
    color: e.color,
    count: e.words.reduce((n, w) => n + (text.split(w).length - 1), 0),
  }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
  return { emotions: hits, dominant: hits[0]?.emo ?? null }
}

/* ---------------- 实体识别（规则） ---------------- */

export interface Entity {
  type: '人名' | '地名' | '机构' | '时间' | '金额' | '邮箱' | '电话' | '网址' | '百分比'
  text: string
  start: number
}

const ORG_SUFFIX = /(公司|集团|大学|学院|研究院|研究所|银行|医院|基金会|委员会|部|局|协会|工作室|实验室|中心)$/
const SURNAME = '李王张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split('')

export function extractEntities(text: string): Entity[] {
  const out: Entity[] = []
  const push = (type: Entity['type'], m: RegExpExecArray) => {
    out.push({ type, text: m[0], start: m.index })
  }
  // 邮箱 / 电话 / 网址 / 金额 / 百分比 / 日期时间
  for (const [type, pattern] of [
    ['邮箱', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
    ['网址', /https?:\/\/[^\s，。；！？,;!?"'<>]+/g],
    ['电话', /(?:\+?86[- ]?)?1[3-9]\d{9}|\d{3,4}-\d{7,8}/g],
    ['金额', /[¥￥$€£]\s?\d[\d,，]*(?:\.\d+)?(?:\s?[万亿kKmM])?|\d[\d,，]*(?:\.\d+)?\s*(?:元|万元|亿元|美元|万|亿)/g],
    ['百分比', /\d+(?:\.\d+)?%/g],
    ['时间', /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?|\d{1,2}月\d{1,2}[日号]|\d{1,2}:\d{2}/g],
  ] as [Entity['type'], RegExp][]) {
    let m: RegExpExecArray | null
    const re = new RegExp(pattern.source, pattern.flags)
    while ((m = re.exec(text))) push(type, m)
  }
  // 机构：以常见后缀结尾的前置词
  const orgRe = /[\u4e00-\u9fffA-Za-z0-9]{2,12}(?:公司|集团|大学|学院|研究院|研究所|银行|医院|工作室|实验室)/g
  let m: RegExpExecArray | null
  while ((m = orgRe.exec(text))) push('机构', m)
  // 人名：常见姓氏 + 1-2 字
  for (let i = 0; i < text.length - 2; i++) {
    if (!SURNAME.includes(text[i])) continue
    const candidate = text.slice(i, i + 2)
    const candidate3 = text.slice(i, i + 3)
    const after = text[i + 2] ?? text[i + 3] ?? ''
    const boundary = /[，。！？、；：""''（）\s]|$/
    if (/^[\u4e00-\u9fff]{2}$/.test(candidate) && !POS_WORDS.has(candidate) && !NEG_WORDS.has(candidate)) {
      const nextChar = text[i + 2]
      const isEnd = i + 2 >= text.length || boundary.test(nextChar)
      const looksLikeName = !/(们|说|的|在|是|和|与|对|为|要|会|能|去|来|看|听|做|用|有|个|中|上|下|这|那)/.test(candidate.slice(1)) && isEnd
      if (looksLikeName && i > 0 && /[\s，。、；：""''（!?.!?,;:]/.test(text[i - 1])) {
        if (!out.some((e) => e.start <= i && i < e.start + e.text.length)) {
          out.push({ type: '人名', text: candidate, start: i })
        }
      }
    }
    void candidate3
    void after
  }
  return out.sort((a, b) => a.start - b.start)
}

/* ---------------- 问答抽取 ---------------- */

export function answerFromPassage(passage: string, question: string): { answer: string; sentence: string } | null {
  const qTokens = tokenizeWords(question.toLowerCase())
  const sentences = splitSentences(passage)
  let best: { s: string; score: number } | null = null
  for (const s of sentences) {
    const tokens = tokenizeWords(s.toLowerCase())
    let score = 0
    for (const q of qTokens) {
      if (STOPWORDS.has(q) || q.length < 1) continue
      if (tokens.some((t) => t.includes(q) || q.includes(t))) score += q.length > 1 ? 2 : 1
    }
    // 常见疑问词引导的答案模式
    if (/谁/.test(question) && /[先生|女士|博士|教授|总|经理|作者|创始人]/.test(s)) score += 2
    if (/多少|几/.test(question) && /\d/.test(s)) score += 2
    if (/什么时候|何时|哪年/.test(question) && /\d{4}|\d+月/.test(s)) score += 2
    if (/哪里|哪儿|在哪/.test(question) && /(位于|位于|在.+市|省|国|路|街)/.test(s)) score += 2
    if (!best || score > best.score) best = { s, score }
  }
  if (!best || best.score <= 0) return null
  return { answer: best.s, sentence: best.s }
}

/* ---------------- 改写（同义词替换 + 句式） ---------------- */

const SYNONYMS: Record<string, string[]> = {
  非常: ['十分', '极其', '格外'],
  很多: ['不少', '大量', '诸多'],
  但是: ['然而', '不过', '可是'],
  因为: ['由于', '鉴于'],
  所以: ['因此', '于是'],
  如果: ['倘若', '假如', '若是'],
  现在: ['如今', '当前', '目前'],
  可能: ['或许', '也许', '大概'],
  重要: ['关键', '要紧', '重大'],
  提高: ['提升', '增加', '增强'],
  降低: ['下降', '减少', '减低'],
  立即: ['马上', '立刻', '当即'],
  帮助: ['协助', '辅助'],
  使用: ['运用', '采用', '利用'],
  获得: ['取得', '得到', '收获'],
  想要: ['希望', '打算'],
  觉得: ['认为', '感到'],
  快速: ['迅速', '快速地', '敏捷'],
  简单: ['简易', '容易'],
  beautiful: ['lovely', 'gorgeous'],
  good: ['great', 'fine', 'nice'],
  bad: ['poor', 'awful'],
  big: ['large', 'huge'],
  small: ['little', 'tiny'],
  fast: ['quick', 'rapid'],
  use: ['utilize', 'employ'],
  make: ['create', 'produce'],
  show: ['display', 'demonstrate'],
  help: ['assist', 'aid'],
}

export function paraphrase(text: string, intensity = 1): string {
  let out = text
  const entries = Object.entries(SYNONYMS)
  let idx = 0
  for (const [from, tos] of entries) {
    const re = new RegExp(from, 'g')
    out = out.replace(re, () => {
      idx++
      if (idx % Math.ceil(1 / intensity) !== 0 && intensity < 1) return from
      return tos[idx % tos.length]
    })
  }
  // 「的」字句序微调：X 的 Y → Y（X 的） 保留原样较安全，跳过
  return out
}

/* ---------------- 可读性 ---------------- */

export function readability(text: string): { sentences: number; words: number; avgSentenceLen: number; avgWordLen: number; score: number; level: string; mode: 'cn' | 'en' } {
  const sentences = splitSentences(text)
  const en = (text.match(/[a-zA-Z]+/g) ?? []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const words = cjk + en
  const avgSentenceLen = sentences.length ? words / sentences.length : words
  const levelOf = (score: number) =>
    score > 80 ? '很容易（初中及以下）' : score > 60 ? '容易（初中）' : score > 40 ? '中等（高中）' : score > 20 ? '较难（大学）' : '很难（专业）'
  // 中文为主（汉字数多于英文词数）走中文口径：旧逻辑在无英文词时把全文汉字总数当"平均词长"，
  // 词长罚分直接把纯中文文本评分压成 0，此处改为按句均字数的简化可读性
  if (cjk > en) {
    // 简化中文口径：句均 30 字以内每字扣 0.9 分，超出部分每字扣 0.45 分（长句边际递减）
    const score = Math.max(0, Math.min(100, 100 - (avgSentenceLen <= 30 ? avgSentenceLen * 0.9 : 27 + (avgSentenceLen - 30) * 0.45)))
    // 中文以双字词为主，按 1.7 字/词估算词长
    return { sentences: sentences.length, words, avgSentenceLen, avgWordLen: 1.7, score, level: levelOf(score), mode: 'cn' }
  }
  // 英文口径（保持原公式）：句长 + 词长综合罚分
  const enChars = (text.match(/[a-zA-Z]/g) ?? []).length
  const avgWordLen = en ? enChars / en : 0
  const score = Math.max(0, Math.min(100, 100 - avgSentenceLen * 2.2 - Math.max(0, avgWordLen - 2) * 4))
  return { sentences: sentences.length, words, avgSentenceLen, avgWordLen, score, level: levelOf(score), mode: 'en' }
}

/* ---------------- 关键词密度 ---------------- */

export function keywordDensity(
  text: string,
  nGram = 3,
): { phrase: string; count: number; density: number }[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  const totalWords = (clean.match(/[\u4e00-\u9fff]|[a-zA-Z]+/g) ?? []).length
  const out: { phrase: string; count: number; density: number }[] = []
  for (let n = 1; n <= nGram; n++) {
    const grams = new Map<string, number>()
    if (n === 1) {
      const tokens = clean.match(/[\u4e00-\u9fff]|[a-zA-Z]+/g) ?? []
      for (const t of tokens) {
        if (STOPWORDS.has(t.toLowerCase()) || t.length < 2) continue
        grams.set(t, (grams.get(t) ?? 0) + 1)
      }
    } else {
      // 中文 n-gram 与英文词组
      const cn = clean.match(/[\u4e00-\u9fff]+/g) ?? []
      for (const seg of cn) {
        for (let i = 0; i + n <= seg.length; i++) {
          const g = seg.slice(i, i + n)
          grams.set(g, (grams.get(g) ?? 0) + 1)
        }
      }
      const enTokens = clean.match(/[a-zA-Z]+/g) ?? []
      for (let i = 0; i + n <= enTokens.length; i++) {
        const g = enTokens.slice(i, i + n).join(' ').toLowerCase()
        grams.set(g, (grams.get(g) ?? 0) + 1)
      }
    }
    for (const [phrase, count] of grams) {
      if (count >= 2) out.push({ phrase, count, density: (count * n * 100) / Math.max(1, totalWords) })
    }
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 50)
}

/* ---------------- 基础翻译（离线词库，诚实标注） ---------------- */

const DICT: Record<string, Partial<Record<'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru', string>>> = {
  你好: { en: 'hello', ja: 'こんにちは', ko: '안녕하세요', fr: 'bonjour', de: 'hallo', es: 'hola', ru: 'привет' },
  谢谢: { en: 'thank you', ja: 'ありがとう', ko: '감사합니다', fr: 'merci', de: 'danke', es: 'gracias', ru: 'спасибо' },
  再见: { en: 'goodbye', ja: 'さようなら', ko: '안녕히 가세요', fr: 'au revoir', de: 'auf wiedersehen', es: 'adiós', ru: 'до свидания' },
  我: { en: 'I', ja: '私', ko: '나', fr: 'je', de: 'ich', es: 'yo', ru: 'я' },
  你: { en: 'you', ja: 'あなた', ko: '너', fr: 'tu', de: 'du', es: 'tú', ru: 'ты' },
  爱: { en: 'love', ja: '愛', ko: '사랑', fr: 'amour', de: 'Liebe', es: 'amor', ru: 'любовь' },
  时间: { en: 'time', ja: '時間', ko: '시간', fr: 'temps', de: 'Zeit', es: 'tiempo', ru: 'время' },
  工作: { en: 'work', ja: '仕事', ko: '일', fr: 'travail', de: 'Arbeit', es: 'trabajo', ru: 'работа' },
  朋友: { en: 'friend', ja: '友達', ko: '친구', fr: 'ami', de: 'Freund', es: 'amigo', ru: 'друг' },
  水: { en: 'water', ja: '水', ko: '물', fr: 'eau', de: 'Wasser', es: 'agua', ru: 'вода' },
  好: { en: 'good', ja: '良い', ko: '좋다', fr: 'bon', de: 'gut', es: 'bueno', ru: 'хорошо' },
  是: { en: 'yes', ja: 'はい', ko: '네', fr: 'oui', de: 'ja', es: 'sí', ru: 'да' },
  不是: { en: 'no', ja: 'いいえ', ko: '아니요', fr: 'non', de: 'nein', es: 'no', ru: 'нет' },
  网站: { en: 'website', ja: 'ウェブサイト' },
  文件: { en: 'file', ja: 'ファイル' },
  图片: { en: 'image', ja: '画像' },
  视频: { en: 'video', ja: '動画' },
  工具: { en: 'tool', ja: 'ツール' },
  中国: { en: 'China', ja: '中国' },
  今天: { en: 'today', ja: '今日' },
  明天: { en: 'tomorrow', ja: '明日' },
}

export function translateBasic(text: string, to: string): { result: string; coverage: number } {
  if (to === 'zh') {
    // 反查：英→中
    let hit = 0
    let total = 0
    const result = text.replace(/[a-zA-Z]+/g, (w) => {
      total++
      for (const [zh, tr] of Object.entries(DICT)) {
        if (tr.en?.toLowerCase() === w.toLowerCase()) {
          hit++
          return zh
        }
      }
      return w
    })
    return { result, coverage: total ? hit / total : 0 }
  }
  let hit = 0
  let total = 0
  const result = text.replace(/[\u4e00-\u9fff]+|[a-zA-Z]+/g, (w) => {
    total++
    const tr = DICT[w]?.[to as 'en']
    if (tr) {
      hit++
      return tr
    }
    return w
  })
  return { result, coverage: total ? hit / total : 0 }
}

export const TRANSLATE_LANGS: { value: string; label: string }[] = [
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'ru', label: '俄语' },
  { value: 'zh', label: '中文' },
]

/* ---------------- 相似度 ---------------- */

export function similarity(a: string, b: string): number {
  const sa = new Set(tokenizeWords(a.toLowerCase()))
  const sb = new Set(tokenizeWords(b.toLowerCase()))
  if (!sa.size || !sb.size) return 0
  let inter = 0
  for (const w of sa) if (sb.has(w)) inter++
  return inter / Math.sqrt(sa.size * sb.size)
}

/* ---------------- 语法检查（基础规则） ---------------- */

export interface GrammarIssue {
  msg: string
  suggestion: string
  index: number
}

export function grammarCheck(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  const rules: { re: RegExp; msg: string; fix: string }[] = [
    { re: /的的地/g, msg: '重复的「的的」', fix: '的' },
    { re: /了了/g, msg: '重复的「了了」', fix: '了' },
    { re: /在在/g, msg: '重复的「在在」', fix: '在' },
    { re: /是是/g, msg: '重复的「是是」', fix: '是' },
    { re: /地地/g, msg: '重复的「地地」', fix: '地' },
    { re: /得得/g, msg: '重复的「得得」', fix: '得' },
    { re: /([，。！？；：])\1+/g, msg: '重复标点', fix: '$1' },
    { re: /因为\s*所以所以|所以所以/g, msg: '「所以所以」重复', fix: '所以' },
    { re: /非常非常/g, msg: '「非常非常」叠用', fix: '非常' },
    { re: /([a-zA-Z])\1{4,}/g, msg: '字母重复过多', fix: '$1$1' },
    { re: /  +/g, msg: '多余空格', fix: ' ' },
    { re: /[（(][^）)]*$/gm, msg: '括号未闭合', fix: '' },
    { re: /。。|。。/g, msg: '句号重复', fix: '。' },
  ]
  for (const r of rules) {
    let m: RegExpExecArray | null
    const re = new RegExp(r.re.source, r.re.flags)
    while ((m = re.exec(text))) {
      issues.push({ msg: r.msg, suggestion: m[0].replace(new RegExp(r.re.source, r.re.flags.replace('g', '')), r.fix), index: m.index })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  // 英文基础：i 应大写
  let m: RegExpExecArray | null
  const reI = /(^|[.!?]\s+|\s)i(\s|[,.!?]|$)/g
  while ((m = reI.exec(text))) {
    issues.push({ msg: '英文 “i” 作为代词应大写', suggestion: 'I', index: m.index })
  }
  return issues
}
