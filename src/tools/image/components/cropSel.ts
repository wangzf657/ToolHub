/** 裁剪选区几何辅助（CropImage 专用）：手柄命中、比例约束、越界钳制 */
export type Sel = { x: number; y: number; w: number; h: number }
export type HandleKey = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export type Hit = HandleKey | 'move' | null

export const HANDLES: { k: HandleKey; dx: number; dy: number; cur: string }[] = [
  { k: 'nw', dx: 0, dy: 0, cur: 'nwse-resize' },
  { k: 'n', dx: 0.5, dy: 0, cur: 'ns-resize' },
  { k: 'ne', dx: 1, dy: 0, cur: 'nesw-resize' },
  { k: 'e', dx: 1, dy: 0.5, cur: 'ew-resize' },
  { k: 'se', dx: 1, dy: 1, cur: 'nwse-resize' },
  { k: 's', dx: 0.5, dy: 1, cur: 'ns-resize' },
  { k: 'sw', dx: 0, dy: 1, cur: 'nesw-resize' },
  { k: 'w', dx: 0, dy: 0.5, cur: 'ew-resize' },
]

/** 8 手柄中心点（图像坐标） */
export function handlePts(s: Sel): [number, number][] {
  return HANDLES.map((h) => [s.x + s.w * h.dx, s.y + s.h * h.dy] as [number, number])
}

/** 命中测试：先手柄（thr 为图像坐标阈值），再选区内部（整体移动），否则 null（新画） */
export function hitHandle(s: Sel | null, p: { x: number; y: number }, thr: number): Hit {
  if (!s) return null
  for (const h of HANDLES) {
    const hx = s.x + s.w * h.dx
    const hy = s.y + s.h * h.dy
    if (Math.abs(p.x - hx) <= thr && Math.abs(p.y - hy) <= thr) return h.k
  }
  if (p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) return 'move'
  return null
}

export function cursorFor(h: Hit): string {
  if (!h) return 'crosshair'
  if (h === 'move') return 'move'
  return HANDLES.find((x) => x.k === h)!.cur
}

/** 钳制到画布内，保持最小 4px */
export function clampSel(s: Sel, W: number, H: number): void {
  s.x = Math.max(0, Math.min(s.x, W - 4))
  s.y = Math.max(0, Math.min(s.y, H - 4))
  s.w = Math.max(4, Math.min(s.w, W - s.x))
  s.h = Math.max(4, Math.min(s.h, H - s.y))
}

/** 以左上角为锚把选区收敛到指定宽高比（新画选区用），钳制后返回 */
export function fitRatio(s: Sel, ratio: number, W: number, H: number): void {
  if (ratio <= 0 || s.w <= 0 || s.h <= 0) return
  if (s.w / s.h > ratio) s.w = s.h * ratio
  else s.h = s.w / ratio
  clampSel(s, W, H)
}
