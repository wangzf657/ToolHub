/**
 * 数独引擎（V1.2：自 utilExt.ts 迁出并扩展）——4×4（2×2 宫）与 9×9（3×3 宫）双尺寸。
 * 终盘生成 + 挖洞唯一解（解计数器逐格校验）+ 技巧阶梯分级（sudokuGrade.ts）+ 生成预算降级。
 * 纯 TS 无 DOM，Node 可测（scripts/tests/run-games-tests.mjs 批量哨兵）。
 */
import { shuffle, type Rng } from './rng'
import { gradeTier } from './sudokuGrade'

export type SudokuGrid = number[] // N*N 格，0 为空
/** 出题档位：4 阶 / 9 阶简单 / 中级 / 高级（需求 R2.1 四档） */
export type SudokuLevel = 'x4' | 'easy' | 'medium' | 'hard'

export interface SudokuMeta {
  n: number // 边长 4 或 9
  box: number // 宫边长 2 或 3
  cells: number
  fullMask: number
}

export const SUDOKU_META: Record<number, SudokuMeta> = {
  4: { n: 4, box: 2, cells: 16, fullMask: 0b1111 },
  9: { n: 9, box: 3, cells: 81, fullMask: 0x1ff },
}

const bitOf = (v: number) => (v ? 1 << (v - 1) : 0)

/** 某格在当前盘面的候选位掩码（同行/列/宫已用数字排除） */
function candMask(g: SudokuGrid, m: SudokuMeta, i: number): number {
  const { n, box } = m
  const r = (i / n) | 0
  const c = i % n
  let used = 0
  for (let k = 0; k < n; k++) used |= bitOf(g[r * n + k]!) | bitOf(g[k * n + c]!)
  const br = ((r / box) | 0) * box
  const bc = ((c / box) | 0) * box
  for (let dr = 0; dr < box; dr++)
    for (let dc = 0; dc < box; dc++) used |= bitOf(g[(br + dr) * n + (bc + dc)]!)
  return m.fullMask & ~used
}

/** 求解数独（MRV 回溯），返回解的副本或 null（无解/多解只回一个） */
export function solveSudoku(grid: SudokuGrid, size = 9): SudokuGrid | null {
  const m = SUDOKU_META[size]!
  const g = [...grid]
  const rec = (): boolean => {
    let best = -1
    let bestMask = 0
    let bestCount = m.n + 1
    for (let i = 0; i < m.cells; i++) {
      if (g[i]) continue
      const mask = candMask(g, m, i)
      const cnt = popcount(mask)
      if (cnt === 0) return false
      if (cnt < bestCount) {
        best = i
        bestMask = mask
        bestCount = cnt
        if (cnt === 1) break
      }
    }
    if (best === -1) return true
    for (let d = 1; d <= m.n; d++) {
      if (bestMask & (1 << (d - 1))) {
        g[best] = d
        if (rec()) return true
        g[best] = 0
      }
    }
    return false
  }
  return rec() ? g : null
}

/** 解计数（到 limit 即停），唯一解判定用 */
export function countSolutions(grid: SudokuGrid, limit = 2, size = 9): number {
  const m = SUDOKU_META[size]!
  const g = [...grid]
  let count = 0
  const rec = (): boolean => {
    let best = -1
    let bestMask = 0
    let bestCount = m.n + 1
    for (let i = 0; i < m.cells; i++) {
      if (g[i]) continue
      const mask = candMask(g, m, i)
      const cnt = popcount(mask)
      if (cnt === 0) return false
      if (cnt < bestCount) {
        best = i
        bestMask = mask
        bestCount = cnt
        if (cnt === 1) break
      }
    }
    if (best === -1) {
      count++
      return count >= limit
    }
    for (let d = 1; d <= m.n; d++) {
      if (bestMask & (1 << (d - 1))) {
        g[best] = d
        if (rec()) return true
        g[best] = 0
      }
    }
    return false
  }
  rec()
  return count
}

export function popcount(x: number): number {
  let c = 0
  while (x) {
    x &= x - 1
    c++
  }
  return c
}

