/**
 * prepare-data.mjs — 离线数据集清洗脚本（node 可重复执行）
 *
 * 用法：node scripts/toolgen/prepare-data.mjs
 * 输入：D:\workspace\ai\Toolhub\.tmp-data\ 下的原始下载数据（见 README 注释）
 * 输出：public/data/*.json（9 个文件，UTF-8 无 BOM，紧凑 JSON）
 *
 * 原始数据来源（下载到 .tmp-data/<src>/，本脚本不做网络请求）：
 *  - idiom    https://raw.githubusercontent.com/pwxcoo/chinese-xinhua/master/data/idiom.json
 *  - xiehouyu https://raw.githubusercontent.com/pwxcoo/chinese-xinhua/master/data/xiehouyu.json
 *  - poetry   https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/全唐诗/唐诗三百首.json
 *             https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/宋词/宋词三百首.json
 *             https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt
 *             https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSPhrases.txt
 *  - ecdict   https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
 *  - periodic https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json
 *  - oui      https://standards-oui.ieee.org/oui/oui.csv
 *  - garbage  https://raw.githubusercontent.com/alexayan/garbage-classification-data/master/garbage.json
 *  - food     https://raw.githubusercontent.com/Sanotsu/china-food-composition-data/main/json_data_v3_20260825_qwen38max_kimi_k3_fixed/merged_*.json
 *  - universities https://raw.githubusercontent.com/DaoSword/China-Education-Data/master/数据收集-高等教育/04-数据宽表/高等教育数据宽表v20230118.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = path.join(ROOT, '.tmp-data');
const OUT = path.join(ROOT, 'public', 'data');
fs.mkdirSync(OUT, { recursive: true });

const CJK = /[\u4e00-\u9fff]/;
const cleanText = (s) =>
  String(s ?? '')
    .replace(/\r\n?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** 读原始文件，缺失时抛出带说明的错误 */
function readSrc(srcDir, file, must = true) {
  const p = path.join(TMP, srcDir, file);
  if (!fs.existsSync(p)) {
    const msg = `[skip] 缺少原始文件 ${path.relative(ROOT, p)}（请先按脚本头注释下载）`;
    if (must) throw new Error(msg);
    console.warn(msg);
    return null;
  }
  return fs.readFileSync(p, 'utf8');
}

const results = [];
function writeJson(name, data) {
  const json = JSON.stringify(data);
  const file = path.join(OUT, name);
  fs.writeFileSync(file, json, 'utf8'); // utf8 写入不带 BOM
  // 自校验：可解析 + 无 BOM
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) throw new Error(`${name} 出现 BOM`);
  JSON.parse(buf.toString('utf8'));
  const kb = (buf.length / 1024).toFixed(0);
  results.push({ name, count: Array.isArray(data) ? data.length : '-', kb });
  console.log(`  -> ${name}: ${Array.isArray(data) ? data.length + ' 条' : '-'} , ${kb} KB`);
  return buf.length;
}

/* ------------------------------------------------------------------ */
/* 1. 成语 idiom.json  { w, p, e, d, ex }                              */
/* ------------------------------------------------------------------ */
function genIdiom() {
  console.log('[1/9] idiom.json 成语');
  const raw = JSON.parse(readSrc('idiom', 'idiom.json'));
  const full = raw.map((x) => ({
    w: cleanText(x.word),
    p: cleanText(x.pinyin),
    e: cleanText(x.explanation),
    d: cleanText(x.derivation),
    ex: cleanText(x.example),
  }));
  let items = full.filter((x) => x.w);
  const utf8 = (s) => Buffer.byteLength(s, 'utf8'); // 按字节判断文件体积
  // 体积策略：实测源数据 explanation 平均仅 20 字（截 200 无效果），文件大小主要由 3.1 万条目
  // 本身决定——5MB 内保不住有效出处/例句。默认保留全部字段信息，仅截掉超长尾部（d/ex ≤100 字），
  // 得到 ~7.9MB；如需严格执行 ≤5MB，把 IDIOM_STRICT_5MB 改为 true（降级链：先清空例句、
  // 再递减出处，最终 ~4MB，代价是 d/ex 大面积失真）。
  const IDIOM_STRICT_5MB = false;
  let mode = '完整（d/ex 截超长 100 字）';
  items = items.map((x) => ({ ...x, d: x.d.slice(0, 100), ex: x.ex.slice(0, 100) }));
  let json = JSON.stringify(items);
  if (IDIOM_STRICT_5MB && utf8(json) > 5 * 1024 * 1024) {
    mode = '严格 5MB：ex 置空、d 截 60 字';
    items = items.map((x) => ({ ...x, ex: '', d: x.d.slice(0, 60) }));
    json = JSON.stringify(items);
    if (utf8(json) > 5 * 1024 * 1024) {
      mode = '严格 5MB：ex/d 置空';
      items = items.map((x) => ({ ...x, d: '' }));
      json = JSON.stringify(items);
    }
  }
  console.log(`  清洗：${raw.length} -> ${items.length} 条（${mode}）`);
  writeJson('idiom.json', items);
}

