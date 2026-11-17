/**
 * 数独技巧阶梯分级器（需求 §3.2「技巧门槛」口径）：
 * 逻辑求解器按阶梯尝试——0=唯一候选法（Naked/Hidden Single）→ 1=区块锁定（Locked Candidates）
 * → 2=显隐性数对（Naked/Hidden Pair）→ 3=X-Wing；全部停滞仍空 → 4（需要链/回溯等更高级技巧）。
 * 返回「解开该题所必需的最高档位」，供出题分级与诚实降级标注。
 */
import { SUDOKU_META, popcount, type SudokuGrid } from './sudoku'

interface Ctx {
  n: number
  box: number
  cells: number
  grid: SudokuGrid
  cands: Uint16Array
  rowUnits: number[][]
  colUnits: number[][]
  boxUnits: number[][]
  peers: number[][]
  empties: number
  contradiction: boolean
}

const bit = (d: number) => 1 << (d - 1)
const digitOf = (mask: number) => 31 - Math.clz32(mask & -mask) + 1 // 最低位对应数字

function makeCtx(puzzle: SudokuGrid, size: number): Ctx {
  const m = SUDOKU_META[size]!
  const { n, box, cells } = m
  const grid = [...puzzle]
  const cands = new Uint16Array(cells)
  const rowUnits: number[][] = []
  const colUnits: number[][] = []
  const boxUnits: number[][] = []
  for (let r = 0; r < n; r++) rowUnits.push(Array.from({ length: n }, (_, k) => r * n + k))
  for (let c = 0; c < n; c++) colUnits.push(Array.from({ length: n }, (_, k) => k * n + c))
  for (let br = 0; br < n; br += box)
    for (let bc = 0; bc < n; bc += box) {
      const u: number[] = []
      for (let dr = 0; dr < box; dr++) for (let dc = 0; dc < box; dc++) u.push((br + dr) * n + (bc + dc))
      boxUnits.push(u)
    }
  const units = [...rowUnits, ...colUnits, ...boxUnits]
  const peers: number[][] = []
  for (let i = 0; i < cells; i++) {
    const set = new Set<number>()
    for (const u of units) if (u.includes(i)) for (const p of u) if (p !== i) set.add(p)
    peers.push([...set])
  }
  const ctx: Ctx = { n, box, cells, grid, cands, rowUnits, colUnits, boxUnits, peers, empties: 0, contradiction: false }
  ctx.empties = grid.filter((v) => !v).length
  for (let i = 0; i < cells; i++) {
    if (grid[i]) continue
    let used = 0
    for (const p of peers[i]!) if (grid[p]) used |= bit(grid[p]!)
    cands[i]! = m.fullMask & ~used
  }
  return ctx
}

function fill(ctx: Ctx, i: number, v: number): void {
  ctx.grid[i] = v
  ctx.cands[i] = 0
  ctx.empties--
  for (const p of ctx.peers[i]!) {
    if (ctx.grid[p]) continue
    const after = ctx.cands[p]! & ~bit(v)
    if (after !== ctx.cands[p]!) {
      ctx.cands[p] = after
      if (after === 0) ctx.contradiction = true
    }
  }
}

/** 消候选：targets 空格去掉数字 d，返回是否有变化 */
function eliminate(ctx: Ctx, targets: number[], d: number): boolean {
  const b = bit(d)
  let hit = false
  for (const i of targets) {
    if (ctx.grid[i]) continue
    const after = ctx.cands[i]! & ~b
    if (after !== ctx.cands[i]!) {
      ctx.cands[i] = after
      hit = true
      if (after === 0) ctx.contradiction = true
    }
  }
  return hit
}

/** 裸唯一候选：某空格候选只剩一个 */
function nakedSingle(ctx: Ctx): boolean {
  let changed = false
  for (let i = 0; i < ctx.cells; i++) {
    if (ctx.grid[i] || !ctx.cands[i]) continue
    if (popcount(ctx.cands[i]!) === 1) {
      fill(ctx, i, digitOf(ctx.cands[i]!))
      changed = true
      if (ctx.contradiction) return changed
    }
  }
  return changed
}

