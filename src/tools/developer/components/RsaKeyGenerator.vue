<script setup lang="ts">
import { ref } from 'vue'
import { Key, Loader2, Copy, Download } from 'lucide-vue-next'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const bits = ref(2048)
const busy = ref(false)
const elapsed = ref(0)
const publicPem = ref('')
const privatePem = ref('')
let timer: number | null = null

const gen = async () => {
  busy.value = true
  publicPem.value = ''
  privatePem.value = ''
  elapsed.value = 0
  timer = window.setInterval(() => (elapsed.value += 0.2), 200)
  try {
    // 先让 loading 提示渲染出来，再进入同步密钥生成（4096 位可能 10 秒以上）
    await new Promise((r) => setTimeout(r, 60))
    const forge = (await import('node-forge')).default
    const pair = forge.pki.rsa.generateKeyPair({ bits: bits.value, e: 0x10001 })
    publicPem.value = forge.pki.publicKeyToPem(pair.publicKey).trim()
    privatePem.value = forge.pki.privateKeyToPem(pair.privateKey).trim()
    toast.ok(`已生成 ${bits.value} 位 RSA 密钥对（耗时 ${elapsed.value.toFixed(1)}s）`)
  } catch (e) {
    toast.err(`密钥生成失败：${(e as Error).message}`)
  } finally {
    if (timer !== null) window.clearInterval(timer)
    timer = null
    busy.value = false
  }
}

const copy = async (text: string, label: string) => {
  if (!text) return
  const ok = await copyText(text)
  ok ? toast.ok(`已复制${label}`) : toast.err('复制失败')
}

const download = (text: string, name: string) => {
  if (!text) return
  saveText(text, name, 'application/x-pem-file')
}
</script>

<template>
  <div class="rsa">
    <div class="opts row row-wrap">
      <span class="field-label">密钥长度</span>
      <select v-model.number="bits" class="select" style="width: 220px" :disabled="busy">
        <option :value="2048">2048 位（推荐，日常安全强度）</option>
        <option :value="4096">4096 位（更高强度，生成更慢）</option>
      </select>
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="gen">
        <Loader2 v-if="busy" :size="15" class="spin" /><Key v-else :size="15" /> 生成密钥对
      </button>
      <span v-if="busy" class="muted small">正在生成，已进行 {{ elapsed.toFixed(1) }}s…浏览器内纯运算，4096 位可能超过 10 秒，请耐心等待</span>
      <span v-else class="muted small">全程浏览器本地生成，密钥不会离开你的设备</span>
    </div>

    <div v-if="privatePem" class="mt-3">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">私钥（PKCS#1 PEM，务必保密）</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="copy(privatePem, '私钥')"><Copy :size="14" /> 复制</button>
        <button class="btn btn-soft btn-sm" @click="download(privatePem, 'private.pem')"><Download :size="14" /> 下载 private.pem</button>
      </div>
      <pre class="pem mono">{{ privatePem }}</pre>
    </div>

    <div v-if="publicPem" class="mt-2">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">公钥（可分发给别人加密 / 验签）</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="copy(publicPem, '公钥')"><Copy :size="14" /> 复制</button>
        <button class="btn btn-soft btn-sm" @click="download(publicPem, 'public.pem')"><Download :size="14" /> 下载 public.pem</button>
      </div>
      <pre class="pem mono">{{ publicPem }}</pre>
    </div>

    <div class="notice notice-info mt-3 small">
      输出为 openssl 兼容的 PKCS#1 PEM（<code>BEGIN RSA PRIVATE KEY</code> / <code>BEGIN PUBLIC KEY</code>）。私钥一旦泄露需立即更换；如需 OpenSSH 格式可用 <code>ssh-keygen -i -m PKCS8</code> 自行转换。
    </div>
  </div>
</template>

<style scoped>
.opts {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  gap: 12px;
  align-items: center;
}
.pem {
  margin: 8px 0 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-2, rgba(127, 127, 127, 0.1)) 60%, transparent);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  color: var(--text-2);
  max-height: 260px;
  overflow-y: auto;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
