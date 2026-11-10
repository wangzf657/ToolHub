/** 开发者工具引擎：格式化、转换、生成（重依赖懒加载，轻量兜底） */

/* ---------------- JSON 工具 ---------------- */

export function formatJson(text: string, indent = 2, sortKeys = false): string {
  const parsed = JSON.parse(text, (k, v) => (sortKeys && typeof v === 'object' && v && !Array.isArray(v) ? sortObj(v) : v))
  return JSON.stringify(parsed, null, indent)
}

function sortObj(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj).sort().reduce((acc, k) => ({ ...acc, [k]: obj[k] }), {})
}

export function minifyJson(text: string): string {
  return JSON.stringify(JSON.parse(text))
}

/** V8 解析器的其余英文消息模式 → 中文提示（覆盖逗号/冒号/引号缺失、未闭合字符串、多余尾部内容等） */
const V8_JSON_HINTS: [RegExp, string][] = [
  [/Expected ',' or '}' after property value/i, '对象属性值后缺少逗号「,」或右花括号「}」，请检查是否漏写逗号'],
  [/Expected ',' or ']' after array element/i, '数组元素后缺少逗号「,」或右方括号「]」，请检查是否漏写逗号'],
  [/Expected double-quoted property name/i, '属性名必须用双引号包裹，JSON 不支持单引号或无引号的属性名'],
  [/Expected property name or '}'/i, '缺少合法的属性名，或对象没有用「}」闭合'],
  [/Expected ':' after property name/i, '属性名后缺少冒号「:」'],
  [/Unexpected non-whitespace character after JSON/i, 'JSON 已结束但后面还有多余内容，请检查是否多写了字符或混入了第二段 JSON'],
  [/Unterminated string/i, '字符串没有用双引号闭合'],
]

/** 把 V8 的英文 JSON 解析错误转成中文提示（供通用 TextTool 复用） */
export function localizeJsonError(msg: string, text = ''): string {
  const pos = msg.match(/position (\d+)/)
  if (/Unexpected end of JSON input|Unexpected end of/i.test(msg)) {
    return pos
      ? `JSON 不完整：内容在预期之外结束（第 ${lineAt(text, Number(pos[1]))} 行附近）`
      : 'JSON 不完整：内容在预期之外结束，请检查是否少写括号或引号'
  }
  const token = msg.match(/Unexpected token '?(.+?)'?[, ]/i)
  if (token) {
    const t = token[1]
    const where = pos ? `（第 ${lineAt(text, Number(pos[1]))} 行，第 ${colAt(text, Number(pos[1]))} 列附近）` : ''
    if (t === '<' || t === 'N' || t === 'u') return `JSON 语法错误：意外符号「${t}」，请检查是否误用了 JS 字面量（如 undefined/NaN）或粘贴了非 JSON 内容${where}`
    return `JSON 语法错误：意外符号「${t}」，请检查逗号、引号或括号是否正确${where}`
  }
  // V8 其余常见消息模式（Expected … / Unterminated … 等），逐类给出可操作的中文提示
  const where = pos ? `（第 ${lineAt(text, Number(pos[1]))} 行，第 ${colAt(text, Number(pos[1]))} 列附近）` : ''
  for (const [re, hint] of V8_JSON_HINTS) {
    if (re.test(msg)) return `JSON 语法错误：${hint}${where}`
  }
  if (/Unexpected token/i.test(msg)) return 'JSON 语法错误：存在无法解析的内容，请检查格式'
  if (/Unexpected .* in JSON/i.test(msg)) return 'JSON 语法错误：结构不符合 JSON 规范'
  if (/Bad escaped character/i.test(msg)) return 'JSON 语法错误：存在非法转义字符'
  if (/Bad control character/i.test(msg)) return 'JSON 语法错误：字符串中含非法控制字符'
  return `JSON 语法错误：${msg}`
}

function lineAt(text: string, idx: number): number {
  return text.slice(0, idx).split('\n').length
}
function colAt(text: string, idx: number): number {
  return idx - text.slice(0, idx).lastIndexOf('\n')
}

export function validateJson(text: string): { ok: boolean; error?: string; line?: number; col?: number } {
  try {
    JSON.parse(text)
    return { ok: true }
  } catch (e) {
    const raw = (e as Error).message
    const pos = raw.match(/position (\d+)/)
    if (pos) {
      const idx = Number(pos[1])
      return { ok: false, error: localizeJsonError(raw, text), line: lineAt(text, idx), col: colAt(text, idx) }
    }
    return { ok: false, error: localizeJsonError(raw, text) }
  }
}

export function jsonToYaml(text: string): string {
  if (!text.trim()) return ''
  const data = JSON.parse(text)
  return toYamlValue(data, 0)
}

function toYamlValue(v: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  if (v === null) return 'null'
  if (typeof v !== 'object') return typeof v === 'string' ? v : String(v)
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    return v.map((item) => `${pad}- ${toYamlInline(item, indent + 1)}`).join('\n')
  }
  const entries = Object.entries(v as Record<string, unknown>)
  if (!entries.length) return '{}'
  return entries.map(([k, val]) => `${pad}${k}: ${toYamlInline(val, indent + 1)}`).join('\n')
}

