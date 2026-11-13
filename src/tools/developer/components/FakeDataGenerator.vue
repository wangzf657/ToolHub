<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Users, Download } from 'lucide-vue-next'
import { fakeRows, FAKE_FIELDS } from '@/lib/jsEngine'
import { rowsToCsv } from '@/lib/csvEngine'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const selected = ref<string[]>(['fullName', 'email', 'phone', 'city', 'address'])
const count = ref(10)
const rows = ref<string[][]>([])
const header = ref<string[]>([])
/** 唯一性开关（rx3）：手机号/身份证列强制唯一 */
const forceUnique = ref(false)

/** 本地扩展字段：GB 11643 合法校验位身份证（rx1，引擎字段表只读故在组件层实现） */
const LOCAL_FIELDS: { key: string; label: string }[] = [{ key: 'idCardCN', label: '身份证（校验位合法）' }]
const ALL_FIELDS = [...FAKE_FIELDS, ...LOCAL_FIELDS]

/** GB 11643 身份证：地区码 + 出生日期 + 3 位顺序 + ISO 7064 MOD 11-2 校验位（数据虚构仅格式合规） */
const AREA_CODES = ['110101', '310104', '440305', '330102', '510107', '420102', '610102', '120101']
const idWeights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const idCheckMap = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
const genIdCard = (): string => {
  const area = AREA_CODES[Math.floor(Math.random() * AREA_CODES.length)]!
  const year = 1960 + Math.floor(Math.random() * 46)
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  const body = `${area}${year}${month}${day}${seq}`
  const sum = [...body].reduce((acc, ch, i) => acc + Number(ch) * idWeights[i]!, 0)
  return body + idCheckMap[sum % 11]!
}

const toggle = (key: string) => {
  const i = selected.value.indexOf(key)
  if (i > -1) selected.value.splice(i, 1)
  else selected.value.push(key)
}

const generate = () => {
  if (!selected.value.length) return toast.warn('请至少选择一个字段')
  const n = Math.floor(count.value)
  if (!n || n < 1 || n > 1000) return toast.err('行数需在 1-1000 之间')
  const engineKeys = selected.value.filter((k) => !LOCAL_FIELDS.some((f) => f.key === k))
  const localKeys = selected.value.filter((k) => LOCAL_FIELDS.some((f) => f.key === k))
  const cols = engineKeys.map((k) => FAKE_FIELDS.find((f) => f.key === k) ?? { key: k, label: k })
  const build = (): string[][] => {
    const base = engineKeys.length ? fakeRows(n, cols).rows : Array.from({ length: n }, () => [] as string[])
    // 本地列插到最前（保持选择顺序里本地字段的位置）
    const idIdx = selected.value.indexOf('idCardCN')
    return base.map((r) => {
      const out = [...r]
      out.splice(Math.max(0, idIdx), 0, ...localKeys.map((k) => (k === 'idCardCN' ? genIdCard() : '')))
      return out
    })
  }
  let result = build()
  if (forceUnique.value) {
    // 手机号 / 身份证列强制唯一：重复行整行重造（rx3）
    const uniqueCols = selected.value
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k === 'phone' || k === 'idCardCN')
      .map(({ i }) => i)
    const seen = new Set<string>()
    let guard = 0
    while (guard++ < 20) {
      result = result.filter((r) => {
        const key = uniqueCols.map((i) => r[i] ?? '').join('|')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      if (result.length >= n) break
      result = result.concat(build().slice(0, n - result.length))
      if (result.length > n) result = result.slice(0, n)
    }
  }
  header.value = selected.value.map((k) => ALL_FIELDS.find((f) => f.key === k)?.label ?? k)
  rows.value = result
  toast.ok(`已生成 ${n} 行 × ${selected.value.length} 列假数据`)
}

/** 家族整合（rx4）：携带字段选择跳 Mock 模板模式 */
const goMock = () => {
  sessionStorage.setItem('toolhub.transfer.mock-json-generator', JSON.stringify({ fields: selected.value }))
  router.push('/t/mock-json-generator')
}

const downloadJson = () => {
  const objects = rows.value.map((r) => Object.fromEntries(header.value.map((h, i) => [h, r[i] ?? ''])))
  saveText(JSON.stringify(objects, null, 2), 'fake-data.json', 'application/json')
  toast.ok('已下载 JSON')
}

const downloadCsv = () => {
  saveText(rowsToCsv(header.value, rows.value), 'fake-data.csv', 'text/csv;charset=utf-8')
  toast.ok('已下载 CSV')
}
</script>

<template>
  <div class="fake-data">
    <div class="fields-panel">
      <span class="field-label">选择字段（{{ selected.length }}/{{ ALL_FIELDS.length }}）</span>
      <div class="field-chips">
        <label v-for="f in ALL_FIELDS" :key="f.key" class="chip" :class="{ active: selected.includes(f.key) }">
          <input type="checkbox" :checked="selected.includes(f.key)" style="display: none" @change="toggle(f.key)" />
          {{ f.label }}
        </label>
      </div>
    </div>

    <div class="row row-wrap mt-3" style="gap: 12px; align-items: end">
      <div>
        <span class="field-label">行数</span>
        <input v-model.number="count" type="number" class="input mono" style="width: 110px" min="1" max="1000" />
      </div>
      <label class="check" style="margin-bottom: 8px" title="手机号/身份证列出现重复时整行重造"><input v-model="forceUnique" type="checkbox" /> 强制唯一（手机/身份证列）</label>
      <button class="btn btn-primary" @click="generate"><Users :size="16" /> 生成假数据</button>
      <template v-if="rows.length">
        <button class="btn btn-ghost btn-sm" @click="downloadJson"><Download :size="14" /> JSON</button>
        <button class="btn btn-ghost btn-sm" @click="downloadCsv"><Download :size="14" /> CSV</button>
      </template>
      <button class="btn btn-ghost btn-sm" style="margin-bottom: 8px" @click="goMock">需要自定义模板？切换 Mock 模板模式 →</button>
    </div>

    <div v-if="rows.length" class="table-wrap mt-3">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th v-for="h in header" :key="h">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows.slice(0, 50)" :key="i">
            <td class="muted">{{ i + 1 }}</td>
            <td v-for="(c, j) in r" :key="j" class="mono">{{ c }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="rows.length > 50" class="muted small mt-1">仅预览前 50 行，下载可获取全部 {{ rows.length }} 行。</p>
    </div>

    <p class="notice notice-info mt-3 small">数据由本地算法随机拼装（真实姓氏 + 常用字、规范格式邮箱/手机号）；身份证按 GB 11643 生成<b>校验位合法</b>的号码但数据完全虚构，仅用于接口调试与测试填充，请勿冒充真实身份。</p>
  </div>
</template>

<style scoped>
.field-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-chips .chip {
  cursor: pointer;
  user-select: none;
}
</style>
