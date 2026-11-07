/** CSV / 表格引擎（papaparse + 纯函数操作） */

export interface CsvData {
  header: string[]
  rows: string[][]
}

/** papaparse 最小接口（避免依赖其类型导出形式） */
interface PapaLike {
  parse(
    text: string,
    config?: { delimiter?: string; skipEmptyLines?: string | boolean },
  ): { data: string[][] }
}

export async function parseCsvFile(
  file: File | Blob,
  opts: { delimiter?: string; header?: boolean } = {},
): Promise<CsvData> {
  const text = await file.text()
  return parseCsvText(text, opts)
}

export function parseCsvText(
  text: string,
  opts: { delimiter?: string; header?: boolean } = {},
): CsvData {
  return parseWithPapa(text, opts)
}

export function parseCsvSync(
  text: string,
  opts: { delimiter?: string; header?: boolean } = {},
): CsvData {
  return parseWithPapa(text, opts)
}

let papaPromise: Promise<PapaLike> | null = null
async function getPapa(): Promise<PapaLike> {
  if (!papaPromise) {
    papaPromise = import('papaparse').then((m) => (m.default ?? m) as unknown as PapaLike)
  }
  return papaPromise
}

function parseWithPapa(text: string, opts: { delimiter?: string; header?: boolean }): CsvData {
  // 使用缓存的全局实例（模块已加载时）或同步降级解析
  const cached = (globalThis as never as { __papa?: PapaLike }).__papa
  if (cached) {
    const r = cached.parse(text, { delimiter: opts.delimiter ?? '', skipEmptyLines: 'greedy' })
    return toData(r.data, opts.header ?? true)
  }
  // 内置轻量解析器兜底（处理引号与分隔符）
  return miniParse(text, opts)
}

export async function parseCsvAsync(
  text: string,
  opts: { delimiter?: string; header?: boolean } = {},
): Promise<CsvData> {
  const Papa = await getPapa()
  ;(globalThis as never as { __papa?: PapaLike }).__papa = Papa
  const r = Papa.parse(text, { delimiter: opts.delimiter ?? '', skipEmptyLines: 'greedy' })
  return toData(r.data, opts.header ?? true)
}

function toData(rows: string[][], hasHeader: boolean): CsvData {
  if (!hasHeader) {
    return {
      header: rows[0]?.map((_, i) => `列${i + 1}`) ?? [],
      rows,
    }
  }
  const [header = [], ...rest] = rows
  return { header: header.map((h, i) => h.trim() || `列${i + 1}`), rows: rest }
}

/** 内置迷你 CSV 解析（引号/转义/自定义分隔符） */
export function miniParse(
  text: string,
  opts: { delimiter?: string; header?: boolean } = {},
): CsvData {
  const delim = opts.delimiter ?? sniffDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuote = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuote) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuote = false
      } else cell += ch
    } else if (ch === '"') {
      inQuote = true
    } else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const clean = rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '')
  return toData(clean, opts.header ?? true)
}