/* ------------------------------------------------------------------ */
/* 2. 歇后语 xiehouyu.json  { r, a }                                   */
/* ------------------------------------------------------------------ */
function genXiehouyu() {
  console.log('[2/9] xiehouyu.json 歇后语');
  const raw = JSON.parse(readSrc('xiehouyu', 'xiehouyu.json'));
  const seen = new Set();
  const items = [];
  for (const x of raw) {
    const r = cleanText(x.riddle);
    const a = cleanText(x.answer);
    if (!r || !a) continue;
    const k = r + '|' + a;
    if (seen.has(k)) continue;
    seen.add(k);
    items.push({ r, a });
  }
  console.log(`  清洗：${raw.length} -> ${items.length} 条（去重、去空）`);
  writeJson('xiehouyu.json', items);
}

/* ------------------------------------------------------------------ */
/* 3. 诗词 poetry.json  { t, a, dy, ps }                               */
/* ------------------------------------------------------------------ */
/** 繁->简：OpenCC TSCharacters/TSPhrases（词组优先、最长匹配） */
function buildT2S() {
  const charMap = new Map();
  const phraseMap = new Map();
  const ch = readSrc('poetry', 'TSCharacters.txt');
  for (const line of ch.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [k, ...vs] = line.split('\t');
    // 多值映射（如 沈 -> 沉 沈）只取第一个值，避免把候选串原样带进文本
    if (k && vs.length) charMap.set(k, vs[0].trim().split(/\s+/)[0]);
  }
  const ph = readSrc('poetry', 'TSPhrases.txt');
  for (const line of ph.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [k, ...vs] = line.split('\t');
    if (k && vs.length) phraseMap.set(k, vs[0].trim().split(/\s+/)[0]);
  }
  const maxLen = Math.max(2, ...[...phraseMap.keys()].map((s) => s.length));
  return function t2s(s) {
    if (!s) return s;
    let out = '';
    let i = 0;
    while (i < s.length) {
      let hit = null;
      for (let len = Math.min(maxLen, s.length - i); len >= 2; len--) {
        const v = phraseMap.get(s.slice(i, i + len));
        if (v !== undefined) {
          hit = v;
          i += len;
          break;
        }
      }
      if (hit === null) {
        out += charMap.get(s[i]) ?? s[i];
        i += 1;
      } else {
        out += hit;
      }
    }
    return out;
  };
}

