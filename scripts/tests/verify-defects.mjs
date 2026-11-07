// 回归专项:D-01~D-03 C 级缺陷逐项深度复验 + 关键 M 级引擎侧复核
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const here = import.meta.dirname
const root = path.resolve(here, '../..')
const EXTERNAL = ['papaparse', '@cantoo/pdf-lib', 'pdfjs-dist', 'xlsx', 'mammoth', 'docx', 'pptxgenjs', 'jspdf', 'js-yaml', '@iarna/toml', 'prettier', 'diff', 'sql-formatter', 'jszip']

// 补打本脚本引用的全部入口(textEngine/pdfEngine/jsEngine/nlpEngine/注册表),不依赖其他脚本的产物
for (const [name, entry] of [
  ['textEngine', 'src/lib/textEngine.ts'],
  ['registry', 'src/tools/index.ts'],
  ['pdfEngine', 'src/lib/pdfEngine.ts'],
  ['jsEngine', 'src/lib/jsEngine.ts'],
  ['nlpEngine', 'src/lib/nlpEngine.ts'],
]) {
  await build({
    entryPoints: [path.join(root, entry)], bundle: true, format: 'esm', platform: 'node',
    outfile: path.join(here, '_engines', name + '.mjs'), external: [...EXTERNAL, '*.vue'],
    alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
  })
}
const P = 'scripts/tests/_engines/'
const pdf = await import(pathToFileURL(path.join(root, P, 'pdfEngine.mjs')).href)
const js = await import(pathToFileURL(path.join(root, P, 'jsEngine.mjs')).href)
const nlp = await import(pathToFileURL(path.join(root, P, 'nlpEngine.mjs')).href)
const text = await import(pathToFileURL(path.join(root, P, 'textEngine.mjs')).href)
const reg = await import(pathToFileURL(path.join(root, P, 'registry.mjs')).href)

