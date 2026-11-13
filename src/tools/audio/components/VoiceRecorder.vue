<script setup lang="ts">
/** 在线录音机：getUserMedia + MediaRecorder，实时计时与电平表，停止后预览，下载 WebM 或转 MP3 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { AudioWaveform, Download, Loader2, Mic, MicOff, Pause, Play, RotateCcw, Square } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { decodeAudio, encodeMp3 } from '@/lib/audioEngine'
import { fmtTime } from './shared'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const recording = ref(false)
const paused = ref(false)
const error = ref('')
const seconds = ref(0)
const levels = ref<number[]>([])
const blob = ref<Blob | null>(null)
const url = ref('')
const ext = ref('webm')
const converting = ref(false)
const encProgress = ref(0)
const clipWarn = ref(false)
const confirmRec = ref(false)
const devices = ref<MediaDeviceInfo[]>([])
const deviceId = ref('')

let stream: MediaStream | null = null
let recorder: MediaRecorder | null = null
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let rafId = 0
let timerId = 0
const chunks: BlobPart[] = []

const baseName = computed(() => `录音-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}`)

/** 按浏览器支持挑容器格式：Chrome/Edge 为 webm，Safari 为 mp4 */
function pickMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const m of cands) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m
    } catch {
      /* 忽略 */
    }
  }
  return ''
}

async function start() {
  error.value = ''
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error.value = '当前浏览器不支持录音（缺少 getUserMedia 或 MediaRecorder），请换用 Chrome / Edge / Firefox。'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId.value ? { deviceId: { exact: deviceId.value } } : true,
    })
  } catch {
    error.value = '无法访问麦克风：请在浏览器地址栏的权限提示中允许「麦克风」，或检查系统隐私设置后重试。'
    return
  }
  // 授权后列出输入设备供下次选择
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    devices.value = all.filter((d) => d.kind === 'audioinput')
  } catch {
    /* 忽略 */
  }
  chunks.length = 0
  const mime = pickMime()
  recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
  ext.value = recorder.mimeType.includes('mp4') ? 'm4a' : recorder.mimeType.includes('ogg') ? 'ogg' : 'webm'
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.onstop = () => {
    blob.value = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
    url.value = URL.createObjectURL(blob.value)
  }
  recorder.start(250)
  recording.value = true
  paused.value = false
  seconds.value = 0
  levels.value = []
  clipWarn.value = false
  timerId = window.setInterval(() => {
    if (!paused.value) seconds.value += 0.1
  }, 100)
  // 实时电平表：AnalyserNode 频谱均值
  audioCtx = new AudioContext()
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  audioCtx.createMediaStreamSource(stream).connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)
  const tick = () => {
    if (!analyser) return
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const lv = Math.min(100, ((sum / data.length) / 140) * 100)
    levels.value.push(lv)
    if (levels.value.length > 64) levels.value.shift()
    if (lv >= 97) clipWarn.value = true // 削波警示：电平顶格
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function togglePause() {
  if (!recorder) return
  if (paused.value) {
    recorder.resume()
    paused.value = false
  } else {
    recorder.pause()
    paused.value = true
  }
}

function stop() {
  recording.value = false
  paused.value = false
  window.clearInterval(timerId)
  cancelAnimationFrame(rafId)
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  stream?.getTracks().forEach((t) => t.stop())
  void audioCtx?.close()
  audioCtx = null
  analyser = null
}

function resetAll() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  blob.value = null
}

/** 重录确认：已有录音时先确认再丢弃，防误触 */
function askReset() {
  if (blob.value && !confirmRec.value) {
    confirmRec.value = true
    return
  }
  confirmRec.value = false
  resetAll()
}

function downloadRaw() {
  if (!blob.value) return
  saveBlob(blob.value, `${baseName.value}.${ext.value}`)
}

/** 录音 blob → 解码 → MP3（浏览器录出的 webm/m4a 均可解码），带编码进度 */
async function downloadMp3() {
  if (!blob.value) return
  converting.value = true
  encProgress.value = 0
  try {
    const buf = await decodeAudio(blob.value)
    const mp3 = await encodeMp3(buf, 192, (p) => (encProgress.value = p))
    saveBlob(mp3, `${baseName.value}.mp3`)
    toast.ok('MP3 已生成并开始下载')
  } catch (e) {
    toast.err((e as Error).message || 'MP3 转换失败，可直接下载原始录音')
  } finally {
    converting.value = false
    encProgress.value = 0
  }
}

onBeforeUnmount(stop)
</script>

