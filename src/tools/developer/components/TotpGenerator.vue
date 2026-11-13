<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { KeyRound, Copy, Check, Timer, Plus, Trash2, AlertTriangle } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** otpauth 模块的最小使用面（其 ESM 顶层导出形状在运行时探测） */
interface TotpInstance {
  generate(arg?: { timestamp: number }): string
}
interface TotpConfig {
  secret: unknown
  algorithm: string
  digits: number
  period: number
}
interface OtpauthClasses {
  TOTP: new (cfg: TotpConfig) => TotpInstance
  Secret: { fromBase32(s: string): unknown }
}
interface Account {
  id: number
  label: string
  secret: string
  algorithm: string
  digits: number
  period: number
}

const toast = useToast()
const mode = ref<'uri' | 'manual'>('uri')
const uri = ref('')
const secret = ref('')
const algorithm = ref('SHA1')
const digits = ref(6)
const period = ref(30)

const token = ref('')
const nextToken = ref('')
const remaining = ref(0)
const progress = ref(100)
const errMsg = ref('')
/** HOTP 计数器型警示（rx1） */
const hotpWarn = ref('')
const copied = ref(false)
/** 服务 · 账号（rx2） */
const issuer = ref('')
const account = ref('')
const nowText = ref(new Date().toLocaleTimeString())
/** 紧迫态（rx5） */
const urgent = computed(() => remaining.value <= 5 && remaining.value > 0)

/** 多账户（rx4）：本地持久化 */
const accounts = ref<Account[]>(JSON.parse(localStorage.getItem('toolhub.totp-accounts') || '[]') as Account[])
watch(accounts, (v) => localStorage.setItem('toolhub.totp-accounts', JSON.stringify(v)), { deep: true })
const accountInsts = new Map<number, TotpInstance>()
const accountLabel = ref('')
const nowTick = ref(0)

let Otp: OtpauthClasses | null = null
let inst: TotpInstance | null = null
let timer: number | null = null

async function loadLib(): Promise<OtpauthClasses> {
  if (Otp) return Otp
  const mod = (await import('otpauth')) as unknown as Record<string, unknown>
  const d = (mod.default ?? {}) as Record<string, unknown>
  const TOTP = (mod.TOTP ?? d.TOTP) as OtpauthClasses['TOTP']
  const Secret = (mod.Secret ?? d.Secret) as OtpauthClasses['Secret']
  if (!TOTP || !Secret) throw new Error('otpauth 引擎加载异常，请刷新页面重试')
  Otp = { TOTP, Secret }
  return Otp
}

/** 解析 otpauth:// 链接；HOTP 计数器型直接警示不生成（rx1） */
function parseUri() {
  hotpWarn.value = ''
  const m = /^otpauth:\/\/(totp|hotp)\/([^?]*)\?(.+)$/i.exec(uri.value.trim())
  if (!m) {
    errMsg.value = '链接格式应为 otpauth://totp/账号?secret=…（请检查后重试）'
    return
  }
  if (m[1]!.toLowerCase() === 'hotp') {
    hotpWarn.value = '该密钥为 HOTP 计数器型（otpauth://hotp/），按事件计数出码，本工具按时间（TOTP）计算的口令不可用。'
    token.value = ''
    nextToken.value = ''
    inst = null
    return
  }
  const q = new URLSearchParams(m[3]!)
  const sec = (q.get('secret') ?? '').replace(/\s/g, '')
  if (!sec) {
    errMsg.value = '链接里没有 secret 参数，无法生成口令'
    return
  }
  secret.value = sec
  algorithm.value = (q.get('algorithm') ?? 'SHA1').replace(/-/g, '').toUpperCase()
  digits.value = Number(q.get('digits') ?? 6) || 6
  period.value = Number(q.get('period') ?? 30) || 30
  // issuer 两种来源：issuer= 参数 或 label 前缀（rx2）
  const qIssuer = q.get('issuer') ?? ''
  const label = decodeURIComponent(m[2] ?? '')
  issuer.value = qIssuer || (label.includes(':') ? label.split(':')[0]!.trim() : '')
  account.value = label.includes(':') ? label.split(':').slice(1).join(':').trim() : label
  errMsg.value = ''
}

async function rebuild() {
  inst = null
  token.value = ''
  nextToken.value = ''
  const s = secret.value.replace(/\s/g, '')
  if (!s || hotpWarn.value) return
  try {
    const lib = await loadLib()
    inst = new lib.TOTP({
      secret: lib.Secret.fromBase32(s),
      algorithm: algorithm.value,
      digits: digits.value,
      period: period.value,
    })
    errMsg.value = ''
    tick()
  } catch (e) {
    errMsg.value = `密钥无法解析：${(e as Error).message}（请确认是 Base32 密钥，仅含 A-Z 和 2-7）`
  }
}

