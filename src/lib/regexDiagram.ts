/**
 * 正则可视化布局引擎：regjsparser AST → 递归布局 → 铁路图 SVG 字符串。
 * 修复台账：09/N-07（quantifier.body 是单元素数组）、10/N-07R（group.body 同为数组，
 * 分组此前整体落入兜底渲染成 "undefined"）。
 * regjsparser 0.14.1 形态要点（test-reports/_scripts/probe-n07r.mjs 实测）：
 *  - quantifier.body / group.body / characterClass.body / disjunction.body 一律为数组；
 *  - 命名分组 = behavior 'normal' + name 字段，且需 features.namedGroups 打开；
 *  - 后顾断言 (?<=) 需 features.lookbehind，\p{} 需 u 标志 + features.unicodePropertyEscape；
 *  - 反向引用节点类型为 'reference'（非 backReference）。
 */
export interface DiagramResult {
  svg: string
  width: number
  height: number
}

/* ---------- 布局盒模型 ---------- */
interface Box {
  w: number
  h: number
  /** 返回定位到 (x,y) 的 SVG 片段 */
  render: (x: number, y: number) => string
}

const CW = 9 // ASCII 字符宽
const HZ = 36 // 常规盒高
const MID = HZ / 2

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textW = (s: string) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 16 : CW), 0)

/** 原子节点：圆角矩形 + 居中文本 */
function term(label: string, dashed = false): Box {
  const w = Math.max(26, textW(label) + 18)
  return {
    w,
    h: HZ,
    render: (x, y) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${HZ}" rx="9" fill="var(--panel-solid)" stroke="var(--accent)" stroke-width="1.4"${dashed ? ' stroke-dasharray="4 3"' : ''} />` +
      `<text x="${x + w / 2}" y="${y + MID + 4.5}" text-anchor="middle" font-size="12.5" fill="var(--text-1)" font-family="monospace">${esc(label)}</text>`,
  }
}

/** 序列：水平拼接，中线连线 */
function seq(boxes: Box[]): Box {
  if (!boxes.length) return term('空')
  const gap = 14
  const w = boxes.reduce((s, b) => s + b.w, 0) + gap * (boxes.length - 1)
  const h = Math.max(...boxes.map((b) => b.h), HZ)
  return {
    w,
    h,
    render: (x, y) => {
      let s = ''
      let cx = x
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i]
        const by = y + (h - b.h) / 2
        s += b.render(cx, by)
        if (i > 0) s += line(cx - gap, y + (h - boxes[i - 1].h) / 2 + boxes[i - 1].h / 2, cx, by + b.h / 2)
        cx += b.w + gap
      }
      return s
    },
  }
}
function line(x1: number, y1: number, x2: number, y2: number) {
  if (x1 === x2 && y1 === y2) return ''
  if (y1 === y2) return `<path d="M${x1} ${y1} H${x2}" stroke="var(--accent)" stroke-width="1.4" fill="none" />`
  return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="var(--accent)" stroke-width="1.4" fill="none" />`
}

/** 分支：垂直堆叠 + 左右汇流线 */
function disj(boxes: Box[]): Box {
  const gap = 14
  const inner = Math.max(...boxes.map((b) => b.w))
  const w = inner + 44
  const h = boxes.reduce((s, b) => s + b.h, 0) + gap * (boxes.length - 1)
  const mid = h / 2
  return {
    w,
    h: h + 8,
    render: (x, y) => {
      let s = ''
      let cy = y + 4
      for (const b of boxes) {
        s += b.render(x + 22, cy)
        s += line(x, mid, x + 22, cy + b.h / 2)
        s += line(x + 22 + b.w, cy + b.h / 2, x + w, mid)
        cy += b.h + gap
      }
      return s
    },
  }
}

/** 量词：子盒 + 虚线外框 + 角标 */
function quant(child: Box, label: string): Box {
  const w = child.w + 26
  const h = child.h + 30
  return {
    w,
    h,
    render: (x, y) => {
      const cy = y + 15 + (child.h - HZ) / 2
      return (
        `<rect x="${x}" y="${y + 4}" width="${w}" height="${h - 8}" rx="12" fill="none" stroke="var(--text-3)" stroke-width="1.2" stroke-dasharray="5 4" />` +
        child.render(x + 13, y + 15) +
        `<rect x="${x + w - 30}" y="${y + h - 18}" width="30" height="18" rx="5" fill="var(--accent-soft)" />` +
        `<text x="${x + w - 15}" y="${y + h - 4.5}" text-anchor="middle" font-size="11" fill="var(--accent-text)" font-family="monospace">${esc(label)}</text>`
      )
    },
  }
}

/** 分组：标签 + 实线外框 */
function group(child: Box, caption: string): Box {
  const capH = caption ? 18 : 6
  const w = child.w + 20
  const h = child.h + capH + 12
  return {
    w,
    h,
    render: (x, y) => {
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="none" stroke="var(--text-3)" stroke-width="1.4" />`
      if (caption) s += `<text x="${x + 10}" y="${y + 13}" font-size="11" fill="var(--text-3)">${esc(caption)}</text>`
      s += child.render(x + 10, y + capH + 4)
      return s
    },
  }
}

const GROUP_LABELS: Record<string, string> = {
  ignore: '(?:…) 不捕获',
  lookahead: '(?=…) 前瞻',
  negativeLookahead: '(?!…) 负前瞻',
  lookbehind: '(?<=…) 后顾',
  negativeLookbehind: '(?<!…) 负后顾',
  modifier: '(?flags:…) 局部标志',
}

