<script setup lang="ts">
/** 音频裁剪：波形拖拽选区（双向同步）+ mm:ss 双向输入 + 淡入淡出 → 结果卡试听/下载（带 MP3 编码进度） */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import { encodeWav, encodeMp3, playBuffer, transformBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime, sizeLabel } from './shared'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const duration = ref(0)
const startS = ref(0)
const endS = ref(0)
const fadeIn = ref(0)
const fadeOut = ref(0)
const kbps = ref(192)

/* ---------- 偏好记忆：导出格式与码率 ---------- */
const PREF_KEY = 'toolhub.trimmer-prefs'
const fmt = ref<'wav' | 'mp3'>('mp3')
try {
  const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') as { fmt?: 'wav' | 'mp3'; kbps?: number }
  if (p.fmt) fmt.value = p.fmt
  if (p.kbps) kbps.value = p.kbps
} catch {
  /* 忽略 */
}
watch([fmt, kbps], () => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ fmt: fmt.value, kbps: kbps.value }))
  } catch {
    /* 忽略 */
  }
})

/* ---------- mm:ss 双向输入：可输入 90 或 1:30 ---------- */
const startText = ref('0:00')
const endText = ref('0:00')
const parseInput = (s: string, fallback: number): number => {
  const t = s.trim()
  if (!t) return fallback
  if (/^\d{1,2}:\d{1,2}(\.\d+)?$/.test(t)) {
    const [m, sec] = t.split(':')
    return Math.max(0, Number(m) * 60 + Number(sec))
  }
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
const syncTextFromNum = () => {
  startText.value = fmtTime(startS.value)
  endText.value = fmtTime(endS.value)
}
const commitStart = () => {
  startS.value = Math.min(parseInput(startText.value, startS.value), Math.max(0, endS.value - 0.05))
  syncTextFromNum()
}
const commitEnd = () => {
  endS.value = Math.max(parseInput(endText.value, endS.value), startS.value + 0.05)
  syncTextFromNum()
}

function onLoaded(buf: AudioBuffer) {
  duration.value = buf.duration
  startS.value = 0
  endS.value = Math.round(buf.duration * 100) / 100
  syncTextFromNum()
}
function onClear() {
  duration.value = 0
}
/** 波形拖拽选区 → 同步到起止输入框 */
function onSelect(s: number, e: number) {
  startS.value = Math.round(s * 100) / 100
  endS.value = Math.round(e * 100) / 100
  syncTextFromNum()
}

/** 即时区间校验（输入时立刻提示，不等到提交） */
const invalidRange = computed(() => endS.value - startS.value <= 0.05)

/** 播放当前选区（含淡入淡出效果）帮助定位 */
function playSelection() {
  const b = base.value
  if (!b?.buffer || invalidRange.value) return
  playBuffer(
    transformBuffer(b.buffer, {
      trim: { start: startS.value, end: endS.value },
      fadeIn: fadeIn.value,
      fadeOut: fadeOut.value,
    }),
  )
}

/* ---------- 执行：进度 + 结果卡（试听后点下载才落盘） ---------- */
const running = ref(false)
const encProgress = ref(0)
const resultUrl = ref('')
const resultBlob = ref<Blob | null>(null)
const outName = ref('')
onBeforeUnmount(() => {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})

async function run() {
  const b = base.value
  if (!b?.buffer || !b.file) {
    toast.warn('请先加载音频文件')
    return
  }
  if (invalidRange.value) {
    toast.err('裁剪区间无效：终点需大于起点（相差至少 0.05 秒）')
    return
  }
  running.value = true
  encProgress.value = 0
  b.setBusy(true)
  try {
    const out = transformBuffer(b.buffer, {
      trim: { start: startS.value, end: endS.value },
      fadeIn: Math.max(0, fadeIn.value),
      fadeOut: Math.max(0, fadeOut.value),
    })
    const blob = fmt.value === 'mp3' ? await encodeMp3(out, kbps.value, (p) => (encProgress.value = p)) : encodeWav(out)
    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    resultBlob.value = blob
    resultUrl.value = URL.createObjectURL(blob)
    outName.value = `${baseName(b.file.name)}-trimmed.${fmt.value}`
    toast.ok('裁剪完成，请试听后下载')
  } finally {
    b.setBusy(false)
    running.value = false
  }
}
</script>

<template>
  <AudioToolBase ref="base" :fade="{ in: fadeIn, out: fadeOut }" @loaded="onLoaded" @clear="onClear" @select="onSelect">
    <div class="grid-2 mt-2">
      <label>
        <span class="field-label">起点（秒，可输 1:30 格式）</span>
        <input v-model="startText" class="input mono" type="text" @change="commitStart" @keyup.enter="commitStart" />
      </label>
      <label>
        <span class="field-label">终点（秒，可输 1:30 格式）</span>
        <input v-model="endText" class="input mono" type="text" @change="commitEnd" @keyup.enter="commitEnd" />
      </label>
      <label>
        <span class="field-label">淡入（秒，0 为关闭）</span>
        <input v-model.number="fadeIn" class="input" type="number" min="0" step="0.1" />
      </label>
      <label>
        <span class="field-label">淡出（秒，0 为关闭）</span>
        <input v-model.number="fadeOut" class="input" type="number" min="0" step="0.1" />
      </label>
    </div>

    <div class="row row-wrap mt-1">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer || invalidRange" @click="playSelection">
        试听选区
      </button>
      <span class="small muted">选区 {{ fmtTime(startS) }} – {{ fmtTime(endS) }}，共 {{ Math.max(0, endS - startS).toFixed(2) }} 秒</span>
    </div>
    <p v-if="invalidRange" class="range-warn">⚠ 起点需小于终点（相差至少 0.05 秒），当前区间无效</p>

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">导出格式</span>
        <select v-model="fmt" class="select">
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
        </select>
      </label>
      <label v-if="fmt === 'mp3'" class="opt grow">
        <span class="field-label">MP3 码率 {{ kbps }} kbps</span>
        <input v-model.number="kbps" type="range" min="64" max="320" step="32" />
      </label>
      <label class="opt">
        <span class="field-label">输出文件名</span>
        <input v-model="outName" class="input" type="text" style="width: 240px" placeholder="留空自动命名" />
      </label>
    </div>

    <div v-if="running || encProgress > 0" class="prog mt-2">
      <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, Math.round((fmt === 'mp3' ? encProgress : 1) * 100))}%` }"></div></div>
      <span class="muted small">{{ fmt === 'mp3' ? `MP3 编码中 ${Math.round(encProgress * 100)}%` : '处理中…' }}</span>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="running || invalidRange" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        裁剪并生成
      </button>
    </div>

    <div v-if="resultUrl" class="result-card mt-2">
      <p class="rc-title">裁剪结果</p>
      <audio :src="resultUrl" controls class="rc-audio"></audio>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">输出 {{ sizeLabel(resultBlob?.size ?? 0) }} · {{ fmt.toUpperCase() }}</span>
        <a class="btn btn-primary btn-sm" :href="resultUrl" :download="outName || 'trimmed'"><Download :size="14" /> 下载</a>
      </div>
    </div>
  </AudioToolBase>
</template>

<style scoped>
.opt { min-width: 130px; }
.range-warn { font-size: 12.5px; color: #d97706; margin: 6px 0 0; }
.prog { display: grid; gap: 5px; max-width: 560px; }
.prog-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c74f2); border-radius: 999px; transition: width 0.2s ease; }
.result-card { max-width: 620px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.rc-title { margin: 0 0 8px; font-weight: 600; font-size: 14px; }
.rc-audio { width: 100%; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
