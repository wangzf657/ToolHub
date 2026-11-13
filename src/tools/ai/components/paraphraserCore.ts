/**
 * 同义改写纯逻辑（paraphraser 组件的可测性提取）。
 * 本地同义词库轮换；英文词条 \b 词边界匹配（rx2，避免 goods/maker 误替换）；重叠位置保留先出现者。
 */

export const SYNONYMS: Record<string, string[]> = {
  非常: ['十分', '极其', '格外'],
  很多: ['不少', '大量', '诸多'],
  但是: ['然而', '不过', '可是'],
  因为: ['由于', '鉴于'],
  所以: ['因此', '于是'],
  如果: ['倘若', '假如', '若是'],
  现在: ['如今', '当前', '目前'],
  可能: ['或许', '也许', '大概'],
  重要: ['关键', '要紧', '重大'],
  提高: ['提升', '增加', '增强'],
  降低: ['下降', '减少', '减低'],
  立即: ['马上', '立刻', '当即'],
  帮助: ['协助', '辅助'],
  使用: ['运用', '采用', '利用'],
  获得: ['取得', '得到', '收获'],
  想要: ['希望', '打算'],
  觉得: ['认为', '感到'],
  快速: ['迅速', '敏捷'],
  简单: ['简易', '容易'],
  beautiful: ['lovely', 'gorgeous'],
  good: ['great', 'fine', 'nice'],
  bad: ['poor', 'awful'],
  big: ['large', 'huge'],
  small: ['little', 'tiny'],
  fast: ['quick', 'rapid'],
  use: ['utilize', 'employ'],
  make: ['create', 'produce'],
  show: ['display', 'demonstrate'],
  help: ['assist', 'aid'],
}

export interface Repl {
  start: number
  end: number
  from: string
  candidates: string[]
  current: number
}

/** 全部可替换位置（位置排序，重叠保留先出现者） */
export function findMatches(src: string): { start: number; end: number; from: string; candidates: string[] }[] {
  const raw: { start: number; end: number; from: string; candidates: string[] }[] = []
  for (const [from, tos] of Object.entries(SYNONYMS)) {
    const isEn = /^[a-zA-Z]+$/.test(from)
    if (isEn) {
      const re = new RegExp(`\\b${from}\\b`, 'gi')
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) raw.push({ start: m.index, end: m.index + m[0].length, from: m[0], candidates: tos })
    } else {
      let pos = src.indexOf(from)
      while (pos >= 0) {
        raw.push({ start: pos, end: pos + from.length, from, candidates: tos })
        pos = src.indexOf(from, pos + from.length)
      }
    }
  }
  raw.sort((a, b) => a.start - b.start)
  const out: typeof raw = []
  let lastEnd = -1
  for (const r of raw) {
    if (r.start < lastEnd) continue
    out.push(r)
    lastEnd = r.end
  }
  return out
}

/** 按幅度决定替换节奏（轻微 1/4、适中 1/2、大幅全换），current 为默认候选下标 */
export function planReplacements(src: string, strength: number): Repl[] {
  if (!src) return []
  const int = Number(strength) || 0.5
  const step = Math.ceil(1 / int)
  const all = findMatches(src)
  const out: Repl[] = []
  let idx = 0
  for (const m of all) {
    idx++
    if (int < 1 && idx % step !== 0) continue
    out.push({ ...m, current: idx % m.candidates.length })
  }
  return out
}

/** 一步到位：文本 → 改写稿（测试与组件共用） */
export function paraphraseText(src: string, strength = 0.5): string {
  let out = ''
  let cursor = 0
  for (const r of planReplacements(src, strength)) {
    out += src.slice(cursor, r.start) + r.candidates[r.current]
    cursor = r.end
  }
  return out + src.slice(cursor)
}
