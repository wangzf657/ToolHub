/**
 * 注册表全序重排脚本(V1.1:FRONT 前置白名单机制已升级为 FULL 全序表)。
 *
 * 规则:
 * 1. `FULL`(scripts/reorder-order.mjs,由 gen-menu-groups.mjs 从蓝图生成)给出每个分类的
 *    完整目标序——注册表数组序 = 菜单二级顺序,未列入/多余均报错(双向死链断言);
 * 2. 强断言:条目数不变、slug 集合不变、无重复、FULL 全覆盖,防止重排弄丢工具;
 * 3. 顺带把文件头注释里过期的「N 项」计数修正为真实条目数。
 *
 * 解析器为字符级状态机:支持单行/多行条目、模板字符串与 ${} 插值、行/块注释,
 * 对 src/tools 下全部 12 个分类注册表统一处理。
 *
 * 用法:node scripts/reorder-registry.mjs(可重复执行,幂等)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { FULL } from './reorder-order.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 期望条目数(与 docs/V1.1/工具清单-V1.1.md 一致),重排前后必须吻合 */
const EXPECT_COUNT = {
  image: 71,
  video: 41,
  audio: 37,
  pdf: 54,
  data: 18,
  utility: 132,
  developer: 91,
  finance: 20,
  business: 15,
  seo: 13,
  ai: 15,
  editors: 4,
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

for (const [cat, order] of Object.entries(FULL)) {
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

  // FULL 双向死链断言:FULL 列入的必须存在,注册表存在的必须被 FULL 覆盖
  const missing = order.filter((s) => !bySlug.has(s))
  if (missing.length) throw new Error(`${cat}: FULL 目标序包含不存在的 slug: ${missing.join(', ')}`)
  const regSlugs = items.map((it) => it.body.join('\n').match(SLUG_RE)[1])
  const uncovered = regSlugs.filter((s) => !order.includes(s))
  if (uncovered.length) throw new Error(`${cat}: 注册表存在但 FULL 未覆盖的 slug: ${uncovered.join(', ')}`)
  if (new Set(order).size !== order.length) throw new Error(`${cat}: FULL 目标序存在重复 slug`)

  const outItems = order.map((s) => bySlug.get(s))
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
  const changed = regSlugs.join() !== slugsOf(outItems).join()
  console.log(`✓ ${cat}: 共 ${items.length} 项,全序 ${order.length} 项${changed ? '' : '(已一致)'}`)
}

console.log('完成。请运行 npm run test 与 npm run build 验证。')
