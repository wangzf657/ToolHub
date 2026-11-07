<script setup lang="ts">
import { ref } from 'vue'
import { Dices, Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const min = ref(1)
const max = ref(100)
const count = ref(10)
const allowRepeat = ref(true)

const numbers = ref<number[]>([])
const copied = ref(false)

const generate = () => {
  const lo = Math.ceil(min.value)
  const hi = Math.floor(max.value)
  if (Number.isNaN(lo) || Number.isNaN(hi)) {
    toast.err('请输入有效的最小值与最大值')
    return
  }
  if (lo > hi) {
    toast.err('最小值不能大于最大值')
    return
  }
  const n = Math.max(1, Math.min(10000, Math.floor(count.value)))
  const rangeSize = hi - lo + 1
  if (!allowRepeat.value && n > rangeSize) {
    toast.err(`不重复模式下数量不能超过区间大小（${rangeSize}）`)
    return
  }
  const used = new Set<number>()
  const out: number[] = []
  while (out.length < n) {
    // 拒绝采样避免取模偏差
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const limit = Math.floor(0x100000000 / rangeSize) * rangeSize
    if (buf[0] >= limit) continue
    const v = lo + (buf[0] % rangeSize)
    if (!allowRepeat.value) {
      if (used.has(v)) continue
      used.add(v)
    }
    out.push(v)
  }
  numbers.value = out
  copied.value = false
}

generate()

const doCopy = async () => {
  const okFlag = await copyText(numbers.value.join('\n'))
  okFlag ? toast.ok('已复制全部随机数') : toast.err('复制失败')
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="grid-3">
        <div>
          <span class="field-label">最小值</span>
          <input v-model.number="min" type="number" class="input" />
        </div>
        <div>
          <span class="field-label">最大值</span>
          <input v-model.number="max" type="number" class="input" />
        </div>
        <div>
          <span class="field-label">数量（1–10000）</span>
          <input v-model.number="count" type="number" class="input" min="1" max="10000" />
        </div>
      </div>

      <div class="row mt-2">
        <label class="check">
          <input v-model="allowRepeat" type="checkbox" />
          <span>允许重复</span>
        </label>
        <button class="btn btn-primary" @click="generate">
          <Dices :size="16" /> 生成随机数
        </button>
      </div>
    </div>

    <div v-if="numbers.length" class="mt-2">
      <div class="io-head">
        <span class="io-title">共 {{ numbers.length }} 个随机数</span>
        <button class="btn btn-ghost btn-sm" @click="doCopy">
          <Check v-if="copied" :size="14" color="var(--ok)" />
          <Copy v-else :size="14" /> 复制全部
        </button>
      </div>
      <div class="num-grid mt-1">
        <span v-for="(n, i) in numbers.slice(0, 200)" :key="i" class="num-chip mono">{{ n }}</span>
      </div>
      <p v-if="numbers.length > 200" class="muted small mt-1">
        仅展示前 200 个，点击「复制全部」获取完整结果
      </p>
      <textarea v-show="false" :value="numbers.join('\n')"></textarea>
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
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.num-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.num-chip {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
  font-size: 13.5px;
}
</style>
