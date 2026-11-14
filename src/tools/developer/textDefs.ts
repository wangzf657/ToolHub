/**
 * developer 域 textDef 增强实现（注册表数据与逻辑分离，保持 registry.ts 精简）
 * 处方来源：docs/优化文档/开发工具/*.md（UX1.0 追加批次）
 * 约束：transform 均为纯函数（除 case-style 的记忆写入），默认选项与 textcalc 哨兵断言兼容
 */
import { b64encode } from '@/lib/textEngine'
import { parseCsvSync } from '@/lib/csvEngine'
import { bytesToBase64, bytesToLatin1, base64ToBytes, latin1ToBytes, convertCoord, COORD_LABELS, outOfChina, parseCookieInput, cookieJsonToHeader, convertIdentifier, CASE_TARGETS, type CaseTarget, type CoordSys } from '@/lib/devExt'

/* =============== Base64（rx2 URL-safe / rx3 换行 / rx4 失败纠偏） =============== */

export function base64Transform(t: string, o: { dir?: unknown; variant?: unknown; wrap?: unknown }): string {
  if (o.dir === 'decode') {
    // rx2：解码自动兼容 URL-safe（先归一化再解码）；剔除换行（rx3 闭环）
    const norm = t.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4)
    try {
      const bin = atob(pad)
      return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    } catch {
      // rx4：失败纠偏——检测输入特征给出建议
      const hints: string[] = []
      if (/^[\w-]+={0,2}$/.test(t.trim()) && /[-_]/.test(t.trim())) hints.push('疑似 URL-safe Base64（已尝试自动归一化仍失败，请检查字符）')
      else if (/^[0-9a-fA-F]+$/.test(t.trim()) && t.trim().length % 2 === 0) hints.push('疑似 Hex 编码，请改用「进制转换」或十六进制查看工具')
      else hints.push('包含无效的 Base64 字符，请检查输入（注意空格与换行已自动剔除）')
      throw new Error(`解码失败：${hints.join('；')}`)
    }
  }
  let out = b64encode(t)
  if (o.variant === 'urlsafe') {
    // rx2：URL-safe 编码（+/ → -_，去填充）
    out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const width = o.wrap === '76' ? 76 : o.wrap === '64' ? 64 : 0
  if (width > 0) out = (out.match(new RegExp(`.{1,${width}}`, 'g')) ?? []).join('\n')
  return out
}

/* =============== URL 编解码（rx1 +号处理 / rx2 form 档 / rx3 报错人话化） =============== */

export function urlTransform(t: string, o: { dir?: unknown; scope?: unknown; plus?: unknown }): string {
  const full = o.scope === 'full'
  const form = o.scope === 'form' // rx2：表单档（application/x-www-form-urlencoded，空格 → +）
  if (o.dir === 'decode') {
    // rx1：+ 号仅在表单语义（form 档 / 显式选择）下还原为空格，RFC 3986 下 + 是合法字面字符
    const src = form || o.plus === 'form' ? t.replace(/\+/g, ' ') : t
    try {
      return full ? decodeURI(src) : decodeURIComponent(src)
    } catch (e) {
      // rx3：定位首个不完整的 %XX 转义
      const m = src.match(/%[0-9a-fA-F]?$/m) ?? src.match(/%[0-9a-fA-F]{0,1}(?![0-9a-fA-F])/)
      let pos = -1
      const idx = src.search(/%(?![0-9a-fA-F]{2})/)
      if (idx >= 0) pos = idx + 1
      void m
      throw new Error(`解码失败：${pos > 0 ? `含不完整的 %XX 转义（位置 ${pos} 附近）` : '含非法百分号转义序列'}，请检查输入`)
    }
  }
  let out = full ? encodeURI(t) : encodeURIComponent(t)
  if (form || o.plus === 'form') out = out.replace(/%20/g, '+') // rx2：form-urlencoded，空格 → +
  return out
}

/* =============== JSON 转 CSV（rx1 拍平 / rx3 嵌套披露） =============== */

export function jsonToCsvTransform(t: string, o: { delim?: unknown; flatten?: unknown }): string {
  if (!t.trim()) return ''
  const data = JSON.parse(t)
  const arr: Record<string, unknown>[] = Array.isArray(data) ? data : [data]
  if (!arr.length) return ''
  const flatten = o.flatten === true
  const flat = (row: Record<string, unknown>, out: Record<string, unknown> = {}, prefix = ''): Record<string, unknown> => {
    for (const [k, v] of Object.entries(row)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (flatten && v && typeof v === 'object' && !Array.isArray(v)) flat(v as Record<string, unknown>, out, key)
      else out[key] = v
    }
    return out
  }
  const rows = arr.map((r) => flat((r ?? {}) as Record<string, unknown>))
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const d = String(o.delim ?? ',')
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return new RegExp(`["\n\r]|${d === '\t' ? '\\t' : d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [cols.join(d)]
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(d))
  let out = lines.join('\n')
  // rx3：嵌套行为披露（仅在确实存在嵌套单元格时前置提示行）
  if (!flatten) {
    const nested = rows.reduce((n, r) => n + Object.values(r).filter((v) => v && typeof v === 'object').length, 0)
    if (nested > 0) out = `# 提示：${nested} 个单元格含嵌套对象（已转 JSON 字符串）；可开启「拍平」选项展开为 a.b.c 列\n${out}`
  }
  return out
}