function sniffDelimiter(text: string): string {
  const sample = text.slice(0, 4000)
  const counts: Record<string, number> = {
    ',': (sample.match(/,/g) ?? []).length,
    ';': (sample.match(/;/g) ?? []).length,
    '\t': (sample.match(/\t/g) ?? []).length,
    '|': (sample.match(/\|/g) ?? []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ','
}

export function rowsToCsv(header: string[], rows: string[][], delimiter = ','): string {
  const esc = (s: string) => {
    const v = s ?? ''
    return /["\n\r]|,|;|\t/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  return [header, ...rows].map((r) => r.map(esc).join(delimiter)).join('\n')
}

/** 行去重 */
export function dedupeRows(
  rows: string[][],
  cols: number[] | null,
  opts: { ignoreCase?: boolean; trim?: boolean } = {},
): { unique: string[][]; removed: number } {
  const seen = new Set<string>()
  const unique: string[][] = []
  const key = (r: string[]) => {
    const arr = cols ? cols.map((i) => r[i] ?? '') : r
    let v = arr.join('\u0001')
    if (opts.trim) v = v.replace(/\s+/g, ' ').trim()
    if (opts.ignoreCase) v = v.toLowerCase()
    return v
  }
  for (const r of rows) {
    const k = key(r)
    if (!seen.has(k)) {
      seen.add(k)
      unique.push(r)
    }
  }
  return { unique, removed: rows.length - unique.length }
}

/** 合并多个 CSV（按表头对齐） */
export function mergeCsvData(
  list: { name: string; data: CsvData }[],
  opts: { addSource?: boolean } = {},
): CsvData {
  const headerSet = new Set<string>()
  for (const item of list) item.data.header.forEach((h) => headerSet.add(h))
  const header = [...headerSet]
  if (opts.addSource) header.push('来源文件')
  const rows: string[][] = []
  for (const item of list) {
    const idx = item.data.header.map((h) => header.indexOf(h))
    for (const r of item.data.rows) {
      const row = idx.map((i) => r[i] ?? '')
      if (opts.addSource) row.push(item.name)
      rows.push(row)
    }
  }
  return { header, rows }
}

/** 拆分：按行数 / 按列值 */
export function splitCsv(
  data: CsvData,
  mode: { kind: 'rows'; size: number } | { kind: 'column'; col: number },
): { name: string; csv: CsvData }[] {
  const out: { name: string; csv: CsvData }[] = []
  if (mode.kind === 'rows') {
    for (let i = 0; i < data.rows.length; i += mode.size) {
      out.push({ name: `第${i + 1}-${Math.min(data.rows.length, i + mode.size)}行`, csv: { header: data.header, rows: data.rows.slice(i, i + mode.size) } })
    }
  } else {
    const groups = new Map<string, string[][]>()
    for (const r of data.rows) {
      const v = r[mode.col] ?? ''
      if (!groups.has(v)) groups.set(v, [])
      groups.get(v)!.push(r)
    }
    for (const [v, rows] of groups) {
      out.push({ name: `${data.header[mode.col]}=${v || '空'}`, csv: { header: data.header, rows } })
    }
  }
  return out
}

/** 简单值统计（透视表/图表共用） */
export function aggregate(
  rows: string[][],
  groupCol: number | null,
  valueCol: number,
  fn: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median',
): { label: string; value: number }[] {
  const groups = new Map<string, number[]>()
  for (const r of rows) {
    const label = groupCol === null ? '全部' : (r[groupCol] ?? '')
    const v = parseFloat(r[valueCol])
    if (Number.isNaN(v)) continue
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(v)
  }
  const calc = (arr: number[]): number => {
    switch (fn) {
      case 'sum': return arr.reduce((a, b) => a + b, 0)
      case 'avg': return arr.reduce((a, b) => a + b, 0) / arr.length
      case 'count': return arr.length
      case 'min': return Math.min(...arr)
      case 'max': return Math.max(...arr)
      case 'median': {
        const s = [...arr].sort((a, b) => a - b)
        const m = Math.floor(s.length / 2)
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
      }
    }
  }
  return [...groups.entries()].map(([label, arr]) => ({ label, value: calc(arr) }))
}

/** 两表对比：added / removed / changed */
export function diffCsvData(
  a: CsvData,
  b: CsvData,
  keyCols: number[] | null = null,
): { added: string[][]; removed: string[][]; changed: { key: string; col: string; before: string; after: string }[] } {
  const keyOf = (r: string[]) => (keyCols ? keyCols.map((i) => r[i]).join('\u0001') : r.join('\u0001'))
  const mapA = new Map(a.rows.map((r) => [keyOf(r), r]))
  const mapB = new Map(b.rows.map((r) => [keyOf(r), r]))
  const added: string[][] = []
  const removed: string[][] = []
  const changed: { key: string; col: string; before: string; after: string }[] = []
  for (const [k, r] of mapB) {
    if (!mapA.has(k)) added.push(r)
  }
  for (const [k, r] of mapA) {
    if (!mapB.has(k)) removed.push(r)
  }
  for (const [k, ra] of mapA) {
    const rb = mapB.get(k)
    if (!rb) continue
    for (let i = 0; i < Math.min(a.header.length, b.header.length); i++) {
      if ((ra[i] ?? '') !== (rb[i] ?? '')) {
        changed.push({ key: k, col: a.header[i] ?? `列${i + 1}`, before: ra[i] ?? '', after: rb[i] ?? '' })
      }
    }
  }
  return { added, removed, changed }
}
