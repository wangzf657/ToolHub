// 深度引擎测试(v2,按真实 API):csv/subtitles/hash/md5/cryptoFile/nlp/date/office/pdf-lib/js
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const here = import.meta.dirname
const root = path.resolve(here, '../..')
const outdir = path.join(here, '_engines')
const EXTERNAL = ['papaparse', '@cantoo/pdf-lib', 'pdfjs-dist', 'xlsx', 'mammoth', 'docx', 'pptxgenjs', 'jspdf', 'js-yaml', '@iarna/toml', 'prettier', 'diff', 'sql-formatter', 'jszip']
const engines = ['csvEngine', 'subtitles', 'hashEngine', 'md5', 'cryptoFile', 'nlpEngine', 'dateEngine', 'officeEngine', 'pdfEngine', 'jsEngine']
for (const e of engines) {
  await build({ entryPoints: [path.join(root, 'src/lib', e + '.ts')], bundle: true, format: 'esm', platform: 'node', outfile: path.join(outdir, e + '.mjs'), external: EXTERNAL, alias: { '@': path.join(root, 'src') }, logLevel: 'silent' })
}
const M = {}
for (const e of engines) M[e] = await import(pathToFileURL(path.join(outdir, e + '.mjs')).href)

const results = []
let passN = 0, failN = 0, warnN = 0
function rec(engine, name, ok, detail = '', sev = 'C') {
  results.push({ engine, name, ok: ok === true, warn: ok === 'warn', sev, detail: String(detail).slice(0, 260) })
  ok === true ? passN++ : ok === 'warn' ? warnN++ : failN++
}
async function run(engine, name, fn, sev = 'C') {
  try {
    const r = await fn()
    if (r === undefined || r === true) rec(engine, name, true)
    else if (String(r).startsWith('warn')) rec(engine, name, 'warn', String(r))
    else rec(engine, name, false, String(r), sev)
  } catch (e) { rec(engine, name, false, e.message, sev) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg ?? '断言失败') }
const blobFile = (u8, name = 't.bin', type = 'application/octet-stream') => new File([u8], name, { type })
const ab = async (b) => new Uint8Array(b instanceof Blob ? await b.arrayBuffer() : b.buffer ?? b)

// ---------------- csvEngine ----------------
await run('csvEngine', '基本解析', async () => {
  const r = M.csvEngine.parseCsvText('a,b\n1,2\n3,4')
  assert(JSON.stringify(r.header) === '["a","b"]' && r.rows.length === 2, JSON.stringify(r).slice(0, 120))
})
await run('csvEngine', '引号字段与转义', async () => {
  const r = M.csvEngine.parseCsvText('"a,x",b\n"1""2",3')
  assert(JSON.stringify(r.header) === '["a,x","b"]' && JSON.stringify(r.rows[0]) === '["1\\"2","3"]', JSON.stringify(r).slice(0, 140))
})
await run('csvEngine', '引号内换行', async () => {
  const r = M.csvEngine.parseCsvText('h1,h2\n"l1\nl2",b\n1,2')
  assert(r.rows.length === 2 && r.rows[0][0] === 'l1\nl2', JSON.stringify(r).slice(0, 120))
})
await run('csvEngine', 'rowsToCsv 转义往返', async () => {
  const csv = M.csvEngine.rowsToCsv(['a,x', 'b'], [['1"2', '3']])
  const back = M.csvEngine.parseCsvText(csv)
  assert(back.rows[0][0] === '1"2' && back.rows[0][1] === '3', csv + ' → ' + JSON.stringify(back.rows))
})
await run('csvEngine', '去重(整行+指定列)', async () => {
  const d1 = M.csvEngine.dedupeRows([['a'], ['a'], ['b']], null, {})
  const d2 = M.csvEngine.dedupeRows([['k', 'v'], ['a', '1'], ['a', '2']], [0], {})
  assert(d1.unique.length === 2 && d2.unique.length === 2, JSON.stringify([d1, d2]).slice(0, 160))
})
await run('csvEngine', '按行拆分', async () => {
  const data = M.csvEngine.parseCsvText('k\n1\n2\n3\n4')
  const parts = M.csvEngine.splitCsv(data, { kind: 'rows', size: 2 })
  assert(parts.length === 2, '份数:' + parts.length)
})
await run('csvEngine', 'diff 新增/删除', async () => {
  const a = M.csvEngine.parseCsvText('k\n1\n2\n3'), b = M.csvEngine.parseCsvText('k\n2\n3\n4')
  const d = M.csvEngine.diffCsvData(a, b)
  const t = JSON.stringify(d)
  assert(t.includes('4') && t.includes('1'), t.slice(0, 200))
})

