<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ArrowLeftRight } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 内置对人民币（CNY）的近似参考汇率快照，仅供本地估算 */
const DEFAULT_RATES: { code: string; name: string; rate: number }[] = [
  { code: 'CNY', name: '人民币', rate: 1 },
  { code: 'USD', name: '美元', rate: 7.16 },
  { code: 'EUR', name: '欧元', rate: 7.78 },
  { code: 'JPY', name: '日元', rate: 0.0472 },
  { code: 'GBP', name: '英镑', rate: 9.08 },
  { code: 'HKD', name: '港元', rate: 0.917 },
  { code: 'TWD', name: '新台币', rate: 0.223 },
  { code: 'KRW', name: '韩元', rate: 0.0052 },
  { code: 'SGD', name: '新加坡元', rate: 5.34 },
  { code: 'AUD', name: '澳大利亚元', rate: 4.7 },
  { code: 'CAD', name: '加拿大元', rate: 5.16 },
  { code: 'CHF', name: '瑞士法郎', rate: 8.06 },
  { code: 'RUB', name: '俄罗斯卢布', rate: 0.076 },
  { code: 'INR', name: '印度卢比', rate: 0.086 },
  { code: 'THB', name: '泰铢', rate: 0.204 },
  { code: 'MYR', name: '马来西亚林吉特', rate: 1.54 },
  { code: 'PHP', name: '菲律宾比索', rate: 0.127 },
  { code: 'IDR', name: '印尼盾', rate: 0.00045 },
  { code: 'VND', name: '越南盾', rate: 0.00028 },
  { code: 'NZD', name: '新西兰元', rate: 4.27 },
  { code: 'SEK', name: '瑞典克朗', rate: 0.677 },
  { code: 'NOK', name: '挪威克朗', rate: 0.647 },
  { code: 'DKK', name: '丹麦克朗', rate: 1.04 },
  { code: 'MXN', name: '墨西哥比索', rate: 0.4 },
  { code: 'BRL', name: '巴西雷亚尔', rate: 1.33 },
  { code: 'TRY', name: '土耳其里拉', rate: 0.21 },
  { code: 'ZAR', name: '南非兰特', rate: 0.38 },
  { code: 'AED', name: '阿联酋迪拉姆', rate: 1.95 },
  { code: 'SAR', name: '沙特里亚尔', rate: 1.91 },
  { code: 'ILS', name: '以色列新谢克尔', rate: 1.94 },
]

const rates = reactive<Record<string, number>>({})
for (const r of DEFAULT_RATES) rates[r.code] = r.rate

const amount = ref<number>(100)
const from = ref('USD')
const to = ref('CNY')
const result = ref('')
const reverse = ref('')

const convert = () => {
  const rFrom = rates[from.value]
  const rTo = rates[to.value]
  if (!rFrom || !rTo) {
    toast.err('货币代码不存在')
    return
  }
  const v = Number(amount.value)
  if (Number.isNaN(v)) {
    result.value = ''
    reverse.value = ''
    return
  }
  const out = (v / rFrom) * rTo
  const fmt = (n: number) =>
    n.toLocaleString('zh-CN', { maximumFractionDigits: n >= 100 ? 2 : 6 })
  result.value = `${fmt(v)} ${from.value} ≈ ${fmt(out)} ${to.value}`
  const rv = (1 / rFrom) * rTo
  reverse.value = `1 ${from.value} ≈ ${fmt(rv)} ${to.value}`
}
convert()

/** 汇率表编辑 */
const editing = ref(false)
const rateInput = ref('')
const startEdit = () => {
  rateInput.value = JSON.stringify(
    DEFAULT_RATES.map((r) => ({ code: r.code, rate: rates[r.code] })),
  )
  editing.value = true
}
const applyRates = () => {
  try {
    const list = JSON.parse(rateInput.value) as { code: string; rate: number }[]
    let n = 0
    for (const item of list) {
      if (typeof item.code === 'string' && typeof item.rate === 'number' && item.rate > 0) {
        rates[item.code] = item.rate
        n++
      }
    }
    if (!n) throw new Error('没有解析到有效汇率')
    editing.value = false
    convert()
    toast.ok(`已更新 ${n} 条汇率`)
  } catch (e) {
    toast.err((e as Error).message || '汇率格式无效，请输入 [{"code":"USD","rate":7.16}, …] 形式的 JSON')
  }
}
const resetRates = () => {
  for (const r of DEFAULT_RATES) rates[r.code] = r.rate
  editing.value = false
  convert()
  toast.ok('已恢复内置参考汇率')
}
</script>

<template>
  <div>
    <div class="notice notice-warn small">内置参考汇率快照（约 2024 年数据，仅供本地估算参考），可在下方手动修改。汇率不会自动联网更新。</div>

    <div class="conv-card mt-2">
      <div class="conv-grid">
        <div>
          <span class="field-label">金额</span>
          <input v-model.number="amount" type="number" class="input mono" @input="convert" />
          <select v-model="from" class="select mt-1" @change="convert">
            <option v-for="r in DEFAULT_RATES" :key="r.code" :value="r.code">{{ r.code }} {{ r.name }}</option>
          </select>
        </div>
        <div class="swap-slot">
          <ArrowLeftRight :size="18" />
        </div>
        <div>
          <span class="field-label">换算到</span>
          <input :value="result ? result.split('≈ ')[1]?.split(' ')[0] ?? '' : ''" class="input mono" readonly placeholder="结果" />
          <select v-model="to" class="select mt-1" @change="convert">
            <option v-for="r in DEFAULT_RATES" :key="r.code" :value="r.code">{{ r.code }} {{ r.name }}</option>
          </select>
        </div>
      </div>

      <p v-if="result" class="big-result">{{ result }}</p>
      <p v-if="reverse" class="muted small">{{ reverse }} · 双向换算：切换两侧货币后修改左侧金额即可重算</p>
    </div>

    <div class="mt-2">
      <div class="io-head">
        <span class="io-title">汇率表（单位：1 外币 = X 人民币）</span>
        <div class="row" style="gap: 8px">
          <button v-if="!editing" class="btn btn-soft btn-sm" @click="startEdit">修改汇率</button>
          <template v-else>
            <button class="btn btn-primary btn-sm" @click="applyRates">应用</button>
            <button class="btn btn-ghost btn-sm" @click="resetRates">恢复默认</button>
          </template>
        </div>
      </div>
      <div v-if="!editing" class="table-wrap mt-1">
        <table class="data-table">
          <thead>
            <tr><th>货币</th><th>代码</th><th>对人民币汇率</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in DEFAULT_RATES" :key="r.code">
              <td>{{ r.name }}</td>
              <td class="mono">{{ r.code }}</td>
              <td class="mono">{{ rates[r.code] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <textarea v-else v-model="rateInput" class="textarea mono mt-1" style="min-height: 200px" placeholder='[{"code":"USD","rate":7.16}, ...]'></textarea>
    </div>
  </div>
</template>

<style scoped>
.conv-card {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.conv-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: start;
}
@media (max-width: 640px) {
  .conv-grid {
    grid-template-columns: 1fr;
  }
  .swap-slot {
    justify-self: center;
  }
}
.swap-slot {
  margin-top: 26px;
  color: var(--text-3);
}
.big-result {
  margin: 16px 0 4px;
  font-size: 24px;
  font-weight: 700;
  color: var(--accent-text);
  font-family: var(--font-mono);
}
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
</style>
