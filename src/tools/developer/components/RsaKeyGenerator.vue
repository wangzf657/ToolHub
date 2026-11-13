<script setup lang="ts">
import { computed, ref } from 'vue'
import { Key, Loader2, Copy, Download, Fingerprint } from 'lucide-vue-next'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const bits = ref(2048)
const busy = ref(false)
const elapsed = ref(0)
const jwkPub = ref<JsonWebKey | null>(null)
const jwkPriv = ref<JsonWebKey | null>(null)
let timer: number | null = null

/** DER（WebCrypto 导出为 PKCS#8/SPKI，按需裁剪/重建出 PKCS#1 与加密导出） */
const derTlv = (tag: number, content: Uint8Array): Uint8Array => {
  const len = content.length
  const lenBytes: number[] = []
  if (len < 0x80) lenBytes.push(len)
  else {
    const bs: number[] = []
    let n = len
    while (n > 0) {
      bs.unshift(n & 0xff)
      n >>= 8
    }
    lenBytes.push(0x80 | bs.length, ...bs)
  }
  return new Uint8Array([tag, ...lenBytes, ...content])
}
const derOid = (oid: string): Uint8Array => {
  const arcs = oid.split('.').map(Number)
  const body: number[] = [arcs[0]! * 40 + arcs[1]!]
  for (const a of arcs.slice(2)) {
    if (a < 0x80) body.push(a)
    else {
      const tmp: number[] = [a & 0x7f]
      let v = a >> 7
      while (v > 0) {
        tmp.unshift((v & 0x7f) | 0x80)
        v >>= 7
      }
      body.push(...tmp)
    }
  }
  return derTlv(0x06, new Uint8Array(body))
}
const concat = (...arrs: Uint8Array[]): Uint8Array => {
  const total = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const a of arrs) {
    out.set(a, p)
    p += a.length
  }
  return out
}
/** 读取一个 DER TLV */
const derRead = (der: Uint8Array, pos: number) => {
  let lenPos = pos + 1
  let len = der[lenPos]!
  lenPos++
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + der[lenPos++]!
  }
  return { content: der.subarray(lenPos, lenPos + len) }
}
/** PKCS#8 → PKCS#1 私钥体（取最外层 SEQUENCE 的第三个元素 OCTET STRING 内容） */
const pkcs1FromPkcs8 = (pkcs8: Uint8Array): Uint8Array => {
  const top = derRead(pkcs8, 0).content
  let p = 0
  let third = new Uint8Array(0) as Uint8Array<ArrayBufferLike>
  let idx = 0
  while (p < top.length) {
    const { content, tag, next } = derReadAt(top, p)
    if (idx === 2 && tag === 0x04) third = content
    p = next
    idx++
  }
  return third
}
/** SPKI → PKCS#1 公钥体（BIT STRING 内容去掉首个未用位数 octet） */
const pkcs1FromSpki = (spki: Uint8Array): Uint8Array => {
  const top = derRead(spki, 0).content
  let p = 0
  let bit = new Uint8Array(0) as Uint8Array<ArrayBufferLike>
  let idx = 0
  while (p < top.length) {
    const { content, tag, next } = derReadAt(top, p)
    if (idx === 1 && tag === 0x03) bit = content.subarray(1)
    p = next
    idx++
  }
  return bit
}
/** 读取 TLV（带 tag 与下一 TLV 位置返回，长/短长度均支持） */
const derReadAt = (der: Uint8Array, pos: number) => {
  const tag = der[pos]!
  let lenPos = pos + 1
  let len = der[lenPos]!
  lenPos++
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + der[lenPos++]!
  }
  return { tag, content: der.subarray(lenPos, lenPos + len), next: lenPos + len }
}

