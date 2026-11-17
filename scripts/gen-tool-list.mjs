/**
 * 从注册表快照重生成当前版本的工具清单(docs/V<主.次>/工具清单-V<主.次>.md)。
 * V1.1 起输出「菜单分组蓝图」格式:6 菜单大类 → 77 领域族 → 工具(组内序=注册表数组序),
 * 与 src/data/menuGroups.ts(gen-menu-groups.mjs 生成)同源——清单、菜单、注册表三者顺序一致。
 *
 * - 「模式」列沿用旧文档的人工标注,缺失的工具按实现方式推导并打印出来供人工复核;
 * - 落地一致性门禁:重生成后的表格行必须与蓝图零差异(scripts/tests/run-menu-tests.mjs MENU-4)。
 *
 * 用法:node scripts/gen-tool-list.mjs [--out <清单路径>]
 *   默认写入当前版本(docs/V1.1/工具清单-V1.1.md);新版本落地时用 --out 指向新版本文件夹,
 *   并同步修改本脚本的 DEFAULT_DOC(见 AGENTS.md 文档规约)。
 */
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const root = path.resolve(here, '..')
const require = createRequire(import.meta.url)
/** 当前版本的工具清单路径(V1.2 过渡态:小游戏增量;R7 落地后切 docs/V1.2/工具清单-V1.2.md 终态蓝图) */
const DEFAULT_DOC = 'docs/V1.2/工具清单-V1.2-过渡蓝图516.md'
/** 清单标题版本口径 */
const DOC_LABEL = 'V1.2 过渡蓝图：小游戏增量'
const outArg = process.argv.indexOf('--out')
const DOC = path.join(root, outArg >= 0 && process.argv[outArg + 1] ? process.argv[outArg + 1] : DEFAULT_DOC)

const EXTERNAL = ['papaparse', '@cantoo/pdf-lib', 'pdfjs-dist', 'xlsx', 'mammoth', 'docx', 'pptxgenjs', 'jspdf', 'js-yaml', '@iarna/toml', 'prettier', 'diff', 'sql-formatter', 'jszip']

