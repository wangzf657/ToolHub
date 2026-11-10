/**
 * 一次性迁移脚本:按「常用 + 高技术含量优先」原则重排各分类注册表的工具顺序。
 *
 * 规则:
 * 1. `FRONT` 中列出的 slug 按目标顺序提到数组最前(首页每个分类只露出前 8 个,前 8 直接决定曝光);
 * 2. 未列出的 slug 保持原有相对顺序依次排在后面,组注释跟随其后的条目一起移动;
 * 3. 强断言:条目数不变、slug 集合不变、无重复,防止重排弄丢工具;
 * 4. 顺带把文件头注释里过期的「N 项」计数修正为真实条目数。
 *
 * 解析器为字符级状态机:支持单行/多行条目、模板字符串与 ${} 插值、行/块注释,
 * 对 src/tools 下全部 11 个分类注册表统一处理(editors 仅 4 项无需重排)。
 *
 * 用法:node scripts/reorder-registry.mjs(可重复执行,幂等)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 期望条目数(与 docs/V1.1/工具清单-V1.1.md 一致),重排前后必须吻合 */
const EXPECT_COUNT = {
  image: 73,
  video: 42,
  audio: 38,
  pdf: 54,
  data: 18,
  utility: 135,
  developer: 92,
  finance: 20,
  business: 16,
  seo: 13,
  ai: 15,
}

/** 各分类希望前置的高频/旗舰工具,按目标顺序书写 */
const FRONT = {
  image: [
    'compress-image-to-size',
    'resize-image',
    'crop-image',
    'remove-background',
    'ocr',
    'passport-photo',
    'png-to-jpg',
    'jpg-to-png',
    'webp-to-jpg',
    'add-watermark',
    'photo-filters',
    'meme-generator',
    'merge-images-long',
    'batch-image-process',
    'gif-frame-extractor',
    'screen-color-picker',
  ],
  video: [
    'compress-video',
    'convert-video',
    'trim-video',
    'video-to-mp3',
    'merge-video',
    'video-to-gif',
    'add-subtitles-to-video',
    'video-thumbnail',
    'mute-video',
    'rotate-video',
    'video-editor',
  ],
  audio: [
    'text-to-speech',
    'audio-transcribe',
    'audio-trimmer',
    'voice-recorder',
    'speech-to-text',
    'convert-audio',
    'wav-to-mp3',
    'mp3-to-wav',
    'merge-audio',
    'vocal-remover',
    'remove-noise-from-audio',
    'audio-pitch-shift',
  ],
  pdf: [
    'merge-pdf',
    'split-pdf',
    'compress-pdf',
    'pdf-to-word',
    'pdf-to-jpg',
    'images-to-pdf',
    'unlock-pdf',
    'protect-pdf',
    'pdf-to-png',
    'watermark-pdf',
    'delete-pdf-pages',
    'pdf-editor',
    'signature-drawing',
    'insert-image-pdf',
    'compress-pptx',
  ],
  data: [
    'csv-viewer',
    'excel-to-csv',
    'csv-to-excel',
    'chart-from-csv',
    'compare-csv-files',
    'merge-csv-files',
    'remove-duplicates-from-csv',
    'data-analysis-tool',
    'excel-viewer',
  ],
  utility: [
    'qr-code-generator',
    'unit-converter',
    'word-counter',
    'loan-calculator',
    'mortgage-calculator',
    'password-generator',
    'uuid-generator',
    'age-calculator',
    'percentage-calculator',
    'bmi-calculator',
    'currency-converter',
    'scientific-calculator',
    'date-difference-calculator',
    'wifi-qr-code',
    'qr-code-scanner',
    'income-tax-calculator',
    'social-insurance-calculator',
    'pinyin-converter',
    'chinese-variant-converter',
    'lunar-calendar',
    'id-card-validator',
    'qr-code-styled',
    'qr-code-batch',
    'copybook-generator',
  ],
  developer: [
    'json-formatter',
    'timestamp-converter',
    'regex-tester',
    'text-diff',
    'base64-encoder',
    'url-encoder',
    'jwt-decoder',
    'hash-generator',
    'csv-to-json',
    'json-to-csv',
    'number-base-converter',
    'sql-formatter',
    'javascript-formatter',
    'docx-to-markdown',
    'markdown-to-docx',
    'html-to-markdown',
    'markdown-to-wechat',
    'code-playground',
    'json-to-excel',
    'regex-visualizer',
    'color-converter',
    'markdown-formatter',
    'markdown-toc',
    'markdown-to-image',
  ],
  finance: [
    'stock-average-calculator',
    'crypto-profit-calculator',
    'sip-calculator',
    'position-size-calculator',
    'cagr-calculator',
    'dividend-calculator',
    'fire-calculator',
    'kelly-criterion-calculator',
    'black-scholes-calculator',
  ],
  business: [
    'resume-builder',
    'take-home-pay-calculator',
    'roi-calculator',
    'freelance-rate-calculator',
    'break-even-calculator',
    'profit-margin-calculator',
    'ltv-calculator',
    'cash-flow-calculator',
  ],
  seo: [
    'sitemap-generator',
    'keyword-density-checker',
    'utm-builder',
    'serp-snippet-preview',
    'schema-faq-generator',
    'readability-checker',
    'heading-structure-checker',
    'schema-article-generator',
  ],
  ai: [
    'text-summarizer',
    'keyword-extractor',
    'translator',
    'sentiment-analyzer',
    'grammar-corrector',
    'paraphraser',
    'entity-extractor',
    'chat-with-pdf',
  ],
}

