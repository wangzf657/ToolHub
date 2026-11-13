<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeftRight, Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const tsInput = ref('')
const msMode = ref<'auto' | 's' | 'ms'>('auto')
const forward = ref({ local: '', utc: '', iso: '', usedMs: false })
const dtLocal = ref('')
const dtUtc = ref('')
const reverseTs = ref('')
const reverseMs = ref('')
const now = ref(Date.now())
let timer: number | undefined
/** 时区显示选择（默认本地，记忆上次选择） */
const TZS = ['本地', 'UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/New_York', 'Europe/London']
const tz = ref(localStorage.getItem('toolhub.ts-tz') || '本地')
watch(tz, (v) => localStorage.setItem('toolhub.ts-tz', v))
/** 批量模式 */
const batchMode = ref(false)
const batchInput = ref('')
const batchRows = ref<{ ts: string; local: string; iso: string }[]>([])
/** 最近复制的行（对勾反馈） */
const copiedKey = ref('')

onMounted(() => {
  timer = window.setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const nowS = computed(() => Math.floor(now.value / 1000))

const fmtLocal = (d: Date) =>
  tz.value === '本地' ? d.toLocaleString('zh-CN', { hour12: false }) : d.toLocaleString('zh-CN', { timeZone: tz.value, hour12: false })

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
  forward.value = { local: fmtLocal(d), utc: d.toUTCString(), iso: d.toISOString(), usedMs: useMs }
}

/** rx3 粘贴即转换：输入为有效整数后 300ms 内自动转换 */
watch(tsInput, (v) => {
  if (/^-?\d{10,13}$/.test(v.trim())) setTimeout(convertTs, 0)
})

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
  reverseMs.value = String(d.getTime())
}

/** 批量转换：逐行判定 10/13 位，输出三列（时间戳/本地/ISO） */
const runBatch = () => {
  const rows: { ts: string; local: string; iso: string }[] = []
  for (const line of batchInput.value.split('\n')) {
    const t = line.trim().split(/[\s,;\t]+/)[0] ?? ''
    if (!/^-?\d{10,13}$/.test(t)) continue
    const digits = t.replace('-', '').length
    const ms = digits >= 13 ? Number(t) : Number(t) * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) continue
    rows.push({ ts: t, local: fmtLocal(d), iso: d.toISOString() })
  }
  batchRows.value = rows
  if (!rows.length) toast.warn('未识别到有效时间戳行（每行一个 10/13 位整数）')
  else toast.ok(`批量转换 ${rows.length} 行`)
}

const copyVal = async (text: string, key: string) => {
  if (!text) return
  const okFlag = await copyText(text)
  if (okFlag) {
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = ''
    }, 1500)
  } else toast.err('复制失败，请手动选择复制')
}
</script>