function toYamlInline(v: unknown, indent: number): string {
  if (v === null) return 'null'
  if (typeof v !== 'object') return typeof v === 'string' && /[:#\n]/.test(v) ? JSON.stringify(v) : String(v)
  const sub = toYamlValue(v, indent)
  return '\n' + sub
}

export function yamlToJson(text: string): string {
  const data = yamlParse(text)
  return JSON.stringify(data, null, 2)
}

/** 轻量 YAML 解析（常见子集：嵌套映射/序列/行内集合/标量），无法识别时报错而非静默丢数据 */
export function yamlParse(text: string): unknown {
  try {
    const jsYaml = (globalThis as never as { __jsYaml?: typeof import('js-yaml') }).__jsYaml
    if (jsYaml) return jsYaml.load(text)
  } catch {
    /* 走内置解析 */
  }
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
  let pos = 0
  const parseBlock = (indent: number): unknown => {
    if (pos >= lines.length) return null
    const line = lines[pos]
    const curIndent = line.match(/^\s*/)![0].length
    if (curIndent < indent) return null
    const content = line.trim()
    if (content.startsWith('- ') || content === '-') {
      const arr: unknown[] = []
      while (pos < lines.length) {
        const l = lines[pos]
        const ind = l.match(/^\s*/)![0].length
        const c = l.trim()
        if (ind !== indent || !(c.startsWith('- ') || c === '-')) break
        pos++
        const item = c === '-' ? null : c.slice(2).trim()
        if (item === null || item === '') {
          // 子块必须比「-」更深缩进，否则为空项
          const ni = nextIndent()
          arr.push(ni > indent ? parseBlock(ni) : null)
        } else if (item.startsWith('[') || item.startsWith('{')) {
          arr.push(parseFlowValue(item))
        } else if ((item.includes(': ') || item.endsWith(':')) && !/^["']/.test(item)) {
          // 行内 map 项：临时重写为缩进行
          lines.splice(pos, 0, ' '.repeat(indent + 2) + item)
          arr.push(parseBlock(indent + 2))
        } else {
          arr.push(parseFlowValue(item))
        }
      }
      return arr
    }
    const obj: Record<string, unknown> = {}
    while (pos < lines.length) {
      const l = lines[pos]
      const ind = l.match(/^\s*/)![0].length
      const c = l.trim()
      if (ind !== indent || c.startsWith('- ')) break
      const m = c.match(/^([^:]+):\s*(.*)$/)
      if (!m) throw new Error(`无法识别的 YAML 行：「${c}」，请检查缩进与冒号后空格`)
      pos++
      const key = scalar(m[1].trim().replace(/^["']|["']$/g, '')) as string
      const rest = m[2].trim()
      if (rest !== '') {
        obj[key] = parseFlowValue(rest)
        continue
      }
      // 值在后续块中：按下一行实际缩进解析（序列可与大键同级）
      obj[key] = null
      if (pos < lines.length) {
        const nl = lines[pos]
        const ni = nl.match(/^\s*/)![0].length
        const nc = nl.trim()
        if (ni > indent) obj[key] = parseBlock(ni)
        else if (ni >= indent && (nc.startsWith('- ') || nc === '-')) obj[key] = parseBlock(ni)
      }
    }
    return obj
  }
  /** 下一行的实际缩进（供子块解析，避免假定固定步长） */
  const nextIndent = (): number => {
    if (pos >= lines.length) return 0
    return lines[pos].match(/^\s*/)![0].length
  }
  return parseBlock(0)
}

/** 行内流式值：[a, b]、{a: 1} 或普通标量 */
function parseFlowValue(s: string): unknown {
  s = s.trim()
  if (s.startsWith('[')) {
    if (!s.endsWith(']')) throw new Error(`YAML 行内序列未闭合：「${s}」，请检查是否缺少 ]`)
    const inner = s.slice(1, -1).trim()
    return inner ? splitFlow(inner).map((p) => parseFlowValue(p)) : []
  }
  if (s.startsWith('{')) {
    if (!s.endsWith('}')) throw new Error(`YAML 行内映射未闭合：「${s}」，请检查是否缺少 }`)
    const inner = s.slice(1, -1).trim()
    if (!inner) return {}
    const obj: Record<string, unknown> = {}
    for (const part of splitFlow(inner)) {
      const m = part.match(/^([^:]+):(.*)$/)
      if (!m) return s // 形如 map 却拆不出键值，原样返回
      obj[String(parseFlowValue(m[1]))] = parseFlowValue(m[2])
    }
    return obj
  }
  return scalar(s)
}

/** 按顶层逗号切分行内集合，忽略引号与嵌套括号内的逗号 */
function splitFlow(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let cur = ''
  for (const ch of s) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
      continue
    }
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim() || parts.length) parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

function scalar(s: string): unknown {
  s = s.trim()
  if (s === '' || s === '~' || s === 'null' || s === 'Null') return null
  if (s === 'true' || s === 'True') return true
  if (s === 'false' || s === 'False') return false
  if (/^-?\d+$/.test(s)) return parseInt(s)
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s)
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1)
  return s
}

export async function yamlToJsonHeavy(text: string): Promise<string> {
  const jsYaml = await import('js-yaml')
  ;(globalThis as never as { __jsYaml?: unknown }).__jsYaml = jsYaml
  const data = jsYaml.load(text)
  return JSON.stringify(data, null, 2)
}

/* ---------------- TOML ---------------- */

export async function tomlToJson(text: string): Promise<string> {
  const toml = await import('@iarna/toml')
  const data = toml.parse(text)
  return JSON.stringify(data, null, 2)
}

export async function jsonToToml(text: string): Promise<string> {
  const toml = await import('@iarna/toml')
  const data = JSON.parse(text)
  return toml.stringify(data as never)
}

/* ---------------- 格式化（prettier / sql-formatter 懒加载） ---------------- */

export async function formatCode(
  lang: 'javascript' | 'css' | 'html' | 'graphql',
  code: string,
  minify = false,
  indent = 2,
): Promise<string> {
  if (lang === 'graphql') {
    return minify ? minifyGraphql(code) : prettyGraphql(code)
  }
  if (lang === 'css' && minify) return minifyCss(code)
  if (lang === 'html' && minify) return minifyHtml(code)
  if (lang === 'javascript' && minify) return minifyJs(code)
  try {
    const prettier = await import('prettier/standalone')
    const parserName = lang === 'javascript' ? 'babel' : lang === 'css' ? 'css' : 'html'
    const plugins = [
      await import('prettier/plugins/babel'),
      await import('prettier/plugins/estree'),
      await import('prettier/plugins/postcss'),
      await import('prettier/plugins/html'),
    ]
    return await prettier.format(code, {
      parser: parserName,
      plugins: plugins as never,
      tabWidth: indent,
      semi: true,
    })
  } catch {
    // 兜底：简单缩进
    return simpleIndent(code, indent)
  }
}

function simpleIndent(code: string, indent: number): string {
  let depth = 0
  return code
    .split('\n')
    .map((line) => {
      const t = line.trim()
      if (!t) return ''
      if (/^[)}\]]/.test(t)) depth = Math.max(0, depth - 1)
      const out = ' '.repeat(indent * depth) + t
      if (/[{[(]$/.test(t)) depth++
      return out
    })
    .join('\n')
}

export function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim()
}

export function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n\s*/g, '')
    .replace(/>\s+</g, '><')
    .trim()
}

