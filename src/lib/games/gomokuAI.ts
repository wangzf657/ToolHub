/**
 * 五子棋 AI：5 格滑窗威胁评分 + 切比雪夫 ≤2 候选裁剪 + α-β 剪枝 + 迭代加深 + 时间预算。
 * 三档难度：入门（贪心 + 受控失误）/ 中级（深度 2）/ 困难（迭代加深至深度 4 + 成五/堵五强制捷径）。
 * 算法思路参考公开教程（棋型评估/候选裁剪/α-β），实现原创；纯 TS，Node 可测（vs 随机 20 局哨兵）。
 */
import { GOMOKU_SIZE, candidates, cellX, cellY, type GomokuBoard, type GomokuPlayer } from './gomoku'
import { random as defaultRandom, pick, type Rng } from './rng'

export type GomokuLevel = 'easy' | 'medium' | 'hard'

const FIVE = 1_000_000
/** 5 格滑窗同色子数得分（窗口含对方子/出界 = 死窗 0 分）；等比代差自然覆盖跳三/跳四 */
const WINDOW_SCORE = [0, 1, 12, 120, 1200, FIVE]
/** 对方威胁的防守折扣（略 >1：堵五优先于自家做四） */
const DEFENSE = 1.05

const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

/** 假设 player 落在 i，该点的滑窗威胁总分（不改盘面；≥FIVE 即该点成五） */
export function scorePoint(board: GomokuBoard, i: number, player: GomokuPlayer): number {
  const opp = player === 1 ? 2 : 1
  const x0 = cellX(i)
  const y0 = cellY(i)
  let total = 0
  for (const [dx, dy] of DIRS) {
    for (let off = -4; off <= 0; off++) {
      let own = 0
      let dead = false
      for (let k = 0; k < 5; k++) {
        const x = x0 + dx * (off + k)
        const y = y0 + dy * (off + k)
        if (x < 0 || x >= GOMOKU_SIZE || y < 0 || y >= GOMOKU_SIZE) {
          dead = true
          break
        }
        const v = board[y * GOMOKU_SIZE + x]!
        if (v === opp) {
          dead = true
          break
        }
        if (v === player || off + k === 0) own++
      }
      if (!dead) total += WINDOW_SCORE[own]!
    }
  }
  return total
}

/** 综合落点分：进攻 + 防守（抢占对方要点） */
function moveScore(board: GomokuBoard, i: number, me: GomokuPlayer): number {
  const opp = (me === 1 ? 2 : 1) as GomokuPlayer
  return scorePoint(board, i, me) + scorePoint(board, i, opp) * DEFENSE
}

/** 盘面威胁评估：全部候选点滑窗分之和（叶节点静态评估；成五点自带 FIVE 级权重） */
function threatSum(board: GomokuBoard, player: GomokuPlayer): number {
  let s = 0
  for (const i of candidates(board)) s += scorePoint(board, i, player)
  return s
}

interface SearchCtx {
  board: GomokuBoard
  deadline: number
  nodes: number
  aborted: boolean
}

/** 当前节点候选（综合分降序取前 K）；α-β 依赖排序剪枝 */
function genMoves(ctx: SearchCtx, me: GomokuPlayer, k: number): number[] {
  const opp = (me === 1 ? 2 : 1) as GomokuPlayer
  const scored = candidates(ctx.board).map((i) => {
    const mine = scorePoint(ctx.board, i, me)
    return { i, s: mine + scorePoint(ctx.board, i, opp) * DEFENSE }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, k).map((x) => x.i)
}

const WIN = 1e9
const dummy = { move: 0 }

/** α-β（negamax）：返回 me 视角分值；超预算置 ctx.aborted 并中断 */
function negamax(ctx: SearchCtx, me: GomokuPlayer, depth: number, alpha: number, beta: number, best: { move: number }): number {
  const opp = (me === 1 ? 2 : 1) as GomokuPlayer
  if (depth <= 0) return threatSum(ctx.board, me) - threatSum(ctx.board, opp) * 1.1
  ctx.nodes++
  const moves = genMoves(ctx, me, depth >= 3 ? 10 : 8)
  if (moves.length === 0) return threatSum(ctx.board, me) - threatSum(ctx.board, opp) * 1.1
  let bestVal = -Infinity
  for (const i of moves) {
    const winNow = scorePoint(ctx.board, i, me) >= FIVE
    ctx.board[i] = me
    const val = winNow ? WIN : -negamax(ctx, opp, depth - 1, -beta, -alpha, dummy)
    ctx.board[i] = 0
    if (val > bestVal) {
      bestVal = val
      best.move = i
    }
    if (val > alpha) alpha = val
    if (alpha >= beta) break
    if ((ctx.nodes & 63) === 0 && Date.now() > ctx.deadline) {
      ctx.aborted = true
      break
    }
  }
  return bestVal
}

export interface GomokuAIOptions {
  level?: GomokuLevel
  /** 单步时间预算（ms），超时返回已完成迭代层最优 */
  budgetMs?: number
  /** 入门档失误随机源（测试注入可种子随机） */
  rng?: Rng
}

/**
 * 求最佳落点（不改入参 board）。
 * 全档位强制捷径：能成五立即成五、对方成五点必堵；入门=贪心+受控失误，中级=深度 2，困难=迭代加深至深度 4。
 */
export function gomokuBestMove(board: GomokuBoard, me: GomokuPlayer, opts: GomokuAIOptions = {}): number {
  const level = opts.level ?? 'hard'
  const rng = opts.rng ?? defaultRandom
  const work = Int8Array.from(board)
  const cands = candidates(work)
  if (cands.length === 1) return cands[0]!
  const opp = (me === 1 ? 2 : 1) as GomokuPlayer

  // 强制捷径（保底正确性）
  const myFive = cands.find((i) => scorePoint(work, i, me) >= FIVE)
  if (myFive !== undefined) return myFive
  const oppFive = cands.find((i) => scorePoint(work, i, opp) >= FIVE)
  if (oppFive !== undefined) return oppFive

  if (level === 'easy') {
    // 贪心综合分 + 受控失误：35% 概率从前 3 随机取
    const scored = cands
      .map((i) => ({ i, s: moveScore(work, i, me) }))
      .sort((a, b) => b.s - a.s)
    if (rng() < 0.35 && scored.length >= 3) return pick(scored.slice(0, 3).map((x) => x.i), rng)
    return scored[0]!.i
  }

  const budget = opts.budgetMs ?? (level === 'hard' ? 900 : 350)
  const ctx: SearchCtx = { board: work, deadline: Date.now() + budget, nodes: 0, aborted: false }
  let bestMove = cands[0]!
  for (const depth of level === 'hard' ? [1, 2, 4] : [1, 2]) {
    ctx.aborted = false
    const best = { move: -1 }
    negamax(ctx, me, depth, -Infinity, Infinity, best)
    if (!ctx.aborted && best.move >= 0) bestMove = best.move
    if (ctx.aborted || Date.now() > ctx.deadline) break
  }
  return bestMove
}
