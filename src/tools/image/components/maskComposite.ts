/** 区域打码合成（BlurRegion 专用）：从原图 + 区域列表重新合成，避免叠加失真 */
import { applyOps } from '@/lib/imageEngine'

export type RMode = 'blur' | 'pixel' | 'black'
export interface Region {
  x: number
  y: number
  w: number
  h: number
  mode: RMode
}

/** 强度：0 = 自动（按区域尺寸比例），5~40 为手动 px/块 */
export function composite(src: HTMLCanvasElement, regions: Region[], strength: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const octx = out.getContext('2d')!
  octx.drawImage(src, 0, 0)
  for (const r of regions) {
    const rw = Math.round(r.w)
    const rh = Math.round(r.h)
    if (rw < 2 || rh < 2) continue
    if (r.mode === 'black') {
      octx.fillStyle = '#111111'
      octx.fillRect(r.x, r.y, rw, rh)
      continue
    }
    const region = document.createElement('canvas')
    region.width = rw
    region.height = rh
    region.getContext('2d')!.drawImage(src, r.x, r.y, rw, rh, 0, 0, rw, rh)
    const auto = Math.max(r.mode === 'blur' ? 5 : 6, Math.round(Math.min(rw, rh) / (r.mode === 'blur' ? 5 : 6)))
    const s = strength > 0 ? strength : auto
    if (r.mode === 'blur') {
      const t = document.createElement('canvas')
      t.width = rw
      t.height = rh
      const tctx = t.getContext('2d')!
      tctx.filter = `blur(${s}px)`
      tctx.drawImage(region, 0, 0)
      octx.drawImage(t, r.x, r.y)
    } else {
      octx.drawImage(applyOps(region, [{ op: 'pixelate', size: s }]), r.x, r.y)
    }
  }
  return out
}
