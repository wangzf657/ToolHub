/** 文本扩展工具：批量提取 / 清洗 / 全角半角 / 集合运算（纯函数，textDef 用） */

export const EXTRACT_TYPES = {
  email: { label: '邮箱', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  phone: { label: '手机号', re: /(?<![\dA-Za-z])1[3-9]\d{9}(?![\d])/g },
  // URL 用「合法字符白名单」匹配：全角标点（，、。等）与中文不在集合内，避免被并入链接
  url: { label: '网址 URL', re: /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&*+,;=%]+|(?<![\dA-Za-z./])www\.[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?(?:\/[A-Za-z0-9\-._~:/?#[\]@!$&*+,;=%]*)?/g },
  ip: { label: 'IP 地址', re: /(?<![\d.])((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d.])/g },
  idcard: { label: '身份证号', re: /(?<![\dXx])[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?![\dXx])/g },
  date: { label: '日期', re: /(?:20\d{2}|19\d{2})[-/年.](?:1[0-2]|0?[1-9])[-/月.](?:[12]\d|3[01]|0?[1-9])日?/g },
  money: { label: '金额', re: /(?:¥|￥|\$|USD\s?|CNY\s?)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]{3,}(?:\.\d+)?\s*元/g },
} as const

export type ExtractType = keyof typeof EXTRACT_TYPES

/** 按类型提取并去重 */
export function extractFromText(text: string, types: ExtractType[], dedupe = true, sort = false): { label: string; items: string[] }[] {
  return types
    .map((t) => {
      const matches = text.match(EXTRACT_TYPES[t].re) ?? []
      let items = matches.map((m) => m.trim())
      if (dedupe) items = [...new Set(items)]
      if (sort) items.sort()
      return { label: EXTRACT_TYPES[t].label, items }
    })
    .filter((g) => g.items.length > 0)
}

export interface CleanOptions {
  spaces?: boolean // 压缩多余空白
  emptyLines?: boolean
  punctuation?: boolean // 中英文标点
  emoji?: boolean
  digits?: boolean
  chinese?: boolean
  english?: boolean
  htmlTags?: boolean
  toHalf?: boolean
}

const PUNCT_RE = /[\u2000-\u206f\u3000-\u303f、。，；：？！“”‘’「」『』（）《》〈〉【】〔〕［］｛｝…—·・,.:;!?'"()\[\]{}<>\-_~`|\\/@#$%^&*+=]/g
// eslint-disable-next-line no-control-regex
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu

/** 通用文本清洗 */
export function cleanText(text: string, o: CleanOptions): string {
  let s = text
  if (o.htmlTags) s = s.replace(/<[^>]+>/g, '')
  if (o.emoji) s = s.replace(EMOJI_RE, '')
  if (o.punctuation) s = s.replace(PUNCT_RE, '')
  if (o.digits) s = s.replace(/\d+/g, '')
  if (o.chinese) s = s.replace(/[\u4e00-\u9fff]/g, '')
  if (o.english) s = s.replace(/[A-Za-z]+/g, '')
  if (o.toHalf) s = fullToHalf(s)
  if (o.spaces) s = s.replace(/[ \t\f\v]+/g, ' ')
  if (o.emptyLines) s = s.replace(/\n\s*\n+/g, '\n').replace(/^\n+|\n+$/g, '')
  return s
}

/** 全角 → 半角 */
export function fullToHalf(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code === 0x3000) out += ' '
    else if (code >= 0xff01 && code <= 0xff5e) out += String.fromCharCode(code - 0xfee0)
    else out += ch
  }
  return out
}

/** 半角 → 全角 */
export function halfToFull(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code === 32) out += '\u3000'
    else if (code >= 0x21 && code <= 0x7e) out += String.fromCharCode(code + 0xfee0)
    else out += ch
  }
  return out
}

function normalizeLine(line: string, ignoreCase: boolean, trim: boolean): string {
  let s = line
  if (trim) s = s.trim()
  if (ignoreCase) s = s.toLowerCase()
  return s
}

export interface SetOptions {
  ignoreCase?: boolean
  trim?: boolean
  keepEmpty?: boolean
}

/** 两列文本集合运算 */
export function setOperations(a: string, b: string, op: 'intersection' | 'union' | 'aMinusB' | 'bMinusA', o: SetOptions = {}): string {
  const toLines = (t: string) =>
    t
      .split(/\r?\n/)
      .map((l) => normalizeLine(l, !!o.ignoreCase, o.trim !== false))
      .filter((l) => o.keepEmpty || l.length > 0)
  const A = toLines(a)
  const B = toLines(b)
  const setB = new Set(B)
  const setA = new Set(A)
  let out: string[]
  if (op === 'intersection') out = [...new Set(A)].filter((l) => setB.has(l))
  else if (op === 'union') out = [...new Set([...A, ...B])]
  else if (op === 'aMinusB') out = [...new Set(A)].filter((l) => !setB.has(l))
  else out = [...new Set(B)].filter((l) => !setA.has(l))
  return out.join('\n')
}

