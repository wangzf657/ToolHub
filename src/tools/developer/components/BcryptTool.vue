<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { Hash, ShieldCheck, Copy, Check, Loader2 } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/* ---------- 生成 ---------- */
const password = ref('')
const rounds = ref(10)
const busy = ref(false)
const genHash = ref('')
const genMs = ref(0)
/** 生成中的耗时预估（rx2，轮次≥12 时显示） */
const estimateText = ref('')
let estTimer: number | null = null
const copied = ref(false)
/** 版本选择（rx5） */
const version = ref<'$2b$' | '$2a$'>('$2b$')

/* ---------- 验证 ---------- */
const vPassword = ref('')
const vPasswordEl = ref<HTMLInputElement | null>(null)
const vHash = ref('')
const vBusy = ref(false)
const verdict = ref<'' | 'ok' | 'bad'>('')

/** bcryptjs 按需加载（纯 JS 实现，浏览器本地运算） */
async function lib() {
  return import('bcryptjs')
}

const genSaltRounds = () => Math.min(15, Math.max(4, Math.round(rounds.value) || 10))

/** 依据上一轮实测耗时估算本轮耗时（每 +1 轮约翻倍） */
const estimateMs = (r: number) => (genMs.value > 0 ? genMs.value * Math.pow(2, r - Number(genHash.value.slice(4, 6) || r)) : 0)

const startEstimate = (r: number) => {
  const est = estimateMs(r)
  if (r < 12 || est <= 0) return
  const endAt = Date.now() + est
  const update = () => {
    const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
    estimateText.value = left > 0 ? `正在计算（约还需 ${left} 秒）…` : '正在计算（马上完成）…'
  }
  update()
  estTimer = window.setInterval(update, 1000)
}
const stopEstimate = () => {
  if (estTimer !== null) {
    clearInterval(estTimer)
    estTimer = null
  }
  estimateText.value = ''
}
onBeforeUnmount(stopEstimate)

const runGen = async () => {
  if (!password.value) return toast.warn('请输入要哈希的密码')
  busy.value = true
  genHash.value = ''
  startEstimate(genSaltRounds())
  try {
    const bcrypt = await lib()
    const r = genSaltRounds()
    const t0 = performance.now()
    let h = await bcrypt.hash(password.value, r)
    if (version.value === '$2a$' && h.startsWith('$2b$')) h = '$2a$' + h.slice(4)
    genHash.value = h
    genMs.value = Math.round(performance.now() - t0)
  } catch (e) {
    toast.err(`生成失败：${(e as Error).message}`)
  } finally {
    busy.value = false
    stopEstimate()
  }
}

/** 哈希分段（rx3）：版本 | 轮次 | 22 字符盐 | 31 字符摘要 */
const hashSegs = () => {
  const h = genHash.value
  if (!/^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(h)) return null
  const salt = h.slice(7, 7 + 22)
  const digest = h.slice(7 + 22)
  return { ver: h.slice(0, 4), rounds: h.slice(4, 6), salt, digest }
}

/** 一键回填验证（rx1） */
const fillVerify = async () => {
  vHash.value = genHash.value
  toast.ok('已回填到右侧验证框')
  await nextTick()
  vPasswordEl.value?.focus()
}

