/**
 * 图片家族跨工具带图转场（UX1.0）：rotate-image → batch-image-process、circle-crop → crop-image 等接力。
 * SPA 内模块级中转；目标工具挂载时 takeHandoff() 取走（一次性）。
 */
let pending: File | null = null

/** 存入待转场图片（File 或 Blob） */
export function handoffImage(f: File | Blob, name = 'handoff.png'): void {
  pending = f instanceof File && f.name ? f : new File([f], name, { type: f.type || 'image/png' })
}

/** 目标工具取走图片（只取一次） */
export function takeHandoff(): File | null {
  const f = pending
  pending = null
  return f
}
