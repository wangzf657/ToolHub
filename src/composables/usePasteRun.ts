/**
 * 粘贴即处理 / Ctrl+Enter 快捷执行（壳级通用能力）
 *
 * 供「输入 + 按钮执行」型工具组件接入：
 * - installPasteRun(el, run)：监听 paste 事件，粘贴落地后自动执行主动作
 * - installCtrlEnter(el, run)：Ctrl/Cmd+Enter 触发主动作
 *
 * 两者均返回卸载函数，组件在 onBeforeUnmount 时调用即可。
 */

/** 粘贴落地（文本已写入输入框）后自动执行；30ms 延迟等 v-model 同步 */
export function installPasteRun(el: HTMLElement | null | undefined, run: () => void): () => void {
  if (!el) return () => {}
  const handler = () => {
    window.setTimeout(run, 30)
  }
  el.addEventListener('paste', handler)
  return () => el.removeEventListener('paste', handler)
}

/** Ctrl/Cmd+Enter 触发执行（捕获阶段，避免被输入法/文本框吞掉） */
export function installCtrlEnter(el: HTMLElement | null | undefined, run: () => void): () => void {
  if (!el) return () => {}
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      run()
    }
  }
  el.addEventListener('keydown', handler, true)
  return () => el.removeEventListener('keydown', handler, true)
}

/** 防抖工具：延迟 ms 后执行，重复调用重置计时；返回卸载函数 */
export function debounceRun(fn: () => void, ms = 400): { call: () => void; cancel: () => void } {
  let timer = 0
  return {
    call: () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(fn, ms)
    },
    cancel: () => window.clearTimeout(timer),
  }
}