function genPoetry() {
  console.log('[3/9] poetry.json 唐诗三百首 + 宋词三百首');
  const t2s = buildT2S();
  // 诗文专用补丁：OpenCC 对「沈」（通「沉」，如「夜夜沈」）按姓氏保留原字，诗文语境应转「沉」；
  // 此替换只作用于标题与正文，不作用于作者（保留「沈佺期」）。
  const POETRY_CHAR_FIX = { 沈: '沉' };
  const fixChars = (s) => s.replace(/沈/g, () => POETRY_CHAR_FIX['沈']);
  // 乐府类目是元数据不是标题（如「鼓吹曲辭 將進酒」），剥掉前缀
  const YUEFU_PREFIX = /^(鼓吹曲辞|横吹曲辞|相和歌辞|清商曲辞|舞曲歌辞|琴曲歌辞|杂曲歌辞|近代曲辞|杂歌谣辞|新乐府辞)\s+/;
  // 源文件《在嶽詠蟬》系「獄」之误，骆宾王名作为《在狱咏蝉》
  const POETRY_TITLE_FIX = { 在岳咏蝉: '在狱咏蝉' };
  // 源数据混入《全唐诗》异文/宋人伪托条目：正文与通行本相同或高度重合者剔除（详见报告）。
  // 键为「归一化标题|作者」。
  const POETRY_DROPS = new Set([
    '颂古三十二首 其二三|释明辩', // 正文≡金昌绪《春怨》（宋僧引用条目）
    '寄人二首 其一|张佖', // 正文≡张泌《寄人 一》（张佖系张泌异写）
    '登楼|朱斌', // 正文≡王之涣《登鹳雀楼》
    '度南涧|蔡襄', // 正文≡张旭《桃花溪》（蔡襄系宋人）
    '婆罗门|杨敬述进', // 正文≈李益《夜上受降城闻笛》异文
    '访羊尊师|孙革', // 正文≡贾岛《寻隐者不遇》
    '盖罗缝 一|不详', // ≈王昌龄《出塞》乐府异文
    '青玉案|无名氏', // 宋词混入唐诗集（两条）
    '江南词|李益', // 正文≡李益《江南曲》（悮/误异体）
    '出塞二首 一|王昌龄', // 正文≡王昌龄《出塞 一》
  ]);
  // 按通行《唐诗三百首》订正署名（黄拱系宋人误署，正文为贺知章《回乡偶书》其一）
  const POETRY_ATTR_FIX = { '还乡偶书 其二|黄拱': { t: '回乡偶书 其一', a: '贺知章' } };
  const seen = new Set();
  const items = [];
  let dropped = 0;
  const push = (t, a, dy, ps) => {
    t = fixChars(t2s(cleanText(t))).replace(YUEFU_PREFIX, '');
    t = POETRY_TITLE_FIX[t] ?? t;
    a = t2s(cleanText(a));
    const attr = POETRY_ATTR_FIX[t + '|' + a];
    if (attr) {
      t = attr.t;
      a = attr.a;
    }
    // 剔除规则只针对唐诗部分的伪托/异文条目；宋词三百首自身的无名氏《青玉案》等保留
    if (dy === '唐' && POETRY_DROPS.has(t + '|' + a)) {
      dropped++;
      return;
    }
    ps = (ps || []).map((p) => fixChars(t2s(cleanText(p)))).filter(Boolean);
    if (!t || !ps.length) return;
    const k = t + '|' + a + '|' + ps.join('');
    if (seen.has(k)) return;
    seen.add(k);
    items.push({ t, a, dy, ps });
  };
  // 唐诗三百首（源文件为繁体，字段 title/author/paragraphs）
  const tang = JSON.parse(readSrc('poetry', '唐诗三百首.json'));
  for (const x of tang) push(x.title, x.author, '唐', x.paragraphs);
  const tangN = items.length;
  // 宋词三百首（简体，词牌在 rhythmic 字段）
  const song = JSON.parse(readSrc('poetry', '宋词三百首.json'));
  for (const x of song) push(x.rhythmic || x.title, x.author, '宋', x.paragraphs);
  console.log(`  清洗：唐 ${tangN} + 宋 ${items.length - tangN} = ${items.length} 首（繁->简、去重、剔除异文/伪托 ${dropped} 条）`);
  writeJson('poetry.json', items);
}