const toPem = (label: string, der: Uint8Array): string => {
  let b64 = ''
  der.forEach((b) => (b64 += String.fromCharCode(b)))
  const b = btoa(b64)
  const lines = b.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

/* ---------- 状态 ---------- */
const privFormat = ref<'pkcs1' | 'pkcs8'>('pkcs1')
const spkiDer = ref<Uint8Array | null>(null)
const pkcs8Der = ref<Uint8Array | null>(null)
const fingerprint = ref('')
/** 私钥下载保护口令（rx6，留空则明文导出） */
const passphrase = ref('')

const publicPem = computed(() => (spkiDer.value ? toPem(privFormat.value === 'pkcs1' ? 'RSA PUBLIC KEY' : 'PUBLIC KEY', spkiDer.value) : ''))
const privatePem = computed(() => (pkcs8Der.value ? toPem(privFormat.value === 'pkcs1' ? 'RSA PRIVATE KEY' : 'PRIVATE KEY', privFormat.value === 'pkcs1' ? pkcs1FromPkcs8(pkcs8Der.value) : pkcs8Der.value) : ''))

const gen = async () => {
  busy.value = true
  spkiDer.value = null
  pkcs8Der.value = null
  jwkPub.value = null
  jwkPriv.value = null
  fingerprint.value = ''
  const t0 = performance.now()
  timer = window.setInterval(() => (elapsed.value = (performance.now() - t0) / 1000), 200)
  try {
    // WebCrypto 原生异步生成：不阻塞主线程（rx1）
    const kp = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: bits.value, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    )
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey))
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))
    spkiDer.value = spki
    pkcs8Der.value = pkcs8
    jwkPub.value = await crypto.subtle.exportKey('jwk', kp.publicKey)
    jwkPriv.value = await crypto.subtle.exportKey('jwk', kp.privateKey)
    // 公钥 SHA-256 指纹（rx3）
    const fpBuf = await crypto.subtle.digest('SHA-256', spki as BufferSource)
    fingerprint.value = [...new Uint8Array(fpBuf)].map((b) => b.toString(16).padStart(2, '0')).join(':')
    elapsed.value = (performance.now() - t0) / 1000
    toast.ok(`已生成 ${bits.value} 位 RSA 密钥对（耗时 ${elapsed.value.toFixed(1)}s）`)
  } catch (e) {
    toast.err(`密钥生成失败：${(e as Error).message}`)
  } finally {
    if (timer !== null) window.clearInterval(timer)
    timer = null
    busy.value = false
  }
}

