<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check, RefreshCw } from 'lucide-vue-next'
import { randomString } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const length = ref(16)
const count = ref(5)
const upper = ref(true)
const lower = ref(true)
const digits = ref(true)
const symbols = ref(true)
const excludeAmbiguous = ref(false)

const passwords = ref<string[]>([])
const copiedIdx = ref(-1)

const generate = () => {
  if (!upper.value && !lower.value && !digits.value && !symbols.value) {
    toast.warn('请至少选择一种字符类型')
    return
  }
  passwords.value = Array.from({ length: Math.max(1, Math.min(50, count.value)) }, () =>
    randomString(length.value, {
      upper: upper.value,
      lower: lower.value,
      digits: digits.value,
      symbols: symbols.value,
      excludeAmbiguous: excludeAmbiguous.value,
    }),
  )
}
generate()

/** 估算池大小与熵 bits */
const strengthOf = (pw: string): { bits: number; label: string; color: string; pct: number } => {
  let pool = 0
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[a-z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 26
  const bits = pw.length * Math.log2(Math.max(pool, 2))
  const pct = Math.min(100, (bits / 128) * 100)
  if (bits < 50) return { bits, label: '弱', color: 'var(--err)', pct }
  if (bits < 80) return { bits, label: '中', color: 'var(--warn)', pct }
  if (bits < 110) return { bits, label: '强', color: 'var(--ok)', pct }
  return { bits, label: '极强', color: 'var(--accent-text)', pct }
}

const doCopy = async (pw: string, i: number) => {
  const okFlag = await copyText(pw)
  if (okFlag) {
    copiedIdx.value = i
    toast.ok('已复制到剪贴板')
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else {
    toast.err('复制失败')
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="len-row">
        <span class="field-label">密码长度：{{ length }}</span>
        <input v-model.number="length" type="range" min="6" max="64" step="1" />
      </div>

      <div class="row row-wrap checks">
        <label class="check"><input v-model="upper" type="checkbox" /> <span>大写字母 A-Z</span></label>
        <label class="check"><input v-model="lower" type="checkbox" /> <span>小写字母 a-z</span></label>
        <label class="check"><input v-model="digits" type="checkbox" /> <span>数字 0-9</span></label>
        <label class="check"><input v-model="symbols" type="checkbox" /> <span>符号 !@#$</span></label>
        <label class="check"><input v-model="excludeAmbiguous" type="checkbox" /> <span>排除易混字符（l/1/O/0 等）</span></label>
      </div>

      <div class="row mt-2">
        <span class="field-label" style="margin: 0">生成数量</span>
        <input v-model.number="count" type="number" class="input count-input" min="1" max="50" />
        <button class="btn btn-primary btn-sm" @click="generate">
          <RefreshCw :size="15" /> 生成
        </button>
      </div>
    </div>

    <div class="list mt-2">
      <div v-for="(pw, i) in passwords" :key="`${i}-${pw}`" class="pw-row">
        <code class="pw-text mono">{{ pw }}</code>
        <div class="pw-meta">
          <span class="pw-label" :style="{ color: strengthOf(pw).color }">{{ strengthOf(pw).label }}</span>
          <button class="copy-btn" title="复制" @click="doCopy(pw, i)">
            <Check v-if="copiedIdx === i" :size="14" color="var(--ok)" />
            <Copy v-else :size="14" />
          </button>
        </div>
        <div class="bar">
          <div class="bar-fill" :style="{ width: strengthOf(pw).pct + '%', background: strengthOf(pw).color }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opts-panel {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.len-row {
  display: grid;
  gap: 4px;
}
.checks {
  gap: 16px;
  margin-top: 10px;
}
.count-input {
  width: 90px;
}
.list {
  display: grid;
  gap: 8px;
}
.pw-row {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
}
.pw-text {
  font-size: 15px;
  letter-spacing: 0.5px;
  word-break: break-all;
}
.pw-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pw-label {
  font-size: 12.5px;
  font-weight: 700;
}
.copy-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.copy-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.bar {
  grid-column: 1 / -1;
  margin-top: 8px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease;
}
</style>