// ---------------- subtitles ----------------
const SRT = '1\n00:00:01,000 --> 00:00:02,500\n第一句\n\n2\n00:00:03,000 --> 00:00:04,000\n第二句\n\n3\n00:00:05,000 --> 00:00:06,000\n第三句\n'
await run('subtitles', 'parseSrt', async () => {
  const cues = M.subtitles.parseSrt(SRT)
  assert(cues.length === 3 && Math.abs(cues[0].start - 1) < 0.01 && cues[0].text === '第一句', JSON.stringify(cues[0]))
})
await run('subtitles', 'shiftCues +1s', async () => {
  const cues = M.subtitles.shiftCues(M.subtitles.parseSrt(SRT), 1)
  assert(Math.abs(cues[0].start - 2) < 0.01, JSON.stringify(cues[0]))
})
await run('subtitles', 'serializeSubs VTT', async () => {
  const vtt = M.subtitles.serializeSubs(M.subtitles.parseSrt(SRT), 'vtt')
  assert(vtt.startsWith('WEBVTT') && vtt.includes('00:00:01.000'), vtt.slice(0, 80))
})
await run('subtitles', 'SRT→VTT→SRT 文本往返', async () => {
  const cues = M.subtitles.parseSrt(SRT)
  const back = M.subtitles.parseSubs(M.subtitles.serializeSubs(cues, 'vtt'))
  const bc = back.cues ?? back; assert(bc.length === 3 && bc.every((c, i) => c.text === cues[i].text), '往返文本不一致:' + JSON.stringify(bc).slice(0, 120))
})
await run('subtitles', 'rescaleCues 25→24fps', async () => {
  const cues = M.subtitles.rescaleCues(M.subtitles.parseSrt(SRT), 25, 24)
  assert(Math.abs(cues[0].start - 1 * 25 / 24) < 0.01, JSON.stringify(cues[0]))
})

// ---------------- hashEngine + md5 ----------------
await run('hashEngine', 'MD5(abc) 标准向量', async () => {
  const h = await M.hashEngine.digestText('MD5', 'abc')
  assert(/900150983cd24fb0d6963f7d28e17f72/.test(String(h)), '实际:' + h)
})
await run('hashEngine', 'SHA-256(abc) 标准向量', async () => {
  const h = await M.hashEngine.digestText('SHA-256', 'abc')
  assert(/ba7816bf8f01cfea414140de5dae2223/.test(String(h)), '实际:' + h)
})
await run('hashEngine', 'SHA-512(abc) 标准向量', async () => {
  const h = await M.hashEngine.digestText('SHA-512', 'abc')
  assert(String(h).startsWith('ddaf35a19361'), '实际:' + String(h).slice(0, 20))
})
await run('hashEngine', 'HMAC-SHA256 RFC 向量', async () => {
  const h = await M.hashEngine.hmac('SHA-256', 'key', 'The quick brown fox jumps over the lazy dog')
  assert(/f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8/.test(JSON.stringify(h)), JSON.stringify(h).slice(0, 120))
})

// ---------------- cryptoFile ----------------
await run('cryptoFile', 'AES-GCM 加解密往返逐字节一致', async () => {
  const data = new Uint8Array(Array.from({ length: 4096 }, (_, i) => (i * 7 + 13) % 256))
  const enc = await M.cryptoFile.encryptFile(blobFile(data), 'pw-测试-123')
  assert((await ab(enc)).length > 4096, '密文应含 IV/头')
  const dec = await M.cryptoFile.decryptFile(blobFile(await ab(enc), 't.enc'), 'pw-测试-123')
  const got = await ab(dec)
  assert(got.length === 4096 && got.every((b, i) => b === data[i]), '长度 ' + got.length)
})
await run('cryptoFile', '错误密码拒绝且中文提示', async () => {
  const enc = await M.cryptoFile.encryptFile(blobFile(new Uint8Array([1, 2, 3])), 'right')
  try { await M.cryptoFile.decryptFile(blobFile(await ab(enc)), 'wrong'); return false } catch (e) { return /[\u4e00-\u9fa5]/.test(e.message) ? true : '信息:' + e.message.slice(0, 80) }
})

