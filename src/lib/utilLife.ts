/** 生活类共享规则：延迟退休、倒班模型、血型遗传、参考文献格式 */

/* ---------- 延迟退休（2024 全国人大常委会决定） ---------- */

export type RetireKind = 'male' | 'femaleWorker' | 'femaleCadre'

export const RETIRE_KINDS: { value: RetireKind; label: string; base: number }[] = [
  { value: 'male', label: '男职工（原 60 岁）', base: 60 },
  { value: 'femaleWorker', label: '女职工（原 50 岁）', base: 50 },
  { value: 'femaleCadre', label: '女干部/原 55 岁女职工', base: 55 },
]

export interface RetirementResult {
  /** 法定退休年月 yyyy-MM */
  retireYm: string
  /** 退休年龄，如 61 岁 3 个月 */
  ageText: string
  /** 延迟月数 */
  delayMonths: number
  /** 原法定退休年月 */
  originalYm: string
  /** 距退休月数 */
  monthsAway: number
}

/** 按渐进式延迟规则计算法定退休年月（birth 格式 yyyy-MM，兼容 yyyy-MM-dd） */
export function retirementFor(birth: string, kind: RetireKind, refDate = new Date()): RetirementResult | null {
  const m = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/.exec(birth.trim())
  if (!m) return null
  const by = Number(m[1]), bm = Number(m[2])
  if (by < 1900 || bm < 1 || bm > 12) return null
  const base = RETIRE_KINDS.find((k) => k.value === kind)!.base
  // 原法定退休年月（绝对月数，自公元 1 年 1 月起）
  const origAbs = (by + base) * 12 + (bm - 1)
  // 改革起始：2025-01-01（含当月，人社部对照表：1965-01 出生男职工即延迟 1 个月）
  const REFORM = 2025 * 12 // 2025-01
  let delay = 0
  if (origAbs >= REFORM) {
    const n = origAbs - REFORM // 原退休月在 2025-01 起的第 n 个月（0 起）
    // 官方口径：每个步长首月 cohort 即延迟 1 档 → floor(n/步长)+1（1965-01~04 → 1 个月）
    delay = kind === 'femaleWorker' ? Math.min(60, Math.floor(n / 2) + 1) : Math.min(36, Math.floor(n / 4) + 1)
  }
  const retireAbs = origAbs + delay
  const ry = Math.floor(retireAbs / 12), rm = (retireAbs % 12) + 1
  const nowAbs = refDate.getFullYear() * 12 + refDate.getMonth()
  const ym = (abs: number) => `${Math.floor(abs / 12)}-${String((abs % 12) + 1).padStart(2, '0')}`
  const dy = Math.floor(delay / 12), dm = delay % 12
  return {
    retireYm: ym(retireAbs),
    originalYm: ym(origAbs),
    ageText: delay === 0 ? `${base} 岁` : `${base + dy} 岁${dm ? ` ${dm} 个月` : ''}`,
    delayMonths: delay,
    monthsAway: Math.max(0, retireAbs - nowAbs),
  }
}

/* ---------- 倒班排班模型 ---------- */

export interface ShiftModel {
  id: string
  label: string
  /** 循环序列：班次名 + 每班持续天数 */
  cycle: { name: string; days: number }[]
  desc: string
}

export const SHIFT_MODELS: ShiftModel[] = [
  { id: 'two-12', label: '两班倒（12h · 一天一换）', cycle: [{ name: '白班', days: 1 }, { name: '夜班', days: 1 }], desc: '白班、夜班每日轮换' },
  { id: 'three-8', label: '三班倒（8h · 一天一换）', cycle: [{ name: '早班', days: 1 }, { name: '中班', days: 1 }, { name: '夜班', days: 1 }], desc: '早/中/夜每日轮换' },
  { id: 'four-three', label: '四班三运转（两天一换）', cycle: [{ name: '早班', days: 2 }, { name: '中班', days: 2 }, { name: '夜班', days: 2 }, { name: '轮休', days: 2 }], desc: '8 天一循环，早中夜轮转 + 轮休' },
]

const dayIndex = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86400000)
}

/** 日期偏移（日历天数，支持负数）对应的班次 */
export function shiftOn(model: ShiftModel, anchor: string, anchorIdx: number, date: string): { name: string; cyclePos: number } {
  const cycleDays = model.cycle.reduce((s, c) => s + c.days, 0)
  let offset = dayIndex(date) - dayIndex(anchor)
  let pos = anchorIdx % cycleDays
  pos = ((pos + (offset % cycleDays)) % cycleDays + cycleDays) % cycleDays
  let acc = 0
  for (const c of model.cycle) {
    if (pos < acc + c.days) return { name: c.name, cyclePos: pos }
    acc += c.days
  }
  return { name: model.cycle[0]!.name, cyclePos: 0 }
}

/* ---------- 血型遗传（ABO + Rh 简化规则） ---------- */

export type AboType = 'A' | 'B' | 'AB' | 'O'

const ABO_GENO: Record<AboType, string[]> = { A: ['AA', 'AO'], B: ['BB', 'BO'], AB: ['AB'], O: ['OO'] }
const genoPheno = (g: string): AboType => (g === 'AB' ? 'AB' : g === 'OO' ? 'O' : (g[0] === 'A' || g[1] === 'A' ? 'A' : 'B'))