/* ------------------------------------------------------------------ */
/* 4. 英汉词典 ecdict.json  { w, uk, us, tr }                          */
/* ------------------------------------------------------------------ */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function genEcdict() {
  console.log('[4/9] ecdict.json 高频英汉词典');
  const text = readSrc('ecdict', 'ecdict.csv');
  const lines = text.split('\n');
  const hdr = parseCsvLine(lines[0].trim());
  const ix = Object.fromEntries(['word', 'phonetic', 'translation', 'bnc', 'frq'].map((k) => [k, hdr.indexOf(k)]));
  const best = new Map(); // 小写词 -> 条目
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (!line) continue;
    const c = parseCsvLine(line);
    const word = c[ix.word];
    const tr = c[ix.translation] ?? '';
    if (!word || !CJK.test(tr)) continue;
    if (!/^[A-Za-z][A-Za-z'\-]*[A-Za-z']?$/.test(word) || word.length > 12) continue;
    const frq = parseInt(c[ix.frq], 10) || 0;
    const bnc = parseInt(c[ix.bnc], 10) || 0;
    if (!frq && !bnc) continue; // 无频率信息的生僻词直接排除
    const score = Math.min(frq > 0 ? frq : 1e9, bnc > 0 ? bnc : 1e9);
    const key = word.toLowerCase();
    const prev = best.get(key);
    if (prev && (prev.score < score || (prev.score === score && prev.second <= (frq && bnc ? Math.max(frq, bnc) : 1e9)))) continue;
    best.set(key, {
      score,
      second: frq && bnc ? Math.max(frq, bnc) : 1e9,
      w: word,
      uk: (c[ix.phonetic] ?? '').trim(),
      trLines: tr.split('\\n').map((s) => s.trim()).filter(Boolean),
    });
  }
  let items = [...best.values()].sort((a, b) => a.score - b.score || a.second - b.second || a.w.localeCompare(b.w)).slice(0, 20000);
  const build = (list, trMax) =>
    list.map((x) => ({ w: x.w, uk: x.uk, us: x.uk, tr: x.trLines.join('；').slice(0, trMax) }));
  let data = build(items, 120);
  // 目标 ≤3MB：超限则逐千条裁剪，再不够则收紧释义
  const LIMIT = 3 * 1024 * 1024;
  while (data.length > 1000 && JSON.stringify(data).length > LIMIT) data = data.slice(0, -1000);
  while (data.length > 1000 && JSON.stringify(data).length > LIMIT) {
    items = items.slice(0, -1000);
    data = build(items, 80);
  }
  console.log(`  清洗：全库 77 万词 -> 频率 Top ${data.length}（词长≤12、含中文释义、去重、tr 截 120 字；us 沿用英式音标）`);
  writeJson('ecdict.json', data);
}

/* ------------------------------------------------------------------ */
/* 5. 元素周期表 periodic.json { z, sym, name, mass, cat, shells, melt, boil, year } */
/* ------------------------------------------------------------------ */
// 118 个元素中文名（GB 3102 / 全国科技名词委官方用字，104-118 为 IUPAC 官方新造字）
const ELEMENT_NAMES = Array.from(
  '氢氦锂铍硼碳氮氧氟氖' + '钠镁铝硅磷硫氯氩钾钙' + '钪钛钒铬锰铁钴镍铜锌' + '镓锗砷硒溴氪铷锶钇锆' +
    '铌钼锝钌铑钯银镉铟锡' + '锑碲碘氙铯钡镧铈镨钕' + '钷钐铕钆铽镝钬铒铥镱' + '镥铪钽钨铼锇铱铂金汞' +
    '铊铅铋钋砹氡钫镭锕钍' + '镤铀镎钚镅锔锫锎锿镄' + '钔锘铹𬬻𬭊𬭳𬭛𬭶鿏𫟼' + '𬬭鿔鿭𫓧镆鉝鿬鿫',
);
// 发现年份（通行口径；10 种元素史前已知标「古代」）
const ELEMENT_YEARS = [
  '1766', '1868', '1817', '1798', '1808', '古代', '1772', '1774', '1886', '1898',
  '1807', '1755', '1825', '1824', '1669', '古代', '1774', '1894', '1807', '1808',
  '1879', '1791', '1801', '1797', '1774', '古代', '1735', '1751', '古代', '1746',
  '1875', '1886', '1250', '1817', '1826', '1898', '1861', '1790', '1794', '1789',
  '1801', '1778', '1937', '1844', '1803', '1803', '古代', '1817', '1863', '古代',
  '古代', '1782', '1811', '1898', '1860', '1808', '1839', '1803', '1885', '1885',
  '1945', '1879', '1901', '1880', '1843', '1886', '1878', '1843', '1879', '1878',
  '1907', '1923', '1802', '1783', '1925', '1803', '1803', '1735', '古代', '古代',
  '1861', '古代', '1753', '1898', '1940', '1900', '1939', '1898', '1899', '1829',
  '1913', '1789', '1940', '1940', '1944', '1944', '1949', '1950', '1952', '1952',
  '1955', '1958', '1961', '1964', '1970', '1974', '1981', '1984', '1982', '1994',
  '1994', '1996', '2004', '1999', '2003', '2000', '2010', '2002',
];
const CAT_MAP = {
  'alkali metal': '碱金属',
  'alkaline earth metal': '碱土金属',
  'transition metal': '过渡金属',
  lanthanide: '镧系',
  actinide: '锕系',
  metalloid: '类金属',
  'diatomic nonmetal': '非金属',
  'polyatomic nonmetal': '非金属',
  halogen: '卤素',
  'noble gas': '稀有气体',
  'post-transition metal': '贫金属', // 契约未列，按准确译名处理（可在 CAT_MAP 一行改）
};
const round2 = (x) => Math.round(x * 100) / 100;
const round4 = (x) => Math.round(x * 10000) / 10000;
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I', 'At']);