function tick() {
  nowTick.value++
  const now = Math.floor(Date.now() / 1000)
  const p = period.value || 30
  remaining.value = p - (now % p)
  progress.value = Math.round((remaining.value / p) * 100)
  nowText.value = new Date().toLocaleTimeString()
  if (inst) {
    try {
      // 本周期口令 + 下一周期预览（rx3）
      const cur = Math.floor(now / p) * p
      token.value = inst.generate({ timestamp: cur * 1000 })
      nextToken.value = inst.generate({ timestamp: (cur + p) * 1000 })
    } catch {
      token.value = ''
    }
  }
  // 多账户卡：为每个账户生成当前/下一口令
  for (const a of accounts.value) {
    if (!accountInsts.has(a.id)) {
      try {
        const lib = Otp
        if (lib) {
          accountInsts.set(
            a.id,
            new lib.TOTP({ secret: lib.Secret.fromBase32(a.secret), algorithm: a.algorithm, digits: a.digits, period: a.period }),
          )
        }
      } catch {
        /* 无效密钥的卡留空 */
      }
    }
  }
}

/** 多账户卡的口令（随全局时钟刷新） */
const codeOf = (a: Account): string => {
  void nowTick.value
  const i = accountInsts.get(a.id)
  if (!i) return ''
  try {
    const p = a.period || 30
    const cur = Math.floor(Date.now() / 1000 / p) * p
    return i.generate({ timestamp: cur * 1000 })
  } catch {
    return ''
  }
}
const nextOf = (a: Account): string => {
  void nowTick.value
  const i = accountInsts.get(a.id)
  if (!i) return ''
  try {
    const p = a.period || 30
    const cur = Math.floor(Date.now() / 1000 / p) * p
    return i.generate({ timestamp: (cur + p) * 1000 })
  } catch {
    return ''
  }
}
const remainingOf = (a: Account): number => {
  void nowTick.value
  const p = a.period || 30
  return p - (Math.floor(Date.now() / 1000) % p)
}

/** 添加当前配置为多账户卡 */
const addAccount = async () => {
  const s = secret.value.replace(/\s/g, '')
  if (!s) return toast.warn('请先在上方填入有效密钥')
  await loadLib()
  accounts.value.push({
    id: Date.now(),
    label: accountLabel.value || issuer.value + (account.value ? ` · ${account.value}` : '') || `账户 ${accounts.value.length + 1}`,
    secret: s,
    algorithm: algorithm.value,
    digits: digits.value,
    period: period.value,
  })
  accountLabel.value = ''
  toast.ok('已添加账户卡，刷新后仍保留')
}
const removeAccount = (id: number) => {
  accounts.value = accounts.value.filter((a) => a.id !== id)
  accountInsts.delete(id)
}

const startClock = () => {
  if (timer === null) timer = window.setInterval(tick, 300)
}

watch([mode], () => {
  errMsg.value = ''
})
watch([secret, algorithm, digits, period], rebuild, { immediate: false })
watch(uri, () => {
  if (uri.value.includes('otpauth://')) parseUri()
})

const doCopy = async (v: string, label = '当前口令') => {
  if (!v) return
  if (await copyText(v)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok(`已复制${label}`)
  } else toast.err('复制失败')
}

const copiedId = ref(0)
void copiedId
onMounted(startClock)
onBeforeUnmount(() => {
  if (timer !== null) window.clearInterval(timer)
})
</script>

