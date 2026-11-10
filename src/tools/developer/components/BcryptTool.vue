<script setup lang="ts">
import { ref } from 'vue'
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
const copied = ref(false)

/* ---------- 验证 ---------- */
const vPassword = ref('')
const vHash = ref('')
const vBusy = ref(false)
const verdict = ref<'' | 'ok' | 'bad'>('')

/** bcryptjs 按需加载（纯 JS 实现，浏览器本地运算） */
async function lib() {
  return import('bcryptjs')
}

const genSaltRounds = () => Math.min(15, Math.max(4, Math.round(rounds.value) || 10))

const runGen = async () => {
  if (!password.value) return toast.warn('请输入要哈希的密码')
  busy.value = true
  genHash.value = ''
  try {
    const bcrypt = await lib()
    const r = genSaltRounds()
    const t0 = performance.now()
    genHash.value = await bcrypt.hash(password.value, r)
    genMs.value = Math.round(performance.now() - t0)
  } catch (e) {
    toast.err(`生成失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
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
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="runGen">
          <Loader2 v-if="busy" :size="15" class="spin" /><Hash v-else :size="15" /> 生成 bcrypt 哈希
        </button>
      </div>
      <div v-if="genHash" class="mt-2">
        <div class="hash-box mono">{{ genHash }}</div>
        <div class="row row-wrap mt-1" style="gap: 10px; align-items: center">
          <button class="btn btn-ghost btn-sm" @click="doCopy">
            <Check v-if="copied" :size="14" color="#34d399" /><Copy v-else :size="14" /> 复制
          </button>
          <span class="muted small">轮次 {{ genHash.slice(4, 6) }} · 耗时 {{ genMs }}ms · 格式 $2a$/$2b$（22 字符盐 + 31 字符摘要）</span>
        </div>
      </div>
    </div>

    <!-- 验证 -->
    <div class="pane">
      <div class="row" style="gap: 8px; align-items: center">
        <ShieldCheck :size="16" class="pane-ic" /><span class="pane-title">验证密码</span>
      </div>
      <div class="mt-2">
        <span class="field-label">密码</span>
        <input v-model="vPassword" type="password" class="input mono" placeholder="输入待验证的明文密码" />
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
      <p class="muted small mt-2">验证耗时与生成轮次相同，高轮次哈希校验也会稍慢，属正常现象。</p>
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
}
.verdict { font-weight: 700; }
.verdict.ok { color: var(--ok); }
.verdict.bad { color: var(--err); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
