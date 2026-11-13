/** 数据工作台共享类型与文件装载 */
import { parseCsvAsync, type CsvData } from '@/lib/csvEngine'
import { readXlsx } from '@/lib/officeEngine'

export interface Dataset {
  name: string
  header: string[]
  rows: string[][]
}

/** 把任意数据文件统一装载为 Dataset 列表（xlsx 每个 sheet 一条；parquet 走 hyparquet） */
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
      } else if (lower.endsWith('.parquet')) {
        // hyparquet 纯 JS 解析（与 parquet-to-csv 同路径）：读前 5000 行进数据集
        const hy = (await import('hyparquet')) as unknown as {
          parquetRead: (opts: Record<string, unknown>) => Promise<void>
        }
        const buf = await f.arrayBuffer()
        const collected: Record<string, unknown>[] = []
        await hy.parquetRead({
          file: buf,
          rowFormat: 'object',
          rowEnd: 5000,
          onBatch: (batch: Record<string, unknown>[]) => collected.push(...batch),
          onComplete: () => {},
        })
        if (!collected.length) throw new Error('Parquet 没有可读数据行（可能是不支持的压缩编码）')
        const header = Object.keys(collected[0]!)
        out.push({
          name: base,
          header,
          rows: collected.map((o) => header.map((h) => (o?.[h] === undefined || o?.[h] === null ? '' : String(o[h])))),
        })
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

/** 内置示例数据集（一键完成「筛选 → 图表 → SQL」全流程演示） */
export const EXAMPLE_DATASETS: Dataset[] = [
  {
    name: '示例·月度销售',
    header: ['月份', '地区', '产品', '销量', '营收(元)'],
    rows: [
      ['2026-01', '华东', '工具箱Pro', '128', '25088'],
      ['2026-01', '华北', '工具箱Pro', '96', '18816'],
      ['2026-01', '华南', '工具箱Lite', '210', '14700'],
      ['2026-02', '华东', '工具箱Pro', '142', '27832'],
      ['2026-02', '华北', '工具箱Lite', '175', '12250'],
      ['2026-02', '华南', '工具箱Pro', '118', '23128'],
      ['2026-03', '华东', '工具箱Lite', '233', '16310'],
      ['2026-03', '华北', '工具箱Pro', '156', '30576'],
      ['2026-03', '华南', '工具箱Pro', '130', '25480'],
      ['2026-04', '华东', '工具箱Pro', '167', '32732'],
      ['2026-04', '华北', '工具箱Lite', '198', '13860'],
      ['2026-04', '华南', '工具箱Lite', '221', '15470'],
    ],
  },
  {
    name: '示例·渠道访问',
    header: ['渠道', '访问量', '注册数'],
    rows: [
      ['自然搜索', '52000', '1820'],
      ['直接访问', '31000', '940'],
      ['社交媒体', '27500', '1230'],
      ['邮件营销', '8600', '410'],
      ['外部链接', '13400', '520'],
    ],
  },
]
