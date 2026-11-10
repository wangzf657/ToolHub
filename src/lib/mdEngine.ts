/**
 * Markdown 引擎：解析 / 渲染 / 与 HTML、Word 互转 / 公众号内联样式
 * marked、turndown、docx 均为懒加载；生成 docx 的 creator 契约写 ToolHub。
 */
import type { Token, Tokens } from 'marked'
import type { ParagraphChild } from 'docx'

type Run = ParagraphChild

/* ------------------------------------------------------------------ */
/* Markdown → HTML                                                     */
/* ------------------------------------------------------------------ */

export async function mdToHtml(md: string, opts: { math?: boolean; mermaid?: boolean } = {}): Promise<string> {
  const { marked } = await import('marked')
  const DOMPurify = (await import('dompurify')).default
  const raw = await marked.parse(md, { gfm: true, breaks: false })
  let html = raw
  if (opts.math) html = await renderMathBlocks(html)
  if (opts.mermaid) html = await markMermaidBlocks(html)
  return DOMPurify.sanitize(html, { ADD_TAGS: ['math', 'semantics', 'annotation', 'svg', 'g', 'path', 'use', 'div'], ADD_ATTR: ['encoding', 'data-mermaid', 'xmlns'] })
}

/** 把 $…$ / $$…$$ 用 KaTeX 渲染成 HTML（失败时保留原文） */
export async function renderMathBlocks(html: string): Promise<string> {
  const katex = await import('katex')
  const block = /\$\$([\s\S]+?)\$\$/g
  const inline = /\$([^$\n]+?)\$/g
  html = html.replace(block, (m, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return m
    }
  })
  html = html.replace(inline, (m, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return m
    }
  })
  return html
}

/** 把 ```mermaid 代码块标记为 <div data-mermaid="编码后的源码">，由预览组件在挂载后调 mermaid 渲染 */
export async function markMermaidBlocks(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let changed = false
  doc.querySelectorAll('pre > code.language-mermaid, pre > code[class*="language-mermaid"]').forEach((code) => {
    const pre = code.parentElement
    if (!pre) return
    const div = doc.createElement('div')
    div.setAttribute('data-mermaid', btoa(unescape(encodeURIComponent(code.textContent ?? ''))))
    div.className = 'mermaid-src'
    pre.replaceWith(div)
    changed = true
  })
  return changed ? doc.body.innerHTML : html
}

/** 在容器内把 data-mermaid 占位渲染成图（预览组件挂载后调用） */
export async function renderMermaidIn(root: HTMLElement): Promise<void> {
  const nodes = root.querySelectorAll<HTMLElement>('div[data-mermaid]')
  if (!nodes.length) return
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
  for (const node of nodes) {
    const src = decodeURIComponent(escape(atob(node.getAttribute('data-mermaid') ?? '')))
    try {
      const { svg } = await mermaid.render(`mmd-${Math.random().toString(36).slice(2, 9)}`, src)
      node.innerHTML = svg
    } catch (e) {
      node.innerHTML = `<pre style="color:var(--err)">Mermaid 语法错误：${(e as Error).message.slice(0, 120)}</pre>`
    }
  }
}

/* ------------------------------------------------------------------ */
/* HTML → Markdown（turndown + GFM 规则）                               */
/* ------------------------------------------------------------------ */

/**
 * 预处理：把 td/th 内的块级 <p>（mammoth/Word 导出、网页富文本的常见形态）拍平为
 * 行内内容 + <br>。turndown-plugin-gfm 的表格规则遇到单元格内块级元素会整体失效，
 * 原样输出 HTML 标签。
 */
function flattenTableCells(html: string): string {
  if (typeof DOMParser === 'undefined') {
    // Node（测试环境）无 DOMParser：退化处理 mammoth 标准形态「td 内单个 p」
    return html.replace(/(<t[dh][^>]*>)\s*<p>([\s\S]*?)<\/p>(\s*<\/t[dh]>)/gi, '$1$2$3')
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('td,th').forEach((cell) => {
    if (cell.querySelector('table')) return // 含嵌套表格的单元格不动
    cell.querySelectorAll('p').forEach((p) => {
      const parent = p.parentNode
      if (!parent) return
      if (p.previousElementSibling) parent.insertBefore(doc.createElement('br'), p)
      while (p.firstChild) parent.insertBefore(p.firstChild, p)
      p.remove()
    })
  })
  return doc.body.innerHTML
}

export async function htmlToMd(html: string): Promise<string> {
  const TurndownService = (await import('turndown')).default
  const { gfm } = await import('turndown-plugin-gfm')
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
  })
  td.use(gfm)
  return td.turndown(flattenTableCells(html))
}

/* ------------------------------------------------------------------ */
/* Markdown → Word（marked AST → docx）                                 */
/* ------------------------------------------------------------------ */

