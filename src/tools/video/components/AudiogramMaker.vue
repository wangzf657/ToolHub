<script setup lang="ts">
/** 播客波形视频（不用 ffmpeg）：decodeAudio + Canvas 实时绘制 + CanvasRecorder 录制（含音轨） */
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { AudioWaveform, Loader2, Square } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeAudio } from '@/lib/audioEngine'
import { CanvasRecorder } from '@/lib/videoEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = shallowRef<File | null>(null)
const buffer = shallowRef<AudioBuffer | null>(null)
const title = ref('')
const shape = ref<'16:9' | '1:1' | '9:16'>('16:9')
const bg = ref('#0f1222')
const barColor = ref('#818cf8')
const textColor = ref('#ffffff')
const showRing = ref(true)
const busy = ref(false)
const progress = ref(0)

const SIZES: Record<string, [number, number]> = {
  '16:9': [1280, 720],
  '1:1': [900, 900],
  '9:16': [720, 1280],
}

const canvas = ref<HTMLCanvasElement | null>(null)

/** 预计算波形条（64 根，取峰值） */
const BARS = 64
const bars = ref<number[]>([])
const computeBars = () => {
  if (!buffer.value) return
  const data = buffer.value.getChannelData(0)
  const step = Math.max(1, Math.floor(data.length / BARS))
  const out: number[] = []
  for (let i = 0; i < BARS; i++) {
    let m = 0
    for (let j = i * step; j < (i + 1) * step && j < data.length; j += 8) m = Math.max(m, Math.abs(data[j]))
    out.push(m)
  }
  bars.value = out
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** 绘制一帧（t 为播放进度秒） */
const drawFrame = (t: number) => {
  const c = canvas.value
  if (!c || !buffer.value) return
  const ctx = c.getContext('2d')!
  const [w, h] = SIZES[shape.value]
  c.width = w
  c.height = h
  const dur = buffer.value.duration || 1
  const ratio = Math.min(1, t / dur)
  ctx.fillStyle = bg.value
  ctx.fillRect(0, 0, w, h)
  // 标题
  if (title.value) {
    ctx.fillStyle = textColor.value
    ctx.font = `600 ${Math.round(w / 22)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(title.value, w / 2, h * 0.12, w * 0.86)
  }
  // 波形条（自底向上）
  const areaH = h * 0.52
  const bottom = h * 0.86
  const bw = (w * 0.86) / BARS
  const played = Math.floor(ratio * BARS)
  bars.value.forEach((v, i) => {
    const bh = Math.max(4, v * areaH)
    ctx.fillStyle = i < played ? barColor.value : 'rgba(255,255,255,0.16)'
    ctx.fillRect(w * 0.07 + i * bw, bottom - bh, bw * 0.62, bh)
  })
  // 时间与圆形进度
  ctx.fillStyle = textColor.value
  ctx.font = `500 ${Math.round(w / 38)}px system-ui, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(`${fmt(t)} / ${fmt(dur)}`, w * 0.93, bottom + h * 0.07)
  if (showRing.value) {
    const r = h * 0.055
    const cx = w * 0.12
    const cy = h * 0.14
    ctx.lineWidth = Math.max(4, r * 0.18)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = barColor.value
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2)
    ctx.stroke()
  }
}

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  file.value = f
  try {
    buffer.value = await decodeAudio(f)
    computeBars()
    drawFrame(0)
  } catch (e) {
    toast.err((e as Error).message || '音频解码失败')
  }
}

let raf = 0
let audioCtx: AudioContext | null = null
let stopping = false

