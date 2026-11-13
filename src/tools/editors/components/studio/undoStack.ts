import { computed, shallowRef } from 'vue'

/**
 * 工作台撤销栈（域G 本地适配版）。
 * 说明：域E 约定提供的 src/composables/useUndoStack.ts 尚未落地；
 * 本模块实现同一抽象（泛型快照栈，上限默认 20），落地后只需把
 * `import { useUndoStack } from './studio/undoStack'` 换为
 * `import { useUndoStack } from '@/composables/useUndoStack'`（API 保持一致）。
 *
 * 用法：push(快照) 在每次变更前调用；undo(当前值)/redo(当前值) 返回应恢复的快照或 null。
 */
export function useUndoStack<T>(cap = 20) {
  // shallowRef：快照整体替换，不需要深层响应式（避免泛型 T 的解包类型问题）
  const past = shallowRef<T[]>([])
  const future = shallowRef<T[]>([])

  /** 新操作入栈：清空重做分支，超过上限丢弃最旧 */
  const push = (s: T) => {
    past.value = [...past.value.slice(Math.max(0, past.value.length - (cap - 1))), s]
    future.value = []
  }

  /** 撤销：传入当前状态以便记入重做分支，返回应恢复的快照（无可撤销返回 null） */
  const undo = (current: T): T | null => {
    if (!past.value.length) return null
    const prev = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)
    future.value = [current, ...future.value].slice(0, cap)
    return prev
  }

  /** 重做：传入当前状态以便记入撤销分支，返回应恢复的快照（无可重做返回 null） */
  const redo = (current: T): T | null => {
    if (!future.value.length) return null
    const next = future.value[0]
    future.value = future.value.slice(1)
    past.value = [...past.value, current].slice(-cap)
    return next
  }

  /** 清空（载入新文件时） */
  const reset = () => {
    past.value = []
    future.value = []
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const depth = computed(() => past.value.length)

  return { push, undo, redo, reset, canUndo, canRedo, depth }
}

/** Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做的统一键盘绑定（输入框聚焦时跳过） */
export function installUndoKeys(el: Window | HTMLElement, undo: () => void, redo: () => void): () => void {
  const target: HTMLElement | Window = el
  const handler = (e: Event) => {
    const ke = e as KeyboardEvent
    if (!(ke.ctrlKey || ke.metaKey)) return
    const key = ke.key.toLowerCase()
    const t = ke.target as HTMLElement | null
    const inEditor = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    if (inEditor) return
    if (key === 'z' && !ke.shiftKey) {
      ke.preventDefault()
      undo()
    } else if ((key === 'z' && ke.shiftKey) || key === 'y') {
      ke.preventDefault()
      redo()
    }
  }
  target.addEventListener('keydown', handler as EventListener)
  return () => target.removeEventListener('keydown', handler as EventListener)
}