export async function mdToDocxBlob(md: string, title = 'Markdown 文档'): Promise<Blob> {
  const { marked } = await import('marked')
  const docx = await import('docx')
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, ShadingType, ExternalHyperlink,
  } = docx
  const tokens = marked.lexer(md)
  const children: unknown[] = []
  for (const t of tokens) pushBlock(t, children, 0, false)

  // 块级 token 转换（递归处理列表嵌套）
  function pushBlock(t: Token, out: unknown[], listLevel: number, inQuote: boolean) {
    switch (t.type) {
      case 'heading': {
        const h = t as Tokens.Heading
        if (h.depth <= 3) {
          out.push(new Paragraph({
            heading: h.depth === 1 ? HeadingLevel.HEADING_1 : h.depth === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            children: inlineRuns(h.tokens as Token[]),
          }))
        } else {
          out.push(new Paragraph({ children: inlineRuns(h.tokens as Token[], { bold: true }) }))
        }
        break
      }
      case 'paragraph': {
        const p = t as Tokens.Paragraph
        out.push(new Paragraph({
          children: inlineRuns(p.tokens as Token[]),
          ...(inQuote ? { indent: { left: 480 } } : {}),
        }))
        break
      }
      case 'code': {
        const c = t as Tokens.Code
        out.push(new Paragraph({
          shading: { type: ShadingType.SOLID, fill: 'F2F3F5' },
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: c.text, font: 'Consolas', size: 18 })],
        }))
        break
      }
      case 'blockquote': {
        const b = t as Tokens.Blockquote
        for (const inner of b.tokens) pushBlock(inner as Token, out, listLevel, true)
        break
      }
      case 'list': {
        const l = t as Tokens.List
        let no = 1
        for (const item of l.items) {
          const prefix = l.ordered ? `${no++}. ` : ''
          for (const inner of item.tokens) {
            const blk = inner as Token
            if (blk.type === 'paragraph' || blk.type === 'text') {
              const runs = inlineRuns((blk as Tokens.Paragraph).tokens as Token[] ?? [])
              // 有序列表 docx 编号需注册 numbering 配置，简化为手动前缀
              if (l.ordered) runs.unshift(new TextRun(prefix))
              out.push(new Paragraph({
                children: runs,
                indent: { left: 360 + listLevel * 360 },
                ...(l.ordered ? {} : { bullet: { level: listLevel } }),
              }))
            } else {
              pushBlock(blk, out, listLevel + 1, inQuote)
            }
          }
        }
        break
      }
      case 'table': {
        const tb = t as Tokens.Table
        const mkCell = (cell: Tokens.TableCell, header: boolean) => new TableCell({
          shading: header ? { type: ShadingType.SOLID, fill: 'EFF3F7' } : undefined,
          children: [new Paragraph({ children: inlineRuns((cell.tokens ?? []) as Token[], header ? { bold: true } : {}) })],
        })
        out.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: (tb.header ?? []).map((c) => mkCell(c, true)) }),
            ...(tb.rows ?? []).map((row) => new TableRow({ children: row.map((c) => mkCell(c, false)) })),
          ],
        }))
        out.push(new Paragraph({ text: '', spacing: { before: 60 } }))
        break
      }
      case 'hr':
        out.push(new Paragraph({ thematicBreak: true }))
        break
      case 'space':
        break
      case 'html': {
        // 内嵌 HTML 标签剥离为纯文本，避免 Word 出现标签
        const text = (t as Tokens.Generic).text?.replace(/<[^>]*>/g, '').trim()
        if (text) out.push(new Paragraph({ children: [new TextRun(text)] }))
        break
      }
      default: {
        const text = (t as Tokens.Generic).text?.trim()
        if (text) out.push(new Paragraph({ text }))
      }
    }
  }

  // 行内 token → docx Run 数组
  function inlineRuns(tokens: Token[], base: { bold?: boolean; italics?: boolean; strike?: boolean } = {}): Run[] {
    const runs: Run[] = []
    for (const it of tokens ?? []) {
      switch (it.type) {
        case 'strong':
          runs.push(...inlineRuns((it as Tokens.Strong).tokens as Token[], { ...base, bold: true }))
          break
        case 'em':
          runs.push(...inlineRuns((it as Tokens.Em).tokens as Token[], { ...base, italics: true }))
          break
        case 'del':
          runs.push(...inlineRuns((it as Tokens.Del).tokens as Token[], { ...base, strike: true }))
          break
        case 'codespan':
          runs.push(new TextRun({ text: (it as Tokens.Codespan).text, font: 'Consolas', size: 20, shading: { type: ShadingType.SOLID, fill: 'F2F3F5' } }))
          break
        case 'link': {
          const l = it as Tokens.Link
          runs.push(new ExternalHyperlink({
            link: l.href,
            children: inlineRuns(l.tokens as Token[], { ...base, bold: true }),
          }))
          break
        }
        case 'image': {
          const img = it as Tokens.Image
          runs.push(new TextRun({ text: img.text ? `[图片：${img.text}]` : '[图片]', italics: true, color: '888888' }))
          break
        }
        case 'br':
          runs.push(new TextRun({ text: '', break: 1 }))
          break
        case 'text': {
          const tx = it as Tokens.Text
          if (tx.tokens?.length) runs.push(...inlineRuns(tx.tokens as Token[], base))
          else runs.push(new TextRun({ text: tx.text, bold: base.bold, italics: base.italics, strike: base.strike }))
          break
        }
        case 'escape':
          runs.push(new TextRun({ text: (it as Tokens.Escape).text, bold: base.bold, italics: base.italics }))
          break
        default:
          runs.push(new TextRun({ text: (it as Tokens.Generic).text ?? '', bold: base.bold, italics: base.italics }))
      }
    }
    return runs
  }

  const doc = new Document({
    creator: 'ToolHub',
    title,
    sections: [{ children: children as never }],
  })
  return Packer.toBlob(doc)
}