export function minifyJs(js: string): string {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function formatXml(xml: string, indent = 2, minify = false): string {
  if (minify) return xml.replace(/>\s+</g, '><').trim()
  const pad = ' '.repeat(indent)
  let depth = 0
  const parts = xml.replace(/>\s*</g, '><').trim().split(/(?=<)|(?<=>)/g)
  const lines: string[] = []
  for (const p of parts) {
    const t = p.trim()
    if (!t) continue
    if (/^<\//.test(t)) depth = Math.max(0, depth - 1)
    lines.push(pad.repeat(depth) + t)
    if (/^<[^!?/][^>]*[^/]>$/.test(t) && !/^<(br|img|input|meta|link|hr)/i.test(t)) depth++
  }
  return lines.join('\n')
}

export function prettyGraphql(q: string, indent = 2): string {
  let depth = 0
  return q
    .replace(/\s+/g, ' ')
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}\n')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const t = l.trim()
      if (t.startsWith('}')) depth = Math.max(0, depth - 1)
      const out = ' '.repeat(indent * depth) + t
      if (t.endsWith('{')) depth++
      return out
    })
    .join('\n')
}

export function minifyGraphql(q: string): string {
  return q
    .replace(/#[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}():,])\s*/g, '$1')
    .trim()
}

export async function formatSql(sql: string, keywordCase: 'upper' | 'lower' | 'preserve' = 'upper'): Promise<string> {
  const { format } = await import('sql-formatter')
  return format(sql, { language: 'postgresql', keywordCase, tabWidth: 2 })
}

/* ---------------- XML ↔ JSON ---------------- */

export function xmlToJson(text: string): string {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('XML 解析失败：' + err.textContent?.slice(0, 120))
  return JSON.stringify(nodeToJson(doc.documentElement), null, 2)
}

function nodeToJson(el: Element): unknown {
  const children = [...el.children]
  const attrs: Record<string, unknown> = {}
  for (const a of el.attributes) attrs[`@${a.name}`] = a.value
  if (!children.length) {
    const text = el.textContent?.trim() ?? ''
    if (Object.keys(attrs).length) {
      return text ? { ...attrs, '#text': text } : attrs
    }
    return text === '' ? null : coerce(text)
  }
  const obj: Record<string, unknown> = { ...attrs }
  for (const c of children) {
    const v = nodeToJson(c)
    if (c.tagName in obj) {
      const prev = obj[c.tagName]
      obj[c.tagName] = Array.isArray(prev) ? [...prev, v] : [prev, v]
    } else {
      obj[c.tagName] = v
    }
  }
  return obj
}

export function jsonToXml(text: string, rootName = 'root', indentSize = 2): string {
  if (!text.trim()) return ''
  const data = JSON.parse(text)
  const build = (v: unknown, name: string, depth: number): string => {
    const pad = ' '.repeat(indentSize * depth)
    if (Array.isArray(v)) {
      return v.map((item) => build(item, name, depth)).join('\n')
    }
    if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>)
      const inner = entries.map(([k, val]) => build(val, k, depth + 1)).join('\n')
      return `${pad}<${name}>\n${inner}\n${pad}</${name}>`
    }
    const val = v === null ? '' : escXml(String(v))
    return `${pad}<${name}>${val}</${name}>`
  }
  const body = build(data, rootName, 1)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function coerce(s: string): unknown {
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  return s
}

