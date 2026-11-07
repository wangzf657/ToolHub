<script setup lang="ts">
/**
 * 音频降噪：谱减法 denoiseBuffer（FFT 2048 / 帧移 512，较耗时，带进度）→
 * 处理前后双 <audio> 对比试听 → WAV/MP3 下载。
 */
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { Download, Loader2, Play } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import { denoiseBuffer, encodeWav, encodeMp3, playBuffer } from '@/lib/audioEngine'
import { baseName, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const strength = ref(0.5)
const working = ref(false)
const progress = ref(0)
const outBuffer = shallowRef<AudioBuffer | null>(null)
const origUrl = ref('')
const procUrl = ref('')
const fmt = ref<'wav' | 'mp3'>('wav')
const downloading = ref(false)

function onLoaded(_buf: AudioBuffer, f: File) {
  origUrl.value = URL.createObjectURL(f)
}
function clearResult() {
  if (procUrl.value) URL.revokeObjectURL(procUrl.value)
  procUrl.value = ''
  outBuffer.value = null
}
function onClear() {
  if (origUrl.value) URL.revokeObjectURL(origUrl.value)
  origUrl.value = ''
  clearResult()
}

async function process() {
  const b = base.value
  if (!b?.buffer) return
  working.value = true
  progress.value = 0
  b.setBusy(true)
  try {
    const out = await denoiseBuffer(b.buffer, strength.value, (p) => (progress.value = p))
    outBuffer.value = out
    const wav = encodeWav(out)
    if (procUrl.value) URL.revokeObjectURL(procUrl.value)
    procUrl.value = URL.createObjectURL(wav)
    toast.ok('降噪完成，可在下方对比试听')
  } catch (e) {
    toast.err((e as Error).message || '降噪失败')
  } finally {
    working.value = false
    b.setBusy(false)
  }
}

function previewOut() {
  if (outBuffer.value) playBuffer(outBuffer.value)
}

async function download() {
  if (!outBuffer.value) return
  downloading.value = true
  try {
    const blob = fmt.value === 'mp3' ? await encodeMp3(outBuffer.value, 192) : encodeWav(outBuffer.value)
    saveBlob(blob, `${baseName(base.value?.file?.name ?? 'audio')}-denoised.${fmt.value}`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    downloading.value = false
  }
}

onBeforeUnmount(() => {
  if (origUrl.value) URL.revokeObjectURL(origUrl.value)
  if (procUrl.value) URL.revokeObjectURL(procUrl.value)
})
</script>

<template>
  <AudioToolBase ref="base" @loaded="onLoaded" @clear="onClear">
    <div class="mt-2 dn-slider">
      <span class="field-label">降噪强度 {{ strength.toFixed(2) }}（0.2 轻微 – 0.9 激进）</span>
      <input v-model.number="strength" type="range" min="0.2" max="0.9" step="0.05" />
    </div>
    <p class="small muted mt-1">
      谱减法降噪会自动估计底噪声谱并逐帧相减，可有效去除嘶声、风扇与电流底噪；强度过大会带来轻微「水声」伪影，建议先从 0.4 试起。处理需要一些时间，长音频可能耗时 10–60 秒。
    </p>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="working || !base?.buffer" @click="process">
        <Loader2 v-if="working" :size="16" class="spin" />
        <Play v-else :size="16" />
        {{ working ? `降噪中 ${Math.round(progress * 100)}%` : '开始降噪' }}
      </button>
    </div>

    <div v-if="outBuffer" class="mt-2">
      <div class="grid-2">
        <div class="dn-cell">
          <span class="field-label">处理前（原始文件）</span>
          <audio v-if="origUrl" :src="origUrl" controls class="dn-audio"></audio>
        </div>
        <div class="dn-cell">
          <span class="field-label">处理后（降噪结果）</span>
          <audio v-if="procUrl" :src="procUrl" controls class="dn-audio"></audio>
        </div>
      </div>
      <div class="row row-wrap mt-2">
        <label class="opt">
          <span class="field-label">导出格式</span>
          <select v-model="fmt" class="select">
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
          </select>
        </label>
        <button class="btn btn-primary" :disabled="downloading" @click="download">
          <Loader2 v-if="downloading" :size="16" class="spin" />
          <Download v-else :size="16" />
          下载降噪结果
        </button>
      </div>
    </div>
  </AudioToolBase>
</template>

<style scoped>
.dn-slider {
  max-width: 520px;
}
.dn-cell {
  min-width: 0;
}
.dn-audio {
  width: 100%;
  display: block;
}
.opt {
  min-width: 130px;
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
