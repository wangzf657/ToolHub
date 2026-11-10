<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Play, Pause, Camera } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeAudio } from '@/lib/audioEngine'
import { getAudioCtx, closeAudioCtx } from '@/lib/audioSynth'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const file = ref<File | null>(null)
const theme = ref<'bars' | 'wave' | 'ring'>('bars')
const color = ref('#6366f1')
const playing = ref(false)
const progress = ref(0)
const duration = ref(0)
const loaded = ref(false)

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ctx: AudioContext | null = null
let src: AudioBufferSourceNode | null = null
let analyser: AnalyserNode | null = null
let buffer: AudioBuffer | null = null
let raf = 0
let startAt = 0
let offsetSec = 0

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  stop()
  file.value = f
  loaded.value = false
  try {
    buffer = await decodeAudio(f)
    duration.value = buffer.duration
    loaded.value = true
    toast.ok('已加载，点播放开始可视化')
  } catch (e) {
    toast.err(`解码失败：${(e as Error).message}`)
  }
}

const play = () => {
  if (!buffer) return toast.warn('请先拖入音频文件')
  const ac = getAudioCtx()
  ctx = ac
  src?.disconnect()
  analyser ??= ac.createAnalyser()
  analyser.fftSize = 2048
  analyser.getByteTimeDomainData(new Uint8Array(4))
  src = ac.createBufferSource()
  src.buffer = buffer
  src.connect(analyser)
  analyser.connect(ac.destination)
  const offset = offsetSec > 0 ? offsetSec : 0
  src.start(0, offset)
  startAt = ac.currentTime - offset
  src.onended = () => { if (playing.value) stop() }
  playing.value = true
  loop()
}

const pause = () => {
  if (!src || !ctx) return
  offsetSec = ctx.currentTime - startAt
  try { src.stop() } catch { /* ignore */ }
  src = null
  playing.value = false
  cancelAnimationFrame(raf)
}

const stop = () => {
  try { src?.stop() } catch { /* ignore */ }
  src = null
  playing.value = false
  offsetSec = 0
  progress.value = 0
  cancelAnimationFrame(raf)
}

const loop = () => {
  const cv = canvasRef.value
  if (!cv || !analyser) return
  if (ctx) progress.value = Math.min(1, (ctx.currentTime - startAt) / duration.value)
  const g = cv.getContext('2d')!
  const W = cv.width
  const H = cv.height
  g.clearRect(0, 0, W, H)
  if (theme.value === 'bars') {
    const n = 64
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)
    const bw = W / n
    for (let i = 0; i < n; i++) {
      const v = data[Math.floor((i / n) * data.length * 0.7)]! / 255
      const h = v * (H - 20)
      g.fillStyle = color.value
      g.globalAlpha = 0.45 + v * 0.55
      g.fillRect(i * bw + 1, H - h, bw - 2, h)
    }
    g.globalAlpha = 1
  } else if (theme.value === 'wave') {
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    g.strokeStyle = color.value
    g.lineWidth = 2
    g.beginPath()
    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * W
      const y = H / 2 + ((data[i]! - 128) / 128) * (H / 2 - 8)
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
    }
    g.stroke()
  } else {
    // 圆环粒子
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)
    const cx = W / 2
    const cy = H / 2
    const base = Math.min(W, H) * 0.22
    g.strokeStyle = color.value
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const v = data[Math.floor((i / 96) * data.length * 0.6)]! / 255
      const r1 = base
      const r2 = base + v * Math.min(W, H) * 0.26
      g.globalAlpha = 0.4 + v * 0.6
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
      g.stroke()
    }
    g.globalAlpha = 1
    g.fillStyle = color.value
    g.font = 'bold 26px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('♪', cx, cy)
  }
  raf = requestAnimationFrame(loop)
}

const snapshot = () => {
  const cv = canvasRef.value
  if (!cv) return
  cv.toBlob((b) => {
    if (b) {
      saveBlob(b, `可视化-${Date.now()}.png`)
      toast.ok('已导出当前画面')
    }
  }, 'image/png')
}

watch(theme, () => { /* 主题切换即时生效（下一帧） */ })

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

onBeforeUnmount(() => {
  stop()
  void closeAudioCtx()
})
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept="audio/*" label="拖入音频，播放即出可视化" @files="onFiles" />

    <div v-if="loaded" class="mt-2">
      <div class="opts-panel">
        <div class="row wrap gap">
          <button class="btn btn-primary btn-sm" @click="playing ? pause() : play()">
            <Pause v-if="playing" :size="15" /><Play v-else :size="15" /> {{ playing ? '暂停' : '播放' }}
          </button>
          <button class="btn btn-sm" @click="stop">停止</button>
          <span class="mono hint">{{ fmtTime(playing || progress > 0 ? progress * duration : 0) }} / {{ fmtTime(duration) }}</span>
          <span class="spacer"></span>
          <span class="field-label">主题</span>
          <select v-model="theme" class="input slim">
            <option value="bars">频谱柱状</option>
            <option value="wave">波形线</option>
            <option value="ring">圆环粒子</option>
          </select>
          <input v-model="color" type="color" class="input" style="width: 44px; height: 32px; padding: 2px" />
          <button class="btn btn-sm" @click="snapshot"><Camera :size="14" /> 截图导出</button>
        </div>
        <div class="progress mt-2"><div class="fill" :style="{ width: progress * 100 + '%' }"></div></div>
      </div>
      <canvas ref="canvasRef" width="720" height="300" class="viz mt-2"></canvas>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.spacer { flex: 1; }
.slim { width: 110px; }
.progress { height: 4px; background: var(--surface-2, rgba(127,127,127,.15)); border-radius: 2px; }
.fill { height: 100%; background: var(--accent); border-radius: 2px; }
.viz { width: 100%; max-width: 720px; display: block; margin: 0 auto; border: 1px solid var(--border); border-radius: 12px; background: rgba(0, 0, 0, .35); }
.hint { font-size: 12px; color: var(--muted); }
</style>