/* =============== JSON 转 YAML（rx1 安全引号化 / rx5 重解析预警） =============== */

/** YAML 1.1 解析器会改写类型的字符串形态（数字/布尔词/空串/ISO 日期） */
const YAML_DANGER = /^-?\d+(\.\d+)?$|^(true|false|yes|no|on|off|null|~)$|^$|^\d{4}-\d{2}-\d{2}([Tt ].*)?$/

export function jsonToYamlTransform(t: string): string {
  if (!t.trim()) return ''
  const data = JSON.parse(t) as unknown
  // 收集将被改写类型的字符串值（rx5）
  const risky: { key: string; value: string }[] = []
  const scan = (v: unknown, path: string) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) scan(x, path ? `${path}.${k}` : k)
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => scan(x, `${path}[${i}]`))
    } else if (typeof v === 'string' && YAML_DANGER.test(v)) {
      risky.push({ key: path || '(根)', value: v })
    }
  }
  scan(data, '')
  let out = yamlDump(data, 0)
  if (risky.length) {
    const names = risky.slice(0, 5).map((r) => `${r.key} 的值 "${r.value}" 已加引号以保持字符串类型`)
    out = `# 重解析预警：${names.join('；')}${risky.length > 5 ? ` 等 ${risky.length} 处` : ''}\n${out}`
  }
  return out
}