const start = async () => {
  const c = canvas.value
  if (!c || !buffer.value || !file.value) return
  busy.value = true
  progress.value = 0
  stopping = false
  const dur = buffer.value.duration
  try {
    audioCtx = new AudioContext()
    const src = audioCtx.createBufferSource()
    src.buffer = buffer.value
    const dest = audioCtx.createMediaStreamDestination()
    src.connect(dest)
    src.connect(audioCtx.destination)
    const rec = new CanvasRecorder(c, 30, dest.stream.getAudioTracks()[0])
    drawFrame(0)
    rec.start()
    src.start()
    const t0 = audioCtx.currentTime
    await new Promise<void>((resolve) => {
      const loop = () => {
        const t = audioCtx ? audioCtx.currentTime - t0 : 0
        drawFrame(t)
        progress.value = Math.min(1, t / dur)
        if (t >= dur || stopping) {
          resolve()
          return
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })
    try {
      src.stop()
    } catch {
      /* 可能已自然结束 */
    }
    const blob = await rec.stop()
    saveBlob(blob, `${baseName(file.value.name)}-audiogram.webm`)
    toast.ok('波形视频已生成（WebM，含音轨）')
  } catch (e) {
    toast.err((e as Error).message || '录制失败，请重试')
  } finally {
    cancelAnimationFrame(raf)
    void audioCtx?.close()
    audioCtx = null
    busy.value = false
    progress.value = 0
    drawFrame(0)
  }
}

const stopEarly = () => {
  stopping = true
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  void audioCtx?.close()
})
</script>

<template>
  <div>
    <FileDrop accept="audio/*" :multiple="false" label="拖放音频文件（播客/口播）" hint="MP3 / WAV / M4A / OGG" @files="onFiles" />

    <template v-if="buffer">
      <div class="stage mt-2">
        <canvas ref="canvas" class="stage-canvas"></canvas>
        <div class="stage-meta">
          <span>{{ fmt(buffer.duration) }}</span>
          <span>{{ SIZES[shape][0] }}×{{ SIZES[shape][1] }}</span>
          <span>{{ buffer.sampleRate }} Hz</span>
        </div>
      </div>

      <div class="opts">
        <div class="opt">
          <span class="field-label">标题文字（可空）</span>
          <input v-model="title" type="text" class="input" style="width: 220px" placeholder="例如：第 12 期 · 聊聊 AI" />
        </div>
        <div class="opt">
          <span class="field-label">画幅</span>
          <select v-model="shape" class="select" style="width: 130px" @change="drawFrame(0)">
            <option value="16:9">16:9 横屏</option>
            <option value="1:1">1:1 方形</option>
            <option value="9:16">9:16 竖屏</option>
          </select>
        </div>
        <div class="opt">
          <span class="field-label">背景色</span>
          <input v-model="bg" type="color" @change="drawFrame(0)" />
        </div>
        <div class="opt">
          <span class="field-label">波形色</span>
          <input v-model="barColor" type="color" @change="drawFrame(0)" />
        </div>
        <div class="opt">
          <span class="field-label">文字色</span>
          <input v-model="textColor" type="color" @change="drawFrame(0)" />
        </div>
        <label class="check" style="margin-bottom: 6px">
          <input v-model="showRing" type="checkbox" @change="drawFrame(0)" />
          显示圆形进度
        </label>
      </div>

      <div v-if="busy" class="prog-wrap mt-2">
        <div class="prog-head">
          <span>正在实时录制（时长与音频一致）…</span>
          <span>{{ Math.round(progress * 100) }}%</span>
        </div>
        <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, progress * 100)}%` }"></div></div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="start">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <AudioWaveform v-else :size="16" />
          {{ busy ? '录制中…' : '开始录制导出' }}
        </button>
        <button v-if="busy" class="btn btn-ghost" @click="stopEarly">
          <Square :size="15" /> 提前结束
        </button>
        <span class="rec-note">录制为实时播放：{{ fmt(buffer.duration) }} 的音频约需 {{ fmt(buffer.duration) }}；导出 WebM。</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stage {
  max-width: 560px;
}
.stage-canvas {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--border);
  display: block;
  background: #0f1222;
}
.stage-meta {
  display: flex;
  gap: 16px;
  font-size: 12.5px;
  color: var(--text-3);
  padding: 8px 2px 0;
}
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  margin-top: 14px;
}
.opt {
  display: grid;
  gap: 4px;
}
.prog-wrap {
  display: grid;
  gap: 6px;
  max-width: 560px;
}
.prog-head {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--text-2);
}
.prog-track {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  overflow: hidden;
  border: 1px solid var(--border);
}
.prog-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #7c74f2);
  border-radius: 999px;
  transition: width 0.2s ease;
}
.rec-note {
  font-size: 12.5px;
  color: var(--text-3);
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
