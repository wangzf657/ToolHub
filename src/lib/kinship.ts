/** 亲戚称谓计算（relationship.js 懒加载，数据+算法纯 JS，本地推导） */

type RelFn = (options: { text: string; sex: number; type?: 'default' | 'chain' | 'toggle' }) => string[]

let fn: RelFn | null = null

async function load(): Promise<RelFn> {
  if (!fn) {
    const mod = await import('relationship.js')
    fn = (mod as unknown as { default: RelFn }).default ?? (mod as unknown as RelFn)
  }
  return fn
}

/** 称谓链 → 称呼列表。chain 形如「爸爸的哥哥」；sex=1 我的性别男 */
export async function kinshipOfChain(chain: string, sex: number): Promise<string[]> {
  const rel = await load()
  const clean = chain.trim().replace(/(的)+$/g, '')
  if (!clean) return []
  return rel({ text: clean, sex })
}

/** 称呼 → 称谓链（反向）。title 形如「大舅」 */
export async function chainOfKinship(title: string, sex: number): Promise<string[]> {
  const rel = await load()
  const clean = title.trim()
  if (!clean) return []
  return rel({ text: clean, sex, type: 'chain' })
}

/** 关系链按钮（从「我」出发逐级选择） */
export const REL_STEPS: { label: string; seg: string; male: boolean }[] = [
  { label: '爸爸', seg: '爸爸', male: true },
  { label: '妈妈', seg: '妈妈', male: false },
  { label: '哥哥', seg: '哥哥', male: true },
  { label: '弟弟', seg: '弟弟', male: true },
  { label: '姐姐', seg: '姐姐', male: false },
  { label: '妹妹', seg: '妹妹', male: false },
  { label: '儿子', seg: '儿子', male: true },
  { label: '女儿', seg: '女儿', male: false },
  { label: '老公', seg: '老公', male: true },
  { label: '老婆', seg: '老婆', male: false },
]
