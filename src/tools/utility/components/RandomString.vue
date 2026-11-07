<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { randomString } from '@/lib/textEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const count = ref(10)
const length = ref(24)
const upper = ref(true)
const lower = ref(true)
const digits = ref(true)
const symbols = ref(false)
const excludeAmbiguous = ref(false)

const output = ref('')

const generate = () => {
  if (!upper.value && !lower.value && !digits.value && !symbols.value) {
    toast.warn('请至少选择一种字符类型')
    return
  }
  const n = Math.max(1, Math.min(500, count.value))
  const list = Array.from({ length: n }, () =>
    randomString(Math.max(1, Math.min(256, length.value)), {
      upper: upper.value,
      lower: lower.value,
      digits: digits.value,
      symbols: symbols.value,
      excludeAmbiguous: excludeAmbiguous.value,
    }),
  )
  output.value = list.join('\n')
  toast.ok(`已生成 ${n} 条随机字符串`)
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="grid-2">
        <div>
          <span class="field-label">生成数量（1–500）</span>
          <input v-model.number="count" type="number" class="input" min="1" max="500" />
        </div>
        <div>
          <span class="field-label">字符串长度（1–256）</span>
          <input v-model.number="length" type="number" class="input" min="1" max="256" />
        </div>
      </div>

      <div class="row row-wrap checks">
        <label class="check"><input v-model="upper" type="checkbox" /> <span>大写字母</span></label>
        <label class="check"><input v-model="lower" type="checkbox" /> <span>小写字母</span></label>
        <label class="check"><input v-model="digits" type="checkbox" /> <span>数字</span></label>
        <label class="check"><input v-model="symbols" type="checkbox" /> <span>符号</span></label>
        <label class="check"><input v-model="excludeAmbiguous" type="checkbox" /> <span>排除易混字符</span></label>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" @click="generate">
          <RefreshCw :size="16" /> 批量生成
        </button>
        <span class="muted small">使用 crypto.getRandomValues 密码学随机源</span>
      </div>
    </div>

    <ResultBox v-model="output" title="生成结果（每行一条）" download="txt" class="mt-2" />
  </div>
</template>

<style scoped>
.opts-panel {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.checks {
  gap: 16px;
  margin-top: 12px;
}
</style>