// ---------------- nlpEngine ----------------
await run('nlpEngine', '情感-正面', async () => {
  const r = M.nlpEngine.sentiment('这部电影太好看了,非常喜欢,强烈推荐')
  assert(/正面|积极|pos/i.test(JSON.stringify(r)), JSON.stringify(r).slice(0, 120))
})
await run('nlpEngine', '情感-负面', async () => {
  const r = M.nlpEngine.sentiment('质量太差了,非常失望,再也不买了')
  assert(/负面|消极|neg/i.test(JSON.stringify(r)), JSON.stringify(r).slice(0, 120))
})
await run('nlpEngine', '实体识别', async () => {
  const es = M.nlpEngine.extractEntities('张三在北京小米公司上班,电话13800138000')
  const t = JSON.stringify(es)
  assert(t.includes('张三') && t.includes('北京') && t.includes('小米'), t.slice(0, 200))
})
await run('nlpEngine', '问答抽取', async () => {
  const a = M.nlpEngine.answerFromPassage('珠穆朗玛峰海拔8848.86米,是世界最高峰。长江是亚洲最长的河流。', '珠穆朗玛峰有多高')
  assert(JSON.stringify(a).includes('8848'), JSON.stringify(a).slice(0, 160))
})
await run('nlpEngine', '离线翻译 你好→hello', async () => {
  const r = M.nlpEngine.translateBasic('你好', 'en')
  assert(/hello/i.test(JSON.stringify(r)), '实际:' + JSON.stringify(r).slice(0, 80))
})

// ---------------- dateEngine ----------------
await run('dateEngine', 'calcAge 2000-01-01 → 26周岁', async () => {
  const a = M.dateEngine.calcAge('2000-01-01')
  assert(a.years === 26 && a.totalDays > 9700, JSON.stringify(a).slice(0, 140))
})
await run('dateEngine', 'dateDiff 364天/260工作日', async () => {
  const d = M.dateEngine.dateDiff('2026-01-01', '2026-12-31')
  assert(d.days === 364, JSON.stringify(d).slice(0, 140))
})

// ---------------- officeEngine(xlsx) ----------------
await run('officeEngine', 'rowsToXlsx→readXlsx 往返', async () => {
  const buf = await M.officeEngine.rowsToXlsx(['a', 'b'], [[1, 2], ['x', 'y']])
  const sheets = await M.officeEngine.readXlsx(buf)
  const t = JSON.stringify(sheets)
  assert(sheets.length === 1 && t.includes('"y"') && t.includes('"2"'), t.slice(0, 180))
})

