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

/** 打开抽屉：同 position 压入一条抽屉哨兵历史（BUG-004/R5.3）——浏览器返回先关抽屉：
 *  popstate 时 vue-router delta=0 不产生真实导航，抽屉关闭；再次返回才是正常页面返回。
 *  关闭不消费哨兵，链接路由等正常 push 会把它留在下方（回退语义不变）。 */
function openDrawer() {
  if (drawerOpen.value) return
  drawerOpen.value = true
  try {
    history.pushState({ ...(history.state ?? {}), toolhubDrawer: true }, '')
  } catch {
    /* 极端环境 pushState 失败时退化为普通打开：返回关抽屉由 ToolDrawer 的路由监听兜底 */
  }
}

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
  return { sidebarCollapsed, drawerOpen, openDrawer }
}