/** 轻量 YAML dump（与引擎 jsonToYaml 同构：对象/数组/标量；危险字符串按类型引号化，数字/布尔保持字面量） */
function yamlDump(v: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  if (v === null) return 'null'
  if (typeof v !== 'object') return yamlScalar(v)
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    return v.map((item) => `${pad}- ${yamlInline(item, indent + 1)}`).join('\n')
  }
  const entries = Object.entries(v as Record<string, unknown>)
  if (!entries.length) return '{}'
  return entries.map(([k, val]) => `${pad}${k}: ${yamlInline(val, indent + 1)}`).join('\n')
}
function yamlInline(v: unknown, indent: number): string {
  if (v === null) return 'null'
  if (typeof v !== 'object') return yamlScalar(v)
  const sub = yamlDump(v, indent)
  return '\n' + sub
}
/** 标量输出：字符串危险值/含特殊字符 → 引号化保持类型；数字/布尔字面量直出 */
function yamlScalar(v: unknown): string {
  if (typeof v === 'string') {
    if (YAML_DANGER.test(v) || /[:#\n"']/.test(v)) return JSON.stringify(v)
    return v
  }
  return String(v)
}

/* =============== YAML 转 JSON（rx1 行列号 / rx3 多文档披露） =============== */

export async function yamlToJsonTransform(t: string): Promise<string> {
  if (!t.trim()) return ''
  // rx3：多文档披露（仅首个文档被转换）
  const docCount = (t.match(/^---\s*$/gm) ?? []).length
  let data: unknown
  let markMsg = ''
  try {
    // 优先 js-yaml：可拿到 mark（行列号，rx1）
    const YAML = (await import('js-yaml')).default
    try {
      data = YAML.load(t)
    } catch (e) {
      const mark = (e as { mark?: { line?: number; column?: number } }).mark
      if (mark) {
        markMsg = `第 ${mark.line! + 1} 行第 ${mark.column! + 1} 列：`
        throw e
      }
      throw e
    }
  } catch {
    // js-yaml 不可用/仍失败 → 回退引擎（保持既有中文提示）
    const { yamlToJson } = await import('@/lib/jsEngine')
    return yamlToJson(t)
  }
  let out = JSON.stringify(data, null, 2)
  if (markMsg) out = `# 解析错误提示：${markMsg}（详见引擎错误信息）\n${out}`
  if (docCount > 0) out = `# 提示：检测到 ${docCount + 1} 个 YAML 文档（--- 分隔），仅转换第 1 个\n${out}`
  return out
}

/* =============== JSON 转 XML（rx1 键名清洗 / rx2 数组项元素名 / rx3 往返自检） =============== */

export function jsonToXmlTransform(t: string, o: { root?: unknown; arrayItem?: unknown }): string {
  if (!t.trim()) return ''
  const data = JSON.parse(t) as unknown
  let cleaned = 0
  const sanitize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sanitize)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        let name = k
        if (!/^[A-Za-z_][\w.-]*$/.test(name)) {
          name = `${name.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '')}`
          if (!/^[A-Za-z_]/.test(name)) name = `_${name}`
          cleaned++
        }
        out[name] = sanitize(val)
      }
      return out
    }
    return v
  }
  const safe = sanitize(data)
  const root = String(o.root || 'root')
  const itemTag = String(o.arrayItem || '').trim()
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const build = (v: unknown, name: string, depth: number): string => {
    const pad = '  '.repeat(depth)
    if (Array.isArray(v)) {
      const tag = itemTag || name
      return v.map((item) => build(item, tag, depth)).join('\n')
    }
    if (v !== null && typeof v === 'object') {
      const inner = Object.entries(v as Record<string, unknown>).map(([k, val]) => build(val, k, depth + 1)).join('\n')
      return `${pad}<${name}>\n${inner}\n${pad}</${name}>`
    }
    return `${pad}<${name}>${escXml(String(v ?? ''))}</${name}>`
  }
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n${build(safe, root, 1)}`
  if (cleaned > 0) out = `<!-- 提示：${cleaned} 个键名不合法已自动清洗（下划线前缀/空格转下划线） -->\n${out}`
  // rx3：往返自检（把输出喂回 XML→JSON 比对结构差异）
  let check = ''
  try {
    const doc = new DOMParser().parseFromString(out.replace(/^<!--[\s\S]*?-->\n/, ''), 'application/xml')
    if (doc.querySelector('parsererror')) throw new Error('parse error')
    check = '✓ 往返结构一致'
  } catch {
    check = '✗ 往返结构不一致，请检查键名或值'
  }
  out += `\n<!-- 往返自检：${check} -->`
  return out
}

/* =============== XML 转 JSON（rx1 口径摘要 / rx2 强制数组） =============== */

export function xmlToJsonTransform(t: string, o: { forceArray?: unknown }): string {
  const doc = new DOMParser().parseFromString(t, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('XML 解析失败：' + (err.textContent ?? '').slice(0, 120))
  const coerce = (s: string): unknown => (s === 'true' ? true : s === 'false' ? false : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s)
  const forceArray = o.forceArray === true
  const walk = (el: Element): unknown => {
    const children = [...el.children]
    const attrs: Record<string, unknown> = {}
    for (const a of el.attributes) attrs[`@${a.name}`] = a.value
    if (!children.length) {
      const text = el.textContent?.trim() ?? ''
      if (Object.keys(attrs).length) return text ? { ...attrs, '#text': text } : attrs
      return (forceArray && text !== '' ? [coerce(text)] : text === '' ? null : coerce(text))
    }
    const obj: Record<string, unknown> = { ...attrs }
    for (const c of children) {
      const v = walk(c)
      if (c.tagName in obj) {
        const prev = obj[c.tagName]
        obj[c.tagName] = Array.isArray(prev) ? [...prev, v] : [prev, v]
      } else {
        obj[c.tagName] = forceArray && !Array.isArray(v) && children.filter((x) => x.tagName === c.tagName).length === 1 ? [v] : v
      }
    }
    return obj
  }
  const root = doc.documentElement
  const data = root ? walk(root) : null
  const result = { [root?.tagName ?? 'root']: data }
  let out = JSON.stringify(result, null, 2)
  // rx1：口径摘要（与实际行为一致）
  const hasAttr = /<[^>]+\s[\w-]+=/.test(t)
  out = `# 口径：属性已保留为 @key｜重复子节点已合并为数组${forceArray ? '｜单元素已强制输出数组' : ''}${hasAttr ? '（本输入含属性）' : ''}\n${out}`
  return out
}

/* =============== JSON 转义 / 反转义（rx1 fallback 披露 / rx2 方向自动 / rx3 Unicode 档） =============== */

