/**
 * 游戏引擎共享随机源：mulberry32 可种子随机（测试可重复对局）+ 洗牌/取样工具。
 * 纯 TS 无 DOM；所有游戏引擎统一走本模块，禁止直接 Math.random（Worker/Node 测试同源）。
 */

export type Rng = () => number

/** mulberry32：32 位种子 → [0,1) 均匀随机，快且足够游戏用 */
export function seededRandom(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 默认随机源（浏览器/Node 各自 native） */
export const random: Rng = Math.random

/** [0, n) 整数 */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n)
}

/** 就地 Fisher–Yates 洗牌（返回同一数组） */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** 均匀取一 */
export function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[randInt(rng, arr.length)]!
}
