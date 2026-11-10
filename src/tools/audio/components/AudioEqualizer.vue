<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { SlidersHorizontal, Play, Square, Download, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeAudio, encodeMp3, encodeWav } from '@/lib/audioEngine'
import { EQ_BANDS, EQ_PRESETS, buildEqChain } from '@/lib/audioExt'
import { getAudioCtx, closeAudioCtx } from '@/lib/audioSynth'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const file = ref<File | null>(null)
const buffer = ref<AudioBuffer | null>(null)
const gains = ref<number[]>([...EQ_PRESETS[0]!.gains])
const busy = ref(false)
const playing = ref(false)
const exporting = ref(false)

let srcNode: AudioBufferSourceNode | null = null
let chain: { input: BiquadFilterNode; output: BiquadFilterNode; filters: BiquadFilterNode[] } | null = null

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  file.value = f
  stopPreview()
  busy.value = true
  try {
    buffer.value = await decodeAudio(f)
    toast.ok(`已加载（${Math.round(buffer.value.duration)} 秒），点播放试听`)
  } catch (e) {
    toast.err(`解码失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const applyPreset = (i: number) => {
  gains.value = [...EQ_PRESETS[i]!.gains]
  syncChain()
}

const syncChain = () => {
  if (!chain) return
  EQ_BANDS.forEach((_, i) => {
    chain!.filters[i]!.gain.value = gains.value[i] ?? 0
  })
}

const startPreview = () => {
  if (!buffer.value) return toast.warn('请先拖入音频文件')
  stopPreview()
  const ctx = getAudioCtx()
  chain = buildEqChain(ctx, gains.value)
  srcNode = ctx.createBufferSource()
  srcNode.buffer = buffer.value
  srcNode.connect(chain.input)
  chain.output.connect(ctx.destination)
  srcNode.onended = () => {
    playing.value = false
    srcNode = null
  }
  srcNode.start()
  playing.value = true
}

const stopPreview = () => {
  try { srcNode?.stop() } catch { /* 已停 */ }
  srcNode = null
  playing.value = false
}

const exportEq = async () => {
  if (!buffer.value) return toast.warn('请先拖入音频文件')
  exporting.value = true
  try {
    // 离线渲染同一 EQ 链
    const off = new OfflineAudioContext(buffer.value.numberOfChannels, buffer.value.length, buffer.value.sampleRate)
    const offChain = buildEqChain(off, gains.value)
    const src = off.createBufferSource()
    src.buffer = buffer.value
    src.connect(offChain.input)
    offChain.output.connect(off.destination)
    src.start()
    const rendered = await off.startRendering()
    const fmt = file.value?.name.toLowerCase().endsWith('.mp3') ? 'mp3' : 'wav'
    const blob = fmt === 'mp3' ? await encodeMp3(rendered, 192) : await encodeWav(rendered)
    saveBlob(blob, `${(file.value?.name ?? 'audio').replace(/\.[^.]+$/, '')}-EQ.${fmt}`)
    toast.ok('已按 EQ 曲线渲染导出')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    exporting.value = false
  }
}

onBeforeUnmount(() => {
  stopPreview()
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept="audio/*" label="拖入音频（wav/mp3/flac/m4a/ogg）" @files="onFiles" />

    <div v-if="file" class="mt-2">
      <div class="opts-panel">
        <div class="row wrap gap mb-2">
          <button v-for="(p, i) in EQ_PRESETS" :key="p.name" class="seg" @click="applyPreset(i)">{{ p.name }}</button>
          <span class="spacer"></span>
          <button class="btn btn-sm" @click="gains = EQ_PRESETS[0]!.gains; syncChain()">重置</button>
        </div>
        <div class="eq-grid">
          <div v-for="(band, i) in EQ_BANDS" :key="band" class="eq-col">
            <span class="eq-val">{{ gains[i] }}dB</span>
            <input
              type="range"
              class="eq-slider"
              min="-12"
              max="12"
              step="1"
              v-model.number="gains[i!]"
              @input="syncChain"
              :style="{ writingMode: 'vertical-lr', direction: 'rtl' }"
            />
            <span class="eq-freq">{{ band >= 1000 ? band / 1000 + 'k' : band }}</span>
          </div>
        </div>
        <div class="row wrap gap mt-2">
          <button class="btn btn-primary" @click="playing ? stopPreview() : startPreview()" :disabled="busy || !buffer">
            <Square v-if="playing" :size="16" /><Play v-else :size="16" /> {{ playing ? '停止试听' : '试听' }}
          </button>
          <button class="btn" :disabled="!buffer || exporting" @click="exportEq">
            <Loader2 v-if="exporting" :size="16" class="spin" /><Download v-else :size="16" /> 按 EQ 导出
          </button>
        </div>
        <p class="hint mt-1">10 段 peaking 均衡（Q=1.1），试听实时生效；导出用 OfflineAudioContext 同链离线渲染，与试听一致。MP3 源导出 MP3（192kbps），其余导出 WAV。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 8px; align-items: center; }
.spacer { flex: 1; }
.seg { padding: 4px 12px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 12px; background: transparent; color: var(--text); }
.seg:hover { border-color: var(--accent); }
.eq-grid { display: flex; gap: 8px; justify-content: space-between; }
.eq-col { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.eq-slider { height: 130px; }
.eq-val { font-size: 11px; color: var(--accent-text); }
.eq-freq { font-size: 11px; color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
