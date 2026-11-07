<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeftRight } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const tsInput = ref('')
const msMode = ref<'auto' | 's' | 'ms'>('auto')
const forward = ref({ local: '', utc: '', iso: '', usedMs: false })
const dtLocal = ref('')
const dtUtc = ref('')
const reverseTs = ref('')
const now = ref(Date.now())
let timer: number | undefined

onMounted(() => {
  timer = window.setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const nowS = computed(() => Math.floor(now.value / 1000))

const convertTs = () => {
  const raw = tsInput.value.trim()
  if (!raw) return toast.warn('请输入时间戳')
  if (!/^-?\d+$/.test(raw)) {
    toast.err('时间戳必须是整数（秒或毫秒）')
    return
  }
  let ms = Number(raw)
  const digits = raw.replace('-', '').length
  const useMs = msMode.value === 'ms' || (msMode.value === 'auto' && digits >= 13)
  if (!useMs) ms *= 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) {
    toast.err('时间戳超出可表示范围')
    return
  }
  forward.value = {
    local: d.toLocaleString('zh-CN', { hour12: false }),
    utc: d.toUTCString(),
    iso: d.toISOString(),
    usedMs: useMs,
  }
}

const useNow = (mode: 's' | 'ms') => {
  tsInput.value = String(mode === 's' ? Math.floor(now.value / 1000) : now.value)
  convertTs()
}

const reverse = () => {
  if (!dtLocal.value) return toast.warn('请选择日期时间')
  const d = new Date(dtLocal.value)
  if (Number.isNaN(d.getTime())) {
    toast.err('日期无效')
    return
  }
  dtUtc.value = d.toUTCString()
  reverseTs.value = String(Math.floor(d.getTime() / 1000))
}
</script>

<template>
  <div class="ts-cvt">
    <div class="now-card">
      <span class="now-label">当前时间戳</span>
      <code class="now-val mono">{{ nowS }}</code>
      <button class="btn btn-soft btn-sm" @click="useNow('s')">用秒级</button>
      <button class="btn btn-soft btn-sm" @click="useNow('ms')">用毫秒级</button>
    </div>

    <div class="grid-2 mt-3" style="gap: 16px">
      <section>
        <span class="field-label">时间戳 → 日期</span>
        <div class="row" style="gap: 8px">
          <input v-model="tsInput" type="text" class="input mono grow" placeholder="1700000000 或 1700000000000" @keyup.enter="convertTs" />
          <select v-model="msMode" class="select" style="width: 96px">
            <option value="auto">自动识别</option>
            <option value="s">秒</option>
            <option value="ms">毫秒</option>
          </select>
          <button class="btn btn-primary btn-sm" @click="convertTs">转换</button>
        </div>
        <div v-if="forward.local" class="result-list mt-2">
          <div class="res-row"><span>本地时间</span><b>{{ forward.local }}</b></div>
          <div class="res-row"><span>UTC</span><b>{{ forward.utc }}</b></div>
          <div class="res-row"><span>ISO 8601</span><b class="mono">{{ forward.iso }}</b></div>
        </div>
      </section>

      <section>
        <span class="field-label">日期 → 时间戳</span>
        <div class="row" style="gap: 8px">
          <input v-model="dtLocal" type="datetime-local" class="input grow" step="1" @change="reverse" />
          <button class="btn btn-primary btn-sm" @click="reverse"><ArrowLeftRight :size="14" /> 转换</button>
        </div>
        <div v-if="reverseTs" class="result-list mt-2">
          <div class="res-row"><span>Unix 秒</span><b class="mono">{{ reverseTs }}</b></div>
          <div class="res-row"><span>UTC 日期</span><b>{{ dtUtc }}</b></div>
        </div>
      </section>
    </div>

    <p class="notice notice-info mt-3 small">
      口径说明：时间戳按 <b>Unix Epoch（1970-01-01 UTC）</b>计算；13 位为毫秒、10 位为秒，自动识别以位数 ≥ 13 判定。本地时间取决于你设备的时区。
    </p>
  </div>
</template>

<style scoped>
.now-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--accent-soft);
}
.now-label {
  font-size: 13px;
  color: var(--text-2);
  font-weight: 600;
}
.now-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent-text);
  letter-spacing: 0.5px;
}
.result-list {
  display: grid;
  gap: 7px;
}
.res-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.res-row span {
  color: var(--text-3);
  flex: none;
}
.res-row b {
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
