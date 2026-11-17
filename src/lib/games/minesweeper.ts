/**
 * 扫雷引擎（纯逻辑，Node 可测）：三级规格、首开安全（首点及邻域无雷）、洪泛开格、
 * 插旗、剩余雷数与胜负判定。渲染在组件（DOM 网格）。
 */
import { shuffle, type Rng } from './rng'

export interface MsLevelDef {
  id: string
  label: string
  w: number
  h: number
  mines: number
}

export const MS_LEVELS: MsLevelDef[] = [
  { id: 'beginner', label: '初级 9×9 · 10 雷', w: 9, h: 9, mines: 10 },
  { id: 'intermediate', label: '中级 16×16 · 40 雷', w: 16, h: 16, mines: 40 },
  { id: 'expert', label: '高级 30×16 · 99 雷', w: 30, h: 16, mines: 99 },
]

export interface MinesweeperState {
  w: number
  h: number
  mines: number
  mine: Uint8Array
  open: Uint8Array
  flag: Uint8Array
  adj: Uint8Array
  started: boolean
  boom: boolean // 踩雷败局
  won: boolean
  rng: Rng
}

export function neighbors(w: number, h: number, i: number): number[] {
  const x = i % w
  const y = Math.floor(i / w)
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      out.push(ny * w + nx)
    }
  return out
}

export function createMinesweeper(w: number, h: number, mines: number, rng: Rng = Math.random): MinesweeperState {
  return {
    w,
    h,
    mines,
    mine: new Uint8Array(w * h),
    open: new Uint8Array(w * h),
    flag: new Uint8Array(w * h),
    adj: new Uint8Array(w * h),
    started: false,
    boom: false,
    won: false,
    rng,
  }
}

/** 布雷：避开首开安全区（首点及其 8 邻域），雷数超出可行域时退化为仅避开首点 */
function placeMines(s: MinesweeperState, safeIdx: number): void {
  const n = s.w * s.h
  const safe = new Set<number>([safeIdx, ...neighbors(s.w, s.h, safeIdx)])
  let pool = [...Array(n).keys()].filter((i) => !safe.has(i))
  if (pool.length < s.mines) pool = [...Array(n).keys()].filter((i) => i !== safeIdx)
  shuffle(pool, s.rng)
  for (let k = 0; k < s.mines && k < pool.length; k++) s.mine[pool[k]!] = 1
  for (let i = 0; i < n; i++) {
    if (s.mine[i]) continue
    s.adj[i] = neighbors(s.w, s.h, i).filter((p) => s.mine[p]).length
  }
}

/** 洪泛开格：0 邻格自动展开邻域（BFS） */
function floodOpen(s: MinesweeperState, start: number): void {
  const queue = [start]
  while (queue.length) {
    const i = queue.pop()!
    if (s.flag[i] || s.open[i]) continue
    s.open[i] = 1
    if (s.adj[i] === 0 && !s.mine[i]) {
      for (const p of neighbors(s.w, s.h, i)) if (!s.open[p]) queue.push(p)
    }
  }
}

function checkWin(s: MinesweeperState): void {
  for (let i = 0; i < s.w * s.h; i++) {
    if (!s.mine[i] && !s.open[i]) return
  }
  s.won = true
}

/**
 * 开格：首开自动布雷（首开安全）；踩雷 → 败局并揭开全部雷；否则洪泛展开并判胜。
 * 已开格/旗格忽略。
 */
export function openCell(s: MinesweeperState, i: number): void {
  if (s.open[i] || s.flag[i] || s.boom || s.won) return
  if (!s.started) {
    placeMines(s, i)
    s.started = true
  }
  if (s.mine[i]) {
    s.boom = true
    for (let k = 0; k < s.mine.length; k++) if (s.mine[k]) s.open[k] = 1
    return
  }
  floodOpen(s, i)
  checkWin(s)
}

/** 插旗切换（未开格上）；返回切换后该格是否为旗 */
export function toggleFlag(s: MinesweeperState, i: number): boolean {
  if (s.open[i] || s.boom || s.won) return false
  s.flag[i] = s.flag[i] ? 0 : 1
  return s.flag[i] === 1
}

/** 剩余雷数 = 总雷 − 旗数（可为负，表示多插） */
export const minesLeft = (s: MinesweeperState): number => s.mines - [...s.flag].reduce((a, b) => a + b, 0)

/** 重开（保留规格与随机源） */
export function resetMinesweeper(s: MinesweeperState): MinesweeperState {
  return createMinesweeper(s.w, s.h, s.mines, s.rng)
}