function genPeriodic() {
  console.log('[5/9] periodic.json 元素周期表');
  const raw = JSON.parse(readSrc('periodic', 'PeriodicTableJSON.json'));
  const byZ = new Map();
  for (const e of raw.elements || []) {
    if (e.number >= 1 && e.number <= 118) byZ.set(e.number, e);
  }
  const items = [];
  for (let z = 1; z <= 118; z++) {
    const e = byZ.get(z);
    if (!e) throw new Error(`periodic 缺少 ${z} 号元素`);
    const cat = HALOGENS.has(e.symbol)
      ? '卤素' // 源数据把 F/Cl/Br/I 归 diatomic nonmetal、At 归 metalloid，按中文元素周期表惯例统一为卤素
      : (CAT_MAP[e.category] ?? (String(e.category).startsWith('unknown') ? '未知' : e.category));
    items.push({
      z,
      sym: e.symbol,
      name: ELEMENT_NAMES[z - 1] || e.name,
      mass: String(round4(Number(e.atomic_mass))),
      cat,
      shells: e.shells ?? [],
      melt: e.melt == null ? null : round2(Number(e.melt)),
      boil: e.boil == null ? null : round2(Number(e.boil)),
      year: ELEMENT_YEARS[z - 1] ?? '',
    });
  }
  console.log(`  清洗：${raw.elements.length} -> 118 元素（英文名->官方中文名、分类译中文、熔沸点 K、内嵌发现年份）`);
  writeJson('periodic.json', items);
}

/* ------------------------------------------------------------------ */
/* 6. MAC 厂商 oui.json  { p, o }                                      */
/* ------------------------------------------------------------------ */
function genOui() {
  console.log('[6/9] oui.json IEEE MAC 前缀厂商');
  const text = readSrc('oui', 'oui.csv');
  const lines = text.split('\n');
  const hdr = parseCsvLine(lines[0]);
  const iAs = hdr.indexOf('Assignment');
  const iOrg = hdr.indexOf('Organization Name');
  const seen = new Set();
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (!line) continue;
    const c = parseCsvLine(line);
    const asg = (c[iAs] ?? '').trim().toUpperCase();
    const org = (c[iOrg] ?? '').trim().replace(/\s+/g, ' ');
    if (!/^[0-9A-F]{6}$/.test(asg) || !org) continue;
    if (seen.has(asg)) continue;
    seen.add(asg);
    const p = `${asg.slice(0, 2)}:${asg.slice(2, 4)}:${asg.slice(4, 6)}`;
    items.push({ p, o: org.slice(0, 60) });
  }
  items.sort((a, b) => (a.p < b.p ? -1 : 1));
  console.log(`  清洗：${lines.length - 1} 行 -> ${items.length} 条（Assignment 格式化为 XX:YY:ZZ、厂商截 60 字、按前缀排序）`);
  writeJson('oui.json', items);
}

/* ------------------------------------------------------------------ */
/* 7. 垃圾分类 garbage.json  { n, c }                                  */
/* ------------------------------------------------------------------ */
// 位掩码分类按「有害 > 可回收 > 湿 > 干」取优先值；纯大件垃圾(16)不在契约四类中，剔除
const GARBAGE_BITS = [
  [2, '有害垃圾'],
  [1, '可回收物'],
  [4, '湿垃圾'],
  [8, '干垃圾'],
];

