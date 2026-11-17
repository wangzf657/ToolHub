/**
 * 键盘游戏输入守卫：文本输入类控件聚焦时不劫持按键；
 * checkbox/radio/button 等非文本 INPUT 放行（勾选项后无需先点画布即可直接玩）。
 */
export function keyTargetBlocked(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(type)
  }
  return false
}