/** 隐唯一候选：某单元内某数字只剩一个可放位置 */
function hiddenSingle(ctx: Ctx): boolean {
  let changed = false
  const all = [...ctx.rowUnits, ...ctx.colUnits, ...ctx.boxUnits]
  for (const u of all) {
    for (let d = 1; d <= ctx.n; d++) {
      if (u.some((i) => ctx.grid[i] === d)) continue
      const spots = u.filter((i) => !ctx.grid[i] && ctx.cands[i]! & bit(d))
      if (spots.length === 1) {
        fill(ctx, spots[0]!, d)
        changed = true
        if (ctx.contradiction) return changed
      }
    }
  }
  return changed
}

/** 区块锁定：宫内候选共行/列 → 消行/列其余（pointing）；行/列候选共宫 → 消宫其余（claiming） */
function lockedCandidates(ctx: Ctx): boolean {
  let changed = false
  const { n, box } = ctx
  for (let d = 1; d <= n; d++) {
    const b = bit(d)
    // claiming：行 → 宫
    for (const u of ctx.rowUnits) {
      const spots = u.filter((i) => !ctx.grid[i] && ctx.cands[i]! & b)
      if (spots.length < 2 || spots.length > box * box) continue
      const boxIds = new Set(spots.map((i) => Math.floor(Math.floor(i / n) / box) * box + Math.floor((i % n) / box)))
      if (boxIds.size !== 1) continue
      const boxId = boxIds.values().next().value as number
      const bu = ctx.boxUnits[boxId]!
      if (eliminate(ctx, bu.filter((i) => !spots.includes(i)), d)) changed = true
    }
    // claiming：列 → 宫
    for (const u of ctx.colUnits) {
      const spots = u.filter((i) => !ctx.grid[i] && ctx.cands[i]! & b)
      if (spots.length < 2 || spots.length > box * box) continue
      const boxIds = new Set(spots.map((i) => Math.floor(Math.floor(i / n) / box) * box + Math.floor((i % n) / box)))
      if (boxIds.size !== 1) continue
      const boxId = boxIds.values().next().value as number
      const bu = ctx.boxUnits[boxId]!
      if (eliminate(ctx, bu.filter((i) => !spots.includes(i)), d)) changed = true
    }
    // pointing：宫 → 行/列
    for (const u of ctx.boxUnits) {
      const spots = u.filter((i) => !ctx.grid[i] && ctx.cands[i]! & b)
      if (spots.length < 2 || spots.length > box) continue
      const rows = new Set(spots.map((i) => Math.floor(i / n)))
      const cols = new Set(spots.map((i) => i % n))
      if (rows.size === 1) {
        const r = rows.values().next().value as number
        if (eliminate(ctx, ctx.rowUnits[r]!.filter((i) => !spots.includes(i)), d)) changed = true
      } else if (cols.size === 1) {
        const c = cols.values().next().value as number
        if (eliminate(ctx, ctx.colUnits[c]!.filter((i) => !spots.includes(i)), d)) changed = true
      }
    }
  }
  return changed
}

/** 显数对：单元内两格候选相同且各恰两值 → 消单元内其余格这两值 */
function nakedPair(ctx: Ctx): boolean {
  let changed = false
  for (const u of [...ctx.rowUnits, ...ctx.colUnits, ...ctx.boxUnits]) {
    const two = u.filter((i) => !ctx.grid[i] && ctx.cands[i] && popcount(ctx.cands[i]!) === 2)
    for (let a = 0; a < two.length; a++)
      for (let b = a + 1; b < two.length; b++) {
        const ma = ctx.cands[two[a]!]!
        if (ma !== ctx.cands[two[b]!]!) continue
        // 数对两值从单元内其余格候选中消去
        const rest = u.filter((i) => i !== two[a] && i !== two[b])
        for (let d = 1; d <= ctx.n; d++) {
          if (!(ma & bit(d))) continue
          if (eliminate(ctx, rest, d)) changed = true
        }
      }
  }
  return changed
}