/** 行计数（去重前/后） */
export function lineCounts(a: string, b: string, o: SetOptions = {}): { a: number; b: number } {
  const toLines = (t: string) =>
    t.split(/\r?\n/).map((l) => normalizeLine(l, !!o.ignoreCase, o.trim !== false)).filter((l) => o.keepEmpty || l.length > 0)
  return { a: toLines(a).length, b: toLines(b).length }
}

/* ---------------- 收货地址解析（china-division 省市区数据前缀匹配） ---------------- */

let divisionCache: { provinces: { code: string; name: string }[]; cities: { code: string; name: string; provinceCode: string }[]; areas: { code: string; name: string; cityCode: string; provinceCode: string }[] } | null = null

async function loadDivisions() {
  if (divisionCache) return divisionCache
  const [pv, ct, ar] = await Promise.all([
    import('china-division/dist/provinces.json'),
    import('china-division/dist/cities.json'),
    import('china-division/dist/areas.json'),
  ])
  divisionCache = {
    provinces: (pv.default ?? pv) as never,
    cities: (ct.default ?? ct) as never,
    areas: (ar.default ?? ar) as never,
  }
  return divisionCache
}

const stripNoise = (s: string) => s.replace(/(\d{7,})|((?:\+?86[- ]?)?1[3-9]\d{9})/g, ' ').replace(/\s+/g, ' ').trim()

export interface ParsedAddress { province: string; city: string; area: string; detail: string }

/** 单条地址解析：先匹配省（含直辖市/自治区简写），再匹配市、区县 */
export async function parseAddressOne(raw: string): Promise<ParsedAddress> {
  const d = await loadDivisions()
  let rest = stripNoise(raw)
  const out: ParsedAddress = { province: '', city: '', area: '', detail: '' }
  // 省/直辖市/自治区（兼容「广东省/广东」「北京/北京市」「广西/广西壮族自治区」）
  for (const p of d.provinces) {
    const short = p.name.replace(/[省市区自治区特别行政区]$/g, '')
    if (rest.startsWith(p.name) || rest.startsWith(short)) {
      out.province = p.name
      rest = rest.slice(rest.startsWith(p.name) ? p.name.length : short.length)
      break
    }
  }
  // 市（该省下属；同省最多匹配名最长的市，兼容「市辖区」→ 直辖市取省名）
  const cities = d.cities.filter((c) => !out.province || c.provinceCode === (d.provinces.find((p) => p.name === out.province)?.code ?? ''))
  let bestCity: { code: string; name: string } | null = null
  for (const c of cities) {
    const nm = c.name === '市辖区' || c.name === '县' ? '' : c.name
    if (nm && rest.startsWith(nm) && (!bestCity || nm.length > bestCity.name.length)) bestCity = { code: c.code, name: nm }
  }
  if (bestCity) {
    out.city = bestCity.name
    rest = rest.slice(bestCity.name.length)
  } else if (out.province && /^(北京|上海|天津|重庆)/.test(out.province)) {
    out.city = out.province
  }
  // 区县
  const areas = d.areas.filter((a) => (bestCity ? a.cityCode === bestCity.code : !out.province || a.provinceCode === d.provinces.find((p) => p.name === out.province)?.code))
  for (const a of areas) {
    if (rest.startsWith(a.name)) {
      out.area = a.name
      rest = rest.slice(a.name.length)
      break
    }
  }
  out.detail = rest.trim().replace(/^[-·,，、\s]+/, '')
  if (!out.province) out.detail = stripNoise(raw) // 全程未匹配时原样保留
  return out
}

/** 批量地址解析，fmt=true 输出 CSV 表头行 */
export async function parseAddresses(text: string, csv: boolean): Promise<string> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200)
  const results: ParsedAddress[] = []
  for (const line of lines) results.push(await parseAddressOne(line))
  if (csv) {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const rows = results.map((r) => [r.province, r.city, r.area, r.detail].map(esc).join(','))
    return ['省,市,区县,详细地址', ...rows].join('\n')
  }
  return results
    .map((r, i) => `【${i + 1}】${r.province || '?'} / ${r.city || '?'} / ${r.area || '?'}\n${r.detail}`)
    .join('\n\n')
}
