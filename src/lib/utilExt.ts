/** 实用工具批量扩展：数据懒加载缓存 + 画布抠图（数独引擎已迁 src/lib/games/sudoku.ts，V1.2） */

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
