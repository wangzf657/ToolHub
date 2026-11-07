<script setup lang="ts">
/** 文字转语音：speechSynthesis 调用系统内置语音，可选音色/语速/音调，试听、暂停、继续、停止 */
import { onBeforeUnmount, ref } from 'vue'
import { Info, Pause, Play, Square, Volume2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
const unsupported = !synth

const text = ref('')
const voices = ref<SpeechSynthesisVoice[]>([])
const voiceURI = ref('')
const rate = ref(1)
const pitch = ref(1)
const speaking = ref(false)
const paused = ref(false)

/** 优先列出中文语音；系统没有任何中文语音时退回全部语音 */
function loadVoices() {
  if (!synth) return
  const all = synth.getVoices()
  if (!all.length) return
  const zh = all.filter((v) => v.lang.toLowerCase().startsWith('zh'))
  voices.value = zh.length ? zh : all
  if (!voices.value.some((v) => v.voiceURI === voiceURI.value)) {
    voiceURI.value = voices.value[0]?.voiceURI ?? ''
  }
}
loadVoices()

if (synth) {
  synth.onvoiceschanged = loadVoices
  // 部分浏览器（Safari）voices 异步加载，轮询兜底
  const poll = window.setInterval(() => {
    loadVoices()
    if (voices.value.length) window.clearInterval(poll)
  }, 400)
  onBeforeUnmount(() => window.clearInterval(poll))
}

function speak() {
  if (!synth) return
  if (!text.value.trim()) {
    toast.warn('请先输入要朗读的文本')
    return
  }
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text.value)
  const v = voices.value.find((x) => x.voiceURI === voiceURI.value)
  if (v) {
    u.voice = v
    u.lang = v.lang
  }
  u.rate = rate.value
  u.pitch = pitch.value
  const done = () => {
    speaking.value = false
    paused.value = false
  }
  u.onstart = () => {
    speaking.value = true
    paused.value = false
  }
  u.onend = done
  u.onerror = done
  synth.speak(u)
}

function pause() {
  if (!synth) return
  synth.pause()
  paused.value = true
}
function resume() {
  if (!synth) return
  synth.resume()
  paused.value = false
}
function stop() {
  if (!synth) return
  synth.cancel()
  speaking.value = false
  paused.value = false
}

onBeforeUnmount(stop)
</script>

<template>
  <div>
    <div v-if="unsupported" class="notice notice-err">
      <Info :size="15" />
      <span>当前浏览器不支持语音合成（speechSynthesis），请换用 Chrome / Edge / Safari 等现代浏览器。</span>
    </div>
    <template v-else>
      <label>
        <span class="field-label">要朗读的文本</span>
        <textarea v-model="text" class="textarea" style="min-height: 150px" placeholder="输入或粘贴文本，使用系统内置语音朗读…" @keydown.enter.exact.prevent="speak"></textarea>
      </label>

      <div class="grid-2 mt-2">
        <label>
          <span class="field-label">语音（系统内置，共 {{ voices.length }} 个）</span>
          <select v-model="voiceURI" class="select">
            <option v-if="!voices.length" value="">正在加载系统语音…</option>
            <option v-for="v in voices" :key="v.voiceURI" :value="v.voiceURI">{{ v.name }}（{{ v.lang }}）</option>
          </select>
        </label>
        <div class="tts-sliders">
          <label><span class="field-label">语速 {{ rate.toFixed(1) }}×</span><input v-model.number="rate" type="range" min="0.5" max="2" step="0.1" /></label>
          <label><span class="field-label">音调 {{ pitch.toFixed(1) }}</span><input v-model.number="pitch" type="range" min="0" max="2" step="0.1" /></label>
        </div>
      </div>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary" :disabled="speaking && !paused" @click="speak">
          <Play :size="16" /> 试听 / 重新朗读
        </button>
        <button v-if="speaking && !paused" class="btn btn-ghost" @click="pause"><Pause :size="15" /> 暂停</button>
        <button v-if="paused" class="btn btn-ghost" @click="resume"><Play :size="15" /> 继续</button>
        <button v-if="speaking || paused" class="btn btn-ghost" @click="stop"><Square :size="15" /> 停止</button>
      </div>

      <p class="notice notice-info mt-2">
        <Volume2 :size="15" />
        <span>使用操作系统内置语音合成引擎朗读，文本全程不联网、不上传。语音列表来自你的系统设置：若列表中没有中文语音，可在系统的「语音 / 辅助功能」设置里安装中文语音包。浏览器原生合成无法直接导出音频文件，如需保存请使用系统录音或虚拟声卡录制。</span>
      </p>
    </template>
  </div>
</template>

<style scoped>
.tts-sliders {
  display: grid;
  gap: 10px;
  align-content: end;
}
</style>