/* ------------------------------------------------------------------ */
/* 公众号排版：CSS 逐元素内联                                            */
/* ------------------------------------------------------------------ */

export interface WechatTheme {
  id: string
  name: string
  /** 强调色（标题/引用/链接） */
  accent: string
}

export const WECHAT_THEMES: WechatTheme[] = [
  { id: 'green', name: '清新绿', accent: '#1a9c74' },
  { id: 'blue', name: '科技蓝', accent: '#2f6fd6' },
  { id: 'ink', name: '极简墨', accent: '#333333' },
  { id: 'orange', name: '暖橙', accent: '#e07b39' },
]

/** 公众号编辑器粘贴时会剥离 <style>，必须把规则写成元素 style 属性 */
export async function mdToWechatHtml(md: string, theme: WechatTheme): Promise<string> {
  const { marked } = await import('marked')
  const raw = await marked.parse(md, { gfm: true })
  const root = document.createElement('div')
  root.innerHTML = raw
  const accent = theme.accent
  const textBase = 'margin:0 0 16px;line-height:1.8;letter-spacing:0.5px;font-size:15px;color:#333333;'
  const apply = (sel: string, css: Record<string, string>) => {
    root.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      Object.assign(el.style, css)
    })
  }
  apply('h1', { margin: '24px 0 16px', fontSize: '21px', fontWeight: '700', color: '#222222', letterSpacing: '1px' })
  apply('h2', { margin: '22px 0 14px', fontSize: '18px', fontWeight: '700', color: accent, borderLeft: `4px solid ${accent}`, paddingLeft: '10px' })
  apply('h3', { margin: '18px 0 12px', fontSize: '16px', fontWeight: '700', color: '#333333' })
  apply('h4,h5,h6', { margin: '16px 0 10px', fontSize: '15px', fontWeight: '700', color: '#444444' })
  root.querySelectorAll<HTMLElement>('p').forEach((el) => {
    el.setAttribute('style', (el.getAttribute('style') ?? '') + textBase)
  })
  apply('ul,ol', { margin: '0 0 16px', paddingLeft: '24px', lineHeight: '1.8' })
  apply('li', { margin: '0 0 6px', fontSize: '15px', color: '#333333' })
  apply('blockquote', { margin: '16px 0', padding: '10px 14px', borderLeft: `3px solid ${accent}`, background: 'rgba(0,0,0,0.03)', color: '#666666', fontSize: '14px' })
  apply('code', { fontFamily: 'Consolas,Menlo,monospace', fontSize: '13px', background: 'rgba(0,0,0,0.05)', padding: '2px 5px', borderRadius: '3px', color: '#c0341d' })
  apply('pre', { margin: '16px 0', padding: '12px 14px', background: '#282c34', borderRadius: '6px', overflowX: 'auto' })
  root.querySelectorAll<HTMLElement>('pre code').forEach((el) => {
    el.style.color = '#abb2bf'
    el.style.background = 'transparent'
    el.style.padding = '0'
  })
  apply('table', { borderCollapse: 'collapse', width: '100%', margin: '16px 0', fontSize: '14px' })
  apply('th', { border: '1px solid #dddddd', padding: '7px 10px', background: `${accent}14`, fontWeight: '600', textAlign: 'left' })
  apply('td', { border: '1px solid #dddddd', padding: '7px 10px' })
  apply('a', { color: accent, textDecoration: 'none', borderBottom: `1px solid ${accent}` })
  apply('img', { maxWidth: '100%', borderRadius: '4px', display: 'block', margin: '14px auto' })
  apply('hr', { border: 'none', borderTop: '1px dashed #cccccc', margin: '24px 0' })
  apply('strong', { color: accent })
  return root.innerHTML
}
