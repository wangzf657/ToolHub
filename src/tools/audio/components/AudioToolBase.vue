<script setup lang="ts">
/**
 * 音频工具基础组件（本目录共享）：
 * FileDrop(audio/*) → decodeAudio 解码（进度提示）→ 元信息条（时长/声道/采样率）→
 * 波形预览（宽度自适应 + resize 重绘）→ 选项插槽。
 * 子组件通过 expose 的 buffer / file / meta 操作，setBusy 显示处理中状态，reload 重新解码。
 */
import { ref, shallowRef, watch } from 'vue'
import { FileAudio, Loader2, RotateCcw } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeAudio, waveformCanvas } from '@/lib/audioEngine'
import { fmtTime, sizeLabel } from './shared'
import { useToast } from '@/composables/useToast'

withDefaults(defineProps<{ showWave?: boolean }>(), { showWave: true })

const emit = defineEmits<{ loaded: [buffer: AudioBuffer, file: File]; clear: [] }>()
const toast = useToast()

const loading = ref(false)
const busy = ref(false)
const file = ref<File | null>(null)
const buffer = shallowRef<AudioBuffer | null>(null)
const meta = ref<{ duration: number; channels: number; sampleRate: number } | null>(null)
const waveStage = ref<HTMLElement | null>(null)

/** 加载并解码音频文件（供文件选择与外部复用） */
async function loadFile(f: File) {
  loading.value = true
  try {
    const buf = await decodeAudio(f)
    buffer.value = buf
    file.value = f
    meta.value = { duration: buf.duration, channels: buf.numberOfChannels, sampleRate: buf.sampleRate }
    emit('loaded', buf, f)
  } catch (e) {
    toast.err((e as Error).message || '音频解码失败：浏览器不支持该格式，请先转成 WAV / MP3 再试')
    resetAll()
  } finally {
    loading.value = false
  }
}

function onFiles(files: File[]) {
  if (!files.length) resetAll()
  else void loadFile(files[0])
}

function resetAll() {
  buffer.value = null
  file.value = null
  meta.value = null
  emit('clear')
}

/** 子组件标记「处理中」状态（显示忙提示条） */
function setBusy(v: boolean) {
  busy.value = v
}

/** 重新解码当前文件 */
async function reload() {
  if (file.value) await loadFile(file.value)
}

/* ---------- 波形预览：宽度自适应 + resize 重绘 ---------- */
let mountedCanvas: HTMLCanvasElement | null = null
let ro: ResizeObserver | null = null

function drawWave() {
  const buf = buffer.value
  const stage = waveStage.value
  if (!buf || !stage) return
  const w = Math.max(280, stage.clientWidth)
  const c = waveformCanvas(buf, w, 110, '#818cf8')
  if (mountedCanvas) mountedCanvas.remove()
  c.style.maxWidth = '100%'
  c.style.display = 'block'
  stage.appendChild(c)
  mountedCanvas = c
}

watch(buffer, () => requestAnimationFrame(drawWave), { flush: 'post' })
watch(waveStage, (el) => {
  ro?.disconnect()
  ro = null
  if (el) {
    ro = new ResizeObserver(() => drawWave())
    ro.observe(el)
  }
})

defineExpose({ buffer, file, meta, setBusy, reload, loadFile, reset: resetAll })
</script>

<template>
  <div>
    <FileDrop
      v-if="!buffer && !loading"
      accept="audio/*"
      :multiple="false"
      label="拖放音频到此处，或点击选择"
      hint="支持 WAV / MP3 / OGG / M4A / FLAC 等浏览器可解码格式 · 全部本地处理"
      @files="onFiles"
    />
    <div v-else>
      <div v-if="loading" class="at-loading"><Loader2 :size="18" class="spin" /> 正在解码音频…</div>
      <template v-else>
        <div class="at-meta">
          <span class="name" :title="file?.name"><FileAudio :size="15" /> {{ file?.name ?? '未命名' }}</span>
          <span v-if="file">· {{ sizeLabel(file.size) }}</span>
          <template v-if="meta">
            <span>时长 {{ fmtTime(meta.duration) }}</span>
            <span>声道 {{ meta.channels === 1 ? '单声道' : meta.channels === 2 ? '立体声' : `${meta.channels} 声道` }}</span>
            <span>采样率 {{ (meta.sampleRate / 1000).toFixed(1) }} kHz</span>
          </template>
        </div>
        <div v-show="buffer" ref="waveStage" class="at-wave"></div>
        <div v-if="busy" class="at-busy"><Loader2 :size="14" class="spin" /> 正在处理，请稍候…</div>
        <slot />
        <div class="row mt-2">
          <button class="btn btn-ghost btn-sm" @click="resetAll"><RotateCcw :size="14" /> 换一个文件</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.at-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 13px;
  color: var(--text-2);
}
.name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text);
}
.at-wave {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
  overflow: hidden;
}
.at-busy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 13.5px;
}
.at-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px 0;
  color: var(--text-2);
  font-size: 14px;
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
