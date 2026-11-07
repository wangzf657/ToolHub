<script setup lang="ts">
import { ref } from 'vue'
import { KeyRound, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { hmac } from '@/lib/hashEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const algo = ref<'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'>('SHA-256')
const secret = ref('')
const message = ref('')
const output = ref('hex')
const result = ref('')
const busy = ref(false)

const run = async () => {
  if (!secret.value) return toast.warn('请输入共享密钥')
  if (!message.value) return toast.warn('请输入要签名的消息')
  busy.value = true
  try {
    result.value = await hmac(algo.value, secret.value, message.value, output.value as 'hex' | 'base64')
    toast.ok(`HMAC-${algo.value} 签名完成`)
  } catch (e) {
    toast.err(`签名失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="hmac-gen">
    <div class="fields">
      <div>
        <span class="field-label">算法</span>
        <select v-model="algo" class="select">
          <option value="SHA-1">HMAC-SHA1</option>
          <option value="SHA-256">HMAC-SHA256</option>
          <option value="SHA-384">HMAC-SHA384</option>
          <option value="SHA-512">HMAC-SHA512</option>
        </select>
      </div>
      <div>
        <span class="field-label">输出格式</span>
        <select v-model="output" class="select">
          <option value="hex">Hex（十六进制）</option>
          <option value="base64">Base64</option>
        </select>
      </div>
    </div>

    <div class="mt-2">
      <span class="field-label">共享密钥（Secret Key）</span>
      <input v-model="secret" type="text" class="input mono" placeholder="如 my-secret-key" autocomplete="off" />
    </div>

    <div class="mt-2">
      <span class="field-label">消息内容</span>
      <textarea v-model="message" class="textarea mono" style="min-height: 110px" placeholder="要签名的消息文本，如请求参数拼接串"></textarea>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <KeyRound v-else :size="16" /> 生成签名
      </button>
    </div>

    <ResultBox v-if="result" v-model="result" title="HMAC 签名结果" download="txt" class="mt-3" />
    <p class="notice notice-info mt-3 small">签名完全在你的浏览器里通过 Web Crypto 计算，密钥不会离开设备。</p>
  </div>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.spin {
  animation: hmac-spin 0.8s linear infinite;
}
@keyframes hmac-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
