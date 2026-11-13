import { useUndoStack, installUndoKeys } from './undoStack'

/**
 * 照片工作台撤销栈（rx1）：画布快照式，覆盖 裁剪/重置/滤镜/文字增删/涂抹·清除 五类，上限 20 步。
 * 快照保存底图/涂抹层的画布克隆 + 调整参数 + 文字图层深拷贝。
 */

/** 文字图层（与 PhotoStudio 共用定义） */
export interface TextLayer {
  id: number
  text: string
  size: number
  color: string
  /** 0-1 相对坐标 */
  x: number
  y: number
}

export interface PhotoSnap {
  adj: [number, number, number, number, number]
  filter: string
  fi: number
  texts: TextLayer[]
  base: HTMLCanvasElement
  paint: HTMLCanvasElement | null
}

export function cloneCanvas(c: HTMLCanvasElement | null): HTMLCanvasElement | null {
  if (!c) return null
  const n = document.createElement('canvas')
  n.width = c.width
  n.height = c.height
  n.getContext('2d')!.drawImage(c, 0, 0)
  return n
}

export interface PhotoUndoDeps {
  base: () => HTMLCanvasElement | null
  paint: () => HTMLCanvasElement | null
  adj: () => [number, number, number, number, number]
  filter: () => string
  fi: () => number
  texts: () => TextLayer[]
  /** 恢复快照到工作台状态 */
  restore: (s: PhotoSnap) => void
  toastOk: (msg: string) => void
}

export function usePhotoUndo(deps: PhotoUndoDeps) {
  const stack = useUndoStack<PhotoSnap>(20)

  const snap = (): PhotoSnap | null => {
    const b = deps.base()
    if (!b) return null
    return {
      adj: deps.adj(),
      filter: deps.filter(),
      fi: deps.fi(),
      texts: deps.texts().map((t) => ({ ...t })),
      base: cloneCanvas(b)!,
      paint: cloneCanvas(deps.paint()),
    }
  }

  /** 每次变更前捕获当前状态 */
  const capture = () => {
    const s = snap()
    if (s) stack.push(s)
  }

  const doUndo = () => {
    const cur = snap()
    if (!cur) return
    const prev = stack.undo(cur)
    if (!prev) return
    deps.restore(prev)
    deps.toastOk('已撤销上一步编辑')
  }

  const doRedo = () => {
    const cur = snap()
    if (!cur) return
    const next = stack.redo(cur)
    if (!next) return
    deps.restore(next)
    deps.toastOk('已重做')
  }

  /** Ctrl+Z / Ctrl+Y 键盘绑定，返回卸载函数 */
  const installKeys = () => installUndoKeys(window, doUndo, doRedo)

  return { stack, capture, doUndo, doRedo, installKeys }
}
