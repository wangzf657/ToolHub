<script setup lang="ts">
import { ref } from 'vue'
import { ShieldAlert, ShieldCheck, Clock } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const token = ref('')
const parsed = ref(false)
const error = ref('')
const headerJson = ref('')
const payloadJson = ref('')
const signature = ref('')
const expInfo = ref<{ ts: number; expired: boolean; text: string } | null>(null)

function b64urlDecode(s: string): string {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4)
  const bin = atob(pad)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const decode = () => {
  error.value = ''
  parsed.value = false
  expInfo.value = null
  const t = token.value.trim()
  if (!t) return toast.warn('请先粘贴 JWT 令牌')
  const parts = t.split('.')
  if (parts.length !== 3 || parts.some((p) => !p)) {
    error.value = 'JWT 应包含由「.」分隔的三段：Header.Payload.Signature。'
    return
  }
  try {
    headerJson.value = JSON.stringify(JSON.parse(b64urlDecode(parts[0]!)), null, 2)
    const payload = JSON.parse(b64urlDecode(parts[1]!)) as Record<string, unknown>
    payloadJson.value = JSON.stringify(payload, null, 2)
    signature.value = parts[2]!
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

const copy = async (v: string, label: string) => {
  const okFlag = await copyText(v)
  okFlag ? toast.ok(`${label} 已复制`) : toast.err('复制失败')
}
</script>

<template>
  <div class="jwt-dec">
    <span class="field-label">JWT 令牌</span>
    <textarea v-model="token" class="textarea mono" style="min-height: 110px" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.…"></textarea>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="decode">解析令牌</button>
      <span class="muted small">解析仅在你的浏览器完成，令牌不会发送到任何服务器。</span>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <template v-if="parsed">
      <div v-if="expInfo" class="notice mt-2" :class="expInfo.expired ? 'notice-err' : 'notice-ok'">
        <ShieldAlert v-if="expInfo.expired" :size="15" style="vertical-align: -3px" />
        <ShieldCheck v-else :size="15" style="vertical-align: -3px" />
        {{ expInfo.expired ? '令牌已过期：' : '令牌未过期：' }}exp = {{ expInfo.text }}（{{ new Date(expInfo.ts * 1000).toISOString() }}）
      </div>

      <div class="seg mt-3">
        <div class="seg-head"><b class="h-tag">Header</b><button class="mini-btn" @click="copy(headerJson, 'Header')">复制</button></div>
        <pre class="seg-body mono">{{ headerJson }}</pre>
      </div>

      <div class="seg mt-2">
        <div class="seg-head"><b class="p-tag">Payload</b><button class="mini-btn" @click="copy(payloadJson, 'Payload')">复制</button></div>
        <pre class="seg-body mono">{{ payloadJson }}</pre>
      </div>

      <div class="seg mt-2">
        <div class="seg-head"><b class="s-tag">Signature</b><button class="mini-btn" @click="copy(signature, 'Signature')">复制</button></div>
        <pre class="seg-body mono sig">{{ signature }}</pre>
      </div>

      <p class="muted small mt-2"><Clock :size="13" style="vertical-align: -2px" /> 常见字段：sub 主题、iat 签发时间、exp 过期时间、iss 签发者、aud 接收方。</p>
    </template>
  </div>
</template>

<style scoped>
.seg-head {
  display: flex;
  align-items: center;
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
  max-height: 260px;
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
</style>
