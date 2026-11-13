<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { KeyRound, Loader2, Check, X } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { hmac } from '@/lib/hashEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

type Algo = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
const toast = useToast()
const algo = ref<Algo>('SHA-256')
const secret = ref('')
const message = ref('')
const output = ref('hex')
const result = ref('')
const busy = ref(false)
/** 密钥编码档（rx2）：同一语义密钥三种格式输入 */
const keyFormat = ref<'text' | 'hex' | 'base64'>('text')
const keyError = ref('')
/** 期望签名比对（rx3） */
const expected = ref('')
const matchState = ref<'idle' | 'ok' | 'bad'>('idle')

const decodeKey = (): Uint8Array | null => {
  keyError.value = ''
  const s = secret.value
  if (keyFormat.value === 'hex') {
    if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) {
      keyError.value = 'Hex 档要求偶数长度的 0-9/a-f 字符'
      return null
    }
    const out = new Uint8Array(s.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  if (keyFormat.value === 'base64') {
    try {
      const bin = atob(s)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    } catch {
      keyError.value = 'Base64 档输入不是合法 Base64'
      return null
    }
  }
  return new TextEncoder().encode(s)
}

/** HMAC-MD5：Web Crypto 不支持 MD5，用内置 md5Bytes 手工实现 H(K^opad ‖ H(K^ipad ‖ m)) */
const hmacMd5 = async (key: Uint8Array, msg: Uint8Array): Promise<string> => {
  const { md5Bytes } = await import('@/lib/md5')
  let k = key
  if (k.length > 64) k = md5Bytes(k)
  const ipad = new Uint8Array(64 + msg.length)
  const opad = new Uint8Array(64 + k.length + 16)
  for (let i = 0; i < 64; i++) {
    ipad[i] = (k[i] ?? 0) ^ 0x36
    opad[i] = (k[i] ?? 0) ^ 0x5c
  }
  ipad.set(msg, 64)
  const inner = md5Bytes(ipad)
  opad.set(inner, 64)
  const outer = md5Bytes(opad)
  return [...outer].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const run = async () => {
  if (!secret.value) return
  if (!message.value) {
    result.value = ''
    matchState.value = 'idle'
    return
  }
  const key = decodeKey()
  if (!key) {
    result.value = ''
    return
  }
  busy.value = true
  try {
    const msgBytes = new TextEncoder().encode(message.value)
    let hex: string
    if (algo.value === 'MD5') {
      hex = await hmacMd5(key, msgBytes)
    } else {
      const name = algo.value as 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
      const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: name }, false, ['sign'])
      const sig = await crypto.subtle.sign('HMAC', k, msgBytes as BufferSource)
      hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }
    result.value = output.value === 'base64' ? btoa(hex.match(/../g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join('')) : hex
    // 期望比对（忽略大小写与空白）
    const exp = expected.value.trim().toLowerCase().replace(/[\s-]/g, '')
    matchState.value = !exp ? 'idle' : exp === result.value.toLowerCase().replace(/[\s-]/g, '') ? 'ok' : 'bad'
  } catch (e) {
    toast.err(`签名失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

/** 自动重算（rx1）：任一输入变化后 300ms 防抖更新 */
let deb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  deb = debounceRun(() => {
    if (!busy.value && secret.value && message.value) run()
  }, 300)
  // 哈希生成器「生成 HMAC」转料
  const t = sessionStorage.getItem('toolhub.transfer.hmac-generator')
  if (t) {
    try {
      const { message: m } = JSON.parse(t) as { message: string }
      message.value = m
      sessionStorage.removeItem('toolhub.transfer.hmac-generator')
      toast.ok('已带入待签名文本，填写密钥即可生成')
    } catch {
      /* 转料损坏忽略 */
    }
  }
})
onBeforeUnmount(() => deb?.cancel())
watch([algo, secret, message, output, keyFormat, expected], () => deb?.call())

/** 空态示例（rx5）：云回调验签场景 */
const fillExample = () => {
  secret.value = 'whsec_8f14e45fceea167a5a36dedd4bea2543'
  message.value = 'path=/pay/callback&ts=1730000000&order=A20250101&amount=99.50'
  algo.value = 'SHA-256'
  run()
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
          <option value="MD5">HMAC-MD5（旧系统兼容）</option>
        </select>
      </div>
      <div>
        <span class="field-label">输出格式</span>
        <select v-model="output" class="select">
          <option value="hex">Hex（十六进制）</option>
          <option value="base64">Base64</option>
        </select>
      </div>
      <div>
        <span class="field-label">密钥编码</span>
        <select v-model="keyFormat" class="select">
          <option value="text">UTF-8 文本</option>
          <option value="hex">Hex 字节</option>
          <option value="base64">Base64 字节</option>
        </select>
      </div>
    </div>
    <p class="muted small mt-1">同一语义密钥用不同编码输入会产出不同签名（字节不同所致），请与对端约定一致。</p>

    <div class="mt-2">
      <span class="field-label">共享密钥（Secret Key）</span>
      <input v-model="secret" type="text" class="input mono" placeholder="如 my-secret-key" autocomplete="off" />
      <span v-if="keyError" class="notice notice-err small mt-1" style="display: block">{{ keyError }}</span>
    </div>

    <div class="mt-2">
      <span class="field-label">消息内容</span>
      <textarea v-model="message" class="textarea mono" style="min-height: 110px" placeholder="要签名的消息文本，如请求参数拼接串"></textarea>
    </div>

    <div class="mt-2">
      <span class="field-label">期望签名（可选，粘贴后自动比对）</span>
      <input v-model="expected" type="text" class="input mono" placeholder="服务方给出的期望签名值" />
      <div v-if="matchState === 'ok'" class="notice notice-ok small mt-1"><Check :size="14" style="vertical-align: -2px" /> 一致：签名与期望值匹配。</div>
      <div v-else-if="matchState === 'bad'" class="notice notice-err small mt-1"><X :size="14" style="vertical-align: -2px" /> 不一致：请核对密钥、消息与算法档位。</div>
    </div>

    <div class="row mt-2 row-wrap">
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <KeyRound v-else :size="16" /> 生成签名
      </button>
      <button class="btn btn-ghost" @click="fillExample">填入示例（云回调验签）</button>
      <button v-if="result" class="btn btn-ghost" @click="copyText(result).then((ok) => (ok ? toast.ok('已复制') : toast.err('复制失败')))">复制签名</button>
    </div>

    <ResultBox v-if="result" v-model="result" title="HMAC 签名结果" download="txt" class="mt-3" />
    <p class="notice notice-info mt-3 small">签名完全在你的浏览器里计算（SHA 系走 Web Crypto，MD5 走内置实现），密钥不会离开设备；任一输入变化后 300ms 自动重算。</p>
  </div>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}
@media (max-width: 760px) {
  .fields {
    grid-template-columns: 1fr;
  }
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