// 打包注册表 + 菜单分组快照(与菜单运行时同一数据源)
const bundle = path.join(here, '_bundle-tool-list.cjs')
await build({
  stdin: {
    contents: `import { allTools } from '@/tools/index'\nimport { menuTree } from '@/data/menuTree'\nmodule.exports = { allTools, menuTree }`,
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
const { allTools, menuTree } = require(bundle)

// 旧文档中的人工模式标注(slug 去掉「（工作室 …）」后缀)
const oldText = readFileSync(DOC, 'utf8')
const oldModes = new Map()
for (const line of oldText.split('\n')) {
  const m = line.match(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \|/)
  if (!m || m[1].trim() === 'slug') continue
  const slug = m[1].trim().replace(/（.*$/, '').trim()
  oldModes.set(slug, m[3].trim())
}

function deriveMode(t) {
  if (t.textDef) return 'text'
  if (t.calcDef) return 'calc'
  if (t.imgcvt) return 'imgcvt'
  if (t.studio || t.category === 'editors') return 'special'
  if (t.category === 'pdf') return 'pdf'
  if (t.category === 'audio') return 'aud'
  if (t.category === 'video') return 'vid'
  if (t.category === 'data') return 'data'
  if (t.category === 'ai' || t.needModel) return 'ai'
  // 图片画布类组件标 img，其余分类的自定义组件按惯例标 special
  return t.category === 'image' ? 'img' : 'special'
}

const missing = []
const modeOf = (t) => oldModes.get(t.slug) ?? (missing.push(`${t.slug}→${deriveMode(t)}`), deriveMode(t))

const out = []
const groupsTotal = menuTree.reduce((n, c) => n + c.groups.length, 0)
out.push(`# 工具清单总表（${allTools.length} 项 · ${DOC_LABEL}）`)
out.push('')
out.push('> **本版定位**：V1.1 的分组（领域族）与全量排序已落地——本清单由 `node scripts/gen-tool-list.mjs` 从注册表与 `src/data/menuGroups.ts`（`scripts/gen-menu-groups.mjs` 生成）重生成，三者顺序一致（哨兵 `run-menu-tests.mjs` 锁定）。')
out.push('> **菜单大类 ≠ 数据分类**：菜单一级为 **6 个菜单大类**，是领域族的显示层归并——音视频 = 视频+音频；文档与数据 = PDF+数据；实用工具 = 实用+金融+商业+SEO+编辑器工作室。底层数据分类（12 个）、分类页、注册表 `category` 字段、路由、sitemap 不变；分类页按 12 数据分类组织（库存目录），菜单按 6 大类组织（任务导航）。')
out.push('> slug 为全站唯一 URL 标识；中文名称为本项目原创命名；「模式」列沿用人工标注，详见 `docs/基础设计规约.md`。')
out.push('> 模式缩写：`text`=文本转换 `compare`=双输入对比 `calc`=计算表单 `img`=图像画布 `imgcvt`=图像格式转换 `pdf`=PDF 操作 `aud`=音频 `vid`=视频 `data`=表格数据 `ai`=AI `special`=自定义组件')
out.push('')
out.push('## 分组与排序口径')
out.push('')
out.push('- **分组**：**6 个菜单大类 → 77 个领域族**（类内小标题），族内成员不跨数据分类（脚本断言锁定）；菜单大类 = 菜单一级（可折叠），领域族 = 类内聚拢小标题。')
out.push('- **排序口径**（需求 R2.3）：组间与组内统一按 **使用频率 40% + 技术含量/差异化 25% + 人群广度 20% + 传播引流 15%** 加权；每个菜单大类小节的第一个工具 = 该大类**默认落地页**（菜单大类头点击目标，即「子工具默认路由是第一个工具」）。')
out.push('- **大类节顺序**：图片 → 音视频 → 文档与数据 → 实用工具 → 开发 → AI（大众媒体处理在前，专业集群靠后）。')
out.push('')
out.push('| 菜单大类 | 归并的数据分类 | 工具数 | 组数 | 默认落地工具 |')
out.push('|---|---|---|---|---|')
const MERGE = { image: 'image', av: 'video + audio', docdata: 'pdf + data', utility: 'utility + editors + finance + business + seo', dev: 'developer', ai: 'ai', games: 'games' }
for (const c of menuTree) {
  out.push(`| ${c.cat.name} | ${MERGE[c.cat.id] ?? ''} | ${c.toolCount} | ${c.groups.length} | ${c.firstTool?.slug ?? ''} |`)
}
out.push('')
menuTree.forEach((c, ci) => {
  out.push(`## ${ci + 1}. ${c.cat.name}（${c.toolCount} · ${c.groups.length} 组）`)
  c.groups.forEach((g, gi) => {
    out.push('')
    out.push(`### ${ci + 1}.${gi + 1} ${g.group.name}`)
    out.push('| slug | 中文名 | 模式 |')
    out.push('|---|---|---|')
    for (const t of g.tools) {
      out.push(`| ${t.slug} | ${t.title} | ${modeOf(t)} |`)
    }
  })
  out.push('')
})
out.push(`> 统计：全站唯一 slug 共 **${allTools.length} 项**（${menuTree.length} 菜单大类 · ${groupsTotal} 领域族；菜单大类为显示层归并；与 \`src/tools/*/registry.ts\` 及 \`src/data/menuGroups.ts\` 一致）。`)
out.push('')

writeFileSync(DOC, out.join('\n'))
console.log(`✓ ${path.relative(root, DOC)} 已重生成:${menuTree.length} 菜单大类 / ${groupsTotal} 领域族 / ${allTools.length} 项`)
console.log(missing.length ? `⚠ 旧文档缺失、已按实现方式推导模式(${missing.length} 项,请复核):\n  ${missing.join('\n  ')}` : '✓ 全部模式均沿用旧文档人工标注')
