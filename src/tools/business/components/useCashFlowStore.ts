/**
 * 现金流预测场景持久化（localStorage，key 前缀 toolhub）+ 烧钱率工具透传（query）。
 */
import { onMounted, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'

const MEM_KEY = 'toolhub.business.cashflow'

export interface MonthRow {
  income: number
  expense: number
}

export interface CashFlowState {
  cash0: Ref<number>
  months: Ref<number>
  defIncome: Ref<number>
  defExpense: Ref<number>
  rows: Ref<MonthRow[]>
  edited: Ref<Set<number>>
}

export function useCashFlowStore(state: CashFlowState) {
  const route = useRoute()
  const toast = useToast()
  const num = (v: number | undefined) => (Number.isFinite(v) ? Number(v) : 0)

  const save = () => {
    try {
      localStorage.setItem(
        MEM_KEY,
        JSON.stringify({
          cash0: num(state.cash0.value),
          defIncome: num(state.defIncome.value),
          defExpense: num(state.defExpense.value),
          months: state.months.value,
          rows: state.rows.value,
          edited: [...state.edited.value],
        }),
      )
    } catch {
      /* 隐私模式/超限静默放弃 */
    }
  }

  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(MEM_KEY) ?? 'null') as
        | { cash0: number; defIncome: number; defExpense: number; months: number; rows: MonthRow[]; edited?: number[] }
        | null
      if (!saved) return
      if (Number.isFinite(saved.cash0)) state.cash0.value = saved.cash0
      if (Number.isFinite(saved.defIncome)) state.defIncome.value = saved.defIncome
      if (Number.isFinite(saved.defExpense)) state.defExpense.value = saved.defExpense
      if (saved.months) state.months.value = saved.months
      if (Array.isArray(saved.rows) && saved.rows.length) {
        state.rows.value = saved.rows.map((r) => ({ income: num(r.income), expense: num(r.expense) }))
      }
      if (Array.isArray(saved.edited)) state.edited.value = new Set(saved.edited)
    } catch {
      /* 记忆损坏忽略 */
    }
  }

  /** burn-rate 等工具透传（query 优先于记忆） */
  const applyQuery = () => {
    const q = route.query as Record<string, string>
    const qn = (k: string) => (q[k] !== undefined && q[k] !== '' && Number.isFinite(Number(q[k])) ? Number(q[k]) : null)
    const cash = qn('cash')
    const revenue = qn('revenue')
    const expense = qn('expense')
    if (cash !== null) state.cash0.value = cash
    if (revenue !== null) state.defIncome.value = revenue
    if (expense !== null) state.defExpense.value = expense
    if (cash !== null || revenue !== null || expense !== null) {
      toast.ok('已带入来自「烧钱率与现金跑道」的数值')
    }
  }

  onMounted(() => {
    load()
    applyQuery()
  })
  watch([state.cash0, state.defIncome, state.defExpense, state.months, state.rows, state.edited], save, { deep: true })
}