export function jsonEscapeTransform(t: string, o: { dir?: unknown; unicode?: unknown }): string {
  // rx2：输入首字符为 " 且含 \ 时自动按反转义处理
  const autoUnescape = t.trimStart().startsWith('"') && t.includes('\\')
  const unescape = o.dir === 'unescape' || autoUnescape
  if (unescape) {
    // 输入是完整 JSON 字面量（带外层引号）时先剥引号再解析，保证往返一致
    const trimmed = t.trim()
    const isLiteral = trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
    const inner = isLiteral ? trimmed.slice(1, -1) : t
    let out: string
    let fallback = false
    try {
      out = JSON.parse(`"${inner.replace(/\r?\n/g, '\\n')}"`) as string
    } catch {
      fallback = true
      out = inner.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
    if (fallback) out = `# 提示：严格解析失败，已用宽松还原（\\u 序列不处理）\n${out}`
    return out
  }
  // 转义：JSON.stringify 字面量；rx3 Unicode 档把非 ASCII 转 \uXXXX
  const lit = JSON.stringify(t)
  if (o.unicode === true) {
    return lit.replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
  }
  return lit
}

/* =============== Base32（rx1 完整性告警 / rx2 变体字母表 / rx4 分组） =============== */

const B32_ALPHABETS: Record<string, string> = {
  standard: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  base32hex: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
  crockford: '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
}

export function base32Transform(t: string, o: { dir?: unknown; alphabet?: unknown; group?: unknown }): string {
  const name = String(o.alphabet ?? 'standard')
  const alpha = B32_ALPHABETS[name] ?? B32_ALPHABETS.standard!
  const dir = o.dir === 'decode' ? 'decode' : 'encode'
  if (dir === 'encode') {
    let out = b32EncodeAlpha(t, alpha)
    if (o.group === 'group8') out = (out.match(/.{1,8}/g) ?? []).join(' ')
    return out
  }
  // 解码：归一化（去空格/大小写/映射表）后按位解码
  const rev = new Map([...alpha].map((c, i) => [c, i]))
  // 去空白后先看总长（含 = padding 应为 8 的倍数）；数据位长度（去 padding）合法余数为 0/2/4/5/7
  const noSpace = t.toUpperCase().replace(/\s/g, '')
  const padless = noSpace.replace(/=/g, '')
  const clean = padless.replace(/O/g, name === 'crockford' ? '0' : 'O')
  const bits: number[] = []
  for (const c of clean) {
    const v = rev.get(c)
    if (v === undefined) throw new Error(`包含无效的 Base32 字符「${c}」（当前字母表：${name}）`)
    for (let b = 4; b >= 0; b--) bits.push((v >> b) & 1)
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b]!
    bytes.push(byte)
  }
  let out = new TextDecoder().decode(new Uint8Array(bytes))
  // rx1：完整性告警——数据位长度余数为 1/3/6 属不可能的 Base32 长度（真截断才告警，去 padding 后 23 位等合法尾组不误报）
  if ([1, 3, 6].includes(padless.length % 8)) {
    out = `# 告警：输入疑似被截断（数据长度 ${padless.length} 不是合法的 Base32 长度），结果可能不完整\n${out}`
  }
  return out
}

function b32EncodeAlpha(text: string, alpha: string): string {
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
  while (out.length % 8 !== 0) out += '='
  return out
}

/* =============== HTML 实体（rx1 转义范围 / rx2 计数 / rx3 畸形实体告警） =============== */

