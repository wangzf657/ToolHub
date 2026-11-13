<script setup lang="ts">
import { ref, watch } from 'vue'
import { Lock, Unlock, KeyRound, Loader2, Copy, Download, Check, ShieldCheck } from 'lucide-vue-next'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const tab = ref<'enc' | 'dec' | 'sign' | 'verify' | 'key'>('enc')
const busy = ref(false)
const hint = ref('')

/* ---------- 加密 ---------- */
const plain = ref('')
const encPwd = ref('')
const pubKey = ref('')
const encOut = ref('')

/* ---------- 解密 ---------- */
const armored = ref('')
const decPwd = ref('')
const privKey = ref('')
const privPass = ref('')
const decOut = ref('')
/** 私钥详情即时回显（rx3） */
const keyInfo = ref<{ fingerprint: string; keyId: string; algorithm: string; created: string } | null>(null)
watch(privKey, async (v) => {
  keyInfo.value = null
  if (!v.trim() || !v.includes('PRIVATE KEY')) return
  try {
    const openpgp = await lib()
    const keys = await openpgp.readKeys({ armoredKeys: v.trim() })
    const k = keys[0] as unknown as {
      getFingerprint(): string
      getKeyID(): { toHex(): string }
      getAlgorithmInfo(): { algorithm: string; bits?: number; curve?: string }
      getCreationTime(): Date
    }
    const info = k.getAlgorithmInfo()
    keyInfo.value = {
      fingerprint: k.getFingerprint().toUpperCase().replace(/(.{4})(?=.)/g, '$1 '),
      keyId: k.getKeyID().toHex().toUpperCase(),
      algorithm: info.curve ? `${info.algorithm}（${info.curve}）` : `${info.algorithm}${info.bits ? ` ${info.bits} 位` : ''}`,
      created: k.getCreationTime().toLocaleDateString('zh-CN'),
    }
  } catch {
    keyInfo.value = null
  }
})

/* ---------- 签名 / 验签（rx2） ---------- */
const signText = ref('')
const signKey = ref('')
const signPass = ref('')
const signOut = ref('')
const verifyPub = ref('')
const verifyText = ref('')
const verifySig = ref('')
const verdict = ref<'' | 'ok' | 'bad' | 'none'>('')

