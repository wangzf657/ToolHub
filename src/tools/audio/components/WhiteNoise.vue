<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Play, Square, Volume2, Timer, Star } from 'lucide-vue-next'
import { startNoise, closeAudioCtx, type NoiseKind } from '@/lib/audioSynth'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const KINDS: { k: NoiseKind; label: string; icon: string }[] = [
  { k: 'white', label: '白噪音', icon: '⚪' },
  { k: 'pink', label: '粉噪音', icon: '🌸' },
  { k: 'brown', label: '棕噪音', icon: '🟤' },
  { k: 'rain', label: '雨声', icon: '🌧️' },
  { k: 'wave', label: '海浪', icon: '🌊' },
  { k: 'fan', label: '风扇', icon: '🌀' },
]

const kind = ref<NoiseKind>('rain')
const volume = ref(0.5)
const playing = ref(false)
const timerMin = ref(0) // 0 = 不定时；-1 = 自定义
const customMin = ref(20)
const remain = ref(0)

/** 结束前 30s 渐弱系数（1 → 0 线性），定时关闭时音量按此衰减 */
const fadeFactor = ref(1)
const effectiveVolume = computed(() => volume.value * fadeFactor.value)

let handle: { stop: () => void; setVolume: (v: number) => void } | null = null
let timer: number | null = null

const applyVolume = () => handle?.setVolume(effectiveVolume.value)

const play = () => {
  stopAll()
  handle = startNoise(kind.value, effectiveVolume.value)
  playing.value = true
  const mins = timerMin.value === -1 ? customMin.value : timerMin.value
  if (mins > 0) {
    remain.value = Math.round(mins * 60)
    fadeFactor.value = 1
    timer = window.setInterval(() => {
      remain.value--
      if (remain.value <= 30 && remain.value > 0) {
        // 结束前 30 秒音量线性降至 0
        fadeFactor.value = remain.value / 30
        applyVolume()
      }
      if (remain.value <= 0) stopAll()
    }, 1000)
  }
}

const stopAll = () => {
  handle?.stop()
  handle = null
  playing.value = false
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  remain.value = 0
  fadeFactor.value = 1
}

/** 切换音色：只换发声源，倒计时与渐弱节奏保持不变 */
const switchKind = (k: NoiseKind) => {
  kind.value = k
  if (playing.value && handle) {
    handle.stop()
    handle = startNoise(kind.value, effectiveVolume.value)
  }
}

const setVolume = () => {
  // 运行中实时调音量（应用渐弱系数），不再重启
  applyVolume()
}

/* ---------- 预设收藏：音色 + 音量 + 定时，一键回放 ---------- */
const PRESET_KEY = 'toolhub.noise-presets'
interface NoisePreset {
  name: string
  kind: NoiseKind
  volume: number
  timerMin: number
  customMin: number
}
const presets = ref<NoisePreset[]>([])
try {
  presets.value = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]') as NoisePreset[]
} catch {
  presets.value = []
}
const presetName = ref('')

const savePreset = () => {
  const name = presetName.value.trim() || KINDS.find((k) => k.k === kind.value)?.label || '预设'
  if (presets.value.some((p) => p.name === name)) {
    toast.warn('已有同名预设，请换一个名字')
    return
  }
  presets.value.push({ name, kind: kind.value, volume: volume.value, timerMin: timerMin.value, customMin: customMin.value })
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presets.value))
  } catch {
    /* 忽略 */
  }
  presetName.value = ''
  toast.ok(`已保存预设「${name}」`)
}

const applyPreset = (p: NoisePreset) => {
  kind.value = p.kind
  volume.value = p.volume
  timerMin.value = p.timerMin
  customMin.value = p.customMin
  play()
}

const removePreset = (i: number) => {
  presets.value.splice(i, 1)
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presets.value))
  } catch {
    /* 忽略 */
  }
}

const remainText = computed(() => {
  const s = Math.max(0, remain.value)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

onBeforeUnmount(() => {
  stopAll()
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="grid6">
        <button v-for="k in KINDS" :key="k.k" class="kind-btn" :class="{ active: kind === k.k }" @click="switchKind(k.k)">
          <span class="ic">{{ k.icon }}</span><span>{{ k.label }}</span>
        </button>
      </div>
      <div class="row wrap gap mt-2">
        <Volume2 :size="16" />
        <input
          type="range" min="0" max="1" step="0.05" v-model.number="volume" @input="setVolume" class="grow"
          :disabled="playing && remain > 0 && remain <= 30"
        />
        <Timer :size="16" />
        <select v-model.number="timerMin" class="input slim">
          <option :value="0">不限时</option>
          <option :value="15">15 分钟</option>
          <option :value="30">30 分钟</option>
          <option :value="60">60 分钟</option>
          <option :value="-1">自定义</option>
        </select>
        <input
          v-if="timerMin === -1" v-model.number="customMin" type="number" min="1" max="720" class="input slim" title="自定义分钟数"
        />
        <span v-if="timerMin === -1" class="muted small">分钟</span>
        <button class="btn btn-primary btn-sm" @click="playing ? stopAll() : play()">
          <Square v-if="playing" :size="15" /><Play v-else :size="15" /> {{ playing ? '停止' : '播放' }}
        </button>
      </div>
      <p v-if="playing && remain > 0" class="hint mt-1">
        ⏳ 将在 {{ remainText }} 后自动停止<template v-if="remain <= 30">（正在渐弱…）</template>
      </p>
      <p class="hint mt-1">声音由浏览器实时合成（无任何音频文件），无限时长不重复。播放期间请保持本页打开；定时结束前 30 秒音量自动线性渐弱。</p>

      <div class="preset-row mt-2">
        <Star :size="15" />
        <input v-model="presetName" class="input slim" placeholder="预设名，如「睡眠」" maxlength="12" @keyup.enter="savePreset" />
        <button class="btn btn-ghost btn-sm" @click="savePreset">保存当前组合</button>
      </div>
      <div v-if="presets.length" class="chips mt-1">
        <span v-for="(p, i) in presets" :key="p.name + i" class="preset-chip">
          <button class="chip-btn" :title="`音量 ${Math.round(p.volume * 100)}%`" @click="applyPreset(p)">{{ p.name }}</button>
          <button class="chip-x" title="删除预设" @click="removePreset(i)">×</button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid6 { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.kind-btn { padding: 12px 8px; border-radius: 12px; border: 1px solid var(--border); background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 13px; color: var(--text); }
.kind-btn.active { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }
.ic { font-size: 22px; }
.gap { gap: 12px; align-items: center; }
.grow { flex: 1; min-width: 120px; }
.slim { width: 110px; }
.hint { font-size: 12px; color: var(--muted); }
.preset-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.preset-chip { display: inline-flex; align-items: center; gap: 2px; }
.chip-btn { padding: 3px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12.5px; color: var(--text); }
.chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.chip-x { border: none; background: transparent; color: var(--muted); cursor: pointer; font-size: 14px; padding: 0 4px; }
</style>