/* ---------------- JSON → TypeScript ---------------- */

export function jsonToTs(text: string, rootName = 'Root'): string {
  const data = JSON.parse(text)
  const lines: string[] = []
  const seen = new Set<string>()
  const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Item'
  const walk = (v: unknown, name: string): string => {
    if (v === null) return 'null'
    if (Array.isArray(v)) {
      const elem = v.length ? walk(v[0], name) : 'unknown'
      return `${elem}[]`
    }
    if (typeof v === 'object') {
      const ifaceName = pascal(name)
      const ifaceKey = ifaceName + JSON.stringify(Object.keys(v as Record<string, unknown>))
      if (seen.has(ifaceKey)) return ifaceName
      seen.add(ifaceKey)
      const props = Object.entries(v as Record<string, unknown>).map(([k, val]) => {
        const type = walk(val, k)
        const optional = val === null || val === undefined ? '?' : ''
        const safeKey = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)
        return `  ${safeKey}${optional}: ${type}`
      })
      lines.push(`export interface ${ifaceName} {\n${props.join('\n')}\n}`)
      return ifaceName
    }
    return typeof v
  }
  const rootType = walk(data, rootName)
  lines.push(`\nexport type ${pascal(rootName)}Data = ${rootType}`)
  return lines.join('\n\n')
}

/* ---------------- JSON Schema（draft-07） ---------------- */

export function jsonSchemaFrom(text: string, rootTitle = 'Generated schema'): string {
  const data = JSON.parse(text)
  const schema: Record<string, unknown> = { $schema: 'http://json-schema.org/draft-07/schema#', title: rootTitle }
  const infer = (v: unknown): Record<string, unknown> => {
    if (v === null) return { type: 'null' }
    if (Array.isArray(v)) {
      return { type: 'array', items: v.length ? infer(v[0]) : {} }
    }
    if (typeof v === 'object') {
      const props: Record<string, unknown> = {}
      const required: string[] = []
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        props[k] = infer(val)
        if (val !== null && val !== undefined) required.push(k)
      }
      return { type: 'object', properties: props, required, additionalProperties: false }
    }
    if (typeof v === 'number') return { type: Number.isInteger(v) ? 'integer' : 'number' }
    return { type: typeof v }
  }
  Object.assign(schema, infer(data))
  return JSON.stringify(schema, null, 2)
}

/* ---------------- JSONPath（常用子集） ---------------- */

export function jsonPathQuery(data: unknown, path: string): unknown[] {
  const results: unknown[] = []
  const tokens = path
    .replace(/^\$\.?/, '')
    .split(/\.|\[(.+?)\]/g)
    .filter((t) => t !== undefined && t !== '')
  const walk = (node: unknown, idx: number): void => {
    if (idx >= tokens.length) {
      results.push(node)
      return
    }
    const t = tokens[idx].trim()
    if (t === '*') {
      if (Array.isArray(node)) node.forEach((n) => walk(n, idx + 1))
      else if (node && typeof node === 'object') Object.values(node).forEach((n) => walk(n, idx + 1))
    } else if (t.startsWith('?')) {
      // 过滤器 [?(...)] 简化支持 @.key==value
      const m = t.match(/@\.([\w]+)\s*==\s*'?([^'&]+)'?/)
      if (Array.isArray(node) && m) {
        node.forEach((n) => {
          const v = (n as Record<string, unknown>)?.[m[1]]
          if (String(v) === m[2].trim()) walk(n, idx + 1)
        })
      }
    } else if (t === '..') {
      // 递归下降
      const next = tokens[idx + 1]
      const collect = (n: unknown): void => {
        if (Array.isArray(n)) n.forEach(collect)
        else if (n && typeof n === 'object') {
          for (const [k, v] of Object.entries(n)) {
            if (k === next) results.push(v)
            collect(v)
          }
        }
      }
      collect(node)
    } else if (/^-?\d+$/.test(t)) {
      const i = Number(t)
      if (Array.isArray(node) && (i >= 0 || node.length + i >= 0)) walk(node[i < 0 ? node.length + i : i], idx + 1)
    } else if (t.includes(':')) {
      const [a, b] = t.split(':').map(Number)
      if (Array.isArray(node)) node.slice(a, b).forEach((n) => walk(n, idx + 1))
    } else {
      if (node !== null && typeof node === 'object') walk((node as Record<string, unknown>)[t], idx + 1)
    }
  }
  walk(data, 0)
  return results
}

