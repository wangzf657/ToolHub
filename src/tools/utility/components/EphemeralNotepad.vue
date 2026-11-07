<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Eraser, Timer, Trash2, ShieldOff } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 自毁档期（秒）；0 表示不自动清空 */
const options = [
  { label: '30 秒', value: 30 },
  { label: '2 分钟', value: 120 },
  { label: '5 分钟', value: 300 },
  { label: '关闭自毁', value: 0 },
]
const ttl = ref(120)

const text = ref('')
const left = ref(0) // 剩余秒

let timer: number | undefined

const armTimer = () => {
  window.clearInterval(timer)
  timer = undefined
  if (ttl.value <= 0) {
    left.value = 0
    return
  }
  left.value = ttl.value
  timer = window.setInterval(() => {
    left.value--
    if (left.value <= 0) {
      window.clearInterval(timer)
      timer = undefined
      if (text.value) {
        text.value = ''
        toast.warn('便签已按自毁倒计时自动清空')
      }
      left.value = ttl.value
    }
  }, 1000)
}

const resetOnEdit = () => {
  if (ttl.value > 0) armTimer()
}

watch(ttl, armTimer)
armTimer()

const clearNow = () => {
  text.value = ''
  if (ttl.value > 0) armTimer()
  toast.ok('已清空（内存中不再保留任何内容）')
}

const leftLabel = computed(() => {
  if (ttl.value <= 0) return '自毁已关闭'
  const m = Math.floor(left.value / 60)
  const s = left.value % 60
  return m > 0 ? `${m} 分 ${String(s).padStart(2, '0')} 秒后自动清空` : `${s} 秒后自动清空`
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div>
    <div class="notice notice-warn small">
      <ShieldOff :size="16" />
      闪念便签只保存在当前页面内存里：不写入磁盘、不同步、不经过网络，刷新或关闭页面即全部焚毁。可再配合自毁倒计时，到点自动清空。
    </div>

    <div class="opts row row-wrap mt-2">
      <span class="field-label" style="margin: 0"><Timer :size="15" /> 自毁倒计时</span>
      <button
        v-for="o in options"
        :key="o.value"
        class="chip"
        :class="{ active: ttl === o.value }"
        @click="ttl = o.value"
      >{{ o.label }}</button>
      <span v-if="ttl > 0" class="mono warn-label">{{ leftLabel }}</span>
    </div>

    <textarea
      v-model="text"
      class="textarea mt-2"
      style="min-height: 260px"
      placeholder="随手记点什么……这段文字只活在这个页面的内存里。"
      @input="resetOnEdit"
    ></textarea>

    <div class="row row-wrap mt-2">
      <button class="btn btn-danger" :disabled="!text" @click="clearNow">
        <Trash2 :size="16" /> 立即清空
      </button>
      <span class="muted small">{{ text.length }} 字符 · 仅在内存中</span>
    </div>
  </div>
</template>

<style scoped>
.opts {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  gap: 8px;
}
.warn-label {
  color: var(--warn);
  font-size: 13px;
  margin-left: auto;
}
.notice {
  align-items: center;
}
</style>
