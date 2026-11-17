/**
 * 2048 引擎（纯逻辑，Node 可测）：4×4 合并/生成/终局判定 + 撤销快照。
 * 渲染在组件（DOM 瓦片动画）；移动语义与原版一致（每行每轮每个瓦片只合并一次）。
 */
import { random as defaultRandom, randInt, type Rng } from './rng'

export type Board2048 = number[] // 16 格，行主序，0 为空

export type Dir2048 = 'left' | 'right' | 'up' | 'down'

const ROWS = [...Array(4).keys()].map((r) => [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3])
const COLS = [...Array(4).keys()].map((c) => [c, c + 4, c + 8, c + 12])

/** 单行向左合并：返回 [新行, 得分, 是否移动]（右侧补 0） */
function mergeLine(line: number[]): { line: number[]; gained: number; moved: boolean } {
  const vals = line.filter((v) => v !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      const merged = (vals[i] as number) * 2
      out.push(merged)
      gained += merged
      i++
    } else out.push(vals[i] as number)
  }
  while (out.length < 4) out.push(0)
  return { line: out, gained, moved: out.some((v, i) => v !== line[i]) }
}

const reverse = (arr: number[]) => [...arr].reverse()

/** 一步移动：返回 {board, gained, moved}；board 为新数组，入参不变 */
export function move2048(board: Board2048, dir: Dir2048): { board: Board2048; gained: number; moved: boolean } {
  const next = [...board]
  let gained = 0
  let moved = false
  const groups = dir === 'left' || dir === 'right' ? ROWS : COLS
  for (const g of groups) {
    let line = g.map((i) => next[i]!)
    if (dir === 'right' || dir === 'down') line = reverse(line)
    const r = mergeLine(line)
    gained += r.gained
    moved = moved || r.moved
    let out = r.line
    if (dir === 'right' || dir === 'down') out = reverse(out)
    g.forEach((cellIdx, k) => (next[cellIdx] = out[k]!))
  }
  return { board: next, gained, moved }
}

/** 随机生成一个新数字（90% 2 / 10% 4）到随机空格；无空格返回原盘 */
export function spawnTile(board: Board2048, rng: Rng = defaultRandom): Board2048 {
  const empties = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)
  if (!empties.length) return [...board]
  const next = [...board]
  next[empties[randInt(rng, empties.length)]!] = rng() < 0.9 ? 2 : 4
  return next
}

export const newBoard2048 = (rng: Rng = defaultRandom): Board2048 => spawnTile(spawnTile(Array(16).fill(0), rng), rng)

/** 终局判定：无空格且任意方向都无有效移动 */
export function isGameOver2048(board: Board2048): boolean {
  if (board.some((v) => v === 0)) return false
  return (['left', 'right', 'up', 'down'] as Dir2048[]).every((d) => !move2048(board, d).moved)
}

/** 是否已达成 2048（胜利展示用，游戏可继续） */
export const hasWon2048 = (board: Board2048): boolean => board.some((v) => v >= 2048)
