// 构建后生成 dist/sitemap.xml + dist/robots.txt（百度/Google/Bing 收录用）
// 站点域名唯一来源：src/data/site.ts 的 site.siteUrl（可用环境变量 TOOLHUB_SITE_URL 覆盖）；未填则只出 robots.txt
// 注册表/指南/分类数据用 esbuild 打包读取（同 scripts/tests 的既有方案），内存求值不产生临时文件
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const root = path.resolve(here, '..')
const EXTERNAL = ['papaparse', '@cantoo/pdf-lib', 'pdfjs-dist', 'xlsx', 'mammoth', 'docx', 'pptxgenjs', 'jspdf', 'js-yaml', '@iarna/toml', 'prettier', 'diff', 'sql-formatter', 'jszip']

// TS 入口打包为 CJS 并就地求值（外部依赖由真实 require 解析到根 node_modules）
async function evalTs(entry) {
  const out = await build({
    entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
    external: [...EXTERNAL, '*.vue'], alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
  })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, createRequire(import.meta.url))
  return mod.exports
}

function readSiteUrl() {
  const env = process.env.TOOLHUB_SITE_URL?.trim()
  if (env) return env
  const m = readFileSync(path.join(root, 'src/data/site.ts'), 'utf8').match(/siteUrl:\s*'([^']*)'/)
  return m?.[1]?.trim() ?? ''
}

const { allTools } = await evalTs(path.join(root, 'src/tools/index.ts'))
const { guides } = await evalTs(path.join(root, 'src/data/guides.ts'))
const { categories } = await evalTs(path.join(root, 'src/data/categories.ts'))

const siteUrl = readSiteUrl().replace(/\/+$/, '')
const today = new Date().toISOString().slice(0, 10)
mkdirSync(path.join(root, 'dist'), { recursive: true })

const robots = ['User-agent: *', 'Allow: /', 'Disallow: /saved', '']
if (siteUrl) robots.push(`Sitemap: ${siteUrl}/sitemap.xml`)
robots.push('')
writeFileSync(path.join(root, 'dist/robots.txt'), robots.join('\n'))

if (!siteUrl) {
  console.warn('⚠ site.siteUrl 未设置（src/data/site.ts）——已生成 robots.txt，跳过 sitemap.xml；正式域名确定后填入即可')
} else {
  const today_ = today
  const seen = new Set()
  const urls = [
    { loc: '/', lastmod: today_ },
    { loc: '/tools', lastmod: today_ },
    { loc: '/studios', lastmod: today_ },
    ...categories.map((c) => ({ loc: c.path, lastmod: today_ })),
    ...allTools.map((t) => ({ loc: `/t/${t.slug}`, lastmod: today_ })),
    { loc: '/guides', lastmod: today_ },
    ...guides.map((g) => ({ loc: `/guides/${g.slug}`, lastmod: g.date })),
    { loc: '/about', lastmod: today_ },
    { loc: '/contact', lastmod: today_ },
    { loc: '/privacy', lastmod: today_ },
    { loc: '/terms', lastmod: today_ },
  ].filter((u) => !seen.has(u.loc) && seen.add(u.loc))

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${siteUrl}${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n')
  writeFileSync(path.join(root, 'dist/sitemap.xml'), xml)
  console.log(`✓ sitemap.xml：${urls.length} 条 URL（工具 ${allTools.length} · 指南 ${guides.length} · 分类 ${categories.length}）→ dist/`)
}