const NAMED_EXTRA: Record<string, string> = { copy: '©', nbsp: '\u00a0', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', times: '×', divide: '÷', cent: '¢', pound: '£', yen: '¥', euro: '€', sect: '§', para: '¶', deg: '°', plusmn: '±', frac12: '½', sup2: '²', sup3: '³', micro: 'µ', larr: '←', uarr: '↑', rarr: '→', darr: '↓', hijump: '' }

export function htmlEntityTransform(t: string, o: { dir?: unknown; scope?: unknown }): string {
  if (o.dir === 'decode') {
    // rx3：畸形实体预扫描
    const malformed: string[] = []
    for (const m of t.matchAll(/&([a-zA-Z]+);?/g)) {
      const name = m[1]!.toLowerCase()
      if (!(name in NAMED_EXTRA) && !/^(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+)$/.test(name)) malformed.push(m[0]!)
    }
    for (const m of t.matchAll(/&#(\d+);/g)) {
      if (Number(m[1]) > 0x10ffff) malformed.push(m[0]!)
    }
    let out = htmlEntityDecodeAll(t)
    if (malformed.length) out = `# 告警：${malformed.length} 处无法识别的实体（${malformed.slice(0, 3).join('、')}${malformed.length > 3 ? '…' : ''}），已按原文保留\n${out}`
    return out
  }
  // 编码
  const scope = String(o.scope ?? 'basic')
  const escBasic: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  let out = ''
  let count = 0
  const kinds = new Set<string>()
  for (const ch of t) {
    if (escBasic[ch]) {
      out += escBasic[ch]!
      count++
      kinds.add(escBasic[ch]!)
      continue
    }
    if (scope === 'extended' || scope === 'all') {
      const named = Object.entries(NAMED_EXTRA).find(([, v]) => v === ch)
      if (named && named[0] !== 'hijump') {
        out += `&${named[0]};`
        count++
        kinds.add(`&${named[0]};`)
        continue
      }
    }
    if (scope === 'all' && ch.charCodeAt(0) > 127) {
      out += `&#${ch.charCodeAt(0)};`
      count++
      kinds.add('&#数字实体;')
      continue
    }
    out += ch
  }
  if (count > 0) out = `# 已转义 ${kinds.size} 类共 ${count} 处\n${out}`
  return out
}

/** 引擎解码 + 扩展命名实体支持（decode 侧与 scope 无关，全部可解） */
function htmlEntityDecodeAll(t: string): string {
  const byValue = new Map(Object.entries(NAMED_EXTRA).map(([k, v]) => [k, v]))
  return t
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => byValue.get(name.toLowerCase()) ?? m)
    .replace(/&#(\d+);/g, (m, n: string) => (Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : m))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, n: string) => (parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : m))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/* =============== CSV 转 Markdown（rx1 引擎替换 / rx2 列宽对齐 / rx3 ragged 补齐） =============== */

export function csvToMarkdownTransform(t: string, o: { delim?: unknown; align?: unknown; pad?: unknown; header?: unknown }): string {
  const d = String(o.delim ?? ',')
  const parsed = parseCsvSync(t, { delimiter: d, header: o.header !== false })
  const header = parsed.header
  const rows = parsed.rows
  if (!header.length) return ''
  const cols = header.length
  const align = String(o.align ?? 'left')
  const padOn = o.pad === true
  // rx3：ragged 补齐/裁齐
  const norm = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? '')
  const all = [header, ...rows.map(norm)]
  const widths = all[0].map((_, i) => Math.max(...all.map((r) => (r[i] ?? '').length), 1))
  const fmt = (r: string[]) => `| ${r.map((c, i) => (padOn ? (c ?? '').padEnd(widths[i]!) : c)).join(' | ')} |`
  const sepRow = Array.from({ length: cols }, () => (align === 'center' ? ':---:' : align === 'right' ? '---:' : '---'))
  return [fmt(header), fmt(sepRow), ...rows.map((r) => fmt(norm(r)))].join('\n')
}

/* =============== JSON 转 Java 实体类（rx1 静态嵌套类 / rx2 签名去重 / rx3 pkg+jackson / rx4 数组提示） =============== */

export function jsonToJavaTransform(t: string, o: { cls?: unknown; lombok?: unknown; pkg?: unknown; jackson?: unknown }): string {
  const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('') || 'Item'
  // 根类名规整：user_order → UserOrder（非法字符分词后逐词首字母大写）
  const rootName = pascal(String(o.cls || 'Demo'))
  const useLombok = o.lombok !== false
  const useJackson = o.jackson === true
  const pkg = String(o.pkg ?? '').trim()
  const data = JSON.parse(t) as unknown
  const isArray = Array.isArray(data)
  const root: unknown = isArray ? (data as unknown[])[0] : data
  const lines: string[] = []
  if (pkg) lines.push(`package ${pkg};`, '')
  if (isArray) lines.push(`// 检测到对象数组，已按首元素生成根类，接口返回用 List<${rootName}> 包裹`)
  const seen = new Map<string, string>() // ifaceKey（类名+字段签名）→ 已生成
  /** 非 Lombok 档手写读写器（getter/setter，贴 IDE 即可编译） */
  const accessor = (type: string, prop: string) => {
    const cap = prop.charAt(0).toUpperCase() + prop.slice(1)
    return [`    public ${type} get${cap}() {`, `        return ${prop};`, '    }', `    public void set${cap}(${type} ${prop}) {`, `        this.${prop} = ${prop};`, '    }'].join('\n')
  }
  /** 字段行（含 Jackson 注解行）+ 读写器行组装 */
  const fieldBlock = (obj: Record<string, unknown>, path: string): { fieldLines: string[]; accessorLines: string[] } => {
    const fieldLines: string[] = []
    const accessorLines: string[] = []
    for (const [k, val] of Object.entries(obj)) {
      const type = javaType(val, k, path ? `${path}.${k}` : k)
      if (useJackson && !/^[a-z][A-Za-z0-9]*$/.test(k)) fieldLines.push(`    @JsonProperty(${JSON.stringify(k)})`)
      const prop = /^[a-z][A-Za-z0-9]*$/.test(k) ? k : k.replace(/[^A-Za-z0-9]/g, '')
      fieldLines.push(`    private ${type} ${prop};`)
      if (!useLombok) accessorLines.push(accessor(type, prop))
    }
    return { fieldLines, accessorLines }
  }
  const javaType = (v: unknown, name: string, path: string): string => {
    if (v === null) return 'Object'
    if (Array.isArray(v)) {
      const elem = v.length ? javaType(v[0], name, path) : 'Object'
      return `List<${elem}>`
    }
    if (typeof v === 'object') {
      return emitClass(v as Record<string, unknown>, pascal(name), path)
    }
    if (typeof v === 'number') return Number.isInteger(v) ? 'Integer' : 'Double'
    if (typeof v === 'boolean') return 'Boolean'
    return 'String'
  }
  const emitClass = (obj: Record<string, unknown>, name: string, path: string): string => {
    const sig = name + JSON.stringify(Object.keys(obj))
    if (seen.has(sig)) return seen.get(sig)!
    seen.set(sig, name)
    const { fieldLines, accessorLines } = fieldBlock(obj, path)
    const inner = accessorLines.length ? [...fieldLines, '', ...accessorLines].join('\n') : fieldLines.join('\n')
    const cls = useLombok ? `@Data\npublic static class ${name} {\n${inner}\n}` : `public static class ${name} {\n${inner}\n}`
    lines.push(cls)
    return name
  }
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    // 根类直接生成（非 static 嵌套）
    const { fieldLines, accessorLines } = fieldBlock(root as Record<string, unknown>, '')
    const inner = accessorLines.length ? [...fieldLines, '', ...accessorLines].join('\n') : fieldLines.join('\n')
    lines.push(useLombok ? `@Data\npublic class ${rootName} {\n${inner}\n}` : `public class ${rootName} {\n${inner}\n}`)
  } else {
    lines.push(`public class ${rootName} { /* 输入不是顶层对象 */ }`)
  }
  lines.push('')
  // import 提示（含 List/Jackson 时）
  const body = lines.join('\n')
  const imports: string[] = []
  if (/List</.test(body)) imports.push('import java.util.List;')
  if (useLombok && /@Data/.test(body)) imports.push('import lombok.Data;')
  if (useJackson && /@JsonProperty/.test(body)) imports.push('import com.fasterxml.jackson.annotation.JsonProperty;')
  const head = imports.length ? imports.join('\n') + '\n\n' : ''
  return head + body
}

/* =============== Gzip（rx2 统计行 / rx3 级别 / rx4 魔数识别） =============== */

export async function gzipTransform(t: string, o: { dir?: unknown; algo?: unknown; enc?: unknown; level?: unknown }): Promise<string> {
  const pako = await import('pako')
  const dir = o.dir === 'decompress' ? 'decompress' : 'compress'
  try {
    if (dir === 'compress') {
      // rx4：魔数识别——输入已是压缩串时自动改为解压并提示
      if (/^(H4sI|eNq)/.test(t.trim())) {
        const bytes = o.enc === 'latin1' ? latin1ToBytes(t.trim()) : base64ToBytes(t.trim())
        const out = o.algo === 'deflate' ? pako.inflate(bytes) : o.algo === 'deflateRaw' ? pako.inflateRaw(bytes) : pako.ungzip(bytes)
        const text = new TextDecoder().decode(out)
        return `# 提示：检测到输入疑似已是压缩串（gzip 魔数），已自动改为解压\n${text}`
      }
      const bytes = new TextEncoder().encode(t)
      const level = [1, 6, 9].includes(Number(o.level)) ? Number(o.level) : 6
      const opts = { level: level as 1 | 6 | 9 }
      const out = o.algo === 'deflate' ? pako.deflate(bytes, opts) : o.algo === 'deflateRaw' ? pako.deflateRaw(bytes, opts) : pako.gzip(bytes, opts)
      // rx2 统计行走 def.stats 通道（registry 内 gzipStats），输出正文保持纯编码串可直接复制
      return o.enc === 'base64' ? bytesToBase64(out) : bytesToLatin1(out)
    }
    // 解压：剔除可能粘贴进来的统计行
    const cleaned = t.replace(/\n\n（[^）]*：\d+ B → \d+ B，压缩率 [\d.]+%）\s*$/g, '')
    const bytes = o.enc === 'base64' ? base64ToBytes(cleaned.trim()) : latin1ToBytes(cleaned.trim())
    const out = o.algo === 'deflate' ? pako.inflate(bytes) : o.algo === 'deflateRaw' ? pako.inflateRaw(bytes) : pako.ungzip(bytes)
    return new TextDecoder().decode(out)
  } catch (e) {
    throw new Error(dir === 'decompress'
      ? `解压失败：输入不是合法的${o.enc === 'base64' ? ' Base64' : ''}压缩串或已损坏，且需与压缩算法一致（${(e as Error).message}）`
      : `压缩失败：${(e as Error).message}`)
  }
}

/** rx2 统计行（gzip 家族）：输入/输出字节数与压缩率——TextTool stats 通道渲染，输出正文不携带 */
export function gzipStats(t: string, o: { dir?: unknown; algo?: unknown; enc?: unknown }, output: string): string {
  if (o.dir === 'decompress' || output.startsWith('# 提示：')) return ''
  const a = new TextEncoder().encode(t).length
  if (!a) return ''
  // base64 去填充后 ×3/4 取整即精确字节数（2 字符→1B、3 字符→2B、4 字符→3B）
  const b = o.enc === 'base64' ? Math.floor(output.replace(/=+$/, '').length * 0.75) : output.length
  const pct = ((1 - b / a) * 100).toFixed(1)
  return `（${String(o.algo ?? 'gzip')}：${a} B → ${b} B，压缩率 ${pct}%）`
}

/* =============== Punycode（rx1 自动切向 / rx3 逐标签视图 / rx4 口径） =============== */

/** rx1 自动切向判定：仅当内容与所选方向相悖时纠正（方向已一致时不打扰、不加提示） */
export function punyAutoDir(t: string, dir: 'toAscii' | 'toUnicode'): { dir: 'toAscii' | 'toUnicode'; hint: string } {
  if (/xn--/i.test(t) && dir === 'toAscii') return { dir: 'toUnicode', hint: '已自动切换方向（检测到 xn-- 输入，输出中文/Unicode 域名）' }
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(t) && dir === 'toUnicode') return { dir: 'toAscii', hint: '已自动切换方向（检测到中文/日文字符，输出 xn-- 编码域名）' }
  return { dir, hint: '' }
}