const doCopy = async () => {
  if (!genHash.value) return
  if (await copyText(genHash.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('已复制哈希值')
  } else toast.err('复制失败')
}

const runVerify = async () => {
  if (!vPassword.value || !vHash.value.trim()) return toast.warn('请输入密码与待校验的哈希值')
  vBusy.value = true
  verdict.value = ''
  try {
    const bcrypt = await lib()
    const ok = await bcrypt.compare(vPassword.value, vHash.value.trim())
    verdict.value = ok ? 'ok' : 'bad'
    ok ? toast.ok('校验通过：密码与哈希匹配') : toast.warn('校验未通过：密码与哈希不匹配')
  } catch (e) {
    verdict.value = ''
    toast.err(`校验失败：${(e as Error).message}（请确认是 $2a$/$2b$ 开头的 bcrypt 哈希）`)
  } finally {
    vBusy.value = false
  }
}

const roundsCost = (n: number) => (n >= 13 ? '很慢（数十秒级）' : n >= 11 ? '较慢（秒级）' : n <= 6 ? '极快，仅测试用' : '常用范围')
</script>

<template>
  <div class="grid-2 bcrypt">
    <!-- 生成 -->
    <div class="pane">
      <div class="row" style="gap: 8px; align-items: center">
        <Hash :size="16" class="pane-ic" /><span class="pane-title">生成哈希</span>
      </div>
      <div class="mt-2">
        <span class="field-label">明文密码</span>
        <input v-model="password" type="password" class="input mono" placeholder="输入密码（不会上传，仅本地运算）" />
      </div>
      <div class="mt-2">
        <div class="row row-wrap" style="gap: 10px; align-items: center">
          <span class="field-label" style="margin: 0">计算轮次</span>
          <input v-model.number="rounds" type="range" min="4" max="15" step="1" class="range" />
          <b class="mono">{{ genSaltRounds() }}</b>
          <span class="muted small">{{ roundsCost(genSaltRounds()) }}</span>
        </div>
        <p class="muted small" style="margin-top: 4px">口径：OWASP 建议 cost≥10；每提升 1 轮耗时约翻倍。</p>
      </div>
      <div class="mt-2 row row-wrap" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">版本</span>
        <label class="check"><input v-model="version" type="radio" value="$2b$" /> $2b$（推荐）</label>
        <label class="check"><input v-model="version" type="radio" value="$2a$" /> $2a$（旧系统）</label>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="runGen">
          <Loader2 v-if="busy" :size="15" class="spin" /><Hash v-else :size="15" /> 生成 bcrypt 哈希
        </button>
        <span v-if="estimateText" class="muted small">{{ estimateText }}</span>
      </div>
      <div v-if="genHash" class="mt-2">
        <!-- 分段标注：版本｜轮次｜盐｜摘要 -->
        <div v-if="hashSegs()" class="hash-box mono segs">
          <span class="seg-v" title="算法版本">{{ hashSegs()!.ver }}</span><span class="seg-r" title="计算轮次">{{ hashSegs()!.rounds }}</span><span>$</span><span class="seg-s" title="22 字符盐">{{ hashSegs()!.salt }}</span><span class="seg-d" title="31 字符摘要">{{ hashSegs()!.digest }}</span>
        </div>
        <div v-else class="hash-box mono">{{ genHash }}</div>
        <div class="legend small">
          <span><i class="dot seg-v"></i>版本</span>
          <span><i class="dot seg-r"></i>轮次</span>
          <span><i class="dot seg-s"></i>22 字符盐</span>
          <span><i class="dot seg-d"></i>31 字符摘要</span>
        </div>
        <div class="row row-wrap mt-1" style="gap: 10px; align-items: center">
          <button class="btn btn-ghost btn-sm" @click="doCopy">
            <Check v-if="copied" :size="14" color="#34d399" /><Copy v-else :size="14" /> 复制
          </button>
          <button class="btn btn-ghost btn-sm" @click="fillVerify"><ShieldCheck :size="14" /> 去验证此哈希</button>
          <span class="muted small">轮次 {{ genHash.slice(4, 6) }} · 耗时 {{ genMs }}ms</span>
        </div>
        <p class="muted small mt-1">同一密码每次生成的哈希不同（盐随机），但都可以用「验证」确认匹配。</p>
      </div>
    </div>

    <!-- 验证 -->
    <div class="pane">
      <div class="row" style="gap: 8px; align-items: center">
        <ShieldCheck :size="16" class="pane-ic" /><span class="pane-title">验证密码</span>
      </div>
      <div class="mt-2">
        <span class="field-label">密码</span>
        <input ref="vPasswordEl" v-model="vPassword" type="password" class="input mono" placeholder="输入待验证的明文密码" />
      </div>
      <div class="mt-2">
        <span class="field-label">bcrypt 哈希值</span>
        <input v-model="vHash" class="input mono" placeholder="$2a$10$…" />
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="vBusy" @click="runVerify">
          <Loader2 v-if="vBusy" :size="15" class="spin" /><ShieldCheck v-else :size="15" /> 验证
        </button>
      </div>
      <p v-if="verdict === 'ok'" class="verdict ok mt-2">✓ 匹配：密码与哈希一致</p>
      <p v-else-if="verdict === 'bad'" class="verdict bad mt-2">✗ 不匹配：密码或哈希有误</p>
      <p class="muted small mt-2">验证耗时与生成轮次相同，高轮次哈希校验也会稍慢，属正常现象。$2a$ 与 $2b$ 版本均可验证。</p>
    </div>
  </div>
</template>

<style scoped>
.pane {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.pane-ic { color: var(--accent-text); }
.pane-title { font-weight: 700; font-size: 14px; }
.range { flex: 1; min-width: 120px; accent-color: var(--accent); }
.hash-box {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-2, rgba(127, 127, 127, 0.1)) 60%, transparent);
  font-size: 12.5px;
  overflow-wrap: anywhere;
  color: var(--text-2);
  word-break: break-all;
}
.seg-v { color: #60a5fa; font-weight: 700; }
.seg-r { color: #c084fc; font-weight: 700; }
.seg-s { color: var(--text-2); }
.seg-d { color: var(--accent-text); font-weight: 600; }
.legend { display: flex; gap: 12px; margin-top: 4px; color: var(--text-3); flex-wrap: wrap; }
.legend span { display: inline-flex; align-items: center; gap: 4px; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
.dot.seg-v { background: #60a5fa; }
.dot.seg-r { background: #c084fc; }
.dot.seg-s { background: var(--text-3); }
.dot.seg-d { background: var(--accent-text); }
.verdict { font-weight: 700; }
.verdict.ok { color: var(--ok); }
.verdict.bad { color: var(--err); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
