/**
 * 正则铁路图增强（纯函数，无副作用）：
 * - explainLabel：按盒上标注文本给出中文解释（量词/字符类/分组/锚点/转义/普通字符）
 * - injectTitles：给交互版 SVG 的 term/group 盒注入 <title> 中文解释（下载版不注入）
 * - inlineSvgTheme：把 SVG 里的 var(--x) 替换为当前主题的实际色值（导出保真，可独立打开）
 * 依赖 lib/regexDiagram.ts 的盒模型口径：rect（盒）后紧跟 text（标注）。
 */

/** 反转义 lib/regexDiagram esc() 的三个实体 */
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 量词角标：* + ? {n} {n,} {n,m}（懒惰模式后缀 ?） */
const isQuantifier = (s: string) => /^(\*|\+|\?|\{\d+(,\d*)?\})\?$/.test(s) && (s.length > 1 || s === '*' || s === '+' || s === '?')

/** 按盒标注文本返回中文解释（标注已反转义为原文） */
export function explainLabel(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  // 分组类（lib 侧 caption 口径：第 N 组 / 第 N 组 (?<name>) / (?:…) 不捕获 …）
  if (/^第\s*\d+\s*组/.test(s)) return `捕获分组：把子表达式包成一组并编号，可用反向引用或替换变量（$1）复用${s.includes('(?<') ? '，这是命名分组' : ''}`
  if (s.includes('不捕获')) return '非捕获分组（?:…）：只聚合不编号，不占用分组号，比捕获分组更省资源'
  if (s.includes('负前瞻')) return '负前瞻断言（?!…）：右侧不能匹配该内容，零宽不消耗字符'
  if (s.includes('前瞻')) return '前瞻断言（?=…）：右侧必须能匹配该内容，零宽不消耗字符'
  if (s.includes('负后顾')) return '负后顾断言（?<!…）：左侧不能匹配该内容，零宽不消耗字符'
  if (s.includes('后顾')) return '后顾断言（?<=…）：左侧必须能匹配该内容，零宽不消耗字符'
  if (s.includes('局部标志')) return '局部标志分组（?flags:…）：只在该分组内生效的正则标志'
  // 锚点与断言
  if (s === '^ 行首') return '行首锚点 ^：匹配字符串（m 标志下为每行）开头位置，零宽断言不消耗字符'
  if (s === '$ 行尾') return '行尾锚点 $：匹配字符串（m 标志下为每行）结尾位置，零宽断言不消耗字符'
  if (s.startsWith('\\b')) return '词边界 \\b：零宽断言，一侧是词字符（\\w）另一侧不是；不消耗字符'
  if (s.startsWith('\\B')) return '非词边界 \\B：\\b 的反面，两侧同为（或同非）词字符；零宽断言'
  // 通配
  if (s.includes('任意字符')) return '点号 .：匹配除换行外的任意单个字符（s 标志下含换行）'
  // 量词
  if (isQuantifier(s)) {
    const lazy = s.endsWith('?')
    const core = lazy ? s.slice(0, -1) : s
    const m: Record<string, string> = { '*': '0 次或多次', '+': '1 次或多次', '?': '0 次或 1 次' }
    const desc = core.startsWith('{')
      ? core.endsWith(',}') || core.includes(',')
        ? '指定次数区间重复'
        : '精确重复指定次数'
      : (m[core] ?? '重复')
    return `量词 ${core}：前一元素${desc}${lazy ? '（懒惰模式：尽可能少匹配）' : '（贪婪模式：尽可能多匹配）'}`
  }
  // 字符类
  if (s.startsWith('[') && s.endsWith(']')) {
    const neg = s[1] === '^'
    return `字符类 ${s}：${neg ? '取反——匹配不在括号内的' : '匹配括号内'}任意一个字符`
  }
  if (/^\\[dDwWsS]$/.test(s)) {
    const m: Record<string, string> = {
      '\\d': '数字 0-9', '\\D': '非数字', '\\w': '词字符（字母/数字/下划线）', '\\W': '非词字符', '\\s': '空白符（空格/制表/换行等）', '\\S': '非空白符',
    }
    return `字符类缩写 ${s}：${m[s] ?? '字符集合'}；等价于一组字符的集合`
  }
  if (/^\\[pP]\{/.test(s)) return `Unicode 属性 ${s}：按 Unicode 属性匹配字符（需 u 标志）`
  // 反向引用
  if (/^\\\d+$/.test(s)) return `反向引用 ${s}：再次匹配第 ${s.slice(1)} 个捕获分组已匹配到的相同文本`
  if (s.startsWith('\\k<')) return `命名反向引用 ${s}：再次匹配同名命名分组已匹配到的文本`
  // 转义与普通字符
  if (s.startsWith('\\') && s.length === 2) {
    if (/^[ntrfv0]$/.test(s[1])) return `转义序列 ${s}：匹配对应控制字符（换行、制表符等不可见字符）`
    return `转义字符 ${s}：匹配字面上的「${s.slice(1)}」`
  }
  if (/^\\u\{|\\x/.test(s)) return `Unicode/十六进制转义 ${s}：按码点匹配对应字符`
  return `普通字符「${s}」：按字面精确匹配`
}

/** 交互版 SVG：把 (rect)(text) 相邻对包进 <g> 并注入 <title> 解释，悬停即可读 */
export function injectTitles(svg: string): string {
  return svg.replace(/(<rect\b[^>]*\/>)(<text\b[^>]*>([^<]*)<\/text>)/g, (_m, rect: string, text: string, label: string) => {
    const exp = explainLabel(unesc(label))
    if (!exp) return _m
    return `<g class="dia-node">${rect}<title>${esc(exp)}</title>${text}</g>`
  })
}

/** 主题色兜底（与 styles/tokens.css 深色默认一致；--text-1 为历史口径，映射 --text） */
const FALLBACK: Record<string, string> = {
  '--accent': '#6366f1',
  '--accent-soft': 'rgba(99, 102, 241, 0.14)',
  '--accent-text': '#a5b4fc',
  '--panel-solid': '#141d33',
  '--text': '#e6eaf3',
  '--text-1': '#e6eaf3',
  '--text-3': '#6f7d99',
}

/** 导出保真：把 var(--x) 替换为当前主题实际色值（迭代展开嵌套引用，未定义走兜底） */
export function inlineSvgTheme(svg: string): string {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return svg
  const cs = window.getComputedStyle(document.documentElement)
  let out = svg
  for (let i = 0; i < 4 && /var\(--/.test(out); i++) {
    out = out.replace(/var\((--[\w-]+)\)/g, (m, name: string) => {
      const v = cs.getPropertyValue(name).trim()
      if (v && !v.includes('var(')) return v
      return v || FALLBACK[name] || m
    })
  }
  return out
}

/** JS 引擎正则报错 → 中文提示（regex-tester 用；返回空串表示无映射，回退原始报错） */
export function humanizeRegexError(msg: string): string {
  if (/character class|class ranges? out of order|unterminated/i.test(msg)) {
    if (/out of order|range/i.test(msg)) return '字符类范围两端顺序颠倒（如 [z-a]），请交换两端或加转义'
    return '字符类（方括号）未闭合，或类内语法有误（如 [a- 缺少右括号与范围终点）'
  }
  if (/nothing to repeat/i.test(msg)) return '量词（* + ? {）前面没有可重复的内容——量词必须跟在字符、分组或字符类之后'
  if (/unterminated group|unbalanced|expected atom.*\(/i.test(msg)) return '分组括号未闭合——数一下左右括号数量是否一致'
  if (/invalid (identity )?escape|bad escape|incomplete/i.test(msg)) return '转义序列有误——单独出现的反斜杠请写成 \\\\（双反斜杠）'
  if (/named group|capture group|group name/i.test(msg)) return '命名分组名称有误——格式为 (?<名字>…)，名字只能含字母数字下划线'
  if (/quantifier|range/i.test(msg)) return '量词写法有误——{n,m} 中的 n 不能大于 m'
  if (/flags/i.test(msg)) return '正则标志（flags）有误——只能使用 d g i m s u v y 的组合'
  return ''
}