export async function punycodeTransform(t: string, o: { dir?: unknown; view?: unknown }): Promise<string> {
  const mod = await import('punycode.js')
  const p = mod.default ?? (mod as unknown as typeof mod.default)
  // rx1：自动切向（纠正后的方向；提示行走 def.stats 通道，输出正文保持纯域名）
  const auto = punyAutoDir(t, o.dir === 'toUnicode' ? 'toUnicode' : 'toAscii')
  const dir = auto.dir
  const fn = dir === 'toAscii' ? p.toASCII : p.toUnicode
  const per = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    try {
      const r = fn(l)
      if (dir === 'toAscii') {
        try {
          new URL(`http://${r}`)
          return r
        } catch {
          return `${r}（未通过 URL 校验：含非法字符或格式不完整）`
        }
      }
      return r
    } catch {
      return `${l}（无法转换，请检查是否为合法域名）`
    }
  })
  let out = per.join('\n')
  // rx3：逐标签视图
  if (o.view === 'perLabel') {
    const rows = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) =>
      l
        .split('.')
        .map((seg) => {
          try {
            const a = p.toASCII(seg)
            const u = p.toUnicode(seg)
            return `${seg} → ${a}${a !== u ? `（${u}）` : ''}`
          } catch {
            return `${seg}（无法转换）`
          }
        })
        .join(' . '),
    )
    out += `\n\n# 逐标签对照\n${rows.join('\n')}`
  }
  return out
}

