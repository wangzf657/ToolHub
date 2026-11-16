/** 工作台壳共享状态：侧栏整体收起 + 移动端抽屉（localStorage 记忆，toolhub 前缀） */
import { ref, watch } from 'vue'

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function lsSet(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* 隐私模式下静默降级：本次会话内仍生效 */
  }
}

/** 侧栏整体收起（桌面）；收起态 rail 常驻 6 个大类图标入口 */
const sidebarCollapsed = ref(lsGet('toolhub.sidebarCollapsed') === '1')
watch(sidebarCollapsed, (v) => lsSet('toolhub.sidebarCollapsed', v ? '1' : '0'))

/** 移动端工具抽屉（顶栏汉堡 = 唯一入口，工具菜单 + 站点导航合并） */
const drawerOpen = ref(false)

/** 菜单大类折叠集合记忆：存「已折叠」的大类 id 数组（多开浏览仅经 chevron 切换产生） */
export function readMenuCollapsed(): string[] {
  try {
    const v = JSON.parse(lsGet('toolhub.menuCollapsed') ?? '')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
export function writeMenuCollapsed(ids: string[]) {
  lsSet('toolhub.menuCollapsed', JSON.stringify(ids))
}

export function useWorkbench() {
  return { sidebarCollapsed, drawerOpen }
}