<template>
  <div class="ts-cvt">
    <div class="now-card">
      <span class="now-label">当前时间戳</span>
      <code class="now-val mono">{{ nowS }}</code>
      <button class="btn btn-soft btn-sm" @click="useNow('s')">用秒级</button>
      <button class="btn btn-soft btn-sm" @click="useNow('ms')">用毫秒级</button>
      <label class="check"><input v-model="batchMode" type="checkbox" /> 批量模式</label>
    </div>

    <template v-if="!batchMode">
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
            <div class="res-row">
              <span>本地时间（{{ tz }}）</span><b>{{ forward.local }}</b>
              <button class="row-copy" :aria-label="`复制本地时间`" @click="copyVal(forward.local, 'f-local')">
                <Check v-if="copiedKey === 'f-local'" :size="13" color="#34d399" /><Copy v-else :size="13" />
              </button>
            </div>
            <div class="res-row">
              <span>UTC</span><b>{{ forward.utc }}</b>
              <button class="row-copy" aria-label="复制 UTC 时间" @click="copyVal(forward.utc, 'f-utc')">
                <Check v-if="copiedKey === 'f-utc'" :size="13" color="#34d399" /><Copy v-else :size="13" />
              </button>
            </div>
            <div class="res-row">
              <span>ISO 8601</span><b class="mono">{{ forward.iso }}</b>
              <button class="row-copy" aria-label="复制 ISO 时间" @click="copyVal(forward.iso, 'f-iso')">
                <Check v-if="copiedKey === 'f-iso'" :size="13" color="#34d399" /><Copy v-else :size="13" />
              </button>
            </div>
          </div>
          <div class="row row-wrap mt-2" style="gap: 8px; align-items: center">
            <span class="muted small">时区显示</span>
            <select v-model="tz" class="select" style="width: 170px">
              <option v-for="z in TZS" :key="z" :value="z">{{ z === '本地' ? '本地（设备时区）' : z }}</option>
            </select>
            <span class="muted small">切换后重新转换生效，选择会被记住</span>
          </div>
        </section>

        <section>
          <span class="field-label">日期 → 时间戳</span>
          <div class="row" style="gap: 8px">
            <input v-model="dtLocal" type="datetime-local" class="input grow" step="1" @change="reverse" />
            <button class="btn btn-primary btn-sm" @click="reverse"><ArrowLeftRight :size="14" /> 转换</button>
          </div>
          <div v-if="reverseTs" class="result-list mt-2">
            <div class="res-row">
              <span>Unix 秒</span><b class="mono">{{ reverseTs }}</b>
              <button class="row-copy" aria-label="复制 Unix 秒" @click="copyVal(reverseTs, 'r-s')">
                <Check v-if="copiedKey === 'r-s'" :size="13" color="#34d399" /><Copy v-else :size="13" />
              </button>
            </div>
            <div class="res-row">
              <span>Unix 毫秒</span><b class="mono">{{ reverseMs }}</b>
              <button class="row-copy" aria-label="复制 Unix 毫秒" @click="copyVal(reverseMs, 'r-ms')">
                <Check v-if="copiedKey === 'r-ms'" :size="13" color="#34d399" /><Copy v-else :size="13" />
              </button>
            </div>
            <div class="res-row">
              <span>UTC 日期</span><b>{{ dtUtc }}</b>
              <button class="row-copy" aria-label="复制 UTC 日期" @click="copyVal(dtUtc, 'r-utc')">
                <Check v-if="copiedKey === 'r-utc'" :size="13" color="#34d399" /><Copy v-else :size="13" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>

    <template v-else>
      <div class="mt-3">
        <span class="field-label">批量时间戳（每行一个，10 位秒 / 13 位毫秒自动判定）</span>
        <textarea v-model="batchInput" class="textarea mono" style="min-height: 150px" placeholder="1700000000&#10;1700000000000&#10;1730000000"></textarea>
        <div class="row mt-2">
          <button class="btn btn-primary btn-sm" @click="runBatch">批量转换</button>
          <button v-if="batchRows.length" class="btn btn-ghost btn-sm" @click="copyVal(batchRows.map((r) => `${r.ts},${r.local},${r.iso}`).join('\n'), 'b-all')">
            <Check v-if="copiedKey === 'b-all'" :size="14" color="#34d399" /><Copy v-else :size="14" /> 复制全部（CSV 三列）
          </button>
        </div>
        <div v-if="batchRows.length" class="result-list mt-2">
          <div v-for="r in batchRows" :key="r.ts" class="res-row">
            <span class="mono">{{ r.ts }}</span><b>{{ r.local }}</b><b class="mono" style="color: var(--text-3)">{{ r.iso }}</b>
            <button class="row-copy" :aria-label="`复制 ${r.ts}`" @click="copyVal(`${r.ts},${r.local},${r.iso}`, r.ts)">
              <Check v-if="copiedKey === r.ts" :size="13" color="#34d399" /><Copy v-else :size="13" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <p class="notice notice-info mt-3 small">
      口径说明：时间戳按 <b>Unix Epoch（1970-01-01 UTC）</b>计算；13 位为毫秒、10 位为秒，自动识别以位数 ≥ 13 判定。本地时间取决于你设备的时区（可选其他时区仅作显示换算）。
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
  flex-wrap: wrap;
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
  align-items: baseline;
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
  flex: 1;
}
.row-copy {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 26px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
  align-self: center;
  opacity: 0.55;
}
.row-copy:hover {
  border-color: var(--accent);
  color: var(--text);
  opacity: 1;
}
</style>