const doSign = async () => {
  if (!signText.value.trim()) return toast.warn('请输入要签名的原文')
  if (!signKey.value.trim()) return toast.warn('请粘贴你的私钥')
  busy.value = true
  signOut.value = ''
  try {
    const openpgp = await lib()
    const keys = await openpgp.readKeys({ armoredKeys: signKey.value.trim() })
    if (signPass.value) {
      for (const k of keys) await (k as unknown as { decrypt(p: string): Promise<boolean> }).decrypt(signPass.value)
    }
    const message = await openpgp.createMessage({ text: signText.value })
    signOut.value = (await openpgp.sign({ message, signingKeys: keys as never, format: 'armored' })) as string
    toast.ok('签名完成（gpg --verify 可验证）')
  } catch (e) {
    toast.err(`签名失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const doVerify = async () => {
  if (!verifyText.value.trim() || !verifySig.value.trim() || !verifyPub.value.trim()) {
    return toast.warn('请填写原文、签名块与签名方公钥')
  }
  busy.value = true
  verdict.value = ''
  try {
    const openpgp = await lib()
    const pubKeys = await openpgp.readKeys({ armoredKeys: verifyPub.value.trim() })
    const message = await openpgp.createMessage({ text: verifyText.value })
    const sig = await openpgp.readSignature({ armoredSignature: verifySig.value.trim() })
    const r = (await openpgp.verify({ message, signature: sig, verificationKeys: pubKeys as never })) as unknown as {
      signatures: { valid: boolean | null }[]
    }
    verdict.value = r.signatures.some((s) => s.valid === true) ? 'ok' : 'bad'
    verdict.value === 'ok' ? toast.ok('验签通过：签名与原文一致') : toast.warn('验签未通过：签名无效或原文被改动')
  } catch {
    verdict.value = 'bad'
    toast.err('验签失败：输入格式有误或签名与原文不对应')
  } finally {
    busy.value = false
  }
}

/* ---------- 生成密钥对 ---------- */
const uidName = ref('')
const uidEmail = ref('')
const keyPass = ref('')
const keyType = ref<'curve25519' | 'rsa3072'>('curve25519')
const newPub = ref('')
const newPriv = ref('')

/** openpgp 体积较大（~600KB），首次使用动态加载 */
async function lib() {
  hint.value = '加载 OpenPGP 引擎…'
  try {
    return await import('openpgp')
  } finally {
    hint.value = ''
  }
}

const doEncrypt = async () => {
  if (!plain.value.trim()) return toast.warn('请输入要加密的文本')
  if (!encPwd.value && !pubKey.value.trim()) return toast.warn('请填写加密密码或接收方公钥（至少一项）')
  busy.value = true
  encOut.value = ''
  try {
    const openpgp = await lib()
    const message = await openpgp.createMessage({ text: plain.value })
    const opts: import('openpgp').EncryptOptions = { message, format: 'armored' }
    if (encPwd.value) opts.passwords = [encPwd.value]
    if (pubKey.value.trim()) {
      opts.encryptionKeys = await openpgp.readKeys({ armoredKeys: pubKey.value.trim() })
    }
    encOut.value = (await openpgp.encrypt({ ...opts, format: 'armored' as const })) as string
    toast.ok('加密完成')
  } catch (e) {
    toast.err(`加密失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const doDecrypt = async () => {
  if (!armored.value.trim()) return toast.warn('请粘贴 PGP 加密文本（-----BEGIN PGP MESSAGE-----）')
  if (!decPwd.value && !privKey.value.trim()) return toast.warn('请填写解密密码或你的私钥（至少一项）')
  busy.value = true
  decOut.value = ''
  try {
    const openpgp = await lib()
    const message = await openpgp.readMessage({ armoredMessage: armored.value.trim() })
    const opts: import('openpgp').DecryptOptions = { message, format: 'utf8' }
    if (decPwd.value) opts.passwords = [decPwd.value]
    if (privKey.value.trim()) {
      const keys = await openpgp.readKeys({ armoredKeys: privKey.value.trim() })
      // 受口令保护的私钥需要先用口令解锁
      if (privPass.value) {
        for (const k of keys) await (k as unknown as { decrypt(p: string): Promise<boolean> }).decrypt(privPass.value)
      }
      opts.decryptionKeys = keys as unknown as import('openpgp').PrivateKey[]
    }
    const r = (await openpgp.decrypt({ ...opts, format: 'utf8' as const })) as { data: string }
    decOut.value = r.data
    toast.ok('解密成功')
  } catch (e) {
    toast.err(`解密失败：${(e as Error).message}（请检查密码/私钥是否对应）`)
  } finally {
    busy.value = false
  }
}

const doGen = async () => {
  busy.value = true
  newPub.value = ''
  newPriv.value = ''
  try {
    const openpgp = await lib()
    const spec: Record<string, unknown> = {
      userIDs: [{ name: uidName.value.trim() || 'ToolHub User', email: uidEmail.value.trim() || undefined }],
      passphrase: keyPass.value || undefined,
      format: 'armored',
    }
    if (keyType.value === 'curve25519') {
      spec.type = 'ecc'
      spec.curve = 'curve25519'
    } else {
      spec.type = 'rsa'
      spec.rsaBits = 3072
    }
    const { privateKey, publicKey } = await openpgp.generateKey(spec as never)
    newPriv.value = privateKey
    newPub.value = publicKey
    toast.ok('密钥对生成完成，请立即保存私钥')
  } catch (e) {
    toast.err(`密钥生成失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const copy = async (text: string, label: string) => {
  if (!text) return
  ;(await copyText(text)) ? toast.ok(`已复制${label}`) : toast.err('复制失败')
}
const dl = (text: string, name: string) => {
  if (text) saveText(text, name, 'application/pgp-keys')
}
const copied = ref(false)
const copyEnc = async () => {
  if (!encOut.value) return
  if (await copyText(encOut.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('已复制密文')
  } else toast.err('复制失败')
}

/** 生成密钥对后 Tab 联动（rx1）：一键把新公钥带进加密 Tab */
const useNewKey = () => {
  if (!newPub.value) return
  pubKey.value = newPub.value
  tab.value = 'enc'
  toast.ok('已切到加密 Tab 并填入新公钥')
}

/** 明文拖入 .txt 自动填充（rx5） */
const onPlainDrop = (e: DragEvent) => {
  const f = e.dataTransfer?.files?.[0]
  if (!f) return
  e.preventDefault()
  const r = new FileReader()
  r.onload = () => (plain.value = String(r.result ?? ''))
  r.readAsText(f)
}
</script>

<template>
  <div class="pgp">
    <div class="row row-wrap" style="gap: 12px">
      <label class="seg" :class="{ active: tab === 'enc' }"><input v-model="tab" type="radio" value="enc" class="sr" /> 加密</label>
      <label class="seg" :class="{ active: tab === 'dec' }"><input v-model="tab" type="radio" value="dec" class="sr" /> 解密</label>
      <label class="seg" :class="{ active: tab === 'sign' }"><input v-model="tab" type="radio" value="sign" class="sr" /> 签名</label>
      <label class="seg" :class="{ active: tab === 'verify' }"><input v-model="tab" type="radio" value="verify" class="sr" /> 验签</label>
      <label class="seg" :class="{ active: tab === 'key' }"><input v-model="tab" type="radio" value="key" class="sr" /> 生成密钥对</label>
      <span v-if="hint" class="muted small"><Loader2 :size="13" class="spin" style="vertical-align: -2px" /> {{ hint }}</span>
    </div>

    <!-- 加密 -->
    <div v-if="tab === 'enc'" class="mt-2">
      <span class="field-label">明文文本（可拖入 .txt 文件填充）</span>
      <textarea v-model="plain" class="textarea mono" style="min-height: 140px" placeholder="输入要加密的内容…" @dragover.prevent @drop="onPlainDrop"></textarea>
      <div class="grid-2 mt-2" style="gap: 14px">
        <div>
          <span class="field-label">密码加密（可选）</span>
          <input v-model="encPwd" type="password" class="input mono" placeholder="对称口令，发送给对方" />
        </div>
        <div>
          <span class="field-label">公钥加密（可选，粘贴对方公钥块）</span>
          <textarea v-model="pubKey" class="textarea mono" style="min-height: 56px" placeholder="-----BEGIN PUBLIC KEY-----…"></textarea>
        </div>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="doEncrypt"><Lock :size="15" /> 加密</button>
        <button v-if="encOut" class="btn btn-ghost btn-sm" @click="copyEnc"><Check v-if="copied" :size="14" color="#34d399" /><Copy v-else :size="14" /> 复制密文</button>
        <button v-if="encOut" class="btn btn-soft btn-sm" @click="dl(encOut, 'message.asc')"><Download :size="14" /> 下载 .asc</button>
      </div>
      <pre v-if="encOut" class="out mono mt-2">{{ encOut }}</pre>
    </div>

    <!-- 解密 -->
    <div v-else-if="tab === 'dec'" class="mt-2">
      <span class="field-label">PGP 密文</span>
      <textarea v-model="armored" class="textarea mono" style="min-height: 100px" placeholder="-----BEGIN PGP MESSAGE-----…"></textarea>
      <div class="grid-2 mt-2" style="gap: 14px">
        <div>
          <span class="field-label">解密密码（可选，密码模式密文用）</span>
          <input v-model="decPwd" type="password" class="input mono" />
        </div>
        <div>
          <span class="field-label">私钥口令（可选，仅私钥有保护时填写）</span>
          <input v-model="privPass" type="password" class="input mono" />
        </div>
        <div>
          <span class="field-label">你的私钥（可选，公钥模式密文用）</span>
          <textarea v-model="privKey" class="textarea mono" style="min-height: 56px" placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----…"></textarea>
        </div>
      </div>
      <div v-if="keyInfo" class="notice notice-info mt-2 small">
        <b>私钥详情：</b>指纹 <code class="mono">{{ keyInfo.fingerprint }}</code> · KeyID <code class="mono">{{ keyInfo.keyId }}</code> · 算法 {{ keyInfo.algorithm }} · 创建于 {{ keyInfo.created }}
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="doDecrypt"><Unlock :size="15" /> 解密</button>
        <button v-if="decOut" class="btn btn-ghost btn-sm" @click="copy(decOut, '明文')"><Copy :size="14" /> 复制明文</button>
      </div>
      <pre v-if="decOut" class="out mono mt-2">{{ decOut }}</pre>
    </div>

    <!-- 签名（rx2） -->
    <div v-else-if="tab === 'sign'" class="mt-2">
      <span class="field-label">要签名的原文</span>
      <textarea v-model="signText" class="textarea mono" style="min-height: 100px" placeholder="输入原文，签名将附加在明文下方（cleartext signature）"></textarea>
      <div class="grid-2 mt-2" style="gap: 14px">
        <div>
          <span class="field-label">你的私钥</span>
          <textarea v-model="signKey" class="textarea mono" style="min-height: 70px" placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----…"></textarea>
        </div>
        <div>
          <span class="field-label">私钥口令（可选）</span>
          <input v-model="signPass" type="password" class="input mono" />
        </div>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="doSign"><KeyRound :size="15" /> 生成签名</button>
        <button v-if="signOut" class="btn btn-soft btn-sm" @click="dl(signOut, 'message-signed.asc')"><Download :size="14" /> 下载 .asc</button>
      </div>
      <pre v-if="signOut" class="out mono mt-2">{{ signOut }}</pre>
    </div>

    <!-- 验签（rx2） -->
    <div v-else-if="tab === 'verify'" class="mt-2">
      <div class="grid-2" style="gap: 14px">
        <div>
          <span class="field-label">原文</span>
          <textarea v-model="verifyText" class="textarea mono" style="min-height: 90px"></textarea>
        </div>
        <div>
          <span class="field-label">签名块（-----BEGIN PGP SIGNATURE-----）</span>
          <textarea v-model="verifySig" class="textarea mono" style="min-height: 90px"></textarea>
        </div>
      </div>
      <div class="mt-2">
        <span class="field-label">签名方公钥</span>
        <textarea v-model="verifyPub" class="textarea mono" style="min-height: 70px" placeholder="-----BEGIN PUBLIC KEY-----…"></textarea>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="doVerify"><ShieldCheck :size="15" /> 验证签名</button>
      </div>
      <p v-if="verdict === 'ok'" class="verdict ok mt-2">✓ 验签通过：签名有效且原文未被改动</p>
      <p v-else-if="verdict === 'bad'" class="verdict bad mt-2">✗ 验签未通过：签名无效、公钥不匹配或原文被改动</p>
    </div>

    <!-- 生成密钥对 -->
    <div v-else class="mt-2">
      <div class="row row-wrap" style="gap: 14px; align-items: flex-end">
        <div>
          <span class="field-label">用户名</span>
          <input v-model="uidName" class="input" placeholder="如 张三" />
        </div>
        <div>
          <span class="field-label">邮箱</span>
          <input v-model="uidEmail" class="input mono" placeholder="you@example.com" />
        </div>
        <div>
          <span class="field-label">保护口令（可选）</span>
          <input v-model="keyPass" type="password" class="input mono" />
        </div>
        <div>
          <span class="field-label">密钥类型</span>
          <select v-model="keyType" class="select">
            <option value="curve25519">ECC Curve25519（推荐，快）</option>
            <option value="rsa3072">RSA 3072（兼容性好）</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="doGen"><KeyRound :size="15" /> 生成密钥对</button>
      </div>
      <template v-if="newPriv">
        <div class="row row-wrap mt-3" style="gap: 10px; align-items: center">
          <span class="field-label" style="margin: 0">私钥（绝不外传，解密/签名用）</span>
          <span class="grow"></span>
          <button class="btn btn-primary btn-sm" @click="useNewKey"><Lock :size="14" /> 用此密钥加密 →</button>
          <button class="btn btn-ghost btn-sm" @click="copy(newPriv, '私钥')"><Copy :size="14" /> 复制</button>
          <button class="btn btn-soft btn-sm" @click="dl(newPriv, 'private-key.asc')"><Download :size="14" /> 下载私钥</button>
        </div>
        <pre class="out mono mt-1">{{ newPriv }}</pre>
        <div class="row row-wrap mt-2" style="gap: 10px; align-items: center">
          <span class="field-label" style="margin: 0">公钥（分发给别人加密/验签）</span>
          <span class="grow"></span>
          <button class="btn btn-ghost btn-sm" @click="copy(newPub, '公钥')"><Copy :size="14" /> 复制</button>
          <button class="btn btn-soft btn-sm" @click="dl(newPub, 'public-key.asc')"><Download :size="14" /> 下载公钥</button>
        </div>
        <pre class="out mono mt-1">{{ newPub }}</pre>
      </template>
    </div>

    <p class="muted small mt-2">所有密钥与文本仅在本页内存中运算，不经过任何服务器；刷新页面后密钥即消失，请自行妥善备份。</p>
  </div>
</template>

<style scoped>
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.out {
  margin: 8px 0 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-2, rgba(127, 127, 127, 0.1)) 60%, transparent);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  /* 弹性高度（rx4）：随视口伸展，下限 240px */
  max-height: max(240px, calc(100vh - 460px));
  overflow-y: auto;
  color: var(--text-2);
}
.verdict { font-weight: 700; }
.verdict.ok { color: var(--ok); }
.verdict.bad { color: var(--err); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
