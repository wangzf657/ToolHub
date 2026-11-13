<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ShieldAlert, ShieldCheck, Clock, Loader2 } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { installPasteRun } from '@/composables/usePasteRun'

const toast = useToast()
const token = ref('')
const parsed = ref(false)
const error = ref('')
const headerJson = ref('')
const payloadJson = ref('')
const signature = ref('')
const expInfo = ref<{ ts: number; expired: boolean; text: string } | null>(null)
/** alg 安全提示（rx3） */
const algWarning = ref('')
const algName = ref('')
/** HS* 签名校验（rx1） */
const secret = ref('')
const sigState = ref<'idle' | 'match' | 'mismatch' | 'unsupported'>('idle')
const verifying = ref(false)
/** 粘贴即解码（rx2，可关） */
const autoRun = ref(true)

const textEl = ref<HTMLTextAreaElement | null>(null)
let unbindPaste: (() => void) | null = null
onMounted(() => {
  // JWT 生成器「去解析验证」转料：自动填入并解析
  const t = sessionStorage.getItem('toolhub.transfer.jwt-decoder')
  if (t) {
    token.value = t
    sessionStorage.removeItem('toolhub.transfer.jwt-decoder')
    decode()
  }
  unbindPaste = installPasteRun(textEl.value, () => {
    if (autoRun.value && token.value.trim()) decode()
  })
})
onBeforeUnmount(() => unbindPaste?.())

function b64urlDecode(s: string): string {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4)
  const bin = atob(pad)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** iat/nbf/exp 时间声明追加中文注释（rx4） */
function annotateTimes(json: string): string {
  const names: Record<string, string> = { iat: '签发于', nbf: '生效于', exp: '过期于' }
  return json.replace(/"(\w+)":\s*(\d{9,13})(?=[,\n\s}])/g, (m, key: string, num: string) => {
    const label = names[key]
    if (!label) return m
    const n = Number(num)
    const ms = num.length >= 13 ? n : n * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return m
    return `${m}${' '}${label} ${d.toLocaleString('zh-CN', { hour12: false })}`
  })
}

const decode = () => {
  error.value = ''
  parsed.value = false
  expInfo.value = null
  algWarning.value = ''
  sigState.value = 'idle'
  const t = token.value.trim()
  if (!t) return toast.warn('请先粘贴 JWT 令牌')
  const parts = t.split('.')
  if (parts.length !== 3 || parts.some((p) => !p)) {
    error.value = 'JWT 应包含由「.」分隔的三段：Header.Payload.Signature。'
    return
  }
  try {
    const header = JSON.parse(b64urlDecode(parts[0]!)) as Record<string, unknown>
    headerJson.value = JSON.stringify(header, null, 2)
    const payload = JSON.parse(b64urlDecode(parts[1]!)) as Record<string, unknown>
    payloadJson.value = annotateTimes(JSON.stringify(payload, null, 2))
    signature.value = parts[2]!
    algName.value = String(header.alg ?? '(缺失)')
    if (!header.alg || header.alg === 'none') {
      algWarning.value = '无签名令牌（alg=none 或缺失）：任何人都可以伪造内容，服务端应直接拒绝。'
    }
    if (typeof payload.exp === 'number') {
      const expired = payload.exp * 1000 < Date.now()
      expInfo.value = {
        ts: payload.exp,
        expired,
        text: new Date(payload.exp * 1000).toLocaleString('zh-CN'),
      }
    }
    parsed.value = true
    toast.ok('JWT 解析成功')
  } catch (e) {
    error.value = `解码失败：${(e as Error).message.slice(0, 100)}`
  }
}