/** 父母 ABO → 子女可能/不可能血型（考虑父母基因型所有组合） */
export function bloodInherit(f: AboType, m: AboType): { possible: AboType[]; impossible: AboType[] } {
  const set = new Set<AboType>()
  for (const gf of ABO_GENO[f])
    for (const gm of ABO_GENO[m]) {
      // 各取一个等位基因的全部组合
      for (const a1 of gf) for (const a2 of gm) set.add(genoPheno([a1, a2].sort().join('')))
    }
  const all: AboType[] = ['A', 'B', 'AB', 'O']
  return {
    possible: all.filter((t) => set.has(t)),
    impossible: all.filter((t) => !set.has(t)),
  }
}

/* ---------- 参考文献（GB/T 7714-2015 与 APA 7） ---------- */

export interface CitationFields {
  type: string // book / journal / thesis / web / conference
  authors: string // 分号或逗号分隔
  title: string
  year: string
  publisher?: string
  city?: string
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  university?: string
  conference?: string
  url?: string
  accessDate?: string
  edition?: string
}

const splitAuthors = (s: string): string[] =>
  s.split(/[;；,，]/).map((x) => x.trim()).filter(Boolean)

/** GB/T 7714-2015：中文姓名不缩写，英文姓前名缩写 */
const gbAuthor = (list: string[]): string => {
  if (!list.length) return ''
  const names = list.map((n) => (/[A-Za-z]/.test(n) && !/[\u4e00-\u9fa5]/.test(n) ? n.replace(/^(\S+)\s+(\S).*$/, '$1 $2') : n))
  const head = names.slice(0, 3).join(', ')
  return names.length > 3 ? `${head}, 等` : head
}

const apaAuthor = (list: string[]): string => {
  if (!list.length) return ''
  const fmt = (n: string) => {
    if (/[\u4e00-\u9fa5]/.test(n)) return n // 中文姓名照写
    const parts = n.split(/\s+/)
    if (parts.length < 2) return n
    const last = parts[parts.length - 1]!
    return `${last}, ${parts.slice(0, -1).map((p) => p[0]!.toUpperCase() + '.').join(' ')}`
  }
  if (list.length === 1) return fmt(list[0]!)
  if (list.length === 2) return `${fmt(list[0]!)} & ${fmt(list[1]!)}`
  // APA 7 三位及以上：末位作者前用「, &」（牛津逗号）
  return `${list.slice(0, -1).map(fmt).join(', ')}, & ${fmt(list[list.length - 1]!)}`
}

/** 生成 GB/T 7714-2015 与 APA 7 两种参考文献格式 */
export function formatCitation(f: CitationFields): { gb: string; apa: string } {
  const list = splitAuthors(f.authors)
  const year = f.year || 'n.d.'
  const page = f.pages ? `: ${f.pages}` : ''
  let gb = ''
  let apa = ''
  switch (f.type) {
    case 'journal':
      gb = `${gbAuthor(list)}. ${f.title}[J]. ${f.journal || ''}, ${year}${f.volume ? `, ${f.volume}` : ''}${f.issue ? `(${f.issue})` : ''}${page}.`
      apa = `${apaAuthor(list)} (${year}). ${f.title}. ${f.journal || ''}${f.volume ? `, ${f.volume}` : ''}${f.issue ? `(${f.issue})` : ''}${page ? `, ${f.pages}` : ''}.`
      break
    case 'thesis':
      gb = `${gbAuthor(list)}. ${f.title}[D]. ${f.city ? f.city + ': ' : ''}${f.university || ''}, ${year}.`
      apa = `${apaAuthor(list)} (${year}). ${f.title} [学位论文]. ${f.university || ''}.`
      break
    case 'web':
      gb = `${gbAuthor(list)}. ${f.title}[EB/OL]. (${year})${f.accessDate ? `[${f.accessDate}]` : ''}. ${f.url || ''}.`
      apa = `${apaAuthor(list)} (${year}). ${f.title}. ${f.url ? 'Retrieved from ' + f.url : ''}`
      break
    case 'conference':
      gb = `${gbAuthor(list)}. ${f.title}[C]//${f.conference || ''}. ${f.city ? f.city + ': ' : ''}${f.publisher || ''}, ${year}${page}.`
      apa = `${apaAuthor(list)} (${year}). ${f.title}. In ${f.conference || ''} (pp. ${f.pages || ''}). ${f.publisher || ''}.`
      break
    default: // book
      gb = `${gbAuthor(list)}. ${f.title}[M]. ${f.city ? f.city + ': ' : ''}${f.publisher || ''}, ${year}${page}.`
      apa = `${apaAuthor(list)} (${year}). ${f.title}${f.edition ? ` (${f.edition} ed.)` : ''}. ${f.publisher || ''}.`
  }
  return { gb: gb.replace(/\s+/g, ' ').replace(/\. \./g, '.').trim(), apa: apa.replace(/\s+/g, ' ').replace(/\.\./g, '.').trim() }
}
