<script setup lang="ts">
/** 视频变速：0.25–4 倍，setpts + atempo 级联（保持音高）或 asetrate 变调 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'
import { getFf, probeAudioRate } from '@/lib/ffmpeg'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const speed = ref(1.5)
const keepPitch = ref(true)

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

const run = async () => {
  const b = base.value
  if (!b || speed.value <= 0) return
  const v = speed.value
  let af: string
  if (keepPitch.value) {
    af = atempoChain(v)
  } else {
    b.setBusy(true, '正在读取音频参数…')
    af = await pitchChain(v)
  }
  await b.runWithFf(
    [
      '-y', '-i', 'input',
      '-vf', `setpts=PTS/${v.toFixed(4)}`,
      '-af', af,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { status: '正在变速…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始变速" @run="run">
    <div class="opts">
      <SliderRow v-model="speed" label="播放速度" :min="0.25" :max="4" :step="0.05" unit="×" width="220px" />
      <label class="check" style="margin-bottom: 6px">
        <input v-model="keepPitch" type="checkbox" />
        保持音高（变速不变调）
      </label>
      <span class="speed-view">输出时长约为原片的 {{ (1 / speed).toFixed(2) }} 倍</span>
    </div>
    <p class="speed-note">
      大于 2× 或小于 0.5× 时音频滤镜会自动级联以保持音高；关闭「保持音高」时声音会同步变调（卡通/慢放效果）。
    </p>
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
