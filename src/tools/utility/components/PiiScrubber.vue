<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck, Copy, Check } from 'lucide-vue-next'
import { piiScrub } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const input = ref('')
const output = ref('')
const found = ref<{ type: string; count: number }[]>([])
const copied = ref(false)

const scrub = () => {
  if (!input.value.trim()) {
    toast.warn('请先贴入要脱敏的文本')
    return
  }
  const r = piiScrub(input.value)
  output.value = r.result
  found.value = r.found
  if (!r.found.length) toast.ok('未发现可识别的敏感信息')
  else toast.ok(`已遮盖 ${r.found.reduce((a, c) => a + c.count, 0)} 处敏感信息`)
}

const doCopy = async () => {
  if (!output.value) return
  const okFlag = await copyText(output.value)
  if (okFlag) {
    copied.value = true
    toast.ok('脱敏结果已复制')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const maskRule = (type: string): string => {
  switch (type) {
    case '邮箱':
      return '保留前 2 位 + ***@域名'
    case '手机号':
    case '身份证':
    case '银行卡号':
      return '保留末 4 位，前部打星'
    default:
      return '整体打星遮盖'
  }
}
</script>

<template>
  <div>
    <div class="io-head">
      <span class="io-title">原始文本</span>
      <button class="btn btn-ghost btn-sm" :disabled="!input" @click="input = ''; output = ''; found = []">清空</button>
    </div>
    <textarea
      v-model="input"
      class="textarea mono mt-1"
      style="min-height: 150px"
      placeholder="贴入包含邮箱、手机号、身份证、IP、URL 等信息的文本…（仅本地处理）"
    ></textarea>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="scrub">
        <ShieldCheck :size="16" /> 立即脱敏
      </button>
      <button v-if="output" class="btn btn-ghost" @click="doCopy">
        <Check v-if="copied" :size="15" />
        <Copy v-else :size="15" /> 复制结果
      </button>
    </div>

    <template v-if="output">
      <div class="io-head mt-2">
        <span class="io-title">脱敏结果</span>
      </div>
      <pre class="code-block mt-1">{{ output }}</pre>

      <div v-if="found.length" class="mt-2">
        <span class="io-title">发现统计</span>
        <div class="table-wrap mt-1">
          <table class="data-table">
            <thead>
              <tr><th>类型</th><th>识别数量</th><th>遮盖方式</th></tr>
            </thead>
            <tbody>
              <tr v-for="f in found" :key="f.type">
                <td>{{ f.type }}</td>
                <td class="mono">{{ f.count }} 个</td>
                <td>{{ maskRule(f.type) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="notice notice-ok mt-2">未发现邮箱 / 手机号 / 身份证 / 银行卡 / IP / URL。</div>
    </template>
  </div>
</template>

<style scoped>
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
.code-block {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