/** punycode 统计行：rx1 自动切向提示（stats 通道渲染，输出正文保持纯域名） */
export function punyStats(t: string, o: { dir?: unknown }): string {
  return punyAutoDir(t, o.dir === 'toUnicode' ? 'toUnicode' : 'toAscii').hint
}

/* =============== 变量命名风格（rx1 一览 / rx2 记忆 / rx4 源风格摘要 / rx5 前缀保留） =============== */

const CASE_MEM_KEY = 'toolhub.case-style.target'

/** 目标风格默认值：读上次记忆（浏览器端模块加载时取一次） */
export const caseStyleDefault = (() => {
  try {
    return localStorage.getItem(CASE_MEM_KEY) || 'camel'
  } catch {
    return 'camel'
  }
})()

export function caseStyleTransform(t: string, o: { target?: unknown; view?: unknown; keepPrefix?: unknown }): string {
  const target = String(o.target ?? 'camel') as CaseTarget
  // rx2：写入记忆（transform 触发即保存，下次会话默认生效）
  try {
    localStorage.setItem(CASE_MEM_KEY, target)
  } catch {
    /* 隐私模式忽略 */
  }
  const keep = o.keepPrefix === true
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (o.view === 'overview') {
    // rx1：五风格一览
    const rows = lines.map((l) => {
      const prefix = keep && /^[_-]?[A-Za-z0-9]+(?=[_-])/.test(l) ? (l.match(/^[_-]?[A-Za-z0-9]+(?=[_-])/)?.[0] ?? '') : ''
      const body = prefix ? l.slice(prefix.length) : l
      const converted = CASE_TARGETS.map((c) => `${c.value}: ${prefix}${convertIdentifier(body, c.value)}`)
      return converted.join(' ｜ ')
    })
    return rows.join('\n')
  }
  const out = lines.map((l) => {
    const m = keep ? l.match(/^([_-]?[A-Za-z0-9]+)(?=[_-])([\s\S]*)$/) : null
    if (m) return `${m[1]}${convertIdentifier(m[2]!, target)}`
    return convertIdentifier(l, target)
  }).join('\n')
  return out
}

/** 变量命名风格统计行（rx4 源风格摘要走 stats 通道，输出正文保持纯转换结果） */
export function caseStats(t: string): string {
  const detect = (l: string): string => {
    if (/^[a-z]+(_[a-z0-9]+)+$/.test(l)) return 'snake_case'
    if (/^[a-z]+([A-Z][a-z0-9]+)+$/.test(l)) return 'camelCase'
    if (/^([A-Z][a-z0-9]+){2,}$/.test(l)) return 'PascalCase'
    if (/^[a-z]+(-[a-z0-9]+)+$/.test(l)) return 'kebab-case'
    if (/^[A-Z]+(_[A-Z0-9]+)+$/.test(l)) return 'CONSTANT_CASE'
    return '混合/未知'
  }
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const counts = new Map<string, number>()
  for (const l of lines) counts.set(detect(l), (counts.get(detect(l)) ?? 0) + 1)
  const summary = [...counts.entries()].map(([k, n]) => `${k} ×${n}`).join('、')
  return summary ? `源风格检测：${summary}` : ''
}

/* =============== Cookie（rx2 相对时间 / rx3 SameSite 告警） =============== */

/** UTC 字符串 → 中文相对时间注解 */
function relTimeNote(expires: string): string {
  const d = new Date(expires)
  if (Number.isNaN(d.getTime())) return ''
  const diff = d.getTime() - Date.now()
  const future = diff > 0
  const abs = Math.abs(diff)
  const unit = abs < 3600e3 ? `${Math.round(abs / 60e3)} 分钟` : abs < 86400e3 ? `${Math.round(abs / 3600e3)} 小时` : abs < 30 * 86400e3 ? `${Math.round(abs / 86400e3)} 天` : abs < 365 * 86400e3 ? `${Math.round(abs / (30 * 86400e3))} 个月` : `${(abs / (365 * 86400e3)).toFixed(1)} 年`
  return `（约 ${future ? '' : '过去 '}${unit}${future ? '后过期' : '前已过期'}）`
}

