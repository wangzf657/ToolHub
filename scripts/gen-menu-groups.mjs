/**
 * 蓝图 → 代码 转写器:解析分组排序蓝图(唯一权威载体;当前指向 V1.2 过渡蓝图 516 项),
 * 生成两份产物(幂等,可重复执行):
 *   1. src/data/menuGroups.ts   —— 菜单领域族数据层(7 菜单大类 + 78 领域族 + slug 归属)
 *   2. scripts/reorder-order.mjs —— 全量数据分类的 FULL 全序表(reorder-registry.mjs 消费)
 *
 * 校验(转写前全部通过才落盘):
 *   - 蓝图 slug 全部存在于注册表 toolMap,无重复;
 *   - 每组成员 category 一致(领域族不跨数据分类),每组 ≥2 项;
 *   - 每组成员的注册表中文名与蓝图一致(防 slug 错位);
 *   - 7 菜单大类数/组数/工具数与蓝图小节标题一致,总计 516(V1.2 过渡态)。
 *
 * 用法:node scripts/gen-menu-groups.mjs
 * 注意:本脚本只读蓝图与注册表;改分组请先改蓝图再重跑本脚本。
 */
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const root = path.resolve(here, '..')
const require = createRequire(import.meta.url)
const BLUEPRINT = path.join(root, 'docs/V1.2/工具清单-V1.2-过渡蓝图516.md') // V1.2 过渡态:小游戏增量已落地(R7 落地后切终态蓝图工具清单-V1.2.md)

const EXTERNAL = ['papaparse', '@cantoo/pdf-lib', 'pdfjs-dist', 'xlsx', 'mammoth', 'docx', 'pptxgenjs', 'jspdf', 'js-yaml', '@iarna/toml', 'prettier', 'diff', 'sql-formatter', 'jszip']

