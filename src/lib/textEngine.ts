/** 文本引擎：纯函数文本工具集合（无依赖） */

/* ---------------- 计数 ---------------- */

export interface TextStats {
  chars: number
  charsNoSpaces: number
  words: number
  cjk: number
  englishWords: number
  lines: number
  sentences: number
  paragraphs: number
  readingMinutes: number
}

export function textStats(text: string): TextStats {
  const chars = text.length
  const charsNoSpaces = text.replace(/\s/g, '').length
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length
  const englishWords = (text.match(/[a-zA-Z0-9]+(?:[''-][a-zA-Z0-9]+)*/g) ?? []).length
  const words = cjk + englishWords
  const lines = text === '' ? 0 : text.split(/\n/).length
  const sentences = (text.match(/[^.!?。！？]+[.!?。！？]+/g) ?? (text.trim() ? [text] : [])).length
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length
  const readingMinutes = Math.ceil(words / 300)
  return { chars, charsNoSpaces, words, cjk, englishWords, lines, sentences, paragraphs, readingMinutes }
}

/* ---------------- 大小写转换 ---------------- */

export function toCase(text: string, mode: string): string {
  switch (mode) {
    case 'upper':
      return text.toUpperCase()
    case 'lower':
      return text.toLowerCase()
    case 'title':
      return text.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    case 'sentence':
      return text
        .toLowerCase()
        .replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase())
    case 'camel':
      return text
        .replace(/[\s_-]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (m) => m.toLowerCase())
    case 'pascal':
      return text
        .replace(/[\s_-]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (m) => m.toUpperCase())
    case 'snake':
      return text
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase()
    case 'kebab':
      return text
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase()
    case 'constant':
      return toCase(text, 'snake').toUpperCase()
    case 'alternating':
      return text
        .split('')
        .map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase()))
        .join('')
    case 'inverse':
      return text
        .split('')
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join('')
    default:
      return text
  }
}

/* ---------------- 行操作 ---------------- */