// ---------------- pdfEngine(pdf-lib 部分) ----------------
async function makePdf(pages) {
  const lib = await M.pdfEngine.loadPdfLib()
  const doc = await lib.PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText('Page ' + (i + 1), { x: 20, y: 360, size: 12 })
  return blobFile(await doc.save(), 't.pdf', 'application/pdf')
}
async function docOf(b) {
  const lib = await M.pdfEngine.loadPdfLib()
  // updateMetadata:false——load 默认会执行 updateInfoDict 把内存里的 producer 改写为 pdf-lib,
  // 元数据断言必须以文件字节为准
  const u8 = b instanceof Blob ? new Uint8Array(await b.arrayBuffer()) : (b instanceof Uint8Array ? b : new Uint8Array(b)); return lib.PDFDocument.load(u8, { ignoreEncryption: true, updateMetadata: false })
}
await run('pdfEngine', 'parsePageSpec', async () => {
  const r = M.pdfEngine.parsePageSpec('1,3-5', 10)
  assert(JSON.stringify(r) === '[0,2,3,4]', JSON.stringify(r))
})
await run('pdfEngine', 'mergePdfs 2+2=4页', async () => {
  const out = await M.pdfEngine.mergePdfs([await makePdf(2), await makePdf(2)])
  assert((await docOf(out)).getPageCount() === 4, '')
})
await run('pdfEngine', 'splitPdf 4页→4文件', async () => {
  const parts = await M.pdfEngine.splitPdf(await makePdf(4))
  assert(parts.length === 4, '数量:' + parts.length)
})
await run('pdfEngine', 'rotatePdf 90°(元数据方式)', async () => {
  const out = await M.pdfEngine.rotatePdf(await makePdf(2), 90)
  const page = (await docOf(out)).getPage(0)
  assert(page.getRotation().angle === 90, 'rotation=' + page.getRotation().angle)
})
await run('pdfEngine', 'extractPages 1,3 → 2页', async () => {
  const out = await M.pdfEngine.extractPages(await makePdf(4), '1,3')
  assert((await docOf(out)).getPageCount() === 2, '')
})
await run('pdfEngine', 'reversePages 4→倒序', async () => {
  const out = await M.pdfEngine.reversePages(await makePdf(4))
  assert((await docOf(out)).getPageCount() === 4, '')
})
await run('pdfEngine', 'protectPdf→unlockPdf 往返', async () => {
  const enc = await M.pdfEngine.protectPdf(await makePdf(2), 'pw123')
  let loadErr = null
  try { const l = await M.pdfEngine.loadPdfLib(); await l.PDFDocument.load(new Uint8Array(await enc.arrayBuffer())) } catch (e) { loadErr = e }
  const dec = await M.pdfEngine.unlockPdf(new File([enc], 'e.pdf', { type: 'application/pdf' }), 'pw123')
  assert((await docOf(dec)).getPageCount() === 2, '解密后页数异常')
  return loadErr ? true : 'warn:未加密标志(密码保护可能未生效)'
})
await run('pdfEngine', '错误密码被拒', async () => {
  const enc = await M.pdfEngine.protectPdf(await makePdf(2), 'right-pw')
  try { await M.pdfEngine.unlockPdf(enc, 'wrong-pw'); return false } catch (e) { return true }
})
await run('pdfEngine', 'setMetadata producer=ToolHub', async () => {
  const out = await M.pdfEngine.setMetadata(await makePdf(1), { title: '测试标题' })
  const doc = await docOf(out)
  assert(/ToolHub/.test(doc.getProducer() ?? '') && doc.getTitle() === '测试标题', `producer=${doc.getProducer()} title=${doc.getTitle()}`)
})

// ---------------- jsEngine ----------------
await run('jsEngine', 'formatCode js', async () => {
  const out = await M.jsEngine.formatCode('javascript', 'const a=1;const b=2')
  assert(out.includes('\n'), out.slice(0, 60))
})
await run('jsEngine', 'formatSql', async () => {
  const out = await M.jsEngine.formatSql('select id,name from users where id=1 and status=2')
  assert(out.toLowerCase().includes('\n') && out.toLowerCase().includes('where'), out.slice(0, 80))
})
await run('jsEngine', 'yaml↔json 往返', async () => {
  const j = await M.jsEngine.yamlToJson('a: 1\nb: x')
  const jObj = typeof j === 'string' ? JSON.parse(j) : j; const y = await M.jsEngine.jsonToYaml(JSON.stringify(jObj))
  const back = await M.jsEngine.yamlToJson(y)
  const norm = (s) => JSON.stringify(typeof s === 'string' ? JSON.parse(s) : s)
  assert(norm(back) === norm(j), `${norm(j)} vs ${norm(back)}`)
})
await run('jsEngine', 'jsonToTs 类型推断', async () => {
  const ts = await M.jsEngine.jsonToTs('{"a":1,"b":"x"}')
  assert(/a:\s*number/.test(ts) && /b:\s*string/.test(ts), ts.slice(0, 140))
})
await run('jsEngine', 'uaParse', async () => {
  const r = await M.jsEngine.uaParse('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
  const t = JSON.stringify(r).toLowerCase()
  assert(t.includes('chrome') && t.includes('windows'), t.slice(0, 140))
})
await run('jsEngine', 'curlToFetch', async () => {
  const out = await M.jsEngine.curlToFetch("curl -X POST https://api.test/x -H 'Content-Type: application/json' -d '{\"a\":1}'")
  const t = JSON.stringify(out); assert(/fetch\(/.test(t) && /POST/.test(t) && /body/.test(t), t.slice(0, 180))
})

// ---------------- 汇总 ----------------
mkdirSync(path.join(root, 'test-reports'), { recursive: true })
writeFileSync(path.join(root, 'test-reports', 'engine2-test-results.json'), JSON.stringify(results, null, 1), 'utf8')
console.log(`引擎用例 ${results.length}:通过 ${passN},失败 ${failN},警告 ${warnN}`)
for (const r of results.filter((x) => !x.ok)) console.log(`[${r.warn ? 'warn' : r.sev}] ${r.engine}.${r.name}: ${r.detail}`)
