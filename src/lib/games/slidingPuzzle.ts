/**
 * 数字华容道引擎（纯逻辑，Node 可测）：N×N（3/4/5）、随机打乱保证可解（逆序奇偶校验）、
 * 移动与完成判定。渲染在组件（DOM 瓦片）。
 *
 * 可解性判定（滑块难题经典结论）：宽为奇数时逆序数必为偶；宽为偶数时
 * （逆序数 + 空格所在行（从底数起 1 起））奇偶性不变。打乱 = 随机排列 + 奇偶不齐则交换两个非空块。
 */
import { shuffle, type Rng } from './rng'

export type SlidingBoard = number[] // n*n 格，值 1..n²-1，0 为空格

export function solvedBoard(n: number): SlidingBoard {
  return [...Array(n * n - 1).keys()].map((k) => k + 1).concat(0)
}

/** 目标态可解性奇偶（0=偶 1=奇）：逆序数 + 偶宽空格行校正 */
export function boardParity(board: SlidingBoard, n: number): 0 | 1 {
  const tiles = board.filter((v) => v !== 0)
  let inv = 0
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++) if (tiles[i]! > tiles[j]!) inv++
  if (n % 2 === 1) return (inv % 2) as 0 | 1
  const blankRowFromBottom = n - Math.floor(board.indexOf(0) / n)
  return ((inv + blankRowFromBottom) % 2) as 0 | 1
}

/** 随机打乱且保证与目标态同奇偶（可解） */
export function shuffledBoard(n: number, rng: Rng = Math.random): SlidingBoard {
  const goal = solvedBoard(n)
  const goalParity = boardParity(goal, n)
  for (let guard = 0; guard < 100; guard++) {
    const board = shuffle([...goal], rng)
    if (boardParity(board, n) === goalParity) return board
    // 奇偶不齐：交换两个非空块（改变逆序数奇偶）
    const a = board.findIndex((v) => v !== 0)
    const b = board.findIndex((v, i) => v !== 0 && i > a)
    ;[board[a], board[b]] = [board[b]!, board[a]!]
    if (boardParity(board, n) === goalParity) return board
  }
  return [...goal]
}

/** 某块是否与空格相邻（可移动） */
export function canMove(board: SlidingBoard, n: number, i: number): boolean {
  const z = board.indexOf(0)
  const zx = z % n
  const zy = Math.floor(z / n)
  const x = i % n
  const y = Math.floor(i / n)
  return Math.abs(zx - x) + Math.abs(zy - y) === 1
}

/** 移动块（与空格交换）；不可移动返回 false。就地修改 */
export function applyMove(board: SlidingBoard, n: number, i: number): boolean {
  if (!canMove(board, n, i)) return false
  const z = board.indexOf(0)
  ;[board[z], board[i]] = [board[i]!, 0]
  return true
}

export const isSolved = (board: SlidingBoard): boolean =>
  board.every((v, i) => v === (i === board.length - 1 ? 0 : i + 1))
