<script setup lang="ts">
/** 音频变调：SoundTouchJS 变速不变调 / 变调不变速（区别于 playbackRate 的联动变速） */
import { ref, shallowRef } from 'vue'
import { Loader2, AudioLines } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeAudio, encodeWav, encodeMp3 } from '@/lib/audioEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = ref<File | null>(null)
const buffer = shallowRef<AudioBuffer | null>(null)
const semitones = ref(0)
const tempo = ref(1)
const format = ref<'wav' | 'mp3'>('wav')
const busy = ref(false)
const duration = ref('')

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

const onFiles = async (files: File[]) => {
  if (!files.length) return
  file.value = files[0]
  busy.value = true
  try {
    buffer.value = await decodeAudio(files[0])
    duration.value = `${buffer.value.duration.toFixed(1)}s`
    toast.ok('解码完成，调整参数后点「生成」')
  } catch (e) {
    toast.err((e as Error).message || '解码失败，请确认音频文件有效')
  } finally {
    busy.value = false
  }
}

/** SoundTouchJS 离线处理：交错的立体声帧流 → 新 AudioBuffer */
async function process(src: AudioBuffer, pitchSemi: number, tempoRatio: number): Promise<AudioBuffer> {
  const { SoundTouch, SimpleFilter, WebAudioBufferSource } = await import('soundtouchjs')
  // mono → 双声道复制，SoundTouch 交错流按双声道处理
  let stereo = src
  if (src.numberOfChannels === 1) {
    const ctx = new OfflineAudioContext(2, src.length, src.sampleRate)
    stereo = ctx.createBuffer(2, src.length, src.sampleRate)
    for (const ch of [0, 1]) stereo.copyToChannel(src.getChannelData(0), ch)
  }
  const st = new SoundTouch()
  st.pitch = Math.pow(2, pitchSemi / 12) // 半音 → 频率比
  st.tempo = tempoRatio
  const filter = new SimpleFilter(new WebAudioBufferSource(stereo), st)
  const FRAME = 4096
  const chunks: Float32Array[] = []
  let totalFrames = 0
  for (;;) {
    const buf = new Float32Array(FRAME * 2)
    const got = filter.extract(buf, FRAME)
    if (got === 0) break
    chunks.push(got === FRAME ? buf : buf.slice(0, got * 2))
    totalFrames += got
    if (totalFrames > src.sampleRate * 60 * 20) break // 20 分钟保险丝
  }
  const ctx = new OfflineAudioContext(2, Math.max(1, totalFrames), src.sampleRate)
  const out = ctx.createBuffer(2, Math.max(1, totalFrames), src.sampleRate)
  const L = out.getChannelData(0)
  const R = out.getChannelData(1)
  let off = 0
  for (const c of chunks) {
    for (let i = 0; i < c.length / 2; i++) {
      L[off + i] = c[i * 2]
      R[off + i] = c[i * 2 + 1]
    }
    off += c.length / 2
  }
  return out
}

const run = async () => {
  if (!buffer.value) return toast.warn('请先载入音频')
  if (semitones.value === 0 && tempo.value === 1) return toast.warn('变调与变速均为原值，无需处理')
  busy.value = true
  try {
    const out = await process(buffer.value, semitones.value, tempo.value)
    const blob =
      format.value === 'mp3'
        ? await encodeMp3(out, 192)
        : await encodeWav(out)
    const ext = format.value === 'mp3' ? 'mp3' : 'wav'
    const label = []
    if (semitones.value !== 0) label.push(`${semitones.value > 0 ? '+' : ''}${semitones.value} 半音`)
    if (tempo.value !== 1) label.push(`${tempo.value}x 速度`)
    saveBlob(blob, `变调-${label.join('-')}.${ext}`)
    toast.ok(`完成：处理后 ${out.duration.toFixed(1)}s · ${fmtSize(blob.size)}`)
  } catch (e) {
    toast.err((e as Error).message || '处理失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept="audio/*" :multiple="false" label="拖入音频文件（MP3/WAV/OGG/M4A/FLAC）" hint="变调不变速 / 变速不变调 · 全部本地处理" @files="onFiles" />

    <div v-if="buffer" class="mt-2">
      <div class="row row-wrap" style="gap: 20px; align-items: flex-end">
        <label class="opt">
          <span class="field-label">变调（半音）：{{ semitones > 0 ? `+${semitones}` : semitones }}</span>
          <input v-model.number="semitones" type="range" min="-12" max="12" step="1" style="width: 220px" />
        </label>
        <label class="opt">
          <span class="field-label">速度：{{ tempo.toFixed(2) }}x</span>
          <input v-model.number="tempo" type="range" min="0.5" max="2" step="0.05" style="width: 220px" />
        </label>
        <label class="opt">
          <span class="field-label">输出格式</span>
          <select v-model="format" class="select" style="width: 110px">
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
          </select>
        </label>
        <button class="btn btn-primary" :disabled="busy" @click="run">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <AudioLines v-else :size="16" /> 生成并下载
        </button>
        <span class="muted small">时长 {{ duration }}</span>
      </div>
      <div class="row mt-1">
        <button class="btn btn-ghost btn-sm" @click="semitones = 0; tempo = 1">重置参数</button>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">使用 SoundTouch 时间伸缩算法：变调保持速度（升降 Key）、变速保持音高（适合倍速听播客）；处理在本地离线完成，长音频请稍候。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 6px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
