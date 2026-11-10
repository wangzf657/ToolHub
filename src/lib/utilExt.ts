/** 实用工具批量扩展：数据懒加载缓存 + 画布抠图 + 数独引擎 */

/* ---------- 远端 JSON 数据集（fetch + 模块级缓存） ---------- */

const dataCache = new Map<string, unknown>()

/** 拉取 public/data 下的数据集 JSON，带模块级缓存（整个会话只加载一次） */
export function fetchDataset<T = unknown>(name: string): Promise<T> {
  const hit = dataCache.get(name)
  if (hit) return Promise.resolve(hit as T)
  return fetch(`/data/${name}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`数据集 ${name}.json 加载失败（${r.status}）`)
      return r.json() as Promise<T>
    })
    .then((json) => {
      dataCache.set(name, json)
      return json
    })
}

/* ---------- 色键 flood-fill 抠图（四角取背景色，与抠图工具同思路） ---------- */

/**
 * 对画布做色键抠图：从四角取样背景色并 flood-fill 置透明，
 * 返回仅含前景主体的画布（背景 alpha=0）。无需模型、即时可用。
 */
export function floodFillCutout(src: HTMLCanvasElement, tolerance = 28): HTMLCanvasElement {
  const w = document.createElement('canvas')
  w.width = src.width
  w.height = src.height
  const ctx = w.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0)
  const id = ctx.getImageData(0, 0, w.width, w.height)
  const d = id.data
  const W = w.width
  const H = w.height
  // 四角 5×5 平均色作为背景种子色
  let sr = 0, sg = 0, sb = 0, n = 0
  const sample = (cx: number, cy: number) => {
    for (let y = cy; y < cy + 5 && y < H; y++)
      for (let x = cx; x < cx + 5 && x < W; x++) {
        const i = (y * W + x) * 4
        sr += d[i]!; sg += d[i + 1]!; sb += d[i + 2]!; n++
      }
  }
  sample(0, 0); sample(W - 5, 0); sample(0, H - 5); sample(W - 5, H - 5)
  const br = sr / n, bg = sg / n, bb = sb / n
  const tol = tolerance * 2.2
  const visited = new Uint8Array(W * H)
  const queue = new Int32Array(W * H)
  let head = 0, tail = 0
  const match = (i: number) =>
    Math.abs(d[i]! - br) <= tol && Math.abs(d[i + 1]! - bg) <= tol && Math.abs(d[i + 2]! - bb) <= tol
  for (const [sx, sy] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]] as const) {
    const idx = sy * W + sx
    if (!visited[idx] && match(idx * 4)) { visited[idx] = 1; queue[tail++] = idx }
  }
  while (head < tail) {
    const idx = queue[head++]!
    d[idx * 4 + 3] = 0
    const x = idx % W
    const y = (idx / W) | 0
    if (x > 0 && !visited[idx - 1] && match((idx - 1) * 4)) { visited[idx - 1] = 1; queue[tail++] = idx - 1 }
    if (x < W - 1 && !visited[idx + 1] && match((idx + 1) * 4)) { visited[idx + 1] = 1; queue[tail++] = idx + 1 }
    if (y > 0 && !visited[idx - W] && match((idx - W) * 4)) { visited[idx - W] = 1; queue[tail++] = idx - W }
    if (y < H - 1 && !visited[idx + W] && match((idx + W) * 4)) { visited[idx + W] = 1; queue[tail++] = idx + W }
  }
  ctx.putImageData(id, 0, 0)
  return w
}

/* ---------- 数独引擎 ---------- */

export type SudokuGrid = number[] // 81 格，0 为空

/** 找某格候选值 */
const peers = (i: number): number[] => {
  const r = Math.floor(i / 9), c = i % 9
  const out: number[] = []
  for (let k = 0; k < 9; k++) {
    out.push(r * 9 + k, k * 9 + c)
    out.push(Math.floor(r / 3) * 27 + Math.floor(c / 3) * 3 + Math.floor(k / 3) * 9 + (k % 3))
  }
  return [...new Set(out)].filter((x) => x !== i)
}

/** 求解计数（回溯，最多数到 limit 即停），用于唯一解判定 */
export function countSolutions(grid: SudokuGrid, limit = 2): number {
  const g = [...grid]
  let count = 0
  const rec = (): void => {
    let best = -1, bestCands: number[] = []
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue
      const used = new Set(peers(i).map((p) => g[p]).filter(Boolean))
      const cands = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !used.has(x))
      if (cands.length < bestCands.length || best === -1) { best = i; bestCands = cands }
      if (bestCands.length <= 1) break
    }
    if (best === -1) { count++; return }
    for (const v of bestCands) {
      g[best] = v
      rec()
      g[best] = 0
      if (count >= limit) return
    }
  }
  rec()
  return count
}

/** 求解数独（返回解或 null） */
export function solveSudoku(grid: SudokuGrid): SudokuGrid | null {
  const g = [...grid]
  const rec = (): boolean => {
    let best = -1, bestCands: number[] = []
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue
      const used = new Set(peers(i).map((p) => g[p]).filter(Boolean))
      const cands = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !used.has(x))
      if (cands.length === 0) return false
      if (cands.length < bestCands.length || best === -1) { best = i; bestCands = cands }
      if (bestCands.length <= 1) break
    }
    if (best === -1) return true
    for (const v of bestCands) {
      g[best] = v
      if (rec()) return true
      g[best] = 0
    }
    return false
  }
  return rec() ? g : null
}

const shuffled = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** 生成完整终盘（随机回溯） */
function fullGrid(): SudokuGrid {
  const g: SudokuGrid = new Array(81).fill(0)
  const rec = (): boolean => {
    let i = g.indexOf(0)
    if (i === -1) return true
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const used = new Set(peers(i).map((p) => g[p]).filter(Boolean))
      if (!used.has(v)) {
        g[i] = v
        if (rec()) return true
        g[i] = 0
      }
    }
    return false
  }
  rec()
  return g
}

export type SudokuDifficulty = 'easy' | 'medium' | 'hard'

/** 挖洞法生成唯一解数独；返回 {puzzle, solution} */
export function generateSudoku(diff: SudokuDifficulty): { puzzle: SudokuGrid; solution: SudokuGrid } {
  const solution = fullGrid()
  const puzzle = [...solution]
  const target = diff === 'easy' ? 42 : diff === 'medium' ? 50 : 57 // 需挖掉的格数
  let removed = 0
  for (const i of shuffled([...Array(81).keys()])) {
    if (removed >= target) break
    const keep = puzzle[i]!
    puzzle[i] = 0
    if (countSolutions(puzzle, 2) === 1) removed++
    else puzzle[i] = keep
  }
  return { puzzle, solution }
}

/** 找出所有冲突格（同行/列/宫重复），返回索引集合 */
export function sudokuConflicts(grid: SudokuGrid): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < 81; i++) {
    const v = grid[i]
    if (!v) continue
    for (const p of peers(i)) {
      if (grid[p] === v) { bad.add(i); bad.add(p) }
    }
  }
  return bad
}
