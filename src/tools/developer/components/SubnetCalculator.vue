<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Network, ArrowRightLeft, Copy, Check } from 'lucide-vue-next'
import { subnetCalc } from '@/lib/jsEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const ip = ref('192.168.1.130')
const cidr = ref(24)
const error = ref('')
/** 输入格式提示（rx1）：按掩码解析时给出说明 */
const parseNote = ref('')
/** 私有段判别（rx4） */
const ipClass = ref('')
/** 复制反馈（rx3） */
const copiedIdx = ref(-1)

interface Row {
  label: string
  value: string
  primary?: boolean
}

const rows = ref<Row[]>([])

const formatNum = (n: number) => n.toLocaleString('zh-CN')

/** IP/CIDR/掩码格式宽容解析（rx1） */
const parseInput = () => {
  const t = ip.value.trim()
  parseNote.value = ''
  // 形如 192.168.1.130/26
  const m1 = t.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/)
  if (m1) {
    ip.value = m1[1]!
    cidr.value = Math.min(32, Math.max(0, Number(m1[2])))
    return
  }
  // 纯掩码 255.255.255.192
  const m2 = t.match(/^(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (m2) {
    const octets = m2[1]!.split('.').map(Number)
    if (octets.every((o) => o >= 0 && o <= 255)) {
      const bin = octets.map((o) => o.toString(2).padStart(8, '0')).join('')
      // 掩码必须形如连续 1 后跟连续 0
      if (/^1*0*$/.test(bin)) {
        cidr.value = (bin.match(/1/g) ?? []).length
        if (octets.some((o) => o !== 255) || cidr.value < 32) parseNote.value = '已按子网掩码解析前缀'
        ip.value = octets.join('.')
        return
      }
    }
  }
  // 「IP 掩码」两段式
  const m3 = t.match(/^(\d{1,3}(?:\.\d{1,3}){3})[\s,]+(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (m3) {
    const bin = m3[2]!.split('.').map(Number).map((o) => o.toString(2).padStart(8, '0')).join('')
    if (/^1*0*$/.test(bin)) {
      ip.value = m3[1]!
      cidr.value = (bin.match(/1/g) ?? []).length
      parseNote.value = '已按掩码解析前缀'
      return
    }
  }
}

/** RFC 1918 私有段判别（rx4） */
const classifyIp = (v: string) => {
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return ''
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 10) return '私有地址（RFC 1918：10.0.0.0/8）'
  if (a === 172 && b >= 16 && b <= 31) return '私有地址（RFC 1918：172.16.0.0/12）'
  if (a === 192 && b === 168) return '私有地址（RFC 1918：192.168.0.0/16）'
  if (a === 127) return '环回地址（127.0.0.0/8）'
  if (a === 169 && b === 254) return '链路本地（169.254.0.0/16）'
  return '公网地址'
}

const run = () => {
  error.value = ''
  parseInput()
  try {
    const r = subnetCalc(ip.value, cidr.value)
    ipClass.value = classifyIp(ip.value.trim())
    rows.value = [
      { label: '网络地址', value: `${r.network}/${cidr.value}`, primary: true },
      { label: '广播地址', value: r.broadcast },
      { label: '子网掩码', value: r.netmask },
      { label: '反掩码', value: r.wildcard },
      { label: '第一个可用主机', value: r.firstHost },
      { label: '最后一个可用主机', value: r.lastHost },
      { label: '地址总数', value: formatNum(r.totalHosts) },
      { label: '可用主机数', value: formatNum(r.usable) },
      { label: 'IP 的二进制', value: r.binary },
    ]
  } catch (e) {
    rows.value = []
    error.value = (e as Error).message
  }
}

/** 实时重算（rx2 配套）：滑杆与数字框双向绑定后自动更新 */
let deb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  deb = debounceRun(run, 200)
  run()
})
watch([ip, cidr], () => deb?.call())

const onSlider = () => run()

const swapToMask = () => {
  const r = rows.value.find((x) => x.label === '子网掩码')
  if (r) {
    ip.value = rows.value.find((x) => x.label === '网络地址')!.value.split('/')[0]!
    toast.ok(`已载入网络地址，当前掩码 ${r.value}（/${cidr.value}）`)
  }
}

const copyRow = async (r: Row, i: number) => {
  const ok = await copyText(r.value)
  if (ok) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else toast.err('复制失败')
}
</script>

<template>
  <div class="subnet-calc">
    <div class="row row-wrap" style="gap: 12px; align-items: end">
      <div class="grow" style="min-width: 220px">
        <span class="field-label">IPv4 地址（支持 IP、IP/CIDR、IP 掩码、纯掩码四种写法）</span>
        <input v-model="ip" type="text" class="input mono" placeholder="192.168.1.130 或 192.168.1.130/26 或 255.255.255.0" @keyup.enter="run" />
        <p v-if="parseNote" class="muted small" style="margin: 3px 0 0">{{ parseNote }}</p>
      </div>
      <div>
        <span class="field-label">CIDR 前缀</span>
        <div class="row" style="gap: 8px; align-items: center">
          <input v-model.number="cidr" type="range" min="0" max="32" step="1" style="width: 170px" @input="onSlider" />
          <input v-model.number="cidr" type="number" class="input mono" style="width: 70px" min="0" max="32" />
          <b class="mono">/{{ cidr }}</b>
        </div>
      </div>
      <button class="btn btn-primary" @click="run"><Network :size="16" /> 计算</button>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <div v-if="rows.length" class="mt-3">
      <div class="row row-wrap" style="margin-bottom: 8px; gap: 10px; align-items: center">
        <b class="small muted">共 {{ rows.length }} 项结果</b>
        <span v-if="ipClass" class="chip" :class="{ accent: ipClass.startsWith('私有') }">{{ ipClass }}</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="swapToMask"><ArrowRightLeft :size="13" /> 载入网络地址</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr v-for="(r, i) in rows" :key="r.label" :class="{ primary: r.primary }">
              <th>{{ r.label }}</th>
              <td class="mono">{{ r.value }}</td>
              <td style="width: 34px">
                <button class="row-copy" :title="`复制${r.label}`" :aria-label="`复制${r.label}`" @click="copyRow(r, i)">
                  <Check v-if="copiedIdx === i" :size="13" color="#34d399" /><Copy v-else :size="13" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="notice notice-info mt-3 small">
      口径说明：可用主机数 = 2^(32−前缀) − 2（网络与广播各占一个）；/31 与 /32 为点对点/单机特例，不做减 2。私有段按 RFC 1918 判别。VLSM 子网划分规划属远期能力，暂未支持。
    </p>
  </div>
</template>

<style scoped>
.data-table tr.primary td {
  color: var(--accent-text);
  font-weight: 700;
}
.row-copy {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 26px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
tr:hover .row-copy {
  opacity: 1;
}
.row-copy:hover {
  border-color: var(--accent);
  color: var(--text);
}
@media (hover: none) {
  .row-copy {
    opacity: 0.55;
  }
}
.chip.accent {
  color: var(--accent-text);
  font-weight: 600;
}
</style>
