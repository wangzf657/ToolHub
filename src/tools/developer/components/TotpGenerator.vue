<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { KeyRound, Copy, Check, Timer } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** otpauth 模块的最小使用面（其 ESM 顶层导出形状在运行时探测） */
interface TotpInstance {
  generate(): string
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

const toast = useToast()
const mode = ref<'uri' | 'manual'>('uri')
const uri = ref('')
const secret = ref('')
const algorithm = ref('SHA1')
const digits = ref(6)
const period = ref(30)

const token = ref('')
const remaining = ref(0)
const progress = ref(100)
const errMsg = ref('')
const copied = ref(false)
const account = ref('')
const nowText = ref(new Date().toLocaleTimeString())

let Otp: OtpauthClasses | null = null
let inst: TotpInstance | null = null
let timer: number | null = null

/** 首次使用时动态加载 otpauth，并探测 ESM 导出形状 */
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

/** 解析 otpauth:// 链接，回填各输入项 */
function parseUri() {
  const m = /^otpauth:\/\/(totp|hotp)\/([^?]*)\?(.+)$/i.exec(uri.value.trim())
  if (!m) {
    errMsg.value = '链接格式应为 otpauth://totp/账号?secret=…（请检查后重试）'
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
  const label = decodeURIComponent(m[2] ?? '')
  account.value = label.includes(':') ? label : ''
  errMsg.value = ''
}

async function rebuild() {
  inst = null
  token.value = ''
  const s = secret.value.replace(/\s/g, '')
  if (!s) return
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
  const now = Math.floor(Date.now() / 1000)
  const p = period.value || 30
  remaining.value = p - (now % p)
  progress.value = Math.round((remaining.value / p) * 100)
  nowText.value = new Date().toLocaleTimeString()
  // 进入新一轮周期时刷新口令；首次也可立即生成
  if (inst && (remaining.value === p || !token.value)) {
    try {
      token.value = inst.generate()
    } catch {
      token.value = ''
    }
  }
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

const doCopy = async () => {
  if (!token.value) return
  if (await copyText(token.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('已复制当前口令')
  } else toast.err('复制失败')
}

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

    <div class="token-card mt-3">
      <div class="row" style="gap: 14px; align-items: center">
        <KeyRound :size="22" class="tok-icon" />
        <span class="tok mono">{{ token || '———— ——' }}</span>
        <button class="btn btn-soft btn-sm" :disabled="!token" @click="doCopy">
          <Check v-if="copied" :size="15" color="#34d399" /><Copy v-else :size="15" /> 复制
        </button>
      </div>
      <div class="bar mt-2"><div class="bar-fill" :style="{ width: progress + '%' }"></div></div>
      <div class="row row-wrap mt-1" style="gap: 10px; align-items: center">
        <span class="remain"><Timer :size="14" /> {{ remaining }}s 后刷新</span>
        <span class="muted small">{{ digits }} 位 · {{ algorithm }} · 每 {{ period }} 秒轮换<span v-if="account"> · 账号 {{ account }}</span></span>
      </div>
    </div>

    <p v-if="errMsg" class="notice notice-err mt-2 small">{{ errMsg }}</p>

    <div class="notice notice-info mt-2 small">
      <p>当前设备时间：<b>{{ nowText }}</b>，口令每 {{ period }} 秒实时刷新，页面停留期间自动更新。</p>
      <p class="mt-1">「当前时间校验」：动态口令完全由「密钥 + 设备当前时间」算出。若本机时间与标准时间偏差超过 ±30 秒，生成的口令将无法通过服务端校验——请先校准系统时间（对照 time.is 等授时页面）。密钥仅在本页内存中运算，不会上传。</p>
    </div>
  </div>
</template>

<style scoped>
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.token-card { padding: 18px 20px; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--panel-solid) 60%, transparent); }
.tok-icon { color: var(--accent-text); }
.tok { font-size: 30px; font-weight: 700; letter-spacing: 4px; color: var(--text); }
.bar { height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--border) 80%, transparent); overflow: hidden; }
.bar-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.3s linear; }
.remain { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--text-2); }
</style>
