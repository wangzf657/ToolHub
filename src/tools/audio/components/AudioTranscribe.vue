<script setup lang="ts">
/**
 * 音频转文字（降级实现，两条路径明示）：
 * 路径一（默认可用）：上传音频 → 播放 + 浏览器语音识别同步记录 → 导出文本。
 * 路径二（预留）：transformers.js 端侧 Whisper 模型（约 40MB），见下方 TODO 注释。
 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { FileAudio, Info, Mic, Pause, Play, Square } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { getSpeechRecognition, type SpeechRecognitionLike } from './shared'
import { useToast } from '@/composables/useToast'

// TODO(端侧 Whisper 集成预留，路径二)：接入 transformers.js 后可完全离线转写：
//   const { pipeline } = await import('@huggingface/transformers')
//   const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', { quantized: true })
//   const mono16k = await resampleToMono16k(file)          // decodeAudio → 单声道混合 → 16kHz 重采样
//   const out = await asr(mono16k)                          // { text: '...' }
// 届时将下方「路径二」面板替换为真实的上传 → 模型下载（进度条）→ 推理 → 文本流程。

const toast = useToast()
const Ctor = getSpeechRecognition()
const supported = !!Ctor

const file = ref<File | null>(null)
const audioUrl = ref('')
const active = ref(false)
const interim = ref('')
const finalText = ref('')
const rec = shallowRef<SpeechRecognitionLike | null>(null)
const audioEl = ref<HTMLAudioElement | null>(null)

function onFiles(list: File[]) {
  if (!list.length) return
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  file.value = list[0]
  audioUrl.value = URL.createObjectURL(list[0])
  finalText.value = ''
  interim.value = ''
}

/** 启动一段连续识别（onend 自动续期，直到 active=false） */
function startRec() {
  if (!Ctor) return
  const r = new Ctor()
  r.lang = 'zh-CN'
  r.continuous = true
  r.interimResults = true
  r.onresult = (e) => {
    let inter = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      if (res.isFinal) finalText.value += res[0].transcript
      else inter += res[0].transcript
    }
    interim.value = inter
  }
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      toast.err('麦克风权限被拒绝：识别通过麦克风收听外放声音，请允许麦克风后重试')
      stopAll()
    }
  }
  r.onend = () => {
    if (active.value) {
      try {
        r.start()
      } catch {
        /* 已在运行 */
      }
    } else {
      rec.value = null
    }
  }
  rec.value = r
  try {
    r.start()
  } catch {
    /* 忽略重复启动 */
  }
}

function startAll() {
  if (!file.value) {
    toast.warn('请先上传音频文件')
    return
  }
  active.value = true
  startRec()
  void audioEl.value?.play()
}

function pauseAll() {
  active.value = false
  audioEl.value?.pause()
  rec.value?.stop()
}

function stopAll() {
  pauseAll()
  if (audioEl.value) audioEl.value.currentTime = 0
}

function onAudioEnd() {
  pauseAll()
  toast.ok('音频播放结束，转写已停止')
}

const canUse = computed(() => supported && !!file.value)

onBeforeUnmount(() => {
  active.value = false
  rec.value?.abort()
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
})
</script>

<template>
  <div>
    <div class="notice notice-info">
      <Info :size="15" />
      <span>
        <b>路径一（推荐，即时可用）：</b>浏览器语音识别「边播边记」——上传音频后点击开始，播放声音经麦克风实时转写为文字。
        <br />
        <b>路径二（端侧 Whisper，即将开放）：</b>页内预留 transformers.js 集成，模型约 40MB、首次下载后可完全离线转写，音质与准确率更佳。
      </span>
    </div>

    <FileDrop
      v-if="!file"
      class="mt-2"
      accept="audio/*"
      :multiple="false"
      label="拖放音频到此处，或点击选择"
      hint="支持 WAV / MP3 / M4A / OGG 等格式 · 全部本地处理"
      @files="onFiles"
    />

    <template v-else>
      <div class="at-file mt-2">
        <FileAudio :size="15" />
        <span class="at-fname" :title="file.name">{{ file.name }}</span>
        <button class="btn btn-ghost btn-sm" @click="stopAll(); file = null">换一个文件</button>
      </div>
      <audio v-if="audioUrl" ref="audioEl" :src="audioUrl" controls class="at-audio" @ended="onAudioEnd"></audio>

      <div class="row row-wrap mt-2">
        <button v-if="!active" class="btn btn-primary" :disabled="!canUse" @click="startAll">
          <Play :size="16" /> 开始转写并播放
        </button>
        <button v-else class="btn btn-ghost" @click="pauseAll"><Pause :size="15" /> 暂停</button>
        <button v-if="active" class="btn btn-ghost" @click="stopAll"><Square :size="15" /> 停止</button>
        <span v-if="active" class="small muted"><Mic :size="13" /> 识别中，请外放并保持环境安静（戴耳机无法识别）</span>
      </div>
      <p v-if="interim" class="stt-interim mt-1">{{ interim }}</p>

      <ResultBox v-model="finalText" class="mt-2" title="转写结果（可直接编辑）" download="txt" placeholder="转写出的文字会累积在这里…" />
    </template>

    <div v-if="!supported" class="notice notice-warn mt-2">
      <Mic :size="15" />
      <span>当前浏览器不支持 Web Speech 语音识别，路径一不可用。请换用 Chrome / Edge，或等待路径二的端侧 Whisper 版本。</span>
    </div>
  </div>
</template>

<style scoped>
.at-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 13.5px;
}
.at-fname {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.at-audio {
  width: 100%;
  margin-top: 10px;
  display: block;
}
.stt-interim {
  color: var(--accent-text);
  font-size: 14px;
}
</style>