<template>
  <div>
    <div v-if="!blob && !recording" class="vc-idle">
      <button class="vc-btn" title="开始录音" aria-label="开始录音" @click="start"><Mic :size="26" /></button>
      <p class="muted small">点击开始录音，浏览器会请求麦克风权限</p>
      <label v-if="devices.length > 1" class="row" style="gap: 8px; align-items: center">
        <span class="field-label" style="margin: 0">输入设备</span>
        <select v-model="deviceId" class="select" style="width: 260px">
          <option value="">系统默认麦克风</option>
          <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">{{ d.label || '麦克风' }}</option>
        </select>
      </label>
    </div>

    <div v-else-if="recording" class="vc-rec">
      <button class="vc-btn danger" title="停止录音" aria-label="停止录音" @click="stop"><Square :size="20" /></button>
      <button class="btn btn-ghost btn-sm" @click="togglePause">
        <Pause v-if="!paused" :size="15" /><Play v-else :size="15" />
        {{ paused ? '继续' : '暂停' }}
      </button>
      <span class="vc-time mono">{{ fmtTime(seconds) }}<template v-if="paused">（已暂停）</template></span>
      <div class="vc-meter" :class="{ clip: clipWarn }">
        <span v-for="(v, i) in levels" :key="i" :style="{ height: `${Math.max(6, v)}%` }"></span>
      </div>
      <p v-if="clipWarn" class="clip-warn">⚠ 声音过大，可能已削波：请远离麦克风或降低系统输入音量</p>
    </div>

    <div v-else class="vc-done">
      <audio :src="url" controls class="vc-audio"></audio>
      <div v-if="converting || encProgress > 0" class="prog mt-2">
        <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, Math.round(encProgress * 100))}%` }"></div></div>
        <span class="muted small">MP3 编码中 {{ Math.round(encProgress * 100) }}%</span>
      </div>
      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" :disabled="converting" @click="downloadMp3">
          <Loader2 v-if="converting" :size="16" class="spin" />
          <AudioWaveform v-else :size="16" />
          转 MP3 并下载（推荐）
        </button>
        <button class="btn btn-ghost" @click="downloadRaw"><Download :size="16" /> 下载原始 {{ ext.toUpperCase() }}</button>
        <button class="btn btn-ghost" @click="askReset"><RotateCcw :size="15" /> 重新录音</button>
      </div>
      <div v-if="confirmRec" class="confirm-row mt-1">
        <span>丢弃当前录音并重录？</span>
        <button class="btn btn-sm" @click="askReset">确认重录</button>
        <button class="btn btn-ghost btn-sm" @click="confirmRec = false">取消</button>
      </div>
    </div>

    <div v-if="error" class="notice notice-err mt-2"><MicOff :size="15" /> {{ error }}</div>
    <p class="notice notice-info mt-2">
      录音直接在浏览器内完成，不会上传到任何服务器。WebM / M4A 录音可直接下载，也可一键转成通用 MP3。
    </p>
  </div>
</template>

<style scoped>
.vc-idle,
.vc-rec {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 26px 0;
}
.vc-btn {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: linear-gradient(135deg, var(--accent), #7c74f2);
  color: #fff;
  box-shadow: 0 10px 26px rgba(99, 102, 241, 0.4);
  transition: transform 0.12s ease;
}
.vc-btn:active {
  transform: scale(0.96);
}
.vc-btn.danger {
  background: linear-gradient(135deg, #f87171, #ef4444);
  box-shadow: 0 10px 26px rgba(248, 113, 113, 0.35);
}
.vc-rec {
  flex-direction: row;
}
.vc-time {
  font-size: 22px;
  font-weight: 700;
  min-width: 64px;
  text-align: center;
}
.vc-meter {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 56px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  overflow: hidden;
  flex: 1;
  max-width: 420px;
}
.vc-meter span {
  width: 4px;
  min-height: 4px;
  border-radius: 2px;
  background: var(--accent);
  flex: none;
}
.vc-audio {
  width: 100%;
  max-width: 520px;
  display: block;
}
.vc-meter.clip {
  border-color: rgba(239, 68, 68, 0.7);
}
.clip-warn {
  font-size: 12.5px;
  color: #ef4444;
  margin: 0;
}
.confirm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #d97706;
  padding: 8px 12px;
  border: 1px solid rgba(217, 119, 6, 0.35);
  border-radius: 10px;
  background: rgba(217, 119, 6, 0.06);
}
.prog { display: grid; gap: 5px; max-width: 520px; width: 100%; }
.prog-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c74f2); border-radius: 999px; transition: width 0.2s ease; }
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