/** 随机终盘（回溯填满） */
function fullGrid(m: SudokuMeta, rng: Rng): SudokuGrid {
  const g: SudokuGrid = new Array(m.cells).fill(0)
  const digits = Array.from({ length: m.n }, (_, k) => k + 1)
  const rec = (): boolean => {
    const i = g.indexOf(0)
    if (i === -1) return true
    const mask = candMask(g, m, i)
    for (const d of shuffle([...digits], rng)) {
      if (mask & (1 << (d - 1))) {
        g[i] = d
        if (rec()) return true
        g[i] = 0
      }
    }
    return false
  }
  rec()
  return g
}

/**
 * 挖洞器：随机逐格移除并即时校验唯一解，直到提示数 ≤ 目标或两轮耗尽/超时。
 * 单步内核（step() 挖一格）：同步路径直接循环驱动，UI 异步路径每步让出主线程（busy 可刷新）。
 */
function createDigger(solution: SudokuGrid, clueTarget: number, rng: Rng, deadline: number) {
  const size = solution.length === 16 ? 4 : 9
  const m = SUDOKU_META[size]!
  const puzzle = [...solution]
  let clues = m.cells
  // 两轮随机顺序（第二轮补挖第一轮因顺序错过的高难度格）
  const orders = [shuffle([...Array(m.cells).keys()], rng), shuffle([...Array(m.cells).keys()], rng)]
  let pass = 0
  let idx = 0
  return {
    /** 挖一格；返回 false 表示已到目标/耗尽 */
    step(): boolean {
      if (clues <= clueTarget || Date.now() > deadline || pass >= orders.length) return false
      const order = orders[pass]!
      while (idx < order.length) {
        const i = order[idx++]!
        if (!puzzle[i]) continue
        const keep = puzzle[i]!
        puzzle[i] = 0
        if (countSolutions(puzzle, 2, m.n) === 1) {
          clues--
          return true
        }
        puzzle[i] = keep
      }
      pass++
      idx = 0
      return pass < orders.length
    },
    result: () => ({ puzzle, clues }),
  }
}

/** 技巧档位 → 展示档位（诚实口径：0=简单 1-2=中级 3-4=高级） */
export function tierToLevel(tier: number): SudokuLevel {
  return tier <= 0 ? 'easy' : tier <= 2 ? 'medium' : 'hard'
}

export interface SudokuPuzzle {
  puzzle: SudokuGrid
  solution: SudokuGrid
  size: number
  clues: number
  /** 实际所需最高技巧档位（sudokuGrade 阶梯） */
  tier: number
  /** 诚实档位（预算内未达目标门槛时按实际技巧降级标注） */
  level: SudokuLevel
  /** 请求档位未达成（降级接受） */
  degraded: boolean
}

const LEVEL_TARGET: Record<SudokuLevel, { size: number; clues: number; minTier: number; maxTier: number; maxClues: number }> = {
  // 4 阶：独立小盘，单档；目标 6 提示（4×4 唯一解常见 4-8 提示）
  x4: { size: 4, clues: 6, minTier: 0, maxTier: 4, maxClues: 8 },
  // 9 阶：提示数区间 + 技巧门槛双口径（需求 §3.2）
  easy: { size: 9, clues: 40, minTier: 0, maxTier: 0, maxClues: 45 },
  medium: { size: 9, clues: 32, minTier: 1, maxTier: 2, maxClues: 34 },
  hard: { size: 9, clues: 27, minTier: 3, maxTier: 4, maxClues: 30 },
}

/** 单次生成尝试：终盘 → 挖洞 → 技巧分级，装配 SudokuPuzzle（未达标时如实降级标注） */
function assemble(
  level: SudokuLevel,
  t: { size: number; minTier: number; maxTier: number; maxClues: number },
  solution: SudokuGrid,
  puzzle: SudokuGrid,
  clues: number,
): SudokuPuzzle {
  const tier = gradeTier(puzzle, t.size)
  const item: SudokuPuzzle = { puzzle, solution, size: t.size, clues, tier, level, degraded: false }
  if (tier >= t.minTier && tier <= t.maxTier && clues <= t.maxClues) return item
  item.level = tierToLevel(tier) === level ? level : tierToLevel(tier)
  item.degraded = true
  return item
}

