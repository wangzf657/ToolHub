/**
 * 贪吃蛇引擎（纯逻辑，Node 可测）：固定步进状态机——方向队列、进食增长、撞墙/穿墙、自撞。
 * Canvas 渲染在组件（rAF + 固定 tick 累积器）。
 */
export const SNAKE_W = 21
export const SNAKE_H = 21

export type Dir = 'up' | 'down' | 'left' | 'right'
const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export interface SnakeState {
  /** 蛇身格索引（头在前） */
  snake: number[]
  dir: Dir
  food: number
  score: number
  alive: boolean
  wrap: boolean
  rng: () => number
}

const idx = (x: number, y: number) => y * SNAKE_W + x
export const cellXY = (i: number): [number, number] => [i % SNAKE_W, Math.floor(i / SNAKE_W)]

function randFood(exclude: Set<number>, rng: () => number): number {
  const free: number[] = []
  for (let i = 0; i < SNAKE_W * SNAKE_H; i++) if (!exclude.has(i)) free.push(i)
  return free[Math.floor(rng() * free.length)] ?? 0
}

export function newSnake(wrap: boolean, rng: () => number = Math.random): SnakeState {
  const snake = [idx(10, 10), idx(9, 10), idx(8, 10)]
  return { snake, dir: 'right', food: randFood(new Set(snake), rng), score: 0, alive: true, wrap, rng }
}

/** 方向入队语义的直接setter：禁止 180° 掉头（同向重复无效果） */
export function turn(state: SnakeState, dir: Dir): void {
  if (!state.alive || dir === OPPOSITE[state.dir] || dir === state.dir) return
  state.dir = dir
}

/**
 * 推进一步（吃食 +3 分并增长；穿墙由 wrap 决定；撞墙/自撞死亡）。
 * 就地更新 state；返回本步事件（ate / died / null）。
 */
export function tickSnake(state: SnakeState): 'ate' | 'died' | null {
  if (!state.alive) return null
  const [dx, dy] = DIRS[state.dir]
  const [hx, hy] = cellXY(state.snake[0]!)
  let nx = hx + dx
  let ny = hy + dy
  if (nx < 0 || nx >= SNAKE_W || ny < 0 || ny >= SNAKE_H) {
    if (!state.wrap) {
      state.alive = false
      return 'died'
    }
    nx = (nx + SNAKE_W) % SNAKE_W
    ny = (ny + SNAKE_H) % SNAKE_H
  }
  const head = idx(nx, ny)
  const ate = head === state.food
  // 自撞判定：尾部本步若不增长会移出，需排除尾格
  const body = ate ? state.snake : state.snake.slice(0, -1)
  if (body.includes(head)) {
    state.alive = false
    return 'died'
  }
  state.snake.unshift(head)
  if (ate) {
    state.score += 3
    state.food = randFood(new Set(state.snake), state.rng)
    return 'ate'
  }
  state.snake.pop()
  return null
}
