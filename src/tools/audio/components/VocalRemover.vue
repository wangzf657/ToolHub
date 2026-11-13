<script setup lang="ts">
/**
 * 人声消除 / 伴奏提取：中置声像抵消 + 低频保底（<120Hz 回补单声道低频）+ 立体声结构保留；
 * 分离度预检、AB 对比试听、双输出（伴奏+人声 ZIP）。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Archive, Play, Square } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import AudioExport from './AudioExport.vue'
import { createBuffer, encodeMp3, encodeWav, vocalCancel } from '@/lib/audioEngine'
import { baseName, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'remove' | 'keep'>('remove')
const fmt = ref<'wav' | 'mp3'>('wav')
const kbps = ref(192)
const bassKeep = ref(true)

const stereo = computed(() => (base.value?.buffer?.numberOfChannels ?? 0) >= 2)
const loaded = computed(() => !!base.value?.buffer)

/* ---------- 分离度预检：左右声道相关系数 → 预估效果 ---------- */
const corr = ref<number | null>(null)
function onLoaded(buf: AudioBuffer) {
  if (buf.numberOfChannels < 2) {
    corr.value = null
    return
  }
  const l = buf.getChannelData(0)
  const r = buf.getChannelData(1)
  const step = Math.max(1, Math.floor(buf.length / 200000))
  let slr = 0
  let sll = 0
  let srr = 0
  let n = 0
  for (let i = 0; i < buf.length; i += step) {
    slr += l[i] * r[i]
    sll += l[i] * l[i]
    srr += r[i] * r[i]
    n++
  }
  corr.value = sll > 0 && srr > 0 ? slr / Math.sqrt(sll * srr) : 0
}
const corrHint = computed(() => {
  if (corr.value === null) return ''
  const c = corr.value
  if (c > 0.9) return '左右声道高度相似（相关系数 0.92 级）：中置成分占绝对主导，分离效果可能有限'
  if (c > 0.6) return '左右声道中等相似：常见流行混音，中置人声可较好分离'
  return '宽立体声混音：分离空间大，效果通常较好'
})

/* ---------- 本地伴奏提取：L−R（side）+ 低频回补（单声道 lowpass(mid)） ---------- */
function vocalRemoveKeepBass(buf: AudioBuffer, bassHz: number): AudioBuffer {
  const out = createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate)
  const dt = 1 / buf.sampleRate
  const alpha = dt / (1 / (2 * Math.PI * bassHz) + dt)
  const l = buf.getChannelData(0)
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l
  const outL = out.getChannelData(0)
  const outR = buf.numberOfChannels > 1 ? out.getChannelData(1) : out.getChannelData(0)
  let lp = 0
  for (let i = 0; i < buf.length; i++) {
    const mid = (l[i] + r[i]) / 2
    lp += alpha * (mid - lp) // 一阶低通：保留低频
    const side = (l[i] - r[i]) / 2
    if (bassKeep) {
      outL[i] = side + lp
      outR[i] = -side + lp
    } else {
      outL[i] = side
      outR[i] = -side
    }
  }
  return out
}

function computeOut(): AudioBuffer {
  const b = base.value!
  if (mode.value === 'keep') return vocalCancel(b.buffer!, 'keep')
  return vocalRemoveKeepBass(b.buffer!, bassKeep.value ? 120 : 20000)
}

/* ---------- AB 对比试听 ---------- */
let node: AudioBufferSourceNode | null = null
const playing = ref<'' | 'src' | 'out'>('')
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
  playing.value = ''
}
function playBuf(buf: AudioBuffer, which: 'src' | 'out') {
  const b = base.value
  if (!b) return
  stopPreview()
  const ctx = new AudioContext()
  void ctx.resume()
  const n = ctx.createBufferSource()
  n.buffer = buf
  n.connect(ctx.destination)
  n.onended = () => {
    if (node === n) {
      node = null
      playing.value = ''
      void ctx.close()
    }
  }
  n.start()
  node = n
  playing.value = which
}
const playSrc = () => base.value?.buffer && playBuf(base.value.buffer, 'src')
const playOut = () => {
  if (!base.value?.buffer) return
  if (base.value.buffer.numberOfChannels < 2) {
    toast.err('人声消除需要立体声文件：当前是单声道，请换立体声音乐')
    return
  }
  playBuf(computeOut(), 'out')
}

