<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Monitor, Chrome, Cpu, Smartphone } from 'lucide-vue-next'
import { uaParse, type UaInfo } from '@/lib/jsEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const ua = ref('')
const result = ref<UaInfo | null>(null)
const error = ref('')

onMounted(() => {
  ua.value = navigator.userAgent
  parse()
})

const parse = () => {
  error.value = ''
  result.value = null
  if (!ua.value.trim()) {
    error.value = '请输入 User-Agent 字符串'
    return
  }
  result.value = uaParse(ua.value)
  toast.ok('解析完成')
}

const reset = () => {
  ua.value = navigator.userAgent
  parse()
}

const CARDS = [
  { key: 'browser', label: '浏览器', icon: Chrome },
  { key: 'engine', label: '渲染引擎', icon: Cpu },
  { key: 'os', label: '操作系统', icon: Monitor },
  { key: 'device', label: '设备类型', icon: Smartphone },
] as const
</script>

<template>
  <div class="ua-parser">
    <span class="field-label">User-Agent 字符串</span>
    <textarea v-model="ua" class="textarea mono" style="min-height: 100px" spellcheck="false" placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) …"></textarea>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" @click="parse">解析 UA</button>
      <button class="btn btn-ghost" @click="reset">重新填入当前浏览器 UA</button>
    </div>

    <div v-if="result" class="mt-3 cards">
      <div v-for="c in CARDS" :key="c.key" class="ua-card">
        <component :is="c.icon" :size="20" class="card-icon" />
        <span class="card-label">{{ c.label }}</span>
        <b class="card-value">{{ result[c.key] }}</b>
      </div>
    </div>
    <div v-else-if="error" class="notice notice-warn mt-2">{{ error }}</div>

    <div class="mt-3">
      <span class="field-label">原始字符串</span>
      <div class="raw mono">{{ ua }}</div>
    </div>

    <p class="notice notice-info mt-3 small">
      解析基于规则匹配（正则特征库），UA Client Hints 时代部分浏览器会冻结或简化 UA，结果仅供参考。
    </p>
  </div>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.ua-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  display: grid;
  gap: 6px;
  justify-items: start;
}
.card-icon {
  color: var(--accent-text);
}
.card-label {
  font-size: 12.5px;
  color: var(--text-3);
}
.card-value {
  font-size: 14.5px;
  overflow-wrap: anywhere;
}
.raw {
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 12.5px;
  overflow-wrap: anywhere;
  max-height: 120px;
  overflow: auto;
}
@media (max-width: 860px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
