<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye, EyeOff, ShieldCheck } from 'lucide-vue-next'

const password = ref('')
const show = ref(false)

/** 字符类别数 */
const classCount = computed(() => {
  let n = 0
  if (/[a-z]/.test(password.value)) n++
  if (/[A-Z]/.test(password.value)) n++
  if (/[0-9]/.test(password.value)) n++
  if (/[^A-Za-z0-9\s]/.test(password.value)) n++
  return n
})

/** 熵 = len * log2(pool)，pool 按实际出现类别累计 */
const entropyBits = computed(() => {
  const pw = password.value
  if (!pw) return 0
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^A-Za-z0-9\s]/.test(pw)) pool += 32
  return pw.length * Math.log2(Math.max(pool, 2))
})

const guesses = computed(() => 2 ** entropyBits.value)

/** 按 1e11 次/秒 估算暴力破解时间 */
const crackTime = computed(() => {
  if (!password.value) return '—'
  const seconds = guesses.value / 2 / 1e11
  if (seconds < 1) return '不到 1 秒'
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  const m = seconds / 60
  if (m < 60) return `${Math.round(m)} 分钟`
  const h = m / 60
  if (h < 24) return `${Math.round(h)} 小时`
  const d = h / 24
  if (d < 365) return `${Math.round(d)} 天`
  const y = d / 365
  if (y < 1e4) return `${Math.round(y)} 年`
  if (y < 1e8) return `${(y / 1e4).toFixed(1)} 万年`
  if (y < 1e12) return `${(y / 1e8).toFixed(1)} 亿年`
  return '天文数字（宇宙年龄的倍数）'
})

const level = computed(() => {
  const bits = entropyBits.value
  if (!password.value) return { label: '—', color: 'var(--text-3)', pct: 0 }
  if (bits < 40) return { label: '非常弱', color: 'var(--err)', pct: 20 }
  if (bits < 60) return { label: '弱', color: 'var(--err)', pct: 40 }
  if (bits < 80) return { label: '中等', color: 'var(--warn)', pct: 60 }
  if (bits < 110) return { label: '强', color: 'var(--ok)', pct: 80 }
  return { label: '非常强', color: 'var(--ok)', pct: 100 }
})

const fmtBits = computed(() => (entropyBits.value >= 1000 ? entropyBits.value.toExponential(2) : entropyBits.value.toFixed(1)))
</script>

<template>
  <div>
    <div class="in-row">
      <input
        v-model="password"
        class="input mono"
        :type="show ? 'text' : 'password'"
        placeholder="输入要检测的密码（仅在本页面内存中计算，不会发送）"
      />
      <button class="eye-btn" :title="show ? '隐藏' : '显示'" :aria-label="show ? '隐藏' : '显示'" @click="show = !show">
        <EyeOff v-if="show" :size="16" />
        <Eye v-else :size="16" />
      </button>
    </div>

    <div class="meter mt-2">
      <div class="meter-fill" :style="{ width: level.pct + '%', background: level.color }"></div>
    </div>

    <div class="row row-wrap mt-1" style="gap: 14px">
      <span class="level-label" :style="{ color: level.color }"><ShieldCheck :size="16" /> {{ level.label }}</span>
      <span class="muted small">信息熵 {{ fmtBits }} bits</span>
      <span class="muted small">暴力破解估算（1e11 次/秒）：约 {{ crackTime }}</span>
    </div>

    <div class="tiles grid-4 mt-2">
      <div class="tile">
        <span class="tile-num">{{ password.length }}</span>
        <span class="tile-label">密码长度</span>
      </div>
      <div class="tile">
        <span class="tile-num">{{ classCount }}</span>
        <span class="tile-label">字符类别数</span>
      </div>
      <div class="tile">
        <span class="tile-num">{{ fmtBits }}</span>
        <span class="tile-label">熵（bits）</span>
      </div>
      <div class="tile">
        <span class="tile-num" :style="{ color: level.color }">{{ level.label }}</span>
        <span class="tile-label">强度评级</span>
      </div>
    </div>

    <div class="notice notice-info mt-2 small">
      计算口径：熵 = 长度 × log₂(字符池大小)，字符池按实际出现的类别（小写 26 / 大写 26 / 数字 10 / 符号 32）累计；破解时间按每秒 1e11 次尝试折半估算。该估算不包含字典攻击与撞库风险，建议配合密码管理器使用。
    </div>
  </div>
</template>

<style scoped>
.in-row {
  display: flex;
  gap: 8px;
}
.eye-btn {
  flex: none;
  width: 42px;
  height: 42px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
  color: var(--text-2);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.eye-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.meter {
  height: 10px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease, background 0.25s ease;
}
.level-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 15px;
}
.tiles {
  gap: 10px;
}
.tile {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 14px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.tile-num {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--font-mono);
}
.tile-label {
  font-size: 12.5px;
  color: var(--text-3);
}
</style>