const DECL_RE = /^\s*(?:export )?const tools: ToolDef\[\] = \[\s*$/
const SLUG_RE = /\bslug:\s*['"]([^'"]+)['"]/

/** 逐行扫描一行源码,返回花括号深度增量;state/ctx 跨行保持(字符串/模板/注释/正则状态) */
function scanLine(line, state, ctx) {
  let delta = 0
  let i = 0
  const REGEX_ALLOWED_TAIL = /[([,!&|?{};:+\-*/%<>~^=(]$/
  const REGEX_AFTER_KEYWORD = /(^|[^$\w])(return|typeof|case|in|of|new|delete|void|do|else|yield|await)$/i
  const note = (ch) => {
    if (!/\s/.test(ch)) ctx.tail = (ctx.tail + ch).slice(-24)
  }
  while (i < line.length) {
    const c = line[i]
    const c2 = line[i + 1] ?? ''
    if (state.mode === 'normal') {
      // 正则字面量:仅在合法上文(运算符/括号/关键字之后)出现
      if (c === '/' && c2 !== '/' && c2 !== '*' && (REGEX_ALLOWED_TAIL.test(ctx.tail) || REGEX_AFTER_KEYWORD.test(ctx.tail))) {
        let j = i + 1
        let inClass = false
        let closed = false
        while (j < line.length) {
          const r = line[j]
          if (r === '\\') j += 2
          else if (r === '[') (inClass = true), j++
          else if (r === ']') (inClass = false), j++
          else if (r === '/' && !inClass) {
            closed = true
            j++
            break
          } else j++
        }
        if (!closed) throw new Error(`无法解析的正则字面量: ${line.slice(Math.max(0, i - 20), i + 60)}`)
        while (j < line.length && /[a-z]/i.test(line[j])) j++ // 消费 gimsuy 等标志
        ctx.tail = '/RE/'
        i = j
        continue
      }
      if (c === "'") state.mode = 'sq'
      else if (c === '"') state.mode = 'dq'
      else if (c === '`') state.mode = 'tmpl'
      else if (c === '/' && c2 === '/') break // 行注释,余下忽略
      else if (c === '/' && c2 === '*') {
        state.mode = 'bc'
        i += 2
        continue
      } else if (c === '{') delta++
      else if (c === '}') {
        delta--
        // ${} 插值闭合:回到模板字符串模式
        if (ctx.interp.length && ctx.depth + delta === ctx.interp[ctx.interp.length - 1]) {
          ctx.interp.pop()
          state.mode = 'tmpl'
        }
      }
      note(c)
      i++
    } else if (state.mode === 'sq' || state.mode === 'dq') {
      if (c === '\\') i += 2
      else if ((state.mode === 'sq' && c === "'") || (state.mode === 'dq' && c === '"')) {
        state.mode = 'normal'
        ctx.tail = "'" // 字符串刚结束,下一个 / 是除法而非正则
        i++
      } else i++
    } else if (state.mode === 'tmpl') {
      if (c === '\\') i += 2
      else if (c === '`') {
        state.mode = 'normal'
        ctx.tail = '`'
        i++
      } else if (c === '$' && c2 === '{') {
        ctx.interp.push(ctx.depth + delta)
        delta++
        state.mode = 'normal'
        i += 2
      } else i++
    } else if (state.mode === 'bc') {
      if (c === '*' && c2 === '/') {
        state.mode = 'normal'
        i += 2
      } else i++
    }
  }
  return delta
}

/** 把注册表源码切成:声明前行 + 数组条目(含其头部注释)+ 结尾行 */
function parseRegistry(src, cat) {
  const lines = src.split('\n')
  const declIdx = lines.findIndex((l) => DECL_RE.test(l))
  if (declIdx < 0) throw new Error(`${cat}: 找不到 tools 数组声明`)
  const state = { mode: 'normal' }
  const ctx = { interp: [], tail: '' }
  let depth = 0
  const items = []
  let pending = []
  let cur = null
  let endLine = -1
  for (let i = declIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (cur === null) {
      if (t === '' || t.startsWith('/*') || t.startsWith('*') || t.startsWith('//')) {
        pending.push(line)
        continue
      }
      if (t.startsWith(']')) {
        endLine = i
        break
      }
      cur = { head: pending.filter((l, idx, arr) => l.trim() !== '' || idx === arr.length - 1), body: [line] }
      pending = []
      ctx.depth = depth
      depth += scanLine(line, state, ctx)
      if (depth === 0) {
        items.push(cur)
        cur = null
      }
    } else {
      cur.body.push(line)
      ctx.depth = depth
      depth += scanLine(line, state, ctx)
      if (depth === 0) {
        items.push(cur)
        cur = null
      }
    }
  }
  if (cur !== null) throw new Error(`${cat}: 存在未闭合的条目`)
  if (endLine < 0) throw new Error(`${cat}: 找不到数组结尾 ]`)
  return { lines, declIdx, endLine, items }
}

for (const [cat, order] of Object.entries(FRONT)) {
  const file = join(root, `src/tools/${cat}/registry.ts`)
  const { lines, declIdx, endLine, items } = parseRegistry(readFileSync(file, 'utf8'), cat)

  if (items.length !== EXPECT_COUNT[cat]) {
    throw new Error(`${cat}: 条目数 ${items.length} ≠ 期望 ${EXPECT_COUNT[cat]},请先核对 EXPECT_COUNT`)
  }

  const bySlug = new Map()
  for (const it of items) {
    const m = it.body.join('\n').match(SLUG_RE)
    if (!m) throw new Error(`${cat}: 条目缺少 slug:\n${it.body[0]}`)
    if (bySlug.has(m[1])) throw new Error(`${cat}: 重复 slug ${m[1]}`)
    bySlug.set(m[1], it)
  }

  const missing = order.filter((s) => !bySlug.has(s))
  if (missing.length) throw new Error(`${cat}: 目标顺序包含不存在的 slug: ${missing.join(', ')}`)

  const listedSet = new Set(order)
  const listed = order.map((s) => bySlug.get(s))
  const rest = items.filter((it) => !listedSet.has(it.body.join('\n').match(SLUG_RE)[1]))

  const outItems = [...listed, ...rest]
  const bodyLines = outItems.flatMap((it) => [...it.head, ...it.body])

  // 修正文件头注释里过期的「N 项」计数
  const headFixed = lines.slice(0, declIdx + 1).map((l) => l.replace(/(\d+) 项/, `${items.length} 项`))
  const out = [...headFixed, ...bodyLines, ...lines.slice(endLine)]

  // 终检:重排后 slug 序列与原集合一致
  const slugsOf = (arr) => arr.map((it) => it.body.join('\n').match(SLUG_RE)[1])
  const before = slugsOf(items).slice().sort().join()
  const after = slugsOf(outItems).slice().sort().join()
  if (before !== after) throw new Error(`${cat}: slug 集合发生变化!`)

  writeFileSync(file, out.join('\n'))
  console.log(`✓ ${cat}: 共 ${items.length} 项,前置 ${listed.length} 项`)
}

console.log('完成。请运行 npm run test 与 npm run build 验证。')