/** 加密 PKCS#8 导出（PBES2 + PBKDF2-SHA256 + AES-256-CBC，rx6） */
const exportEncrypted = async () => {
  if (!pkcs8Der.value) return
  if (!passphrase.value) return toast.warn('请先设置保护口令（留空则请用「下载 private.pem」明文导出）')
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(16))
    const iter = 2048
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.value) as BufferSource, 'PBKDF2', false, ['deriveKey'])
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-CBC', length: 256 },
      false,
      ['encrypt'],
    )
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, aesKey, pkcs8Der.value as BufferSource))
    const intBytes = (n: number) => {
      const out = [n & 0xff]
      let v = n >> 8
      while (v > 0) {
        out.unshift(v & 0xff)
        v >>= 8
      }
      return new Uint8Array(out)
    }
    const kdf = derTlv(0x30, concat(derOid('1.2.840.113549.1.5.12'), derTlv(0x30, concat(derTlv(0x04, salt), derTlv(0x02, intBytes(iter)), derTlv(0x30, derOid('1.2.840.113549.2.9'))))))
    const encScheme = derTlv(0x30, concat(derOid('2.16.840.1.101.3.4.1.42'), derTlv(0x04, iv)))
    const pbes2 = derTlv(0x30, concat(derOid('1.2.840.113549.1.5.13'), derTlv(0x30, concat(kdf, encScheme))))
    const epki = derTlv(0x30, concat(pbes2, derTlv(0x04, ct)))
    saveText(toPem('ENCRYPTED PRIVATE KEY', epki), 'private-encrypted.pem', 'application/x-pem-file')
    toast.ok('已下载口令保护的私钥（openssl pkey -passin 可读取）')
  } catch (e) {
    toast.err(`加密导出失败：${(e as Error).message}`)
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

/** JWK 导出（rx4） */
const downloadJwk = (which: 'pub' | 'priv') => {
  const jwk = which === 'pub' ? jwkPub.value : jwkPriv.value
  if (!jwk) return
  saveText(JSON.stringify(jwk, null, 2), which === 'pub' ? 'public.jwk.json' : 'private.jwk.json', 'application/json')
  toast.ok('已下载 JWK（jwt.io RS256 可直接验证）')
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
      <span class="field-label">私钥格式</span>
      <select v-model="privFormat" class="select" style="width: 170px" :disabled="busy">
        <option value="pkcs1">PKCS#1（BEGIN RSA PRIVATE KEY）</option>
        <option value="pkcs8">PKCS#8（BEGIN PRIVATE KEY）</option>
      </select>
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="gen">
        <Loader2 v-if="busy" :size="15" class="spin" /><Key v-else :size="15" /> 生成密钥对
      </button>
      <span v-if="busy" class="muted small">正在生成，已进行 {{ elapsed.toFixed(1) }}s…（WebCrypto 后台运算，页面不冻结）</span>
      <span v-else class="muted small">全程浏览器本地生成，密钥不会离开你的设备</span>
    </div>

    <div v-if="fingerprint" class="row row-wrap mt-2" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0"><Fingerprint :size="14" style="vertical-align: -2px" /> 公钥 SHA-256 指纹</span>
      <code class="mono small">{{ fingerprint }}</code>
      <button class="btn btn-ghost btn-sm" @click="copy(fingerprint, '指纹')"><Copy :size="13" /></button>
    </div>

    <div v-if="privatePem" class="mt-3">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">私钥（{{ privFormat === 'pkcs1' ? 'PKCS#1' : 'PKCS#8' }} PEM，务必保密）</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="copy(privatePem, '私钥')"><Copy :size="14" /> 复制</button>
        <button class="btn btn-soft btn-sm" @click="download(privatePem, 'private.pem')"><Download :size="14" /> 下载 private.pem</button>
        <button class="btn btn-ghost btn-sm" @click="downloadJwk('priv')"><Download :size="14" /> 导出 JWK</button>
      </div>
      <pre class="pem mono">{{ privatePem }}</pre>
      <div class="row row-wrap mt-1" style="gap: 8px; align-items: center">
        <span class="field-label" style="margin: 0">下载保护口令（可选）</span>
        <input v-model="passphrase" type="password" class="input" style="width: 220px" placeholder="留空则明文导出" autocomplete="new-password" />
        <button class="btn btn-soft btn-sm" @click="exportEncrypted"><Download :size="14" /> 口令保护导出</button>
        <span class="muted small">加密为 PBES2/PBKCS#8，openssl pkey -passin 可读取；无口令读取被拒</span>
      </div>
    </div>

    <div v-if="publicPem" class="mt-2">
      <div class="row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">公钥（{{ privFormat === 'pkcs1' ? 'PKCS#1' : 'SPKI' }}，可分发加密 / 验签）</span>
        <span class="grow"></span>
        <button class="btn btn-ghost btn-sm" @click="copy(publicPem, '公钥')"><Copy :size="14" /> 复制</button>
        <button class="btn btn-soft btn-sm" @click="download(publicPem, 'public.pem')"><Download :size="14" /> 下载 public.pem</button>
        <button class="btn btn-ghost btn-sm" @click="downloadJwk('pub')"><Download :size="14" /> 导出 JWK</button>
      </div>
      <pre class="pem mono">{{ publicPem }}</pre>
    </div>

    <div class="notice notice-info mt-3 small">
      WebCrypto 原生生成（2048/4096 位），页面不冻结；输出 openssl 兼容 PEM（PKCS#1 与 PKCS#8 可切换）。JWK 可直接填入 jwt.io 验证 RS256 签名。私钥一旦泄露需立即更换；如需 OpenSSH 格式可用 <code>ssh-keygen -i -m PKCS8</code> 自行转换。
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
  /* PEM 区弹性高度（rx5） */
  max-height: max(260px, calc(100vh - 420px));
  overflow-y: auto;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