async function produce(onProgress?: (p: number) => void): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  if (b.buffer.numberOfChannels < 2) {
    throw new Error('人声消除需要立体声文件：当前文件是单声道，请换一首立体声音乐再试')
  }
  b.setBusy(true)
  try {
    const out = computeOut()
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value, onProgress) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

/** 双输出：伴奏 + 人声两份文件打包 ZIP */
async function produceBoth() {
  const b = base.value
  if (!b?.buffer || !b.file) {
    toast.warn('请先加载音频文件')
    return
  }
  if (b.buffer.numberOfChannels < 2) {
    toast.err('需要立体声文件才能同时导出伴奏与人声')
    return
  }
  b.setBusy(true)
  try {
    const stem = baseName(b.file.name)
    const acc = vocalRemoveKeepBass(b.buffer, bassKeep.value ? 120 : 20000)
    const voc = vocalCancel(b.buffer, 'keep')
    const enc = (buf: AudioBuffer) => (fmt.value === 'mp3' ? encodeMp3(buf, kbps.value) : encodeWav(buf))
    const accBlob = await enc(acc)
    const vocBlob = await enc(voc)
    await saveMany(
      [
        { name: `${stem}-伴奏.${fmt.value}`, blob: accBlob },
        { name: `${stem}-人声.${fmt.value}`, blob: vocBlob },
      ],
      `${stem}-双输出.zip`,
    )
    toast.ok('伴奏与人声已分别导出并打包下载')
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(
  () => `${baseName(base.value?.file?.name ?? 'audio')}-${mode.value === 'remove' ? '伴奏' : '人声'}.${fmt.value}`,
)
onBeforeUnmount(stopPreview)
</script>

<template>
  <AudioToolBase ref="base" @loaded="onLoaded">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'remove' }" @click="mode = 'remove'">消除人声（提取伴奏）</button>
      <button class="chip" :class="{ active: mode === 'keep' }" @click="mode = 'keep'">仅保留中置（提取人声）</button>
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="playSrc">
        <Play v-if="playing !== 'src'" :size="14" /><Square v-else :size="14" /> {{ playing === 'src' ? '停止' : '原声' }}
      </button>
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="playOut">
        <Play v-if="playing !== 'out'" :size="14" /><Square v-else :size="14" /> {{ playing === 'out' ? '停止' : '处理后（AB 对比）' }}
      </button>
    </div>

    <div v-if="corrHint" class="notice notice-info mt-2"><span>分离度预检：{{ corrHint }}</span></div>

    <label v-if="mode === 'remove'" class="check mt-2">
      <input v-model="bassKeep" type="checkbox" /> 低频保底（<120Hz 回补单声道低频：避免抵消把贝斯/鼓底一起削掉）
    </label>

    <p class="small muted mt-1">
      原理：立体声混音中主唱通常位于正中（左右声道相同），对左右声道做 L−R 抵消即可去掉中置人声得到伴奏；
      反之取 (L+R)/2 只保留中置成分。伴奏档已回补低频并保留左右差异（立体声结构），
      位于两侧的乐器与和声仍会留在伴奏中，这是声像类算法的固有特性。
    </p>

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

    <AudioExport :produce="produce" :default-name="outName" button-text="处理并生成" :disabled="loaded && !stereo" />
    <div class="row mt-1">
      <button class="btn btn-ghost btn-sm" :disabled="!loaded || !stereo" @click="produceBoth">
        <Archive :size="14" /> 一次导出伴奏 + 人声（ZIP 双输出）
      </button>
    </div>
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
</style>
