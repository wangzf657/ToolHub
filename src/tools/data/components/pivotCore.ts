/**
 * 透视表核心（纯函数）：多级行字段树构建 + 基数护栏（每级最多 maxKeys 个新键）。
 * 每个节点累计其子树全部数值（行小计）与按列键的数值（单元格/列合计）。
 */
export interface PivotNode {
  key: string
  level: number
  /** 该节点子树的全部数值（含自身叶子） */
  arr: number[]
  /** 列键 → 数值集合（子树累计） */
  colArrs: Map<string, number[]>
  children: Map<string, PivotNode>
}

export interface PivotBuild {
  root: PivotNode
  colKeys: string[]
  /** 每层被截断丢弃的新键合计 */
  truncated: number
  /** 全部列键数（截断前） */
  totalColKeys: number
}

const EMPTY = '（空）'

export function buildPivot(
  rows: string[][],
  rowCols: number[],
  colCol: number,
  valCol: number,
  maxKeys = 200,
): PivotBuild {
  const root: PivotNode = { key: '全部', level: -1, arr: [], colArrs: new Map(), children: new Map() }
  const colKeys: string[] = []
  const colSeen = new Set<string>()
  let truncated = 0
  let totalColKeys = 0

  const accum = (node: PivotNode, v: number, ck: string) => {
    node.arr.push(v)
    let a = node.colArrs.get(ck)
    if (!a) {
      a = []
      node.colArrs.set(ck, a)
    }
    a.push(v)
  }

  for (const r of rows) {
    const ck = colCol >= 0 ? (r[colCol] ?? '').trim() || EMPTY : '全部'
    if (!colSeen.has(ck)) {
      colSeen.add(ck)
      if (colKeys.length < maxKeys) colKeys.push(ck)
      totalColKeys++
    }
    const useCk = colKeys.includes(ck) ? ck : EMPTY
    const vRaw = parseFloat(r[valCol] ?? '')
    const v = Number.isNaN(vRaw) ? 0 : vRaw

    let node = root
    accum(node, v, useCk)
    for (let li = 0; li < rowCols.length; li++) {
      const k = (r[rowCols[li]] ?? '').trim() || EMPTY
      let child = node.children.get(k)
      if (!child) {
        // 基数护栏：每层新键超过 maxKeys 时丢弃（计入 truncated）
        if (node === root || node.children.size < maxKeys) {
          child = { key: k, level: li, arr: [], colArrs: new Map(), children: new Map() }
          node.children.set(k, child)
        } else {
          truncated++
          break
        }
      }
      node = child
      accum(node, v, useCk)
    }
  }

  return { root, colKeys, truncated, totalColKeys }
}

/** DFS 展平树为渲染行（缩进层级 + 每行即该子树小计） */
export interface FlatRow {
  key: string
  level: number
  node: PivotNode
  isLeaf: boolean
}

export function flattenTree(node: PivotNode, maxRows: number): { rows: FlatRow[]; truncated: number } {
  const out: FlatRow[] = []
  const walk = (n: PivotNode): boolean => {
    for (const child of n.children.values()) {
      if (out.length >= maxRows) return false
      out.push({ key: child.key, level: child.level, node: child, isLeaf: child.children.size === 0 })
      if (child.children.size && !walk(child)) return false
    }
    return true
  }
  const ok = walk(node)
  return { rows: out, truncated: ok ? 0 : maxRows }
}

/** 统计值列的非数值项个数（数值占比披露） */
export function countNonNumeric(rows: string[][], valCol: number): number {
  let n = 0
  for (const r of rows) {
    const v = (r[valCol] ?? '').trim()
    if (v !== '' && Number.isNaN(Number(v))) n++
  }
  return n
}