/* ---------------- Mock 数据 ---------------- */

const FIRST_NAMES = ['伟', '芳', '娜', '敏', '静', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀', '霞', '平', '刚', '桂', '文']
const LAST_NAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑'.split('')
const EN_FIRST = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth']
const EN_LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Anderson']
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆']
const COMPANIES = ['创新科技', '云山网络', '星辰数据', '远航软件', '灯塔信息', '青石互联', '白泽智能']

const rand = (n: number): number => Math.floor(Math.random() * n)
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)]

export function mockValue(token: string): string {
  const m = token.match(/^\{\{(.+)\}\}$/)
  const t = (m ? m[1] : token).trim()
  const intMatch = t.match(/^int:(-?\d+)-(-?\d+)$/)
  if (intMatch) return String(Number(intMatch[1]) + rand(Number(intMatch[2]) - Number(intMatch[1]) + 1))
  switch (t) {
    case 'firstName': return pick(FIRST_NAMES)
    case 'lastName': return pick(LAST_NAMES)
    case 'enFirstName': return pick(EN_FIRST)
    case 'enLastName': return pick(EN_LAST)
    case 'fullName': return pick(LAST_NAMES) + pick(FIRST_NAMES)
    case 'email': return `${pick(EN_FIRST).toLowerCase()}.${pick(EN_LAST).toLowerCase()}${rand(900) + 100}@example.com`
    case 'phone': return `1${pick(['3', '5', '7', '8', '9'])}${String(rand(100000000)).padStart(9, '0')}`
    case 'city': return pick(CITIES)
    case 'address': return `${pick(CITIES)}市${pick(['朝阳', '海淀', '锦江', '南山', '西湖'])}区${pick(['幸福', '和平', '中山', '解放', '人民'])}路${rand(200) + 1}号`
    case 'company': return pick(COMPANIES) + '有限公司'
    case 'uuid': return uuid()
    case 'date': return new Date(Date.now() - rand(365) * 86400000).toISOString().slice(0, 10)
    case 'datetime': return new Date(Date.now() - rand(365) * 86400000).toISOString()
    case 'bool': return String(Math.random() < 0.5)
    case 'url': return `https://example.com/${pick(EN_LAST).toLowerCase()}/${rand(1000)}`
    case 'ip': return `${rand(223) + 1}.${rand(256)}.${rand(256)}.${rand(254) + 1}`
    case 'color': return '#' + rand(0xffffff).toString(16).padStart(6, '0')
    case 'id': return String(rand(100000))
    default: return token
  }
}

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function generateMock(template: string, count: number, asArray = true): string {
  // 递归替换模板中的 token
  const replaceTokens = (s: string): string =>
    s.replace(/\{\{[^}]+\}\}/g, (m) => mockValue(m))
  const results: unknown[] = []
  try {
    const parsed = JSON.parse(template)
    for (let i = 0; i < count; i++) {
      results.push(JSON.parse(replaceTokens(JSON.stringify(parsed))))
    }
    return JSON.stringify(asArray ? results : results[0], null, 2)
  } catch {
    // 非法 JSON 模板：按行文本生成
    const lines: string[] = []
    for (let i = 0; i < count; i++) lines.push(replaceTokens(template))
    return lines.join('\n')
  }
}

/* ---------------- 假数据（行式） ---------------- */

export function fakeRows(count: number, cols: { key: string; label: string }[]): { header: string[]; rows: string[][] } {
  return {
    header: cols.map((c) => c.label),
    rows: Array.from({ length: count }, () => cols.map((c) => mockValue(`{{${c.key}}}`))),
  }
}

export const FAKE_FIELDS: { key: string; label: string }[] = [
  { key: 'fullName', label: '姓名' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'city', label: '城市' },
  { key: 'address', label: '地址' },
  { key: 'company', label: '公司' },
  { key: 'date', label: '日期' },
  { key: 'uuid', label: 'UUID' },
  { key: 'int:18-65', label: '年龄' },
  { key: 'int:1000-99999', label: '金额' },
  { key: 'url', label: '网址' },
  { key: 'ip', label: 'IP 地址' },
]

/* ---------------- cURL → fetch ---------------- */

