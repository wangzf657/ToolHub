/**
 * Mock 生成器增强（纯函数，无副作用）：
 * - seededMock：种子化可复现生成（mulberry32 PRNG），同 seed 同模板逐字符一致；
 *   token 语义与 lib/jsEngine.generateMock 对齐（uuid/姓名/邮箱/int 区间/日期/城市…）。
 * - tsFieldsToTemplate：最小 TS interface 解析 → Mock 模板（string→姓名、number→int 区间、
 *   boolean→bool、Date→datetime），供「从 TS 类型生成」一键填模板。
 */

const LAST_NAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴']
const FIRST_NAMES = ['伟', '芳', '娜', '敏', '静', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀', '霞', '平', '刚', '文', '云']
const EN_FIRST = ['james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda', 'david', 'elizabeth']
const EN_LAST = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'wilson', 'anderson']
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆']
const COMPANIES = ['创新科技', '云山网络', '星辰数据', '远航软件', '灯塔信息', '青石互联', '白泽智能']

/** mulberry32：小而稳的种子化 PRNG */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 单个 token → 种子化值 */
function tokenValue(t: string, rnd: () => number): string {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
  const rand = (n: number) => Math.floor(rnd() * n)
  const hex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[rand(16)]).join('')
  if (t.startsWith('int:')) {
    const m = t.match(/^int:(-?\d+)-(-?\d+)$/)
    if (!m) return '0'
    const a = Number(m[1])
    const b = Number(m[2])
    return String(Math.min(a, b) + Math.floor(rnd() * (Math.abs(b - a) + 1)))
  }
  switch (t) {
    case 'fullName':
      return pick(LAST_NAMES) + pick(FIRST_NAMES)
    case 'email':
      return `${pick(EN_FIRST)}.${pick(EN_LAST)}${rand(900) + 100}@example.com`
    case 'phone':
      return `1${pick(['3', '5', '7', '8'])}${String(rand(100000000)).padStart(8, '0')}`
    case 'uuid':
      return `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`
    case 'date': {
      const d = new Date(Date.UTC(2024, 0, 1) + Math.floor(rnd() * 1000) * 86400000)
      return d.toISOString().slice(0, 10)
    }
    case 'datetime': {
      const d = new Date(Date.UTC(2024, 0, 1) + Math.floor(rnd() * 1000) * 86400000)
      return `${d.toISOString().slice(0, 10)} ${String(rand(24)).padStart(2, '0')}:${String(rand(60)).padStart(2, '0')}:${String(rand(60)).padStart(2, '0')}`
    }
    case 'city':
      return pick(CITIES)
    case 'address':
      return `${pick(CITIES)}市${pick(['朝阳', '海淀', '锦江', '南山', '西湖'])}区${pick(['幸福', '和平', '中山', '解放', '人民'])}路${rand(200) + 1}号`
    case 'company':
      return pick(COMPANIES)
    case 'bool':
      return String(rnd() < 0.5)
    case 'url':
      return `https://www.example.com/${hex(6)}`
    case 'ip':
      return `${rand(223) + 1}.${rand(256)}.${rand(256)}.${rand(254) + 1}`
    case 'color':
      return `#${hex(6)}`
    case 'id':
      return String(rand(900000) + 100000)
    default:
      return `{{${t}}}`
  }
}

/** 种子化生成：模板为合法 JSON 时输出对象数组，否则按行文本 */
export function seededMock(template: string, count: number, seed: number): string {
  const replaceTokens = (s: string, rnd: () => number) => s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, t: string) => tokenValue(t, rnd))
  try {
    const parsed = JSON.parse(template)
    const out: unknown[] = []
    for (let i = 0; i < count; i++) {
      // seed + 记录序号：逐条独立、可复现
      out.push(JSON.parse(replaceTokens(JSON.stringify(parsed), mulberry32(seed * 7919 + i))))
    }
    return JSON.stringify(out, null, 2)
  } catch {
    const lines: string[] = []
    for (let i = 0; i < count; i++) lines.push(replaceTokens(template, mulberry32(seed * 7919 + i)))
    return lines.join('\n')
  }
}

/** 最小 TS interface 解析 → Mock 模板。支持扁平字段与一维数组；解析失败返回 null。 */
export function tsFieldsToTemplate(src: string): string | null {
  const body = src.match(/interface\s+\w+\s*\{([\s\S]*?)\}/) ?? src.match(/\btype\s+\w+\s*=\s*\{([\s\S]*?)\}/)
  if (!body) return null
  const fields = [...body[1].matchAll(/^\s*(?:readonly\s+)?(\w+)\??\s*:\s*([^;,\n]+)[;,\n]?/gm)]
  if (!fields.length) return null
  const tokenOf = (rawType: string): string => {
    const t = rawType.trim()
    const isArr = /\[\]$/.test(t) || /^Array</.test(t)
    const base = t.replace(/\[\]$/, '').replace(/^Array<|>$/g, '').trim()
    let token: string
    switch (base) {
      case 'string':
        token = '{{fullName}}'
        break
      case 'number':
        token = '{{int:18-60}}'
        break
      case 'boolean':
        token = '{{bool}}'
        break
      case 'Date':
        token = '{{datetime}}'
        break
      default:
        token = '{{uuid}}'
    }
    if (!isArr) return token
    // 数组：数值型不加引号，字符串型给两个元素
    return base === 'number' || base === 'boolean' ? `[${token}, ${token}]` : `["${token}", "${token}"]`
  }
  const lines = fields.map((m) => {
    const isNumeric = /^number$/.test(m[2].trim()) || /^Array<number>$/.test(m[2].trim()) || /^number\[\]$/.test(m[2].trim())
    const isBool = /^boolean(\[\])?$/.test(m[2].trim())
    const v = tokenOf(m[2])
    const quote = isNumeric || isBool ? '' : '"'
    return `  "${m[1]}": ${quote}${v}${quote},`
  })
  const text = lines.join('\n').replace(/,$/, '')
  return `{\n${text}\n}`
}