<template>
  <div class="totp">
    <div class="row row-wrap" style="gap: 12px">
      <label class="seg" :class="{ active: mode === 'uri' }"><input v-model="mode" type="radio" value="uri" class="sr" /> 粘贴 otpauth:// 链接</label>
      <label class="seg" :class="{ active: mode === 'manual' }"><input v-model="mode" type="radio" value="manual" class="sr" /> 手动输入密钥</label>
    </div>

    <div v-if="mode === 'uri'" class="mt-2">
      <span class="field-label">otpauth:// 链接（两步验证迁移码中的链接）</span>
      <input v-model="uri" class="input mono" placeholder="otpauth://totp/示例:me@site.com?secret=JBSWY3DPEHPK3PXP&issuer=示例" />
    </div>

    <div v-else class="mt-2">
      <div class="row row-wrap" style="gap: 14px">
        <div>
          <span class="field-label">Base32 密钥（secret）</span>
          <input v-model="secret" class="input mono" style="min-width: 260px" placeholder="如 JBSWY3DPEHPK3PXP" />
        </div>
        <div>
          <span class="field-label">算法</span>
          <select v-model="algorithm" class="select">
            <option value="SHA1">SHA-1（最常见）</option>
            <option value="SHA256">SHA-256</option>
            <option value="SHA512">SHA-512</option>
          </select>
        </div>
        <div>
          <span class="field-label">位数</span>
          <select v-model="digits" class="select" style="width: 90px">
            <option :value="6">6 位</option>
            <option :value="8">8 位</option>
          </select>
        </div>
        <div>
          <span class="field-label">周期（秒）</span>
          <input v-model.number="period" type="number" min="10" max="120" class="input" style="width: 90px" />
        </div>
      </div>
    </div>

    <div v-if="hotpWarn" class="notice notice-warn mt-2 small"><AlertTriangle :size="14" style="vertical-align: -2px" /> {{ hotpWarn }}</div>

    <div class="token-card mt-3" :class="{ urgent }">
      <div class="row" style="gap: 14px; align-items: center">
        <KeyRound :size="22" class="tok-icon" />
        <span class="tok mono">{{ token || '———— ——' }}</span>
        <button class="btn btn-soft btn-sm" :disabled="!token" @click="doCopy(token)">
          <Check v-if="copied" :size="15" color="#34d399" /><Copy v-else :size="15" /> 复制
        </button>
      </div>
      <div class="bar mt-2"><div class="bar-fill" :class="{ urgent }" :style="{ width: progress + '%' }"></div></div>
      <div class="row row-wrap mt-1" style="gap: 10px; align-items: center">
        <span class="remain" :class="{ 'remain-urgent': urgent }"><Timer :size="14" /> {{ remaining }}s 后刷新</span>
        <span v-if="nextToken" class="muted small">下一码 <code class="mono">{{ nextToken }}</code></span>
        <span class="muted small">{{ digits }} 位 · {{ algorithm }} · 每 {{ period }} 秒轮换<span v-if="issuer || account"> · {{ issuer }}<template v-if="issuer && account"> · </template>{{ account }}</span></span>
      </div>
    </div>

    <p v-if="errMsg" class="notice notice-err mt-2 small">{{ errMsg }}</p>

    <!-- 多账户卡（rx4） -->
    <div v-if="accounts.length" class="mt-3">
      <span class="field-label">多账户（{{ accounts.length }} 张卡，本地保存）</span>
      <div v-for="a in accounts" :key="a.id" class="acct-card" :class="{ 'acct-urgent': remainingOf(a) <= 5 }">
        <div class="row" style="gap: 12px; align-items: center; flex-wrap: wrap">
          <b class="acct-label">{{ a.label }}</b>
          <code class="mono acct-code" @click="doCopy(codeOf(a), '账户口令')">{{ codeOf(a) || '——————' }}</code>
          <button class="btn btn-soft btn-sm" @click="doCopy(codeOf(a), '账户口令')"><Copy :size="13" /></button>
          <span class="muted small">下一码 {{ nextOf(a) }} · {{ remainingOf(a) }}s</span>
          <span class="grow"></span>
          <button class="btn btn-ghost btn-sm" :aria-label="`删除 ${a.label}`" @click="removeAccount(a.id)"><Trash2 :size="14" /></button>
        </div>
      </div>
    </div>
    <div class="row row-wrap mt-2" style="gap: 10px; align-items: end">
      <div>
        <span class="field-label">把当前密钥存为账户卡（命名）</span>
        <input v-model="accountLabel" class="input" style="min-width: 220px" placeholder="如 GitHub · me@example.com" />
      </div>
      <button class="btn btn-ghost btn-sm" @click="addAccount"><Plus :size="14" /> 添加账户卡</button>
    </div>

    <div class="notice notice-info mt-2 small">
      <p>当前设备时间：<b>{{ nowText }}</b>，口令每 {{ period }} 秒实时刷新，页面停留期间自动更新。</p>
      <p class="mt-1">「当前时间校验」：动态口令完全由「密钥 + 设备当前时间」算出。若本机时间与标准时间偏差超过 ±30 秒，生成的口令将无法通过服务端校验——请先校准系统时间（对照 time.is 等授时页面）。密钥仅在本页内存与本地存储中，不会上传。</p>
    </div>
  </div>
</template>

<style scoped>
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.token-card { padding: 18px 20px; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--panel-solid) 60%, transparent); }
.token-card.urgent { border-color: var(--err); }
.tok-icon { color: var(--accent-text); }
.tok { font-size: 30px; font-weight: 700; letter-spacing: 4px; color: var(--text); }
.bar { height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--border) 80%, transparent); overflow: hidden; }
.bar-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.3s linear; }
.bar-fill.urgent { background: var(--err); }
.remain { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.remain-urgent { color: var(--err); }
/* 多账户卡 */
.acct-card { border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; margin-top: 8px; background: color-mix(in srgb, var(--panel-solid) 55%, transparent); }
.acct-card.acct-urgent { border-color: var(--err); }
.acct-label { font-size: 13px; color: var(--text-2); }
.acct-code { font-size: 20px; font-weight: 700; letter-spacing: 3px; color: var(--accent-text); cursor: pointer; }
</style>