export function curlToFetch(cmd: string): { method: string; url: string; headers: [string, string][]; body: string | null; code: string } {
  // 解析（支持多行反斜杠续行）
  const raw = cmd.replace(/\\\n/g, ' ').replace(/\r/g, '')
  const tokens = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
  let url = ''
  let method = 'GET'
  const headers: [string, string][] = []
  let body: string | null = null
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]
    const unq = t.replace(/^["']|["']$/g, '')
    if (t === '-X' || t === '--request') method = (tokens[++i] ?? 'GET').toUpperCase()
    else if (t === '-H' || t === '--header') {
      const h = (tokens[++i] ?? '').replace(/^["']|["']$/g, '')
      const idx = h.indexOf(':')
      if (idx > 0) headers.push([h.slice(0, idx).trim(), h.slice(idx + 1).trim()])
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      body = (tokens[++i] ?? '').replace(/^["']|["']$/g, '')
      if (method === 'GET') method = 'POST'
    } else if (t === '--compressed' || t === '-s' || t === '-L' || t === '-k' || t.startsWith('-')) {
      if (t === '-F' || t === '--form') i++
      continue
    } else if (!t.startsWith('-') && !url) {
      url = unq
    }
  }
  if (!url) throw new Error('未在命令中找到 URL')
  const headerLines = headers.map(([k, v]) => `    "${k}": ${JSON.stringify(v)},`).join('\n')
  const bodyLines = body ? `  body: ${JSON.stringify(body)},` : ''
  const code = `const response = await fetch(${JSON.stringify(url)}, {
  method: ${JSON.stringify(method)},
  headers: {
${headerLines || '    // 无请求头'}
  },
${bodyLines}
});

if (!response.ok) {
  throw new Error(\`请求失败: \${response.status}\`);
}

const data = await response.json();
console.log(data);`
  return { method, url, headers, body, code }
}

/* ---------------- User-Agent 解析 ---------------- */

export interface UaInfo {
  browser: string
  engine: string
  os: string
  device: string
}

export function uaParse(ua: string): UaInfo {
  let browser = '未知浏览器'
  let engine = '未知引擎'
  let os = '未知系统'
  let device = '桌面设备'
  const b: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, 'Microsoft Edge'],
    [/OPR\/([\d.]+)|Opera/, 'Opera'],
    [/SamsungBrowser\/([\d.]+)/, 'Samsung 浏览器'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
    [/MSIE [\d.]+|Trident\/[\d.]+/, 'Internet Explorer'],
  ]
  for (const [re, name] of b) {
    const m = ua.match(re)
    if (m) {
      browser = m[1] ? `${name} ${m[1].split('.')[0]}` : name
      break
    }
  }
  const e: [RegExp, string][] = [
    [/Gecko\/[\d.]+.*rv:([\d.]+)/, 'Gecko'],
    [/AppleWebKit\/([\d.]+)/, 'WebKit'],
    [/Trident\/([\d.]+)/, 'Trident'],
  ]
  for (const [re, name] of e) {
    if (re.test(ua)) {
      engine = name
      break
    }
  }
  if (/Chrome\/|Chromium/.test(ua) && engine === 'WebKit') engine = 'Blink'
  const o: [RegExp, string][] = [
    [/Windows NT 10\.0/, 'Windows 10/11'],
    [/Windows NT 6\.1/, 'Windows 7'],
    [/Windows/, 'Windows'],
    [/Mac OS X ([\d_]+)/, 'macOS'],
    [/Android ([\d.]+)/, 'Android'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/CrOS/, 'ChromeOS'],
    [/Linux/, 'Linux'],
  ]
  for (const [re, name] of o) {
    const m = ua.match(re)
    if (m) {
      os = m[1] ? `${name} ${m[1].replace(/_/g, '.')}` : name
      break
    }
  }
  if (/Mobile|iPhone|Android.*Mobile/.test(ua)) device = '移动设备'
  else if (/iPad|Tablet/.test(ua)) device = '平板设备'
  else if (/Bot|bot|Spider|slurp|crawl/.test(ua)) device = '爬虫'
  return { browser, engine, os, device }
}

/* ---------------- HTTP 状态码 ---------------- */

export const HTTP_STATUS: { code: number; name: string; desc: string }[] = [
  { code: 100, name: 'Continue', desc: '继续：客户端应继续发送请求主体' },
  { code: 101, name: 'Switching Protocols', desc: '切换协议：服务器同意切换到客户端指定的协议' },
  { code: 200, name: 'OK', desc: '请求成功，响应体包含所请求的资源' },
  { code: 201, name: 'Created', desc: '已创建：请求成功并且服务器创建了新的资源' },
  { code: 202, name: 'Accepted', desc: '已接受：请求已接受但尚未处理完成' },
  { code: 204, name: 'No Content', desc: '无内容：服务器成功处理，但不需要返回任何实体内容' },
  { code: 206, name: 'Partial Content', desc: '部分内容：服务器完成了部分 GET 请求（断点续传）' },
  { code: 301, name: 'Moved Permanently', desc: '永久重定向：资源已永久移动到新 URL' },
  { code: 302, name: 'Found', desc: '临时重定向：资源临时从不同 URI 响应' },
  { code: 304, name: 'Not Modified', desc: '未修改：缓存的版本仍然有效' },
  { code: 307, name: 'Temporary Redirect', desc: '临时重定向，且方法与主体不变' },
  { code: 308, name: 'Permanent Redirect', desc: '永久重定向，且方法与主体不变' },
  { code: 400, name: 'Bad Request', desc: '请求语法错误，服务器无法理解' },
  { code: 401, name: 'Unauthorized', desc: '未认证：需要身份验证信息' },
  { code: 403, name: 'Forbidden', desc: '已认证但无权访问该资源' },
  { code: 404, name: 'Not Found', desc: '服务器找不到请求的资源' },
  { code: 405, name: 'Method Not Allowed', desc: '请求方法不被允许' },
  { code: 408, name: 'Request Timeout', desc: '请求超时：客户端发送过慢' },
  { code: 409, name: 'Conflict', desc: '请求与资源当前状态冲突' },
  { code: 410, name: 'Gone', desc: '资源已永久删除' },
  { code: 413, name: 'Payload Too Large', desc: '请求主体过大，超过服务器限制' },
  { code: 415, name: 'Unsupported Media Type', desc: '不支持的媒体类型' },
  { code: 422, name: 'Unprocessable Entity', desc: '请求格式正确但语义错误无法处理' },
  { code: 429, name: 'Too Many Requests', desc: '请求过多：触发了速率限制' },
  { code: 500, name: 'Internal Server Error', desc: '服务器内部错误' },
  { code: 501, name: 'Not Implemented', desc: '服务器不支持该请求方法' },
  { code: 502, name: 'Bad Gateway', desc: '网关收到上游无效响应' },
  { code: 503, name: 'Service Unavailable', desc: '服务暂时不可用（过载或维护）' },
  { code: 504, name: 'Gateway Timeout', desc: '网关等待上游响应超时' },
]

/* ---------------- Chmod ---------------- */

export function chmodToSymbol(octal: string): string {
  const map: Record<string, string> = {
    '0': '---', '1': '--x', '2': '-w-', '3': '-wx', '4': 'r--', '5': 'r-x', '6': 'rw-', '7': 'rwx',
  }
  const digits = octal.replace(/[^0-7]/g, '').padStart(3, '0').slice(-3)
  return [...digits].map((d) => map[d]).join('')
}

export function chmodFromSymbol(symbol: string): string {
  const map: Record<string, number> = {
    r: 4, w: 2, x: 1,
  }
  const groups = symbol.match(/[r-][w-][x-]/g) ?? []
  return groups.map((g) => {
    let n = 0
    if (g[0] === 'r') n += map.r
    if (g[1] === 'w') n += map.w
    if (g[2] === 'x') n += map.x
    return n
  }).join('')
}

/* ---------------- 子网计算 ---------------- */

export function subnetCalc(ip: string, prefix: number) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error('IPv4 地址格式无效')
  }
  if (prefix < 0 || prefix > 32) throw new Error('CIDR 前缀必须在 0-32 之间')
  const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const network = (ipInt & mask) >>> 0
  const broadcast = (network | (~mask >>> 0)) >>> 0
  const totalHosts = 2 ** (32 - prefix)
  const usable = prefix >= 31 ? totalHosts : totalHosts - 2
  const intToIp = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
  const maskParts = [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255]
  const wildcard = maskParts.map((p) => 255 - p).join('.')
  return {
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    netmask: maskParts.join('.'),
    wildcard,
    firstHost: prefix >= 31 ? intToIp(network) : intToIp(network + 1),
    lastHost: prefix >= 31 ? intToIp(broadcast) : intToIp(broadcast - 1),
    totalHosts,
    usable,
    ipInt,
    binary: parts.map((p) => p.toString(2).padStart(8, '0')).join('.'),
  }
}

/* ---------------- SVG 优化 ---------------- */

export function optimizeSvg(svg: string, opts: { precision?: number; removeComments?: boolean; removeMetadata?: boolean } = {}): string {
  let out = svg
  const p = opts.precision ?? 2
  if (opts.removeComments !== false) out = out.replace(/<!--[\s\S]*?-->/g, '')
  if (opts.removeMetadata !== false) {
    out = out
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
      .replace(/\s(id|data-name|class)="[^"]*"/g, '')
  }
  // 数字精度
  out = out.replace(/-?\d+\.\d+/g, (m) => {
    const n = Number(m)
    return String(Number(n.toFixed(p)))
  })
  out = out.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim()
  return out
}

/* ---------------- Unicode 查询 ---------------- */

export function unicodeInfo(ch: string): { char: string; codePoint: string; decimal: number; block: string; entity: string } {
  const cp = ch.codePointAt(0) ?? 0
  return {
    char: ch,
    codePoint: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
    decimal: cp,
    block: unicodeBlock(cp),
    entity: cp > 127 ? `&#${cp};` : ch,
  }
}

function unicodeBlock(cp: number): string {
  const blocks: [number, number, string][] = [
    [0x0000, 0x007f, '基本拉丁'], [0x0080, 0x00ff, '拉丁补充'], [0x0100, 0x017f, '拉丁扩展-A'],
    [0x0370, 0x03ff, '希腊字母'], [0x0400, 0x04ff, '西里尔字母'], [0x2000, 0x206f, '常用标点'],
    [0x2100, 0x214f, '字母式符号'], [0x2190, 0x21ff, '箭头符号'], [0x2200, 0x22ff, '数学符号'],
    [0x2300, 0x23ff, '杂项技术'], [0x2460, 0x24ff, '带圈字母数字'], [0x2500, 0x257f, '制表符'],
    [0x25a0, 0x25ff, '几何图形'], [0x2600, 0x26ff, '杂项符号'], [0x2700, 0x27bf, '装饰符号'],
    [0x3000, 0x303f, 'CJK 符号和标点'], [0x3040, 0x309f, '平假名'], [0x30a0, 0x30ff, '片假名'],
    [0x4e00, 0x9fff, 'CJK 统一表意文字'], [0xf900, 0xfaff, 'CJK 兼容表意文字'],
    [0xff00, 0xffef, '半角/全角形式'], [0x1f300, 0x1f5ff, '杂项符号和图形'], [0x1f600, 0x1f64f, '表情符号'],
    [0x1f680, 0x1f6ff, '交通和地图符号'], [0x1f900, 0x1f9ff, '补充符号和图形'],
  ]
  for (const [a, b, name] of blocks) {
    if (cp >= a && cp <= b) return name
  }
  return '其他区域'
}

/* ---------------- PX/REM ---------------- */

export function pxRem(px: number | null, rem: number | null, root = 16): { rem?: number; px?: number } {
  if (px !== null) return { rem: Number((px / root).toFixed(4)) }
  if (rem !== null) return { px: Number((rem * root).toFixed(2)) }
  return {}
}

/** JSON → Java 实体类（POJO，可选 Lombok；与 jsonToTs 同思路的类型推断） */
export function jsonToJava(text: string, className = 'Demo', lombok = true, indentStr = '    '): string {
  const data = JSON.parse(text)
  const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('') || 'Item'
  const lines: string[] = []
  const seen = new Set<string>()

  const javaType = (v: unknown, name: string): { type: string; nested?: string } => {
    if (v === null) return { type: 'Object' }
    if (typeof v === 'string') return { type: 'String' }
    if (typeof v === 'number') return { type: Number.isInteger(v) ? 'Integer' : 'Double' }
    if (typeof v === 'boolean') return { type: 'Boolean' }
    if (Array.isArray(v)) {
      const elem = v.length ? javaType(v[0], name) : { type: 'Object' }
      return { type: `List<${elem.type}>`, nested: elem.nested }
    }
    // 嵌套对象 → 生成子类
    const cls = pascal(name) + 'Dto'
    if (!seen.has(cls)) {
      seen.add(cls)
      emitClass(cls, v as Record<string, unknown>, indentStr)
    }
    return { type: cls }
  }

  const emitClass = (cls: string, obj: Record<string, unknown>, ind: string) => {
    // 先收集字段类型（嵌套类在字段遍历中递归注册）
    const fields: { name: string; type: string }[] = []
    for (const [k, v] of Object.entries(obj)) {
      const t = javaType(v, k)
      fields.push({ name: camel(k), type: t.type })
    }
    lines.push(`/** ${cls} */`)
    if (lombok) lines.push(`@Data`)
    lines.push(`public class ${cls} {`)
    for (const f of fields) {
      lines.push(`${ind}private ${f.type} ${f.name};`)
    }
    lines.push('')
    if (!lombok) {
      // 无 Lombok 时补 getter/setter
      for (const f of fields) {
        const cap = f.name[0]!.toUpperCase() + f.name.slice(1)
        lines.push(`${ind}public ${f.type} get${cap}() {`)
        lines.push(`${ind}${ind}return this.${f.name};`)
        lines.push(`${ind}}`)
        lines.push(`${ind}public void set${cap}(${f.type} ${f.name}) {`)
        lines.push(`${ind}${ind}this.${f.name} = ${f.name};`)
        lines.push(`${ind}}`)
      }
    }
    lines.push('}')
    lines.push('')
  }

  const rootObj = Array.isArray(data) && data.length ? data[0] : data
  if (typeof rootObj !== 'object' || rootObj === null) {
    throw new Error('顶层应为 JSON 对象（或非空对象数组）')
  }
  emitClass(pascal(className) || 'Demo', rootObj as Record<string, unknown>, indentStr)
  // emitClass 递归产生的子类排在 lines 尾部，反转注释行处理即可——按序返回
  return lines.join('\n').trimEnd() + '\n'
}

function camel(s: string): string {
  const clean = s.replace(/[^a-zA-Z0-9_]/g, '_')
  const parts = clean.split('_').filter(Boolean)
  if (!parts.length) return 'field'
  const first = parts[0]!.toLowerCase()
  return first + parts.slice(1).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')
}
