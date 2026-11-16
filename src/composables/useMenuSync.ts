/**
 * 顶栏导航 ↔ 工作台菜单联动总线(V1.1 验收追加):
 * - 顶栏点某菜单大类 → 菜单独占展开该类并折叠其他类;
 * - 顶栏点「全部工具」→ 菜单全部大类展开。
 * ToolMenu(桌面侧栏/移动抽屉两实例)watch request 施加;WorkbenchLayout watch 展开被收起的侧栏。
 * nonce 单调递增:重复点同一大类也能再次触发;consumedNonce 记录已消费的请求,
 * 挂载晚于请求的 ToolMenu 实例(如从首页点顶栏大类后工作台才挂载)在 onMounted 补消费一次。
 */
import { ref } from 'vue'

export interface MenuSyncRequest {
  kind: 'solo' | 'all'
  /** kind=solo 时的目标菜单大类 id */
  catId?: string
  nonce: number
}

const request = ref<MenuSyncRequest | null>(null)
const consumedNonce = ref(0)
let nonce = 0

export function useMenuSync() {
  return {
    request,
    consumedNonce,
    /** 独占展开某个菜单大类(折叠其他) */
    solo(catId: string) {
      request.value = { kind: 'solo', catId, nonce: ++nonce }
    },
    /** 全部大类展开 */
    expandAll() {
      request.value = { kind: 'all', nonce: ++nonce }
    },
  }
}