/** HS256/384/512 本地重算签名比对（rx1） */
const verifySig = async () => {
  const parts = token.value.trim().split('.')
  if (parts.length !== 3 || !secret.value) return
  if (!/^HS(256|384|512)$/.test(algName.value)) {
    sigState.value = 'unsupported'
    return
  }
  verifying.value = true
  try {
    const sha = algName.value === 'HS256' ? 'SHA-256' : algName.value === 'HS384' ? 'SHA-384' : 'SHA-512'
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret.value), { name: 'HMAC', hash: sha }, false, ['sign'])
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${parts[0]}.${parts[1]}`))
    const computed = b64urlEncode(new Uint8Array(mac))
    sigState.value = computed === parts[2] ? 'match' : 'mismatch'
  } catch {
    sigState.value = 'mismatch'
  } finally {
    verifying.value = false
  }
}

/** 空态示例（rx6）：jwt.io 经典 HS256 演示令牌（密钥 your-256-bit-secret） */
const fillSample = () => {
  token.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  decode()
}

const copy = async (v: string, label: string) => {
  const okFlag = await copyText(v)
  okFlag ? toast.ok(`${label} 已复制`) : toast.err('复制失败')
}
</script>

<template>
  <div class="jwt-dec">
    <span class="field-label">JWT 令牌</span>
    <textarea ref="textEl" v-model="token" class="textarea mono" style="min-height: 110px" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.…"></textarea>

    <div class="row mt-2 row-wrap">
      <button class="btn btn-primary" @click="decode">解析令牌</button>
      <button v-if="!token" class="btn btn-ghost" @click="fillSample">填入示例</button>
      <label class="check" title="粘贴后自动解析，可关"><input v-model="autoRun" type="checkbox" /> 粘贴即解码</label>
      <span class="muted small">解析仅在你的浏览器完成，令牌不会发送到任何服务器。</span>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <template v-if="parsed">
      <div v-if="algWarning" class="notice notice-warn mt-2"><ShieldAlert :size="15" style="vertical-align: -3px" /> {{ algWarning }}</div>

      <div v-if="expInfo" class="notice mt-2" :class="expInfo.expired ? 'notice-err' : 'notice-ok'">
        <ShieldAlert v-if="expInfo.expired" :size="15" style="vertical-align: -3px" />
        <ShieldCheck v-else :size="15" style="vertical-align: -3px" />
        {{ expInfo.expired ? '令牌已过期：' : '令牌未过期：' }}exp = {{ expInfo.text }}（{{ new Date(expInfo.ts * 1000).toISOString() }}）
      </div>

      <div class="seg mt-3">
        <div class="seg-head"><b class="h-tag">Header</b><span class="muted small">alg: {{ algName }}</span><button class="mini-btn" @click="copy(headerJson, 'Header')">复制</button></div>
        <pre class="seg-body mono">{{ headerJson }}</pre>
      </div>

      <div class="seg mt-2">
        <div class="seg-head"><b class="p-tag">Payload</b><button class="mini-btn" @click="copy(payloadJson, 'Payload')">复制</button></div>
        <pre class="seg-body mono">{{ payloadJson }}</pre>
        <p class="muted small mt-1">iat / nbf / exp 等时间声明已附本地时间注释。</p>
      </div>

      <div class="seg mt-2">
        <div class="seg-head"><b class="s-tag">Signature</b><button class="mini-btn" @click="copy(signature, 'Signature')">复制</button></div>
        <pre class="seg-body mono sig">{{ signature }}</pre>
        <div v-if="sigState === 'match'" class="notice notice-ok mt-1 small"><ShieldCheck :size="14" style="vertical-align: -2px" /> 签名匹配：密钥正确，内容未被篡改。</div>
        <div v-else-if="sigState === 'mismatch'" class="notice notice-err mt-1 small"><ShieldAlert :size="14" style="vertical-align: -2px" /> 签名不匹配：密钥错误或内容被篡改。</div>
        <div v-else-if="sigState === 'unsupported'" class="notice notice-warn mt-1 small">签名校验仅支持 HS256/HS384/HS512 对称算法，当前 alg 为 {{ algName }}。</div>
      </div>

      <div v-if="/^HS(256|384|512)$/.test(algName)" class="row row-wrap mt-2" style="gap: 8px; align-items: end">
        <div class="grow" style="max-width: 460px">
          <span class="field-label">校验密钥（{{ algName }} 的 shared secret）</span>
          <input v-model="secret" type="text" class="input mono" placeholder="your-256-bit-secret" @keyup.enter="verifySig" />
        </div>
        <button class="btn btn-soft" :disabled="verifying" @click="verifySig"><Loader2 v-if="verifying" :size="14" class="spin" /> 校验签名</button>
      </div>

      <p class="muted small mt-2"><Clock :size="13" style="vertical-align: -2px" /> 常见字段：sub 主题、iat 签发时间、exp 过期时间、iss 签发者、aud 接收方。</p>
    </template>
  </div>
</template>

<style scoped>
.seg-head {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 6px;
}
.h-tag {
  color: var(--accent-text);
  font-size: 13px;
}
.p-tag {
  color: #34d399;
  font-size: 13px;
}
.s-tag {
  color: #fbbf24;
  font-size: 13px;
}
/* 结果区弹性高度（rx5）：随视口伸展，下限 260px */
.seg-body {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 12.5px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: max(260px, calc(100vh - 420px));
}
.seg-body.sig {
  word-break: break-all;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  font-size: 12px;
  padding: 3px 10px;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.spin {
  animation: jw-spin 0.8s linear infinite;
}
@keyframes jw-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
