<script setup lang="ts">
/** 音频倒放：整段或选区反转 + 5ms 微淡入防咔哒；试听防叠播；WAV 默认导出 + 编码进度结果卡 */
import { computed, ref } from 'vue'
import { Play, Square } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import AudioExport from './AudioExport.vue'
import { copyBuffer, createBuffer, encodeWav, encodeMp3, transformBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { fmtTime } from './shared'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
/** WAV 默认：倒放多用于音效/采样制作，默认无损格式 */
const fmt = ref<'wav' | 'mp3'>('wav')
const kbps = ref(192)
const rangeOn = ref(false)
const microFade = ref(true)

const selection = computed(() => base.value?.selection ?? null)

function preview() {
  const b = base.value
  if (!b?.buffer) return
  stopPreview()
  const out = rangeOn.value && selection.value ? reverseRange(b.buffer, selection.value.start, selection.value.end) : transformBuffer(b.buffer, { reverse: true, fadeIn: microFade.value ? 0.005 : 0 })
  playWithStop(out)
}

/* ---------- 播放防叠播：新播放前停掉上一段 ---------- */
let node: AudioBufferSourceNode | null = null
function playWithStop(buf: AudioBuffer) {
  stopPreview()
  const ctx = new AudioContext()
  void ctx.resume()
  const n = ctx.createBufferSource()
  n.buffer = buf
  n.connect(ctx.destination)
  n.onended = () => {
    if (node === n) {
      node = null
      playing.value = false
      void ctx.close()
    }
  }
  n.start()
  node = n
  playing.value = true
}
function stopPreview() {
  if (node) {
    try {
      node.onended = null
      node.stop()
    } catch {
      /* 已停止 */
    }
    node = null
  }
  playing.value = false
}
const playing = ref(false)

/** 区间倒放：头段原序 + 选中段反转 + 尾段原序（采样级手工拼接） */
function reverseRange(buf: AudioBuffer, s0: number, e0: number): AudioBuffer {
  const s = Math.max(0, Math.min(s0, e0))
  const e = Math.min(buf.duration, Math.max(s0, e0))
  const out = createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate)
  const iS = Math.floor(s * buf.sampleRate)
  const iE = Math.min(buf.length, Math.floor(e * buf.sampleRate))
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch)
    const dst = out.getChannelData(ch)
    dst.set(src.subarray(0, iS), 0)
    for (let i = iS; i < iE; i++) {
      const rev = iE - 1 - (i - iS)
      let v = src[rev] ?? 0
      // 5ms 微淡入/淡出防边界咔哒
      if (microFade.value) {
        const fadeN = Math.round(buf.sampleRate * 0.005)
        const pos = i - iS
        if (pos < fadeN) v *= pos / fadeN
        if (iE - i < fadeN) v *= (iE - i) / fadeN
      }
      dst[i] = v
    }
    if (iE < buf.length) dst.set(src.subarray(iE), iE)
  }
  return out
}

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const out = rangeOn.value && selection.value ? reverseRange(b.buffer, selection.value.start, selection.value.end) : transformBuffer(b.buffer, { reverse: true, fadeIn: microFade.value ? 0.005 : 0 })
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value, onProgress) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-reversed.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="row row-wrap mt-2">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="preview">
        <Play v-if="!playing" :size="14" /><Square v-else :size="14" />
        {{ playing ? '停止试听' : '试听倒放效果' }}
      </button>
      <label class="check"><input v-model="rangeOn" type="checkbox" /> 只倒放选区</label>
      <label class="check"><input v-model="microFade" type="checkbox" /> 5ms 微淡入防咔哒</label>
      <span v-if="rangeOn" class="small muted">当前选区：{{ selection ? `${fmtTime(selection.start)} – ${fmtTime(selection.end)}` : '未选择（在波形上拖拽）' }}</span>
    </div>

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">导出格式</span>
        <select v-model="fmt" class="select">
          <option value="wav">WAV（默认，无损）</option>
          <option value="mp3">MP3</option>
        </select>
      </label>
      <label v-if="fmt === 'mp3'" class="opt grow">
        <span class="field-label">MP3 码率 {{ kbps }} kbps</span>
        <input v-model.number="kbps" type="range" min="64" max="320" step="32" />
      </label>
    </div>

    <AudioExport :produce="produce" :default-name="outName" button-text="倒放并生成" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
</style>