/** 未达标候选项的接近度（越小越好） */
const distTo = (t: { minTier: number; maxClues: number }, p: SudokuPuzzle) =>
  Math.abs(p.tier - t.minTier) * 4 + Math.max(0, p.clues - t.maxClues)

/**
 * 生成唯一解数独（同步版，Node 测试用）。预算内未达技巧门槛时降级接受并如实标注。
 */
export function generateSudoku(level: SudokuLevel, opts: { rng?: Rng; budgetMs?: number } = {}): SudokuPuzzle {
  const rng = opts.rng ?? Math.random
  const t = LEVEL_TARGET[level]!
  const m = SUDOKU_META[t.size]!
  const deadline = Date.now() + (opts.budgetMs ?? (t.size === 4 ? 300 : level === 'hard' ? 1500 : 900))
  let best: SudokuPuzzle | null = null
  for (let attempt = 0; attempt < 8; attempt++) {
    const solution = fullGrid(m, rng)
    const digger = createDigger(solution, t.clues, rng, deadline)
    while (digger.step());
    const { puzzle, clues } = digger.result()
    const item = assemble(level, t, solution, puzzle, clues)
    if (!item.degraded) return item
    if (!best || distTo(t, item) < distTo(t, best)) best = item
    if (Date.now() > deadline) break
  }
  return best!
}

/**
 * UI 出题：异步分片（挖洞步间让出主线程刷新 busy 提示，需求 R2 验收 P95 ≤ 2s 且全程 busy）。
 */
export async function generateSudokuAsync(
  level: SudokuLevel,
  opts: { budgetMs?: number; onProgress?: (attempt: number) => void } = {},
): Promise<SudokuPuzzle> {
  const t = LEVEL_TARGET[level]!
  const m = SUDOKU_META[t.size]!
  const deadline = Date.now() + (opts.budgetMs ?? (t.size === 4 ? 500 : level === 'hard' ? 2000 : 1200))
  const step = () => new Promise<void>((r) => setTimeout(r, 0))
  let best: SudokuPuzzle | null = null
  for (let attempt = 0; attempt < 8; attempt++) {
    opts.onProgress?.(attempt)
    const solution = fullGrid(m, Math.random)
    const digger = createDigger(solution, t.clues, Math.random, deadline)
    // 每 5 步让出一次主线程：浏览器对嵌套 setTimeout 有 4ms 节流，逐步让出会把
    // 高级档拖慢一个数量级；5 步一批兼顾响应性与速度（busy 动画为合成器动画不受影响）
    let steps = 0
    while (digger.step()) if (++steps % 5 === 0) await step()
    const { puzzle, clues } = digger.result()
    const item = assemble(level, t, solution, puzzle, clues)
    if (!item.degraded) return item
    if (!best || distTo(t, item) < distTo(t, best)) best = item
    if (Date.now() > deadline) break
  }
  return best!
}

/** 冲突格集合（同行/列/宫重复），作答期错误检查用 */
export function sudokuConflicts(grid: SudokuGrid, size = 9): Set<number> {
  const m = SUDOKU_META[size]!
  const bad = new Set<number>()
  const { n, box } = m
  const checkUnit = (cells: number[]) => {
    const seen = new Map<number, number>()
    for (const i of cells) {
      const v = grid[i]
      if (!v) continue
      if (seen.has(v)) {
        bad.add(i)
        bad.add(seen.get(v)!)
      } else seen.set(v, i)
    }
  }
  for (let r = 0; r < n; r++) checkUnit(Array.from({ length: n }, (_, k) => r * n + k))
  for (let c = 0; c < n; c++) checkUnit(Array.from({ length: n }, (_, k) => k * n + c))
  for (let br = 0; br < n; br += box)
    for (let bc = 0; bc < n; bc += box) {
      const cells: number[] = []
      for (let dr = 0; dr < box; dr++) for (let dc = 0; dc < box; dc++) cells.push((br + dr) * n + (bc + dc))
      checkUnit(cells)
    }
  return bad
}

/** 盘面完成判定：无空格且无冲突 */
export function sudokuComplete(grid: SudokuGrid, size = 9): boolean {
  if (grid.some((v) => !v)) return false
  return sudokuConflicts(grid, size).size === 0
}