function genGarbage() {
  console.log('[7/9] garbage.json 垃圾分类');
  const raw = JSON.parse(readSrc('garbage', 'alexayan.json'));
  const seen = new Set();
  const items = [];
  let skipped = 0;
  for (const x of raw) {
    const n = cleanText(x.name);
    if (!n || seen.has(n)) continue;
    let cat = null;
    for (const [bit, name] of GARBAGE_BITS) {
      if (Number(x.category) & bit) {
        cat = name;
        break;
      }
    }
    if (!cat) {
      skipped++;
      continue;
    }
    seen.add(n);
    items.push({ n, c: cat });
  }
  console.log(`  清洗：${raw.length} -> ${items.length} 条（位掩码->四分类、去重，剔除大件垃圾 ${skipped} 条）`);
  writeJson('garbage.json', items);
}

/* ------------------------------------------------------------------ */
/* 8. 食物成分 food.json  { n, kcal, p, f, cb }                        */
/* ------------------------------------------------------------------ */
function genFood() {
  console.log('[8/9] food.json 食物成分（每 100g 可食部）');
  const dir = path.join(TMP, 'food');
  const files = fs.readdirSync(dir).filter((f) => /^food_\d+\.json$/.test(f)).sort();
  if (!files.length) throw new Error(`[skip] 缺少原始文件 .tmp-data/food/food_*.json（61 个分类文件）`);
  const seen = new Set();
  const items = [];
  let dropped = 0;
  for (const f of files) {
    const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const x of arr) {
      const n = cleanText(x.foodName);
      const kcal = Number(x.energyKCal);
      if (!n || !Number.isFinite(kcal) || seen.has(n)) {
        dropped++;
        continue;
      }
      const num = (v) => {
        const t = Number(v);
        return Number.isFinite(t) ? t : 0;
      };
      seen.add(n);
      items.push({ n, kcal, p: num(x.protein), f: num(x.fat), cb: num(x.CHO) });
    }
  }
  console.log(`  清洗：${61} 个分类文件 -> ${items.length} 条（能量缺失/无名/重名剔除 ${dropped} 条；数值取自《中国食物成分表》第 6 版口径）`);
  writeJson('food.json', items);
}

/* ------------------------------------------------------------------ */
/* 9. 高校名单 universities.json  { n, prov, type, tags }              */
/* ------------------------------------------------------------------ */
function genUniversities() {
  console.log('[9/9] universities.json 全国公办本科高校');
  const text = readSrc('universities', 'daosword-wide.csv');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const hdr = parseCsvLine(lines[0]);
  const ix = Object.fromEntries(
    ['学校名称', '所在省份', '办学层次', '学校性质', '学校类别', '985工程', '211工程', '双一流建设'].map((k) => [k, hdr.indexOf(k)]),
  );
  const flag = (v) => parseFloat(v) > 0;
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    if (c[ix.办学层次] !== '本科' || c[ix.学校性质] !== '公办') continue;
    const tags = [];
    if (flag(c[ix['985工程']])) tags.push('985');
    if (flag(c[ix['211工程']])) tags.push('211');
    if (flag(c[ix['双一流建设']])) tags.push('双一流');
    const type = (c[ix.学校类别] || '综合').replace(/类$/, '');
    items.push({ n: cleanText(c[ix.学校名称]), prov: cleanText(c[ix.所在省份]), type, tags });
  }
  console.log(`  清洗：${lines.length - 1} 行 -> ${items.length} 条（筛选公办本科；type 去「类」尾字；tags 取 985/211/双一流标记）`);
  writeJson('universities.json', items);
}

/* ------------------------------------------------------------------ */
const gens = [
  ['idiom.json', genIdiom],
  ['xiehouyu.json', genXiehouyu],
  ['poetry.json', genPoetry],
  ['ecdict.json', genEcdict],
  ['periodic.json', genPeriodic],
  ['oui.json', genOui],
  ['garbage.json', genGarbage],
  ['food.json', genFood],
  ['universities.json', genUniversities],
];

let failed = 0;
for (const [name, fn] of gens) {
  try {
    fn();
  } catch (e) {
    failed++;
    console.warn(`  [失败] ${name}: ${e.message}`);
  }
}

console.log('\n===== 汇总 =====');
for (const r of results) console.log(`${r.name.padEnd(18)} ${String(r.count).padStart(6)} 条  ${String(r.kb).padStart(6)} KB`);
if (failed) {
  console.warn(`\n${failed} 个数据集生成失败，见上方 [失败]/[skip] 提示。`);
  process.exitCode = 1;
} else {
  console.log('\n全部 9 个数据集生成成功。');
}
