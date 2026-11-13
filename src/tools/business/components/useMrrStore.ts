/**
 * MRR 计算器状态持久化（localStorage，key 前缀 toolhub）：档位表与变动输入全量记忆。
 */
import { onMounted, ref, watch, type Ref } from 'vue'

export interface MrrTier {
  name: string
  price: number
  count: number
}

export interface MrrMoves {
  newMrr: number
  expandMrr: number
  contractMrr: number
  churnMrr: number
  startMrr: number
}

const MEM_KEY = 'toolhub.business.mrr'

export function useMrrStore(tiers: Ref<MrrTier[]>, moves: {
  newMrr: Ref<number>
  expandMrr: Ref<number>
  contractMrr: Ref<number>
  churnMrr: Ref<number>
  startMrr: Ref<number>
}) {
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(MEM_KEY) ?? 'null') as { tiers?: MrrTier[]; moves?: MrrMoves } | null
      if (saved?.tiers?.length) tiers.value = saved.tiers
      if (saved?.moves) {
        moves.newMrr.value = saved.moves.newMrr
        moves.expandMrr.value = saved.moves.expandMrr
        moves.contractMrr.value = saved.moves.contractMrr
        moves.churnMrr.value = saved.moves.churnMrr
        moves.startMrr.value = saved.moves.startMrr
      }
    } catch {
      /* 记忆损坏忽略 */
    }
  }
  const save = () => {
    try {
      localStorage.setItem(
        MEM_KEY,
        JSON.stringify({
          tiers: tiers.value,
          moves: {
            newMrr: moves.newMrr.value,
            expandMrr: moves.expandMrr.value,
            contractMrr: moves.contractMrr.value,
            churnMrr: moves.churnMrr.value,
            startMrr: moves.startMrr.value,
          },
        }),
      )
    } catch {
      /* 隐私模式/超限静默放弃 */
    }
  }
  onMounted(load)
  watch([tiers, moves.newMrr, moves.expandMrr, moves.contractMrr, moves.churnMrr, moves.startMrr], save, { deep: true })
}
