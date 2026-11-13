/**
 * 中文笔误检查纯逻辑（grammar-corrector 组件的可测性提取）。
 * 含 matchLen 止损（替换按精确切片，不吞字）与通用叠字收缩（合法叠词白名单豁免）。
 */

export interface GIssue {
  index: number
  matchLen: number
  match: string
  msg: string
  suggestion: string
}

interface Rule {
  re: RegExp
  msg: string
  /** 返回整段匹配（m[0]）的替换文本 */
  fix: string | ((m: RegExpExecArray) => string)
}

/** rx4 同音/形近错别字（首轮扩充：仅收「错形基本无合法含义」的高置信词对） */
const TYPOS: [string, string][] = [
  ['在见', '再见'], ['一在', '一再'], ['在也', '再也'], ['现再', '现在'], ['正再', '正在'],
  ['再家', '在家'], ['再场', '在场'], ['作天', '昨天'], ['作梦', '做梦'], ['作饭', '做饭'],
  ['作事', '做事'], ['好象', '好像'], ['影象', '影像'], ['密秘', '秘密'], ['蓝球', '篮球'],
  ['等侯', '等候'], ['侯选', '候选'], ['拨河', '拔河'], ['份量', '分量'], ['签定', '签订'],
  ['装璜', '装潢'], ['追朔', '追溯'], ['世记', '世纪'], ['防害', '妨害'], ['松驰', '松弛'],
  ['明片', '名片'], ['坐阵', '坐镇'], ['针贬', '针砭'], ['钉书机', '订书机'], ['迫不急待', '迫不及待'],
  ['一如继往', '一如既往'], ['甘败下风', '甘拜下风'], ['名付其实', '名副其实'], ['鬼鬼崇崇', '鬼鬼祟祟'],
  ['蜂涌而来', '蜂拥而来'], ['人才倍出', '人才辈出'],
]

/** 的地得混用（动词+的+补语 → 得；形容词+的+动词 → 地） */
const DE_RULES: Rule[] = [
  { re: /([跑走说笑唱写读做吃看听喝想飞])的(?=[很快慢好多早晚对错])/g, msg: '「$1的」后接补语应为「得」', fix: (m) => `${m[1]}得` },
  { re: /(高兴|开心|悄悄|轻轻|慢慢|认真|努力|仔细|紧张|激动|顺利)的(?=[跑走来去说看听写做喊跳])/g, msg: '状语后应为「地」', fix: (m) => `${m[1]}地` },
]

/** 合法叠词白名单：叠字本身成词（谢谢/星星/匆匆…），收缩会破坏词义，豁免 */
const LEGIT_DOUBLE = new Set([
  '匆匆', '悄悄', '渐渐', '缓缓', '徐徐', '纷纷', '往往', '常常', '慢慢', '轻轻', '暗暗', '白白', '屡屡', '恰恰',
  '多多', '久久', '好好', '远远', '早早', '快快', '满满', '统统', '小小', '大大', '高高', '红红', '绿绿',
  '呱呱', '毛毛', '婆婆', '爷爷', '奶奶', '宝宝', '星星', '谢谢', '人人', '天天', '年年', '岁岁', '代代',
  '层层', '样样', '种种', '点点', '一一', '姥姥', '叔叔', '伯伯', '哥哥', '姐姐', '弟弟', '妹妹',
])

const RULES: Rule[] = [
  ...DE_RULES,
  ...TYPOS.map(([bad, good]): Rule => ({ re: new RegExp(bad, 'g'), msg: `同音错别字「${bad}」应为「${good}」`, fix: good })),
  { re: /的的地/g, msg: '重复的「的的」', fix: '的' },
  { re: /所以所以/g, msg: '「所以所以」重复', fix: '所以' },
  { re: /非常非常/g, msg: '「非常非常」叠用', fix: '非常' },
  // 通用叠字收缩（的地得由上面的专项规则处理，此处豁免避免重复报告；白名单叠词保留）
  { re: /([^\u7684\u5730\u5f97])\1/g, msg: '重复字「$&」', fix: (m) => (LEGIT_DOUBLE.has(m[0]) ? m[0] : m[1]) },
  { re: /([，。！？；：])\1+/g, msg: '重复标点', fix: (m) => m[1] },
  { re: /。{3,}/g, msg: '句号连用应省略号', fix: '……' },
  { re: /。，|，。/g, msg: '逗号句号冗余连用', fix: '。' },
  { re: /([a-zA-Z])\1{4,}/g, msg: '字母重复过多', fix: (m) => m[1] + m[1] },
  { re: /  +/g, msg: '多余空格', fix: ' ' },
  { re: /[（(][^）)]*$/gm, msg: '括号未闭合', fix: '' },
]

/** 扫描全部问题（按位置排序） */
export function findIssues(src: string): GIssue[] {
  const out: GIssue[] = []
  for (const r of RULES) {
    const re = new RegExp(r.re.source, r.re.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const fix = typeof r.fix === 'function' ? r.fix(m) : m[0].replace(new RegExp(r.re.source, r.re.flags.replace('g', '')), r.fix)
      if (fix !== m[0]) out.push({ index: m.index, matchLen: m[0].length, match: m[0], msg: r.msg.replace('$&', m[0]).replace('$1', m[1] ?? ''), suggestion: fix })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  // 英文代词 i 大写（含上下文匹配，fix 保留前后字符——不吞字符）
  const reI = /(^|[.!?]\s+|\s)i(\s|[,.!?]|$)/g
  let mi: RegExpExecArray | null
  while ((mi = reI.exec(src))) {
    out.push({ index: mi.index, matchLen: mi[0].length, match: mi[0], msg: '英文 “i” 作为代词应大写', suggestion: `${mi[1]}I${mi[2]}` })
  }
  return out.sort((a, b) => a.index - b.index)
}

/** rx1 止损：替换按 matchLen 精确切片（从后往前应用避免索引位移） */
export function applyFixes(src: string, issues: GIssue[]): string {
  let out = src
  for (const it of issues.slice().sort((a, b) => b.index - a.index)) {
    out = out.slice(0, it.index) + it.suggestion + out.slice(it.index + it.matchLen)
  }
  return out
}

/** 一步到位：文本 → 修正稿（测试与组件共用） */
export function correctGrammarText(src: string): string {
  return applyFixes(src, findIssues(src))
}
