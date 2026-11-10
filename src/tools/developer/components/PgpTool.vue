<script setup lang="ts">
import { ref } from 'vue'
import { Lock, Unlock, KeyRound, Loader2, Copy, Download, Check } from 'lucide-vue-next'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const tab = ref<'enc' | 'dec' | 'key'>('enc')
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
</script>

<template>
  <div class="pgp">
    <div class="row row-wrap" style="gap: 12px">
      <label class="seg" :class="{ active: tab === 'enc' }"><input v-model="tab" type="radio" value="enc" class="sr" /> 加密</label>
      <label class="seg" :class="{ active: tab === 'dec' }"><input v-model="tab" type="radio" value="dec" class="sr" /> 解密</label>
      <label class="seg" :class="{ active: tab === 'key' }"><input v-model="tab" type="radio" value="key" class="sr" /> 生成密钥对</label>
      <span v-if="hint" class="muted small"><Loader2 :size="13" class="spin" style="vertical-align: -2px" /> {{ hint }}</span>
    </div>

    <!-- 加密 -->
    <div v-if="tab === 'enc'" class="mt-2">
      <span class="field-label">明文文本</span>
      <textarea v-model="plain" class="textarea mono" style="min-height: 90px" placeholder="输入要加密的内容…"></textarea>
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
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="doDecrypt"><Unlock :size="15" /> 解密</button>
        <button v-if="decOut" class="btn btn-ghost btn-sm" @click="copy(decOut, '明文')"><Copy :size="14" /> 复制明文</button>
      </div>
      <pre v-if="decOut" class="out mono mt-2">{{ decOut }}</pre>
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
  max-height: 240px;
  overflow-y: auto;
  color: var(--text-2);
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