/** 隐数对：单元内两数字恰好只出现在相同两格 → 该两格候选收敛为这两值 */
function hiddenPair(ctx: Ctx): boolean {
  let changed = false
  for (const u of [...ctx.rowUnits, ...ctx.colUnits, ...ctx.boxUnits]) {
    const pos: number[][] = []
    for (let d = 1; d <= ctx.n; d++) {
      if (u.some((i) => ctx.grid[i] === d)) {
        pos.push([])
        continue
      }
      pos.push(u.filter((i) => !ctx.grid[i] && ctx.cands[i]! & bit(d)))
    }
    for (let d1 = 1; d1 <= ctx.n; d1++)
      for (let d2 = d1 + 1; d2 <= ctx.n; d2++) {
        const a = pos[d1 - 1]!
        const b = pos[d2 - 1]!
        if (a.length !== 2 || b.length !== 2) continue
        if (a[0] !== b[0] || a[1] !== b[1]) continue
        const mask = bit(d1) | bit(d2)
        for (const i of a) {
          const after = ctx.cands[i]! & mask
          if (after !== ctx.cands[i]!) {
            ctx.cands[i] = after
            changed = true
          }
        }
      }
  }
  return changed
}

/** X-Wing：某数字在两行（列）的候选恰好落在相同两列（行）→ 消其余行（列）该数字 */
function xWing(ctx: Ctx): boolean {
  let changed = false
  const n = ctx.n
  for (let d = 1; d <= n; d++) {
    const b = bit(d)
    // 行 → 候选列
    const rowCols = ctx.rowUnits.map((u) => u.filter((i) => !ctx.grid[i] && ctx.cands[i]! & b).map((i) => i % n))
    for (let r1 = 0; r1 < n; r1++) {
      if (rowCols[r1]!.length !== 2) continue
      for (let r2 = r1 + 1; r2 < n; r2++) {
        if (rowCols[r2]!.length !== 2) continue
        if (rowCols[r1]![0] !== rowCols[r2]![0] || rowCols[r1]![1] !== rowCols[r2]![1]) continue
        for (const c of rowCols[r1]!) {
          const targets = ctx.colUnits[c]!.filter((i) => Math.floor(i / n) !== r1 && Math.floor(i / n) !== r2)
          if (eliminate(ctx, targets, d)) changed = true
        }
      }
    }
    // 列 → 候选行
    const colRows = ctx.colUnits.map((u) => u.filter((i) => !ctx.grid[i] && ctx.cands[i]! & b).map((i) => Math.floor(i / n)))
    for (let c1 = 0; c1 < n; c1++) {
      if (colRows[c1]!.length !== 2) continue
      for (let c2 = c1 + 1; c2 < n; c2++) {
        if (colRows[c2]!.length !== 2) continue
        if (colRows[c1]![0] !== colRows[c2]![0] || colRows[c1]![1] !== colRows[c2]![1]) continue
        for (const r of colRows[c1]!) {
          const targets = ctx.rowUnits[r]!.filter((i) => i % n !== c1 && i % n !== c2)
          if (eliminate(ctx, targets, d)) changed = true
        }
      }
    }
  }
  return changed
}

/**
 * 阶梯求解：低档技巧停滞才启用更高档；返回解开所必需的最高档位（0-3），
 * 全部停滞仍有空格 → 4（更高级技巧/回溯）。
 */
export function gradeTier(puzzle: SudokuGrid, size = 9): number {
  const ctx = makeCtx(puzzle, size)
  const techniques: ((ctx: Ctx) => boolean)[][] = [
    [nakedSingle, hiddenSingle],
    [lockedCandidates],
    [nakedPair, hiddenPair],
    [xWing],
  ]
  let used = 0
  let allowed = 0
  let guard = 400
  while (ctx.empties > 0 && !ctx.contradiction && guard-- > 0) {
    let progressed = false
    let any = true
    while (any) {
      any = false
      for (let t = 0; t <= allowed; t++) {
        for (const fn of techniques[t]!) {
          if (fn(ctx)) {
            any = true
            progressed = true
            used = Math.max(used, t)
            if (ctx.empties === 0 || ctx.contradiction) return ctx.contradiction ? 4 : used
          }
        }
      }
    }
    if (!progressed) {
      if (allowed >= 3) return 4
      allowed++
    }
  }
  if (ctx.contradiction) return 4
  return ctx.empties === 0 ? used : 4
}
