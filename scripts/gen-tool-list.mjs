/**
 * 从注册表快照重生成当前版本的工具清单(docs/V<主.次>/工具清单-V<主.次>.md),使其与 src/tools
 * 下各分类注册表完全一致:
 * - 节顺序 = categories 顺序,节内顺序 = 各注册表数组顺序(常用优先);
 * - 「模式」列尽量沿用旧文档的人工标注,缺失的工具按实现方式推导并打印出来供人工复核;
 * - 编辑器节沿用旧文档约定:工作室在所属分类与编辑器分类各登记一条(求和会高于唯一数)。
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
/** 当前版本的工具清单路径(新版本落地时同步更新) */
const DEFAULT_DOC = 'docs/V1.1/工具清单-V1.1.md'
const outArg = process.argv.indexOf('--out')
const DOC = path.join(root, outArg >= 0 && process.argv[outArg + 1] ? process.argv[outArg + 1] : DEFAULT_DOC)

const EXTERNAL = ['papaparse', '@cantoo/pdf-lib', 'pdfjs-dist', 'xlsx', 'mammoth', 'docx', 'pptxgenjs', 'jspdf', 'js-yaml', '@iarna/toml', 'prettier', 'diff', 'sql-formatter', 'jszip']

// 打包注册表 + 分类定义快照
const bundle = path.join(here, '_bundle-tool-list.cjs')
await build({
  stdin: {
    contents: `import { allTools } from '@/tools/index'\nimport { categories } from '@/data/categories'\nmodule.exports = { allTools, categories }`,
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
const { allTools, categories } = require(bundle)

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

// 按分类分节(节内 = 注册表顺序)
const sections = categories.map((c) => ({
  name: c.name,
  tools: allTools.filter((t) => t.category === c.id),
}))
const editors = sections[sections.length - 1] // 最后一个分类 = editors

const out = []
out.push(`# 工具清单总表（${allTools.length} 项，以 \`src/tools/*/registry.ts\` 的唯一 slug 为准）`)
out.push('')
out.push('> slug 为全站唯一 URL 标识；中文名称为本项目原创命名；「模式」列指定实现模式，详见 `docs/基础设计规约.md`。')
out.push('> 模式缩写：`text`=文本转换 `compare`=双输入对比 `calc`=计算表单 `img`=图像画布 `imgcvt`=图像格式转换 `pdf`=PDF 操作 `aud`=音频 `vid`=视频 `data`=表格数据 `ai`=AI `special`=自定义组件')
out.push('> 各分类与节内工具顺序与 `src/tools/*/registry.ts` 一致（按「常用 + 高技术含量优先」重排，可用 `node scripts/reorder-registry.mjs` 维护前置区）。')
out.push('')
for (const s of sections) {
  out.push(`## ${s.name}（${s.tools.length}）`)
  out.push('| slug | 中文名 | 模式 |')
  out.push('|---|---|---|')
  for (const t of s.tools) {
    out.push(`| ${t.slug} | ${t.title} | ${modeOf(t)} |`)
  }
  out.push('')
}
out.push(`> 统计：全站唯一 slug 共 **${allTools.length} 项**（以 \`src/tools/*/registry.ts\` 为准，各节行数相加即唯一数）。`)
out.push('')

writeFileSync(DOC, out.join('\n'))
const total = sections.reduce((n, s) => n + s.tools.length, 0)
console.log(`✓ ${path.relative(root, DOC)} 已重生成:${categories.length} 节,分类行合计 ${total} 行`)
console.log(`  编辑器节工具:${editors.tools.map((t) => t.slug).join(', ')}`)
console.log(missing.length ? `⚠ 旧文档缺失、已按实现方式推导模式(${missing.length} 项,请复核):\n  ${missing.join('\n  ')}` : '✓ 全部模式均沿用旧文档人工标注')
