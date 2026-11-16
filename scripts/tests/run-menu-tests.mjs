// V1.1 菜单数据断言哨兵(R1-f)+ R5 移动基座哨兵 —— 进 npm run test 门禁
// 1. groupOf 覆盖 allTools 全部 slug,无遗漏/无多余/无重复;
// 2. 每组成员 category === 组定义 category(领域族不跨数据分类);每组 ≥2 项;
// 3. 每组 menuCategory ∈ 6 菜单大类;菜单树 6 大类/77 族/511 项,各菜单大类 firstTool 存在;
// 4. 注册表数组序与蓝图(docs/V1.1/工具清单-V1.1.md)逐分类一致(重排漂移即 FAIL);
// 5. R5 哨兵:base.css 含 ≤860 输入 16px 规则;src/ 零 100vh(无白名单强断言)。
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const root = path.resolve(here, '../..')
const EXTERNAL = ['papaparse', '@cantoo/pdf-lib', 'pdfjs-dist', 'xlsx', 'mammoth', 'docx', 'pptxgenjs', 'jspdf', 'js-yaml', '@iarna/toml', 'prettier', 'diff', 'sql-formatter', 'jszip']

await build({
  entryPoints: [path.join(root, 'src/data/menuGroups.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(here, '_engines', 'menuGroups.mjs'),
  external: [...EXTERNAL, '*.vue'],
  alias: { '@': path.join(root, 'src') },
  logLevel: 'silent',
})
await build({
  entryPoints: [path.join(root, 'src/tools/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(here, '_engines', 'registry.mjs'),
  external: [...EXTERNAL, '*.vue'],
  alias: { '@': path.join(root, 'src') },
  logLevel: 'silent',
})
const mg = await import(pathToFileURL(path.join(root, 'scripts/tests/_engines/menuGroups.mjs')).href)
const reg = await import(pathToFileURL(path.join(root, 'scripts/tests/_engines/registry.mjs')).href)

let pass = 0
let fail = 0
const lines = []
function chk(id, name, ok, detail = '') {
  ok ? pass++ : fail++
  lines.push(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? ' | ' + detail : ''}`)
}

const { menuCategories, menuGroups, groupOf } = mg
const { allTools, toolMap } = reg

// ---------- 1. 覆盖断言 ----------
const slugSet = new Set(allTools.map((t) => t.slug))
chk('MENU-1', '注册表 slug 全站唯一', slugSet.size === allTools.length, `${allTools.length} 项`)
const groupSlugs = Object.keys(groupOf)
chk('MENU-1', 'groupOf 覆盖数 = 注册表条目数', groupSlugs.length === allTools.length, `${groupSlugs.length}/${allTools.length}`)
const extra = groupSlugs.filter((s) => !slugSet.has(s))
chk('MENU-1', 'groupOf 无多余 slug', extra.length === 0, extra.slice(0, 5).join(','))
const missing = allTools.filter((t) => !(t.slug in groupOf)).map((t) => t.slug)
chk('MENU-1', 'groupOf 无遗漏', missing.length === 0, missing.slice(0, 5).join(','))

// ---------- 2/3. 组结构与菜单树 ----------
const groupById = new Map(menuGroups.map((g) => [g.id, g]))
const catIds = new Set(menuCategories.map((c) => c.id))
chk('MENU-2', '菜单大类 = 6', menuCategories.length === 6, menuCategories.map((c) => c.id).join(','))
const byGroup = new Map()
for (const t of allTools) {
  const gid = groupOf[t.slug]
  if (!groupById.has(gid)) {
    chk('MENU-2', `slug 指向不存在的组 ${gid}`, false, t.slug)
    continue
  }
  if (!byGroup.has(gid)) byGroup.set(gid, [])
  byGroup.get(gid).push(t)
}
let crossCat = []
let small = []
let badMenuCat = []
for (const [gid, tools] of byGroup) {
  const def = groupById.get(gid)
  if (tools.some((t) => t.category !== def.category)) crossCat.push(gid)
  if (tools.length < 2) small.push(`${gid}(${tools.length})`)
  if (!catIds.has(def.menuCategory)) badMenuCat.push(gid)
}
chk('MENU-2', '领域族不跨数据分类', crossCat.length === 0, crossCat.join(','))
chk('MENU-2', '每组 ≥2 项(无碎片组)', small.length === 0, small.join(','))
chk('MENU-2', 'menuCategory ∈ 6 菜单大类', badMenuCat.length === 0, badMenuCat.join(','))
chk('MENU-3', '领域族总数 = 77', menuGroups.length === 77, String(menuGroups.length))
for (const c of menuCategories) {
  const groups = menuGroups.filter((g) => g.menuCategory === c.id)
  const n = groups.reduce((s, g) => s + (byGroup.get(g.id)?.length ?? 0), 0)
  chk('MENU-3', `菜单大类「${c.name}」非空`, groups.length > 0 && n > 0, `${groups.length} 组 ${n} 项`)
}

// ---------- 4. 注册表序 = 蓝图序(逐分类) ----------
const md = readFileSync(path.join(root, 'docs/V1.1/工具清单-V1.1.md'), 'utf8')
const blueprint = []
for (const line of md.split('\n')) {
  const m = line.match(/^\| ([a-z0-9-]+) \|/)
  if (m && m[1] !== 'slug') blueprint.push(m[1])
}
chk('MENU-4', '蓝图行数 = 511', blueprint.length === 511, String(blueprint.length))
const bpByCat = {}
for (const slug of blueprint) {
  const cat = toolMap.get(slug)?.category
  if (cat) (bpByCat[cat] ??= []).push(slug)
}
const EXPECT = { image: 71, video: 41, audio: 37, pdf: 54, data: 18, utility: 132, developer: 91, finance: 20, business: 15, seo: 13, ai: 15, editors: 4 }
for (const [cat, expect] of Object.entries(EXPECT)) {
  const regOrder = allTools.filter((t) => t.category === cat).map((t) => t.slug)
  const same = regOrder.join() === (bpByCat[cat] ?? []).join()
  chk('MENU-4', `注册表序=蓝图序 ${cat}`, same && regOrder.length === expect, same ? `${regOrder.length} 项` : `首位 ${regOrder[0]} ≠ ${bpByCat[cat]?.[0]}`)
}

// ---------- 5. R5 基座哨兵 ----------
const baseCss = readFileSync(path.join(root, 'src/styles/base.css'), 'utf8')
chk('R5-S1', 'base.css 含 ≤860 输入 16px 防缩放规则', /@media \(max-width: 860px\)[\s\S]{0,400}font-size: 16px/.test(baseCss))
chk('R5-S1', 'base.css 含 tap-highlight 重置', baseCss.includes('-webkit-tap-highlight-color: transparent'))
const tokensCss = readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8')
chk('R5-S1', 'tokens.css 含 safe-area 变量', tokensCss.includes('--safe-b'))
const vhFiles = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(p)
    } else if (/\.(vue|ts|css)$/.test(name) && readFileSync(p, 'utf8').includes('100vh')) vhFiles.push(path.relative(root, p))
  }
}
walk(path.join(root, 'src'))
chk('R5-S2', 'src/ 零 100vh(一律 dvh)', vhFiles.length === 0, vhFiles.slice(0, 5).join(','))

console.log(`菜单与移动基座哨兵 ${pass + fail} 项:通过 ${pass},失败 ${fail}`)
for (const l of lines) console.log(l)
if (fail > 0) process.exit(1)
