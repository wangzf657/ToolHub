/**
 * 五子棋 AI Web Worker：主线程零阻塞（需求 R3.2）。
 * Vite 原生 worker 构建（new URL + type: 'module'）；协议 {id, board, me, level} → {id, move}。
 */
import { gomokuBestMove } from './gomokuAI'
import type { GomokuLevel } from './gomokuAI'
import type { GomokuPlayer } from './gomoku'

interface Req {
  id: number
  board: number[]
  me: GomokuPlayer
  level: GomokuLevel
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, board, me, level } = e.data
  const move = gomokuBestMove(Int8Array.from(board), me, { level, budgetMs: 900 })
  ;(self as unknown as Worker).postMessage({ id, move })
}