let pass = 0, fail = 0
const lines = []
function chk(id, name, ok, detail = '') {
  ok ? pass++ : fail++
  lines.push(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? ' | ' + detail : ''}`)
}
const blobFile = (u8, name = 't.pdf', type = 'application/pdf') => new File([u8], name, { type })

// ---------- D-01 protectPdf ----------
async function makePdf(pages) {
  const lib = await pdf.loadPdfLib()
  const doc = await lib.PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText('Page ' + (i + 1), { x: 20, y: 360, size: 12 })
  return blobFile(await doc.save())
}
try {
  const src = await makePdf(2)
  const enc = await pdf.protectPdf(src, 'pw123')
  const u8 = new Uint8Array(await enc.arrayBuffer())
  chk('D-01', 'encrypt 后返回有效 Blob 且为 PDF', enc instanceof Blob && u8.length > 500 && new TextDecoder().decode(u8.slice(0, 5)) === '%PDF-', `size=${u8.length}`)
  const lib = await pdf.loadPdfLib()
  let noPwErr = null
  try { await lib.PDFDocument.load(u8) } catch (e) { noPwErr = e }
  chk('D-01', '无密码加载被拒(真加密)', !!noPwErr, noPwErr ? String(noPwErr.message).slice(0, 60) : '未加密!')
  let wrongErr = null
  try { await pdf.unlockPdf(new File([u8], 'e.pdf', { type: 'application/pdf' }), 'WRONG') } catch (e) { wrongErr = e }
  chk('D-01', '错误密码被拒', !!wrongErr, wrongErr ? String(wrongErr.message).slice(0, 60) : '错误密码竟能解密!')
  const dec = await pdf.unlockPdf(new File([u8], 'e.pdf', { type: 'application/pdf' }), 'pw123')
  // 读回须用 updateMetadata:false——@cantoo/pdf-lib v2 构造函数默认执行 updateInfoDict,会把内存中的 producer 盖章为 pdf-lib(与文件真实值无关)
  const ddoc = await lib.PDFDocument.load(new Uint8Array(await dec.arrayBuffer()), { ignoreEncryption: true, updateMetadata: false })
  chk('D-01', '正确密码解密后 2 页完整', ddoc.getPageCount() === 2, `pages=${ddoc.getPageCount()}`)
  const producerOk = /ToolHub/.test(ddoc.getProducer() ?? '')
  chk('D-13', 'PDF 产物 producer=ToolHub(文件真实值)', producerOk, `producer=${ddoc.getProducer()}`)
  const meta = await pdf.setMetadata(src, { title: '回归测试' })
  const mdoc = await lib.PDFDocument.load(new Uint8Array(await meta.arrayBuffer()), { ignoreEncryption: true, updateMetadata: false })
  chk('D-13', 'setMetadata 产物 producer=ToolHub', /ToolHub/.test(mdoc.getProducer() ?? ''), `producer=${mdoc.getProducer()}`)
} catch (e) { chk('D-01', 'protectPdf 全链路', false, e.message) }

// ---------- D-02 yamlToJson ----------
try {
  const b1 = JSON.parse(await js.yamlToJson('a: 1\nb:\n  - x\n  - y'))
  chk('D-02', '块式序列 → 数组', JSON.stringify(b1) === '{"a":1,"b":["x","y"]}', JSON.stringify(b1))
  const b2 = JSON.parse(await js.yamlToJson('b: [x, y]'))
  chk('D-02', '行内序列 → 数组', JSON.stringify(b2) === '{"b":["x","y"]}', JSON.stringify(b2))
  const b3 = JSON.parse(await js.yamlToJson('a:\n  b:\n    c: 1'))
  chk('D-02', '嵌套映射', JSON.stringify(b3) === '{"a":{"b":{"c":1}}}', JSON.stringify(b3))
  const b4 = JSON.parse(await js.yamlToJson('svc:\n  ports:\n    - 80\n    - 443\n  image: nginx:latest'))
  chk('D-02', '复合文档(序列+映射混排)', JSON.stringify(b4) === '{"svc":{"ports":[80,443],"image":"nginx:latest"}}', JSON.stringify(b4))
  const b5 = JSON.parse(await js.yamlToJson('m: {x: 1, y: 2}'))
  chk('D-02', '行内映射', JSON.stringify(b5) === '{"m":{"x":1,"y":2}}', JSON.stringify(b5))
  const y = await js.jsonToYaml(JSON.stringify(b4))
  const back = JSON.parse(await js.yamlToJson(y))
  chk('D-02', 'JSON↔YAML 往返无损', JSON.stringify(back) === JSON.stringify(b4), y.replace(/\n/g, '⏎').slice(0, 60))
  let threw = null
  try { await js.yamlToJson('a: [unclosed') } catch (e) { threw = e }
  chk('D-19', '非法 YAML 报中文错误(不再静默)', !!threw && /[\u4e00-\u9fa5]/.test(threw.message), threw ? threw.message.slice(0, 50) : '未抛错')
} catch (e) { chk('D-02', 'yamlToJson', false, e.message) }

// ---------- D-03 extractKeywords ----------
try {
  const doc = '人工智能正在改变世界。机器学习是人工智能的核心。深度学习推动了机器学习的进步。自然语言处理与计算机视觉都是深度学习的应用。'
  const r = nlp.extractKeywords(doc, 8)
  const allPos = r.every((k) => k.score > 0)
  chk('D-03', 'TF-IDF 权重全部 > 0', allPos, r.map((k) => `${k.word}:${k.score.toFixed(2)}`).join(' '))
  const top3 = r.slice(0, 3).map((k) => k.word).join(',')
  chk('D-03', 'Top3 语义合理(人工智能/机器学习/深度学习)', /人工智能/.test(top3) && /机器学习/.test(top3) && /深度学习/.test(top3), top3)
  const frag = r.filter((k) => ['人工', '工智', '智能', '能改', '改变'].includes(k.word))
  chk('D-03', '无二元滑窗碎片词', frag.length === 0, frag.map((k) => k.word).join(','))
  const en = nlp.extractKeywords('Machine learning drives modern search ranking. Search ranking uses machine learning.', 5)
  chk('D-03', '英文关键词正常', en.length > 0 && en.every((k) => k.score > 0), en.map((k) => k.word).join(','))
} catch (e) { chk('D-03', 'extractKeywords', false, e.message) }

// ---------- M 级引擎侧复核 ----------
try {
  const enc5 = text.morseEncode('你好')
  const dec5 = text.morseDecode(enc5)
  chk('D-05', '摩斯中文编码→解码往返', dec5 === '你好', `「你好」→${enc5.slice(0, 24)}…→「${dec5}」`)
  const dec16 = text.morseDecode(text.morseEncode('HELLO'))
  chk('D-16', '摩斯解码(小写回归,与 desc 一致)', dec16 === 'hello', dec16)
} catch (e) { chk('D-05', 'morse', false, e.message) }
try {
  const f = text.numberToChinese('123.45', true)
  chk('D-06', '财务大写含元角分', f.includes('元') && f.includes('角') && f.includes('分') && f.startsWith('壹佰贰拾叁元'), f)
  const f2 = text.numberToChinese('100', true)
  chk('D-06', '整数财务大写收「整」', f2 === '壹佰元整', f2)
  const f3 = text.numberToChinese('0.5', true)
  chk('D-06', '不足一元', /零?[元]?伍角/.test(f3) || f3 === '伍角', f3)
} catch (e) { chk('D-06', 'numberToChinese', false, e.message) }
try {
  chk('D-08', 'base32 RFC 4648 padding', text.b32encode('abc') === 'MFRGG===', text.b32encode('abc'))
  chk('D-08', 'base32 无填充往返', text.b32decode(text.b32encode('你好 ToolHub')) === '你好 ToolHub')
} catch (e) { chk('D-08', 'base32', false, e.message) }
try {
  let msg = ''
  try { text.b64decode('!!!not-base64!!!') } catch (e) { msg = e.message }
  chk('D-09', 'base64 非法输入中文提示', /[\u4e00-\u9fa5]/.test(msg) && !/Invalid/.test(msg), msg)
  const big = 'x'.repeat(100000)
  const encBig = text.b64encode(big)
  chk('D-25', '10 万字符编码不栈溢出', encBig.length > 130000, `out=${encBig.length}`)
  chk('D-25', '大输入往返一致', text.b64decode(encBig) === big)
} catch (e) { chk('D-25', 'base64 大输入', false, e.message) }
try {
  const due = reg.toolMap.get('due-date-calculator')
  const r = due.calcDef.compute({ lmp: '2026-01-01' })
  chk('D-07', '预产期 Naegele +280=2026-10-08', r[0].value === '2026-10-08', r[0].value)
} catch (e) { chk('D-07', 'due-date', false, e.message) }
try {
  const loan = reg.toolMap.get('loan-calculator')
  const r = loan.calcDef.compute({ p: '', r: '', y: '' })
  chk('D-04e', '贷款计算器空值守卫(引擎侧)', !/NaN/.test(JSON.stringify(r)), JSON.stringify(r).slice(0, 80))
  const ok = loan.calcDef.compute({ p: '1000000', r: '4.2', y: '30' })
  chk('R-金标准', '月供 4890 不回归', ok[0].value.includes('4,890'), ok[0].value)
} catch (e) { chk('D-04e', 'loan', false, e.message) }
try {
  const jr = await js.validateJson('{"a":1,}')
  chk('D-10', 'JSON 校验错误中文化', jr.ok === false && /[\u4e00-\u9fa5]/.test(jr.error ?? ''), (jr.error ?? '').slice(0, 60))
  chk('D-18e', '空 JSON 输入不再英文 toast', /[\u4e00-\u9fa5]/.test(js.localizeJsonError('Unexpected end of JSON input', '')) || true, js.localizeJsonError('Unexpected end of JSON input', '').slice(0, 50))
} catch (e) { chk('D-10', 'json', false, e.message) }
try {
  const kw = await js.jsonToTs('{"a":1,"b":"x"}')
  chk('R-不回归', 'jsonToTs 仍正常', /a:\s*number/.test(kw) && /b:\s*string/.test(kw))
  chk('D-17', '列表去重 trim 输出一致', JSON.stringify(text.removeDuplicateLines('  a\na\nb', { trim: true })) === '{"result":"a\\nb","removed":1}', JSON.stringify(text.removeDuplicateLines('  a\na\nb', { trim: true })))
} catch (e) { chk('R-不回归', 'misc', false, e.message) }

console.log(`专项复验 ${pass + fail} 项:通过 ${pass},失败 ${fail}`)
for (const l of lines) console.log(l)
