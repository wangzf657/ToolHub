<script setup lang="ts">
/** 视频变速：0.25–4 倍，setpts + atempo 级联（保持音高）或 asetrate 变调；支持静音输出与快捷档 */
import { computed, onBeforeUnmount, ref } from 'vue'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import SliderRow from './SliderRow.vue'
import { getFf, probeAudioRate } from '@/lib/ffmpeg'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const speed = ref(1.5)
const keepPitch = ref(true)
const muteOut = ref(false)

/** atempo 只支持 0.5–2，需级联 */
function atempoChain(v: number): string {
  const parts: string[] = []
  let f = v
  while (f > 2 + 1e-6) {
    parts.push('atempo=2.0')
    f /= 2
  }
  while (f < 0.5 - 1e-6) {
    parts.push('atempo=0.5')
    f /= 0.5
  }
  parts.push(`atempo=${f.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`)
  return parts.join(',')
}

/**
 * 变调档滤镜链：asetrate 是"按新采样率解读现有样本"，必须用源采样率计算，
 * 硬编码 44100 会把 48kHz 源的实际变速错算成 44100×v/48000，导致音画失步。
 * 先探测源采样率并透传；探测失败时回退为"先统一重采样到已知采样率"，倍率仍精确。
 */
async function pitchChain(v: number): Promise<string> {
  const f = base.value?.file()
  if (f) {
    try {
      const ff = await getFf()
      const sr = await probeAudioRate(ff, 'input', new Uint8Array(await f.arrayBuffer()))
      if (sr && sr > 0) return `asetrate=${sr}*${v.toFixed(4)},aresample=${sr}`
    } catch {
      /* 探测失败走下方安全写法 */
    }
  }
  return `aresample=44100,asetrate=44100*${v.toFixed(4)},aresample=44100`
}

const QUICK = [0.25, 0.5, 1, 2, 4]

/** 绝对时长回显：预计输出 m 分 s 秒（原片 mm:ss × 倍率） */
const dur = computed(() => base.value?.meta?.duration ?? 0)
const fmtDur = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '—:—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
const expectOut = computed(() => {
  if (!durFinite.value) return ''
  return `预计输出 ${fmtDur(dur.value / speed.value)}（原片 ${fmtDur(dur.value)} × ${(1 / speed.value).toFixed(2)}）`
})
const durFinite = computed(() => Number.isFinite(dur.value) && dur.value > 0)

/* ---------- 处理中离开确认 ---------- */
let running = false
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (running) {
    e.preventDefault()
    e.returnValue = ''
  }
}
window.addEventListener('beforeunload', onBeforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

const run = async () => {
  const b = base.value
  if (!b) return
  if (speed.value === 1) {
    toast.warn('速度为 1.00×（无变化）：请先调整播放速度后再执行')
    return
  }
  if (speed.value <= 0) return
  running = true
  try {
    const v = speed.value
    let af: string
    if (keepPitch.value) {
      af = atempoChain(v)
    } else {
      b.setBusy(true, '正在读取音频参数…')
      af = await pitchChain(v)
    }
    const args: string[] = ['-y', '-i', 'input', '-vf', `setpts=PTS/${v.toFixed(4)}`]
    if (muteOut.value) args.push('-an')
    else args.push('-af', af)
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23')
    if (!muteOut.value) args.push('-c:a', 'aac', '-b:a', '128k')
    args.push('-movflags', '+faststart', b.outputName)
    await b.runWithFf(args, { status: '正在变速…' })
  } finally {
    running = false
  }
}
</script>

<template>
  <FfBase ref="base" button-text="开始变速" @run="run">
    <div class="opts">
      <SliderRow v-model="speed" label="播放速度" :min="0.25" :max="4" :step="0.05" unit="×" width="220px" />
      <div class="quick">
        <button v-for="q in QUICK" :key="q" class="chip-btn" :class="{ active: speed === q }" @click="speed = q">
          {{ q }}×
        </button>
      </div>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="keepPitch" type="checkbox" :disabled="muteOut" />
        保持音高（变速不变调）
      </label>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="muteOut" type="checkbox" />
        输出静音（去掉音轨，无需再去消音）
      </label>
      <span v-if="speed === 1" class="one-warn">速度为 1.00×，输出与原片相同，无需处理</span>
      <span v-else class="speed-view">
        输出时长约为原片的 {{ (1 / speed).toFixed(2) }} 倍<template v-if="expectOut"> · {{ expectOut }}</template>
      </span>
    </div>
    <p class="speed-note">
      大于 2× 或小于 0.5× 时音频滤镜会自动级联以保持音高；关闭「保持音高」时声音会同步变调（卡通/慢放效果）。
      勾选「输出静音」将去掉音轨（-an），如只需无声视频不必再去「视频消音」。
    </p>
    <FfExpectHint text="变速需整段重编码，耗时约为视频时长的 1/2~1/5；首次使用需加载约 30MB 编解码核心。处理期间请保持页面打开，勿刷新或关闭标签页。" />
  </FfBase>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: flex-end;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  margin-top: 14px;
}
.quick { display: flex; gap: 6px; margin-bottom: 6px; }
.chip-btn { padding: 3px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12.5px; color: var(--text); }
.chip-btn.active { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }
.one-warn { font-size: 12.5px; color: #d97706; margin-bottom: 6px; }
.speed-view {
  font-size: 12.5px;
  color: var(--text-3);
  margin-bottom: 6px;
}
.speed-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
