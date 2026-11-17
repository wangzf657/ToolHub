/**
 * 五子棋规则引擎：15×15 棋盘、无禁手（长连亦胜）、五连判定与连线收集、邻域候选裁剪。
 * 纯 TS 无 DOM，Node 可测（胜负判定/AI 对局哨兵）；AI 见 gomokuAI.ts。
 */
export const GOMOKU_SIZE = 15
export const GOMOKU_CELLS = GOMOKU_SIZE * GOMOKU_SIZE

/** 1=黑 2=白 0=空（Int8Array 225 格，行主序 idx = y*15+x） */
export type GomokuBoard = Int8Array
export type GomokuPlayer = 1 | 2

/** 四个方向的位移（dx,dy） */
const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

export const cellX = (i: number) => i % GOMOKU_SIZE
export const cellY = (i: number) => Math.floor(i / GOMOKU_SIZE)

/**
 * 判定落子胜负（无禁手规则：五连及以上即胜）。
 * 返回获胜连线（含落点的连续同色格索引，≥5 个），未胜返回 null。
 */
export function winLine(board: GomokuBoard, last: number): number[] | null {
  const p = board[last]!
  if (!p) return null
  const x0 = cellX(last)
  const y0 = cellY(last)
  for (const [dx, dy] of DIRS) {
    const line = [last]
    for (let s = 1; s < 5; s++) {
      const x = x0 + dx * s
      const y = y0 + dy * s
      if (x < 0 || x >= GOMOKU_SIZE || y < 0 || y >= GOMOKU_SIZE) break
      const i = y * GOMOKU_SIZE + x
      if (board[i] !== p) break
      line.push(i)
    }
    for (let s = 1; s < 5; s++) {
      const x = x0 - dx * s
      const y = y0 - dy * s
      if (x < 0 || x >= GOMOKU_SIZE || y < 0 || y >= GOMOKU_SIZE) break
      const i = y * GOMOKU_SIZE + x
      if (board[i] !== p) break
      line.push(i)
    }
    if (line.length >= 5) return line.sort((a, b) => a - b)
  }
  return null
}

/** 棋盘是否还有空点（满盘和局） */
export const boardFull = (board: GomokuBoard): boolean => !board.some((v) => v === 0)

/**
 * 候选落点：已有棋子切比雪夫距离 ≤ radius 的空点（剪枝：225 → 约 20-60）。
 * 空盘返回中心点。
 */
export function candidates(board: GomokuBoard, radius = 2): number[] {
  const out: number[] = []
  let hasStone = false
  const near = new Uint8Array(GOMOKU_CELLS)
  for (let i = 0; i < GOMOKU_CELLS; i++) {
    if (!board[i]) continue
    hasStone = true
    const x = cellX(i)
    const y = cellY(i)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= GOMOKU_SIZE || ny < 0 || ny >= GOMOKU_SIZE) continue
        const j = ny * GOMOKU_SIZE + nx
        if (!board[j]) near[j] = 1
      }
  }
  if (!hasStone) return [Math.floor(GOMOKU_CELLS / 2)]
  for (let i = 0; i < GOMOKU_CELLS; i++) if (near[i]) out.push(i)
  return out
}