export function cookieTransform(t: string, o: { dir?: unknown }): string {
  if (o.dir === 'build') return cookieJsonToHeader(t)
  let out = parseCookieInput(t)
  // rx3：SameSite=None 且无 Secure → 顶部黄条（textDef 以提示行呈现）
  const hasNone = /samesite\s*=\s*none/i.test(t)
  const hasSecure = /secure/i.test(t)
  if (hasNone && !hasSecure) out = `# 告警：SameSite=None 需搭配 Secure，现代浏览器将拒绝不带 Secure 的 None Cookie\n${out}`
  // rx2：Expires 相对时间注解 + 会话 Cookie 标注
  try {
    const parsed = JSON.parse(out.replace(/^#[^\n]*\n/, '')) as unknown
    const annotate = (row: Record<string, unknown>) => {
      if (typeof row.expires === 'string') row.expiresNote = relTimeNote(row.expires)
      if (!row.expires && !row.maxAge) row.sessionNote = '会话级（未设置 Expires/Max-Age，关闭浏览器即失效）'
      return row
    }
    const annotated = Array.isArray(parsed) ? parsed.map((r) => annotate(r as Record<string, unknown>)) : parsed && typeof parsed === 'object' ? annotate(parsed as Record<string, unknown>) : parsed
    const json = JSON.stringify(annotated, null, 2)
    out = out.replace(/^#[^\n]*\n/, (m) => m) + '' // 保持告警行
    out = out.includes('# 告警') ? `# 告警：SameSite=None 需搭配 Secure，现代浏览器将拒绝不带 Secure 的 None Cookie\n${json}` : json
  } catch {
    /* 非 JSON 输出保持原样 */
  }
  return out
}

/* =============== 地图坐标系（rx2 顺序判别 / rx4 偏移量 / rx5 截断） =============== */

/** 球面近似距离（米），用于显示 GCJ02 相对 WGS84 的偏移量（rx4） */
export function haversineM(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function coordCompute(
  v: { input?: unknown; from?: unknown },
): { label: string; value: string; primary?: boolean; hint?: string }[] {
  const raw = String(v.input ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const lines = raw.slice(0, 200)
  if (!lines.length) return [{ label: '请输入经纬度', value: '每行一个「经度,纬度」，如 116.404,39.915' }]
  const from = String(v.from) as CoordSys
  const rows: { label: string; value: string; primary?: boolean; hint?: string }[] = []
  let outOfCn = false
  lines.forEach((line, idx) => {
    const nums = line.split(/[,，\s]+/).map(Number)
    let lon = nums[0]
    let lat = nums[1]
    if (nums.length < 2 || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat!) > 90 || Math.abs(lon!) > 180) {
      rows.push({ label: `第 ${idx + 1} 行`, value: '格式不合法：应为「经度,纬度」，纬度 ±90、经度 ±180 内' })
      return
    }
    // rx2：顺序智能判别（首值像纬度、次值像经度 → 提示，按原样计算）
    let orderHint = ''
    if (lon! > 0.8 && lon! <= 55.8 && lat! >= 73 && lat! <= 135.8) {
      orderHint = '疑似纬度、经度顺序颠倒，已按输入原样计算'
    }
    const results: Record<string, { lon: number; lat: number }> = {}
    for (const to of ['wgs84', 'gcj02', 'bd09'] as const) {
      results[to] = convertCoord(lon!, lat!, from, to)
    }
    // rx4：偏移量显示（GCJ02 与 WGS84 的近似米距）
    const dMeter = haversineM(results.wgs84!, results.gcj02!)
    for (const to of ['wgs84', 'gcj02', 'bd09'] as const) {
      const r = results[to]!
      const mark = to === from ? '（原坐标系）' : ''
      const hintBits: string[] = []
      if (orderHint) hintBits.push(orderHint)
      if (to === 'gcj02' && dMeter > 1) hintBits.push(`Δ 约 ${Math.round(dMeter)}m`)
      rows.push({
        label: `第 ${idx + 1} 行 · ${COORD_LABELS[to].split('（')[0]}`,
        value: `${r.lon.toFixed(6)}, ${r.lat.toFixed(6)}${mark}`,
        primary: idx === 0 && to !== from,
        hint: hintBits.join('；') || undefined,
      })
    }
    if (outOfChina(lon!, lat!)) outOfCn = true
  })
  if (raw.length > 200) rows.push({ label: '截断提示', value: `已处理前 200 行（共 ${raw.length} 行），请分批` })
  if (outOfCn) rows.push({ label: '提示', value: '检测到中国境外坐标：纠偏算法仅对中国大陆生效，境外各坐标系结果一致' })
  return rows
}