export function sortLines(text: string, opts: { mode?: 'alpha' | 'alphaDesc' | 'numeric' | 'numericDesc' | 'length' | 'lengthDesc' | 'shuffle' | 'reverse'; unique?: boolean; ignoreCase?: boolean; trim?: boolean } = {}): string {
  let lines = text.split('\n')
  if (opts.trim) lines = lines.map((l) => l.trim())
  if (opts.unique) {
    const seen = new Set<string>()
    lines = lines.filter((l) => {
      const k = opts.ignoreCase ? l.toLowerCase() : l
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const cmp = (a: string, b: string) => {
    switch (opts.mode) {
      case 'alphaDesc':
        return b.localeCompare(a, 'zh-CN')
      case 'numeric': {
        const na = parseFloat(a)
        const nb = parseFloat(b)
        return (Number.isNaN(na) ? Infinity : na) - (Number.isNaN(nb) ? Infinity : nb)
      }
      case 'numericDesc': {
        const na = parseFloat(a)
        const nb = parseFloat(b)
        return (Number.isNaN(nb) ? -Infinity : nb) - (Number.isNaN(na) ? -Infinity : na)
      }
      case 'length':
        return a.length - b.length
      case 'lengthDesc':
        return b.length - a.length
      case 'reverse':
        return 0
      case 'shuffle':
        return Math.random() - 0.5
      default:
        return (opts.ignoreCase ? a.toLowerCase() : a).localeCompare(opts.ignoreCase ? b.toLowerCase() : b, 'zh-CN')
    }
  }
  if (opts.mode === 'shuffle') {
    // Fisher-Yates
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[lines[i], lines[j]] = [lines[j], lines[i]]
    }
  } else if (opts.mode === 'reverse') {
    lines = lines.reverse()
  } else {
    lines = lines.sort(cmp)
  }
  return lines.join('\n')
}

export function removeDuplicateLines(text: string, opts: { ignoreCase?: boolean; trim?: boolean; keepLast?: boolean } = {}): { result: string; removed: number } {
  const lines = text.split('\n')
  const seen = new Set<string>()
  const out: string[] = []
  const list = opts.keepLast ? [...lines].reverse() : lines
  for (const l of list) {
    let k = opts.trim ? l.trim() : l
    if (opts.ignoreCase) k = k.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    // 开启 trim 时输出同样去除首尾空白（与行排序的去重口径一致）
    out.push(opts.trim ? l.trim() : l)
  }
  const result = (opts.keepLast ? out.reverse() : out).join('\n')
  return { result, removed: lines.length - out.length }
}

export function removeLineBreaks(text: string, mode: 'all' | 'keepParagraph' | 'join'): string {
  if (mode === 'all') return text.replace(/\s*\n\s*/g, '')
  if (mode === 'keepParagraph') {
    return text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
      .join('\n\n')
  }
  return text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function repeatText(text: string, times: number, sep: string): string {
  return new Array(Math.max(0, Math.min(100000, times))).fill(text).join(sep)
}

export function reverseText(text: string, mode: 'chars' | 'words' | 'lines'): string {
  if (mode === 'chars') return [...text].reverse().join('')
  if (mode === 'words') return text.split(/\s+/).filter(Boolean).reverse().join(' ')
  return text.split('\n').reverse().join('\n')
}

/* ---------------- 查找替换 ---------------- */

export function findReplace(
  text: string,
  find: string,
  replace: string,
  opts: { caseSensitive?: boolean; regex?: boolean; whole?: boolean } = {},
): { result: string; count: number } {
  if (!find) return { result: text, count: 0 }
  let count = 0
  let pattern: string
  if (opts.regex) {
    pattern = find
  } else {
    pattern = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (opts.whole) pattern = `\\b${pattern}\\b`
  }
  const re = new RegExp(pattern, opts.caseSensitive ? 'g' : 'gi')
  const result = text.replace(re, (...args) => {
    count++
    // 支持 $1 捕获组
    return replace.replace(/\$(\d)/g, (_, d) => args[Number(d)] ?? '')
  })
  return { result, count }
}

/* ---------------- 编码类 ---------------- */

export function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  // 分块转字符串，避免大输入下展开参数导致栈溢出
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function b64decode(text: string): string {
  let bin: string
  try {
    bin = atob(text.replace(/\s/g, ''))
  } catch {
    throw new Error('包含无效的 Base64 字符，请检查输入')
  }
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function b32encode(text: string): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = new TextEncoder().encode(text)
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += alpha[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += alpha[(value << (5 - bits)) & 31]
  // RFC 4648：输出补齐到 8 的倍数（= 填充），保证与严格解码器互操作
  return out + '='.repeat((8 - (out.length % 8)) % 8)
}

export function b32decode(text: string): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = text.toUpperCase().replace(/[=\s]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const c of clean) {
    const idx = alpha.indexOf(c)
    if (idx === -1) throw new Error('包含无效的 Base32 字符')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

export function urlEncode(text: string, component = true): string {
  return component ? encodeURIComponent(text) : encodeURI(text)
}

export function urlDecode(text: string, component = true): string {
  return component ? decodeURIComponent(text.replace(/\+/g, ' ')) : decodeURI(text)
}

export function htmlEntityEncode(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function htmlEntityDecode(text: string): string {
  const ta = document.createElement('textarea')
  ta.innerHTML = text
  return ta.value
}

export function jsonEscapeEncode(text: string): string {
  return JSON.stringify(text).slice(1, -1)
}

export function jsonEscapeDecode(text: string): string {
  try {
    return JSON.parse(`"${text.replace(/\n/g, '\\n')}"`) as string
  } catch {
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
}

/* ---------------- 摩斯 / 二进制 / 凯撒 / 罗马 ---------------- */

const MORSE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  '=': '-...-', '+': '.-.-.', '-': '-....-', '"': '.-..-.', '@': '.--.-.',
}
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]))

export function morseEncode(text: string): string {
  const words: string[] = []
  const flush = (buf: string[]) => {
    if (buf.length) words.push(buf.join(' '))
  }
  for (const raw of text.toLowerCase().split(/\s+/)) {
    if (!raw) continue
    let buf: string[] = []
    for (const c of raw) {
      if (MORSE[c]) {
        buf.push(MORSE[c])
      } else if (/[\u4e00-\u9fff]/.test(c)) {
        // 中文按 Unicode 码点数字编码，每个汉字独立成词（/ 分隔），可无损解码
        flush(buf)
        buf = []
        words.push([...String(c.codePointAt(0))].map((d) => MORSE[d]).join(' '))
      }
    }
    flush(buf)
  }
  return words.join(' / ')
}

export function morseDecode(text: string): string {
  let out = ''
  for (const word of text.split(/\s*\/\s*|\s{2,}/)) {
    const s = word
      .trim()
      .split(/\s+/)
      .map((code) => MORSE_REV[code] ?? '')
      .join('')
    if (!s) continue
    let piece = s
    // 5 位纯数字且落在 CJK 码点区间时还原为汉字
    if (/^\d{5}$/.test(s)) {
      const n = Number(s)
      if (n >= 0x4e00 && n <= 0x9fff) piece = String.fromCodePoint(n)
    }
    // 编码端每个汉字独立成词，连续汉字直接拼接还原原词
    if (!out) out = piece
    else if (/[\u4e00-\u9fff]/.test(out[out.length - 1]) && /[\u4e00-\u9fff]/.test(piece[0])) out += piece
    else out += ' ' + piece
  }
  return out
}

export function textToBinary(text: string): string {
  return [...new TextEncoder().encode(text)].map((b) => b.toString(2).padStart(8, '0')).join(' ')
}

export function binaryToText(text: string): string {
  const bytes = text.trim().split(/\s+/).map((b) => parseInt(b, 2))
  if (bytes.some((n) => Number.isNaN(n) || n > 255)) throw new Error('存在无效的二进制字节（只允许 8 位 0/1）')
  return new TextDecoder().decode(new Uint8Array(bytes))
}

export function caesar(text: string, shift = 13): string {
  const s = ((shift % 26) + 26) % 26
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base)
  })
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function toRoman(n: number): string {
  n = Math.floor(n)
  if (n < 1 || n > 3999) throw new Error('仅支持 1–3999 的整数')
  let out = ''
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

export function fromRoman(s: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  const t = s.toUpperCase().replace(/[^IVXLCDM]/g, '')
  let out = 0
  for (let i = 0; i < t.length; i++) {
    const v = map[t[i]]
    const next = map[t[i + 1]] ?? 0
    out += v < next ? -v : v
  }
  return out
}

/* ---------------- 数字转中文 ---------------- */

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const CN_UNITS = ['', '十', '百', '千']
const CN_BIG = ['', '万', '亿', '万亿']

export function numberToChinese(input: number | string, finance = false): string {
  const digits = finance ? ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'] : CN_DIGITS
  const units = finance ? ['', '拾', '佰', '仟'] : CN_UNITS
  const big = finance ? ['', '万', '亿', '万亿'] : CN_BIG
  let s = String(input).replace(/[,\s_]/g, '')
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  const [intPart = '', decPart] = s.split('.')
  const n = parseInt(intPart, 10)
  if (Number.isNaN(n)) return '（请输入有效数字）'
  // 四位一组（低→高），组内转「几千几百几十几」
  const groupToCn = (g: number): string => {
    const q = Math.floor(g / 1000)
    const b = Math.floor((g % 1000) / 100)
    const t = Math.floor((g % 100) / 10)
    const o = g % 10
    let out = ''
    if (q) out += digits[q] + units[3]
    if (b) out += digits[b] + units[2]
    if (t) {
      // 「一十」在组首可省略「一」（非财务体）
      out += (!q && !b && t === 1 && !finance ? '' : digits[t]) + units[1]
    }
    if (o) {
      out += (q || b) && !t ? digits[0] : ''
      out += digits[o]
    }
    return out
  }
  const intToCn = (num: number): string => {
    if (num === 0) return digits[0]
    const groups: number[] = []
    let rest = num
    while (rest > 0) {
      groups.push(rest % 10000)
      rest = Math.floor(rest / 10000)
    }
    const parts: string[] = []
    for (let gi = groups.length - 1; gi >= 0; gi--) {
      const g = groups[gi]
      const isLast = gi === 0
      if (g === 0) continue
      parts.push(groupToCn(g) + big[gi])
      // 下一组（更低位）不足千位时补零
      if (!isLast && groups[gi - 1] > 0 && groups[gi - 1] < 1000) parts.push(digits[0])
    }
    return parts.join('')
  }
  // 财务大写：按人民币票据惯例精确到分，补「元/角/分/整」单位
  if (finance) {
    const num = Number(neg ? '-' + s : s)
    if (!Number.isFinite(num)) return '（请输入有效数字）'
    const cents = Math.round(Math.abs(num) * 100)
    const yuan = Math.floor(cents / 100)
    const jiao = Math.floor((cents % 100) / 10)
    const fen = cents % 10
    let out = yuan === 0 ? '' : intToCn(yuan) + '元'
    if (jiao === 0 && fen === 0) {
      out += yuan === 0 ? '零元整' : '整'
    } else {
      if (jiao) out += digits[jiao] + '角'
      else if (fen) out += '零'
      if (fen) out += digits[fen] + '分'
      else out += '整'
    }
    return (neg ? '负' : '') + (out || '零元整')
  }
  let out = n === 0 ? digits[0] : intToCn(n)
  if (decPart) {
    out += '点' + [...decPart].map((d) => digits[Number(d)] ?? '').join('')
  }
  return (neg ? '负' : '') + out
}

/* ---------------- 花体字（Unicode 变换） ---------------- */

const FANCY: Record<string, Record<string, string>> = {
  bold: { upper: '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙', lower: '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳', digits: '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗' },
  italic: { upper: '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡', lower: '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻' },
  script: { upper: '𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩', lower: '𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃' },
  fraktur: { upper: '𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅', lower: '𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟' },
  mono: { upper: '𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻', lower: '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣', digits: '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿' },
  circled: { upper: 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ', lower: 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ', digits: '⓿①②③④⑤⑥⑦⑧⑨' },
  double: { upper: '𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ', lower: '𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫', digits: '𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡' },
  smallcaps: { upper: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘQʀꜱᴛᴜᴠᴡxʏᴢ', lower: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘQʀꜱᴛᴜᴠᴡxʏᴢ' },
}

export function fancyText(text: string, style: keyof typeof FANCY): string {
  const map = FANCY[style]
  if (!map) return text
  return [...text]
    .map((c) => {
      if (map.upper && c >= 'A' && c <= 'Z') return map.upper[c.charCodeAt(0) - 65]
      if (map.lower && c >= 'a' && c <= 'z') return map.lower[c.charCodeAt(0) - 97]
      if (map.digits && c >= '0' && c <= '9') return map.digits[Number(c)]
      return c
    })
    .join('')
}

export const FANCY_STYLES: { key: string; label: string }[] = [
  { key: 'bold', label: '粗体 𝐛𝐨𝐥𝐝' },
  { key: 'italic', label: '斜体 𝘪𝘵𝘢𝘭𝘪𝘤' },
  { key: 'script', label: '花体 𝓼𝓬𝓻𝓲𝓹𝓽' },
  { key: 'fraktur', label: '哥特 𝔉𝔯𝔞𝔨𝔱𝔲𝔯' },
  { key: 'mono', label: '等宽 𝚖𝚘𝚗𝚘' },
  { key: 'circled', label: '圆圈 ⓒⓘⓡⓒⓛⓔ' },
  { key: 'double', label: '双线 𝕕𝕠𝕦𝕓𝕝𝕖' },
  { key: 'smallcaps', label: '小型大写 ꜱᴍᴀʟʟ' },
]

/* ---------------- ASCII 大字 ---------------- */

const BANNER_5X5: Record<string, string[]> = {
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  B: ['████ ', '█   █', '████ ', '█   █', '████ '],
  C: [' ████', '█    ', '█    ', '█    ', ' ████'],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  F: ['█████', '█    ', '████ ', '█    ', '█    '],
  G: [' ████', '█    ', '█  ██', '█   █', ' ███ '],
  H: ['█   █', '█   █', '█████', '█   █', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  J: ['  ███', '   █ ', '   █ ', '█  █ ', ' ██  '],
  K: ['█   █', '█  █ ', '███  ', '█  █ ', '█   █'],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
  Q: [' ███ ', '█   █', '█ █ █', ' ██ █', '   ██'],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  U: ['█   █', '█   █', '█   █', '█   █', ' ███ '],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  W: ['█   █', '█   █', '█ █ █', '██ ██', '█   █'],
  X: ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  '0': [' ███ ', '█  ██', '█ █ █', '██  █', ' ███ '],
  '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
  '2': [' ███ ', '█   █', '  ██ ', ' █   ', '█████'],
  '3': [' ███ ', '█   █', '  ██ ', '█   █', ' ███ '],
  '4': ['  ██ ', ' █ █ ', '█████', '   █ ', '   █ '],
  '5': ['█████', '█    ', '████ ', '    █', '████ '],
  '6': [' ███ ', '█    ', '████ ', '█   █', ' ███ '],
  '7': ['█████', '    █', '   █ ', '  █  ', '  █  '],
  '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
  '9': [' ███ ', '█   █', ' ████', '    █', ' ███ '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
  '!': ['█', '█', '█', ' ', '█'],
  '?': [' ███ ', '█   █', '  ██ ', '     ', '  █  '],
  '.': [' ', ' ', ' ', ' ', '█'],
  ',': ['  ', '  ', '  ', ' █', '█ '],
  '-': ['    ', '    ', '████', '    ', '    '],
  '+': ['  █  ', '  █  ', '█████', '  █  ', '  █  '],
  '*': ['█ █ █', ' ███ ', '█████', ' ███ ', '█ █ █'],
  ':': [' ', '█', ' ', '█', ' '],
  '#': ['█ █ █', '█████', '█ █ █', '█████', '█ █ █'],
  '中': ['█████', '  █  ', '█████', '  █  ', '█████'],
  '文': ['█   █', ' ███ ', '  █  ', ' ███ ', '█   █'],
}

export function asciiBanner(text: string, fill = '█', space = ' '): string {
  const chars = [...text.toUpperCase()].slice(0, 12)
  const lines = ['', '', '', '', '']
  for (const ch of chars) {
    const glyph = BANNER_5X5[ch] ?? BANNER_5X5[ch.toLowerCase()] ?? BANNER_5X5['?']
    for (let r = 0; r < 5; r++) {
      lines[r] += glyph[r].split('').map((c) => (c === '█' ? fill : space)).join('') + '  '
    }
  }
  return lines.join('\n')
}

/* ---------------- 词频 / 回文 / 变位词 ---------------- */

export function wordFrequency(
  text: string,
  opts: { ignoreCase?: boolean; stopwords?: boolean; top?: number } = {},
): { word: string; count: number }[] {
  const tokens = tokenizeWords(text)
  const freq = new Map<string, number>()
  const stop = opts.stopwords ? STOPWORDS : null
  for (let t of tokens) {
    if (opts.ignoreCase !== false) t = t.toLowerCase()
    if (stop?.has(t)) continue
    freq.set(t, (freq.get(t) ?? 0) + 1)
  }
  return [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, opts.top ?? 200)
}

export function tokenizeWords(text: string): string[] {
  // 中文按 2-gram 简化分词，英文按词
  const en = text.match(/[a-zA-Z0-9']+/g) ?? []
  const cn = text.match(/[\u4e00-\u9fff]/g) ?? []
  const cnWords: string[] = []
  for (let i = 0; i < cn.length - 1; i++) cnWords.push(cn[i] + cn[i + 1])
  if (cn.length === 1) cnWords.push(cn[0])
  return [...en, ...cnWords]
}

export const STOPWORDS = new Set(
  'the a an and or of to in on for with is are was were be been it this that i you he she they we as at by from not but'.split(
    ' ',
  ),
)

export function isPalindrome(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
  const rev = [...clean].reverse().join('')
  return clean.length > 0 && clean === rev
}

export function isAnagram(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '').split('').sort().join('')
  return a.length > 0 && norm(a) === norm(b)
}

/* ---------------- PII 脱敏 ---------------- */

export function piiScrub(text: string): { result: string; found: { type: string; count: number }[] } {
  const rules: { type: string; re: RegExp; keep?: number }[] = [
    { type: '邮箱', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, keep: 2 },
    { type: '手机号', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, keep: 4 },
    { type: '身份证', re: /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g, keep: 4 },
    { type: '银行卡号', re: /(?<!\d)\d{16,19}(?!\d)/g, keep: 4 },
    { type: 'IP 地址', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, keep: 0 },
    { type: 'URL', re: /https?:\/\/[^\s<>"]+/g, keep: 0 },
  ]
  let result = text
  const found: { type: string; count: number }[] = []
  for (const r of rules) {
    const matches = result.match(r.re) ?? []
    if (!matches.length) continue
    result = result.replace(r.re, (m) => {
      if (r.keep && m.includes('@')) {
        const [u, d] = m.split('@')
        return `${u.slice(0, r.keep)}***@${d}`
      }
      if (r.keep && /^\d+$/.test(m)) {
        return '*'.repeat(Math.max(0, m.length - r.keep)) + m.slice(-r.keep)
      }
      return '*'.repeat(Math.min(m.length, 12))
    })
    found.push({ type: r.type, count: matches.length })
  }
  return { result, found }
}

/* ---------------- Slug ---------------- */

export function slugify(text: string, sep = '-'): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, sep)
    .replace(new RegExp(`${sep}{2,}`, 'g'), sep)
    .replace(new RegExp(`^${sep}|${sep}$`, 'g'), '')
    .toLowerCase()
}

/* ---------------- 随机 ---------------- */

export function randomString(
  length: number,
  opts: { upper?: boolean; lower?: boolean; digits?: boolean; symbols?: boolean; excludeAmbiguous?: boolean } = {},
): string {
  let pool = ''
  if (opts.upper !== false) pool += opts.excludeAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (opts.lower !== false) pool += opts.excludeAmbiguous ? 'abcdefghijkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz'
  if (opts.digits !== false) pool += opts.excludeAmbiguous ? '23456789' : '0123456789'
  if (opts.symbols) pool += '!@#$%^&*()-_=+[]{};:,.<>?'
  if (!pool) pool = 'abcdefghijklmnopqrstuvwxyz'
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return [...arr].map((n) => pool[n % pool.length]).join('')
}

export function uuidv4(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/* ---------------- 数字转英文单词 ---------------- */

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

export function numberToEnglish(n: number): string {
  if (n < 0) return 'negative ' + numberToEnglish(-n)
  if (n < 20) return EN_ONES[n]
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : '')
  if (n < 1000) return EN_ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numberToEnglish(n % 100) : '')
  const scales: [number, string][] = [
    [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand'],
  ]
  for (const [v, name] of scales) {
    if (n >= v) {
      return numberToEnglish(Math.floor(n / v)) + ' ' + name + (n % v ? ' ' + numberToEnglish(n % v) : '')
    }
  }
  return String(n)
}

/* ---------------- 文本对比辅助 ---------------- */

export function normalizeLines(text: string, opts: { trim?: boolean; ignoreCase?: boolean } = {}): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => {
      let v = l
      if (opts.trim) v = v.trim()
      if (opts.ignoreCase) v = v.toLowerCase()
      return v
    })
}
