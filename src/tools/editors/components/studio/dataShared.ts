/** 数据工作台共享类型与文件装载 */
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { readXlsx } from '@/lib/officeEngine'

export interface Dataset {
  name: string
  header: string[]
  rows: string[][]
}

/** 把任意数据文件统一装载为 Dataset 列表（xlsx 每个 sheet 一条） */
export async function loadFilesToDatasets(files: File[]): Promise<Dataset[]> {
  const out: Dataset[] = []
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '')
    const lower = f.name.toLowerCase()
    try {
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const sheets = await readXlsx(f)
        for (const s of sheets) {
          out.push({ name: sheets.length > 1 ? `${base}·${s.name}` : base, header: s.header, rows: s.rows })
        }
      } else if (lower.endsWith('.json')) {
        const arr = JSON.parse(await f.text())
        const list: Record<string, unknown>[] = Array.isArray(arr) ? arr : ((arr as { data?: unknown[] }).data ?? [])
        if (!Array.isArray(list) || !list.length) throw new Error('JSON 需为非空对象数组')
        const header = [...new Set(list.flatMap((o) => Object.keys(o ?? {})))]
        out.push({
          name: base,
          header,
          rows: list.map((o) => header.map((h) => (o?.[h] === undefined || o?.[h] === null ? '' : String(o[h])))),
        })
      } else {
        const d: CsvData = await parseCsvAsync(await f.text())
        out.push({ name: base, header: d.header, rows: d.rows })
      }
    } catch (e) {
      throw new Error(`${f.name}：${(e as Error).message || '解析失败'}`)
    }
  }
  return out
}

/** 数据集 → 记录数组（对象形式），供 SQL / 导出使用 */
export function datasetToRecords(ds: Dataset): Record<string, unknown>[] {
  return ds.rows.map((r) => Object.fromEntries(ds.header.map((h, i) => [h, r[i] ?? ''])))
}

/** CSV 转义 */
export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /["\n,;\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
