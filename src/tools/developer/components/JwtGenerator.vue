<script setup lang="ts">
import { ref } from 'vue'
import { PenTool } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { hmac } from '@/lib/hashEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const header = ref('{\n  "alg": "HS256",\n  "typ": "JWT"\n}')
const payload = ref('{\n  "sub": "1234567890",\n  "name": "张三",\n  "iat": 1700000000,\n  "exp": 1893456000\n}')
const secret = ref('')
const algo = ref<'HS256' | 'HS384' | 'HS512'>('HS256')
const token = ref('')

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const generate = async () => {
  let h: unknown
  let p: unknown
  try {
    h = JSON.parse(header.value)
    p = JSON.parse(payload.value)
  } catch (e) {
    return toast.err(`JSON 有误：${(e as Error).message.slice(0, 80)}`)
  }
  if (!secret.value) return toast.warn('请输入签名密钥')
  const enc = algo.value.replace('HS', 'SHA-') as 'SHA-256' | 'SHA-384' | 'SHA-512'
  try {
    const head = b64url(JSON.stringify(h))
    const body = b64url(JSON.stringify(p))
    const sig = await hmac(enc, secret.value, `${head}.${body}`, 'base64')
    const sigUrl = sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    token.value = `${head}.${body}.${sigUrl}`
    toast.ok(`JWT（${algo.value}）生成成功`)
  } catch (e) {
    toast.err(`签名失败：${(e as Error).message}`)
  }
}
</script>

<template>
  <div class="jwt-gen">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: end">
      <div>
        <span class="field-label">算法</span>
        <select v-model="algo" class="select" style="width: 130px">
          <option value="HS256">HS256</option>
          <option value="HS384">HS384</option>
          <option value="HS512">HS512</option>
        </select>
      </div>
      <div class="grow">
        <span class="field-label">签名密钥（Secret）</span>
        <input v-model="secret" type="text" class="input mono" placeholder="your-256-bit-secret" autocomplete="off" />
      </div>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">Header（JSON）</span>
        <textarea v-model="header" class="textarea mono" style="min-height: 170px"></textarea>
      </div>
      <div>
        <span class="field-label">Payload（JSON）</span>
        <textarea v-model="payload" class="textarea mono" style="min-height: 170px"></textarea>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="generate"><PenTool :size="16" /> 签名生成 JWT</button>
      <span class="muted small">过期时间请自行在 payload 中维护 exp 字段（Unix 秒）。</span>
    </div>

    <ResultBox v-if="token" v-model="token" title="生成的 JWT" download="txt" min-height="140px" class="mt-3" />
    <p class="notice notice-info mt-3 small">仅支持 HMAC 对称算法（HS256/384/512），签名在你的浏览器内完成，密钥不上传。</p>
  </div>
</template>
