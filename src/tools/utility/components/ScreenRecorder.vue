<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Circle, Square, Mic, MicOff, Download, MonitorPlay } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const withMic = ref(false)
const recording = ref(false)
const elapsed = ref(0)
const videoUrl = ref('')
const blobSize = ref(0)

let recorder: MediaRecorder | null = null
let chunks: BlobPart[] = []
let timer: number | undefined
let stream: MediaStream | null = null
let blob: Blob | null = null

const timeLabel = computed(() => {
  const s = elapsed.value
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
})

const start = async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    toast.err('当前浏览器不支持屏幕捕获（getMediaDevices.getDisplayMedia），请使用桌面版 Chrome / Edge / Firefox')
    return
  }
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: withMic.value,
    })
  } catch {
    toast.warn('已取消或被拒绝屏幕共享权限；如需录制请重新点击开始并选择要共享的屏幕 / 窗口 / 标签页')
    return
  }
  // 若需要麦克风但屏幕流未带音轨，追加一条音频轨
  if (withMic.value && !stream.getAudioTracks().length) {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      mic.getAudioTracks().forEach((t) => stream!.addTrack(t))
    } catch {
      toast.warn('麦克风权限被拒绝，将只录制画面')
    }
  }
  if (!stream.getVideoTracks().length) {
    toast.err('未获得视频轨道，无法录制')
    return
  }

  chunks = []
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 })
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.onstop = finish
  // 用户点击浏览器的「停止共享」按钮时结束录制
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    if (recorder?.state === 'recording') recorder.stop()
  })
  recorder.start(1000)
  recording.value = true
  elapsed.value = 0
  videoUrl.value = ''
  timer = window.setInterval(() => elapsed.value++, 1000)
}

const stop = () => {
  recorder?.stop()
}

const finish = () => {
  recording.value = false
  window.clearInterval(timer)
  stream?.getTracks().forEach((t) => t.stop())
  blob = new Blob(chunks, { type: 'video/webm' })
  blobSize.value = blob.size
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = URL.createObjectURL(blob)
  toast.ok('录制完成，可预览并下载 WebM 文件')
}

const download = () => {
  if (!blob) return
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  saveBlob(blob, `screen-${ts}.webm`)
}

onBeforeUnmount(() => {
  window.clearInterval(timer)
  recorder?.state === 'recording' && recorder.stop()
  stream?.getTracks().forEach((t) => t.stop())
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
})
</script>

<template>
  <div>
    <div class="opts row row-wrap">
      <label class="check">
        <input v-model="withMic" type="checkbox" :disabled="recording" />
        <span><Mic v-if="withMic" :size="15" /><MicOff v-else :size="15" /> 同时录制麦克风音频</span>
      </label>
    </div>

    <div class="stage mt-2">
      <template v-if="recording">
        <div class="rec-ind">
          <span class="dot"></span>
          <span class="rec-time mono">{{ timeLabel }}</span>
        </div>
        <MonitorPlay :size="52" class="rec-icon" />
        <p class="muted small">正在录制所选屏幕 / 窗口，点击下方按钮或浏览器共享栏的「停止共享」结束</p>
      </template>
      <template v-else-if="videoUrl">
        <video :src="videoUrl" class="preview" controls></video>
        <p class="muted small">时长 {{ timeLabel }} · {{ (blobSize / 1024 / 1024).toFixed(1) }} MB · WebM</p>
      </template>
      <template v-else>
        <MonitorPlay :size="52" class="rec-icon" />
        <p class="muted small">点击「开始录制」并选择要共享的屏幕、窗口或标签页</p>
      </template>
    </div>

    <div class="row row-wrap mt-2">
      <button v-if="!recording" class="btn btn-primary" @click="start">
        <Circle :size="15" fill="currentColor" /> 开始录制
      </button>
      <button v-else class="btn btn-danger" @click="stop">
        <Square :size="15" fill="currentColor" /> 停止（{{ timeLabel }}）
      </button>
      <button v-if="videoUrl" class="btn btn-ghost" @click="download">
        <Download :size="16" /> 下载 WebM
      </button>
    </div>

    <p class="notice notice-info small mt-2">
      录制完全在本地进行，视频不会上传。首次点击会弹出浏览器的屏幕共享选择框；录制 WebM 格式无时长限制、无水印。
    </p>
  </div>
</template>

<style scoped>
.opts {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.stage {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 34px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  min-height: 220px;
  text-align: center;
}
.rec-icon {
  color: var(--text-3);
}
.rec-ind {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--err);
  animation: blink 1.1s ease-in-out infinite;
}
@keyframes blink {
  50% { opacity: 0.25; }
}
.rec-time {
  font-size: 22px;
  font-weight: 700;
  color: var(--err);
}
.preview {
  width: 100%;
  max-width: 640px;
  border-radius: 10px;
  background: #000;
}
</style>
