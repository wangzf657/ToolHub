<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PenTool, Dices, ArrowRightLeft } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { hmac } from '@/lib/hashEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const header = ref('{\n  "alg": "HS256",\n  "typ": "JWT"\n}')
const payload = ref('{\n  "sub": "1234567890",\n  "name": "张三",\n  "iat": 1700000000,\n  "exp": 1893456000\n}')
const secret = ref('')
const algo = ref<'HS256' | 'HS384' | 'HS512'>('HS256')
const token = ref('')
/** 生成后再次编辑提示（rx5） */
const stale = ref(false)
watch([header, payload, secret], () => {
  if (token.value) stale.value = true
})

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 生成后清掉旧版本提示 */
const clearStaleOnGenerate = () => (stale.value = false)

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
    clearStaleOnGenerate()
    toast.ok(`JWT（${algo.value}）生成成功`)
  } catch (e) {
    toast.err(`签名失败：${(e as Error).message}`)
  }
}

/** exp 快捷档（rx1）：把 exp 写回 payload 为当前 Unix + 时长 */
const applyExp = (minutes: number) => {
  try {
    const p = JSON.parse(payload.value) as Record<string, unknown>
    p.exp = Math.floor(Date.now() / 1000) + minutes * 60
    payload.value = JSON.stringify(p, null, 2)
    toast.ok(`已写入 exp（${minutes < 60 ? `${minutes} 分钟` : minutes < 1440 ? `${minutes / 60} 小时` : `${minutes / 1440} 天`}）`)
  } catch (e) {
    toast.err(`payload 不是合法 JSON，无法写入：${(e as Error).message.slice(0, 60)}`)
  }
}

/** iat = 当前 Unix 秒（rx2） */
const applyIatNow = () => {
  try {
    const p = JSON.parse(payload.value) as Record<string, unknown>
    p.iat = Math.floor(Date.now() / 1000)
    payload.value = JSON.stringify(p, null, 2)
    toast.ok('已把 iat 覆写为当前时间')
  } catch (e) {
    toast.err(`payload 不是合法 JSON：${(e as Error).message.slice(0, 60)}`)
  }
}

/** 随机密钥：43 字符 base64url（256bit 熵，rx3） */
const rollSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  secret.value = b64url(bytes)
  toast.ok('已生成 256bit 随机密钥')
}

/** 去 jwt-decoder 闭环验证（rx4）：令牌经 sessionStorage 转料，解码页自动解析 */
const goVerify = () => {
  if (token.value) sessionStorage.setItem('toolhub.transfer.jwt-decoder', token.value)
  router.push('/t/jwt-decoder')
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
        <div class="row" style="gap: 8px">
          <input v-model="secret" type="text" class="input mono grow" placeholder="your-256-bit-secret 或点骰子生成" autocomplete="off" />
          <button class="btn btn-soft btn-sm" title="生成 43 字符 base64url 随机密钥（256bit 熵）" @click="rollSecret"><Dices :size="15" /> 随机密钥</button>
        </div>
      </div>
    </div>

    <div class="row row-wrap mb-2" style="gap: 12px; align-items: center">
      <span class="field-label" style="margin: 0">过期时间快捷档</span>
      <button class="btn btn-soft btn-sm" @click="applyExp(15)">15 分钟</button>
      <button class="btn btn-soft btn-sm" @click="applyExp(60)">1 小时</button>
      <button class="btn btn-soft btn-sm" @click="applyExp(1440)">1 天</button>
      <button class="btn btn-soft btn-sm" @click="applyExp(10080)">7 天</button>
      <button class="btn btn-ghost btn-sm" @click="applyIatNow"><ArrowRightLeft :size="14" /> iat = 当前时间</button>
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

    <div v-if="stale" class="notice notice-warn mt-2 small">内容已变更，当前令牌为旧版本——请重新点击「签名生成 JWT」。</div>

    <div class="row mt-2 row-wrap">
      <button class="btn btn-primary" @click="generate"><PenTool :size="16" /> 签名生成 JWT</button>
      <button v-if="token" class="btn btn-ghost" @click="goVerify">去解析验证 →</button>
      <span class="muted small">快捷档会把 exp / iat 直接写回上方 payload 文本。</span>
    </div>

    <ResultBox v-if="token" v-model="token" title="生成的 JWT" download="txt" min-height="140px" class="mt-3" />
    <p class="notice notice-info mt-3 small">仅支持 HMAC 对称算法（HS256/384/512），签名在你的浏览器内完成，密钥不上传；生成的令牌可一键跳转「JWT 解析器」回验。</p>
  </div>
</template>