/** regjsparser 英文报错 → 中文摘要（仿 JSON 错误中文化口径，附原始信息便于定位） */
function zhRegexError(msg: string): string {
  if (/classAtom|character.?class|unterminated|unclosed/i.test(msg)) return '字符类（方括号）未闭合，或类内语法有误'
  if (/group|capturing|unbalanced|\(/i.test(msg)) return '分组括号未闭合'
  if (/nothing to repeat|quantifier/i.test(msg)) return '量词（* + ? {）缺少可重复的内容'
  if (/escape/i.test(msg)) return '转义序列有误'
  if (/flag|modifier/i.test(msg)) return '正则标志（flags）有误'
  if (/expected atom/i.test(msg)) return '该位置缺少可识别的语法单元（字符/分组/转义）'
  return '正则语法有误'
}

/** 递归把 AST 节点（或节点数组）转为布局盒；captureNo 闭包计数捕获组编号（源顺序 = JS 编号） */
function boxOf(node: unknown, captureNo: () => number): Box {
  // regjsparser 0.14.1 的 body 字段（quantifier/group/characterClass/disjunction）一律是数组
  if (Array.isArray(node)) return seq(node.map((n) => boxOf(n, captureNo)))
  const n = node as Record<string, unknown>
  switch (String(n.type)) {
    case 'alternative':
      return seq(((n.body as Record<string, unknown>[]) ?? []).map((c) => boxOf(c, captureNo)))
    case 'disjunction': {
      const alts = (n.body as Record<string, unknown>[]) ?? []
      return alts.length > 1 ? disj(alts.map((c) => boxOf(c, captureNo))) : boxOf(alts[0], captureNo)
    }
    case 'quantifier': {
      const q = n as { min: number; max?: number; symbol?: string; greedy: boolean }
      let label = q.symbol ?? ''
      if (!label) {
        if (q.max === undefined || q.max === q.min) label = `{${q.min}}`
        else if (q.max === Infinity) label = `{${q.min},}`
        else label = `{${q.min},${q.max}}`
      }
      if (!q.greedy) label += '?'
      const child = Array.isArray(n.body) ? n.body[0] : n.body
      return quant(boxOf(child, captureNo), label)
    }
    case 'group': {
      const g = n as { behavior: string; name?: { value?: string } }
      const no = g.behavior === 'normal' ? captureNo() : 0
      let caption = GROUP_LABELS[g.behavior] ?? g.behavior
      if (no) caption = g.name?.value ? `第 ${no} 组 (?<${g.name.value}>)` : `第 ${no} 组`
      // group.body 恒为数组（flattenBody），交给 boxOf 的数组分支统一处理
      return group(boxOf(n.body, captureNo), caption)
    }
    case 'characterClass':
      return term(String(n.raw ?? '[…]'))
    case 'characterClassEscape':
      // \d \w \s 等类缩写（带原文，如 "\d"）
      return term(String(n.raw ?? '\\…'), true)
    case 'dot':
      return term(String(n.raw ?? '.') + ' 任意字符', false)
    case 'anchor': {
      const a = n as { kind: string }
      const labels: Record<string, string> = { start: '^ 行首', end: '$ 行尾', 'word-boundary': '\\b 词边界', 'non-word-boundary': '\\B' }
      return term(labels[a.kind] ?? String(n.raw), true)
    }
    case 'reference':
      // 反向引用 \1 / \k<name>（0.14.1 类型名为 reference）
      return term(String(n.raw ?? '\\1'), true)
    case 'unicodePropertyEscape':
      return term(String(n.raw ?? '\\p{…}'), true)
    case 'value': {
      const v = n as { kind: string; raw: string }
      return term(v.raw, v.kind !== 'symbol')
    }
    default:
      return term(String(n.raw ?? n.type ?? '?'), true)
  }
}

/** 正则 → 铁路图 SVG。解析失败时抛出中文错误（附原始报错），UI 直接展示。 */
export async function regexDiagramSvg(src: string, flags = ''): Promise<DiagramResult> {
  if (!/^[dgimsuvy]*$/.test(flags)) throw new Error('正则标志（flags）有误（可用：d g i m s u v y）')
  let ast: unknown
  try {
    // regjsparser 以 module.exports = {parse} 整体导出，Node/esbuild 场景只有 default 上有 parse
    type ParseFn = typeof import('regjsparser').parse
    const regmod = (await import('regjsparser')) as unknown as { parse?: ParseFn; default?: { parse: ParseFn } }
    const parse = regmod.parse ?? regmod.default?.parse
    if (!parse) throw new Error('regjsparser 加载失败')
    // ES2018+ 语法（命名分组/后顾断言/\p{}）由 features 打开；u/v 标志语义仍由 flags 决定
    ast = parse(src, flags, { namedGroups: true, lookbehind: true, unicodePropertyEscape: true, unicodeSet: true, modifiers: true, bufferBoundaries: true })
  } catch (e) {
    const msg = (e as Error).message || ''
    throw new Error(`${zhRegexError(msg)}（原始报错：${msg.slice(0, 80)}）`)
  }
  let captureCount = 0
  const captureNo = () => ++captureCount
  const box = boxOf(ast, captureNo)
  const PAD = 26
  const width = box.w + PAD * 2
  const height = box.h + PAD * 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${Math.min(1200, width)}px">${box.render(PAD, PAD)}` +
    // 入口与出口连线
    `<path d="M0 ${height / 2} H${PAD}" stroke="var(--accent)" stroke-width="1.4" fill="none" />` +
    `<path d="M${width - PAD} ${height / 2} H${width}" stroke="var(--accent)" stroke-width="1.4" fill="none" />` +
    `<circle cx="${width - 6}" cy="${height / 2}" r="3.5" fill="var(--accent)" />` +
    `</svg>`
  return { svg, width, height }
}

/** 提取 SVG 里的可见文本标签（测试哨兵用，反转义 esc 的三个实体） */
export function svgTextLabels(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) =>
    m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  )
}