// 打包注册表快照(与 gen-tool-list 同法)
const bundle = path.join(here, '_bundle-menu-groups.cjs')
await build({
  stdin: {
    contents: `import { allTools } from '@/tools/index'\nmodule.exports = { allTools }`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: bundle,
  external: [...EXTERNAL, '*.vue'],
  alias: { '@': path.join(root, 'src') },
  logLevel: 'silent',
})
const { allTools } = require(bundle)
const toolMap = new Map(allTools.map((t) => [t.slug, t]))

/** 菜单大类:蓝图节名 → id(顺序 = 菜单一级顺序) */
const MENU_CAT = [
  { match: '图片', id: 'image', name: '图片', icon: 'image' },
  { match: '音视频', id: 'av', name: '音视频', icon: 'video' },
  { match: '文档与数据', id: 'docdata', name: '文档与数据', icon: 'pdf' },
  { match: '实用工具', id: 'utility', name: '实用工具', icon: 'utility' },
  { match: '开发工具', id: 'dev', name: '开发工具', icon: 'code' },
  { match: 'AI', id: 'ai', name: 'AI', icon: 'ai' },
  { match: '小游戏', id: 'games', name: '小游戏', icon: 'gamepad-2' },
]

// ---------- 解析蓝图 ----------
const md = readFileSync(BLUEPRINT, 'utf8')
const lines = md.split('\n')
const cats = []
let curCat = null
let curGroup = null
const errors = []
for (const line of lines) {
  let m
  if ((m = line.match(/^## (\d+)\. (.+?)（(\d+) · (\d+) 组）/))) {
    const title = m[2]
    const def = MENU_CAT.find((c) => title === c.match || title.startsWith(c.match))
    if (!def) throw new Error(`未知菜单大类节标题: ${line}`)
    curCat = { def, index: Number(m[1]), toolCount: Number(m[3]), groupCount: Number(m[4]), groups: [] }
    cats.push(curCat)
    curGroup = null
  } else if ((m = line.match(/^### (\d+\.\d+) (.+)$/)) && curCat) {
    curGroup = { no: m[1], name: m[2], tools: [] }
    curCat.groups.push(curGroup)
  } else if ((m = line.match(/^\| ([a-z0-9-]+) \| (.+?) \| /)) && curGroup) {
    const slug = m[1]
    const title = m[2].trim()
    if (slug === 'slug') continue
    const tool = toolMap.get(slug)
    if (!tool) errors.push(`蓝图 slug 不存在于注册表: ${slug}`)
    else {
      if (tool.title !== title) errors.push(`「${slug}」名称错位: 蓝图「${title}」≠ 注册表「${tool.title}」`)
      curGroup.tools.push({ slug, title, category: tool.category })
    }
  }
}

// ---------- 校验 ----------
const seen = new Map()
for (const cat of cats) {
  for (const g of cat.groups) {
    for (const t of g.tools) {
      if (seen.has(t.slug)) errors.push(`slug 重复出现: ${t.slug}(${seen.get(t.slug)} 与 ${g.name})`)
      seen.set(t.slug, g.name)
    }
    const catsOf = new Set(g.tools.map((t) => t.category))
    if (catsOf.size > 1) errors.push(`族「${g.name}」跨数据分类: ${[...catsOf].join(',')}`)
    if (g.tools.length < 2) errors.push(`族「${g.name}」成员 < 2`)
    g.category = g.tools[0]?.category
  }
  const n = cat.groups.reduce((s, g) => s + g.tools.length, 0)
  if (n !== cat.toolCount) errors.push(`${cat.def.name}: 工具数 ${n} ≠ 节标题 ${cat.toolCount}`)
  if (cat.groups.length !== cat.groupCount) errors.push(`${cat.def.name}: 组数 ${cat.groups.length} ≠ 节标题 ${cat.groupCount}`)
}
const total = [...seen.keys()].length
if (total !== allTools.length) errors.push(`蓝图覆盖 ${total} 项 ≠ 注册表 ${allTools.length} 项`)
for (const t of allTools) if (!seen.has(t.slug)) errors.push(`注册表 slug 未入蓝图: ${t.slug}`)
if (cats.length !== 7) errors.push(`菜单大类 ${cats.length} ≠ 7`)
if (errors.length) {
  console.error('蓝图校验失败:\n  ' + errors.join('\n  '))
  process.exit(1)
}

// ---------- 生成 src/data/menuGroups.ts ----------
const esc = (s) => s.replace(/'/g, "\\'")
const mg = []
mg.push('/**')
mg.push(' * 菜单领域族数据层(V1.2 过渡态)——由 scripts/gen-menu-groups.mjs 从蓝图生成,勿手改;')
mg.push(' * 改分组/排序请先改蓝图再重跑生成器。单一事实源:工具名/简介/URL 实时取自注册表,本文件只定义归属与顺序。')
mg.push(' */')
mg.push("import type { CategoryId } from '@/types'")
mg.push('')
mg.push('/** 菜单大类(7 个,显示层归并;≠ 数据分类 CategoryId 13 个) */')
mg.push('export interface MenuCategoryDef { id: string; name: string; icon: string }')
mg.push('')
mg.push('export interface MenuGroupDef {')
mg.push('  /** 组 id,如 image-1 */')
mg.push('  id: string')
mg.push('  /** 领域族名,如「压缩与调整」 */')
mg.push('  name: string')
mg.push('  /** lucide 图标名(预留,当前菜单不渲染族图标) */')
mg.push('  icon: string')
mg.push('  /** 所属数据分类(组成员必须一致,脚本断言) */')
mg.push('  category: CategoryId')
mg.push('  /** 所属菜单大类(7 值之一,显示层归并) */')
mg.push('  menuCategory: string')
mg.push('}')
mg.push('')
mg.push(`export const menuCategories: MenuCategoryDef[] = [`)
for (const c of cats) mg.push(`  { id: '${c.def.id}', name: '${c.def.name}', icon: '${c.def.icon}' },`)
mg.push(']')
mg.push('')
mg.push(`/** 数组顺序 = 菜单组级顺序(蓝图定稿);组内工具序 = 注册表数组序(reorder 后与蓝图一致) */`)
mg.push('export const menuGroups: MenuGroupDef[] = [')
let gi = 0
for (const cat of cats) {
  mg.push(`  /* ---- ${cat.def.name} ---- */`)
  cat.groups.forEach((g, idx) => {
    gi++
    g.id = `${cat.def.id}-${idx + 1}`
    // 族图标继承所属菜单大类(OBS-D:统一 wrench 占位对「休闲游戏」等族语义不贴切;该字段当前无 UI 消费,纯数据层语义修正)
    mg.push(`  { id: '${g.id}', name: '${esc(g.name)}', icon: '${cat.def.icon}', category: '${g.category}', menuCategory: '${cat.def.id}' },`)
  })
}
mg.push(']')
mg.push('')
mg.push(`/** slug → 组 id,${total} 项全覆盖 */`)
mg.push('export const groupOf: Record<string, string> = {')
for (const cat of cats) {
  for (const g of cat.groups) {
    mg.push(`  /* ${esc(g.name)} */`)
    const entries = g.tools.map((t) => `'${t.slug}': '${g.id}',`)
    mg.push('  ' + entries.join(' '))
  }
}
mg.push('}')
writeFileSync(path.join(root, 'src/data/menuGroups.ts'), mg.join('\n') + '\n')

// ---------- 生成 scripts/reorder-order.mjs(FULL 全序) ----------
/** 组 id 前缀 → 数据分类数组的组装:按菜单组序过滤出各数据分类的蓝图序 */
const fullByCat = {}
for (const cat of cats) {
  for (const g of cat.groups) {
    const arr = (fullByCat[g.category] ??= [])
    arr.push(...g.tools.map((t) => t.slug))
  }
}
const ro = []
ro.push('/**')
ro.push(` * ${Object.keys(fullByCat).length} 数据分类的 FULL 全序表(蓝图定稿)——由 scripts/gen-menu-groups.mjs 生成,勿手改。`)
ro.push(' * 消费方:scripts/reorder-registry.mjs(FRONT 前置白名单机制已升级为 FULL 全序)。')
ro.push(' */')
ro.push('export const FULL = {')
for (const [cat, slugs] of Object.entries(fullByCat)) {
  ro.push(`  ${cat}: [`)
  for (let i = 0; i < slugs.length; i += 4) {
    ro.push('    ' + slugs.slice(i, i + 4).map((s) => `'${s}',`).join(' '))
  }
  ro.push('  ],')
}
ro.push('}')
writeFileSync(path.join(here, 'reorder-order.mjs'), ro.join('\n') + '\n')

console.log(`✓ 菜单大类 ${cats.length} 个 / 领域族 ${gi} 组 / 工具 ${total} 项校验通过`)
console.log(`✓ 已生成 src/data/menuGroups.ts 与 scripts/reorder-order.mjs`)
for (const c of cats) console.log(`  ${c.def.name}: ${c.groups.length} 组 ${c.toolCount} 项`)
