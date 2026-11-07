<script setup lang="ts">
import { ref } from 'vue'
import { Network, ArrowRightLeft } from 'lucide-vue-next'
import { subnetCalc } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const ip = ref('192.168.1.130')
const cidr = ref(24)
const error = ref('')

interface Row {
  label: string
  value: string
  primary?: boolean
}

const rows = ref<Row[]>([])

const formatNum = (n: number) => n.toLocaleString('zh-CN')

const run = () => {
  error.value = ''
  try {
    const r = subnetCalc(ip.value, cidr.value)
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

const onSlider = () => run()

const swapToMask = () => {
  const r = rows.value.find((x) => x.label === '子网掩码')
  if (r) {
    ip.value = rows.value.find((x) => x.label === '网络地址')!.value.split('/')[0]!
    toast.ok(`已载入网络地址，当前掩码 ${r.value}（/${cidr.value}）`)
  }
}
</script>

<template>
  <div class="subnet-calc">
    <div class="row row-wrap" style="gap: 12px; align-items: end">
      <div class="grow" style="min-width: 200px">
        <span class="field-label">IPv4 地址</span>
        <input v-model="ip" type="text" class="input mono" placeholder="192.168.1.130" @keyup.enter="run" />
      </div>
      <div>
        <span class="field-label">CIDR 前缀：/{{ cidr }}</span>
        <input v-model.number="cidr" type="range" min="0" max="32" step="1" style="width: 200px" @input="onSlider" />
      </div>
      <button class="btn btn-primary" @click="run"><Network :size="16" /> 计算</button>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <div v-if="rows.length" class="mt-3">
      <div class="row" style="margin-bottom: 8px">
        <b class="small muted">共 {{ rows.length }} 项结果</b>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="swapToMask"><ArrowRightLeft :size="13" /> 载入网络地址</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr v-for="r in rows" :key="r.label" :class="{ primary: r.primary }">
              <th>{{ r.label }}</th>
              <td class="mono">{{ r.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="notice notice-info mt-3 small">
      口径说明：可用主机数 = 2^(32−前缀) − 2（网络与广播各占一个）；/31 与 /32 为点对点/单机特例，不做减 2。
    </p>
  </div>
</template>

<style scoped>
.data-table tr.primary td {
  color: var(--accent-text);
  font-weight: 700;
}
</style>
