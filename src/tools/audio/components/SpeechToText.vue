<script setup lang="ts">
/** 语音输入：webkitSpeechRecognition 连续识别，中间结果实时显示，最终文本拼接到结果框（可复制下载） */
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { Info, Mic, MicOff, Square } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { getSpeechRecognition, type SpeechRecognitionLike } from './shared'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const Ctor = getSpeechRecognition()
const supported = !!Ctor

const lang = ref('zh-CN')
const listening = ref(false)
const interim = ref('')
const finalText = ref('')
const rec = shallowRef<SpeechRecognitionLike | null>(null)

function start() {
  if (!Ctor) return
  const r = new Ctor()
  r.lang = lang.value
  r.continuous = true
  r.interimResults = true
  r.maxAlternatives = 1
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
      toast.err('麦克风权限被拒绝：请在浏览器地址栏允许「麦克风」后重试')
      stop()
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      toast.warn(`识别出现问题（${e.error}），正在自动继续…`)
    }
    // no-speech / network 等由 onend 自动重启接管
  }
  r.onend = () => {
    if (listening.value) {
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
    listening.value = true
  } catch {
    toast.err('无法启动语音识别，请稍后重试')
  }
}

function stop() {
  listening.value = false
  interim.value = ''
  rec.value?.stop()
}

onBeforeUnmount(() => {
  listening.value = false
  rec.value?.abort()
})
</script>

<template>
  <div>
    <div v-if="!supported" class="notice notice-warn">
      <MicOff :size="15" />
      <span>
        当前浏览器不支持 Web Speech 语音识别。替代方案：① 使用 Chrome / Edge 打开本页；
        ② 用系统的听写功能；③ 把录音文件交给本站「音频转文字」工具处理。
      </span>
    </div>
    <template v-else>
      <div class="row row-wrap">
        <span class="field-label" style="margin: 0">识别语言</span>
        <button class="chip" :class="{ active: lang === 'zh-CN' }" @click="lang = 'zh-CN'">中文（普通话）</button>
        <button class="chip" :class="{ active: lang === 'en-US' }" @click="lang = 'en-US'">English</button>
        <button class="chip" :class="{ active: lang === 'yue' }" @click="lang = 'yue'">粤语</button>
      </div>

      <div class="stt-cta mt-2">
        <button v-if="!listening" class="stt-btn" title="开始识别" @click="start"><Mic :size="24" /></button>
        <button v-else class="stt-btn danger" title="停止识别" @click="stop"><Square :size="20" /></button>
        <div>
          <p class="stt-status">{{ listening ? '正在聆听，说话即可…' : '点击麦克风开始连续识别' }}</p>
          <p v-if="interim" class="stt-interim">{{ interim }}</p>
        </div>
      </div>

      <ResultBox v-model="finalText" class="mt-2" title="识别结果（可直接编辑）" download="txt" placeholder="识别出的文字会累积在这里，也可手动修改…" />
      <p class="notice notice-info mt-2">
        <Info :size="15" />
        <span>识别由浏览器内置引擎完成；Chrome / Edge 会把语音发送给其语音服务用于识别，本站本身不收集任何数据。识别结果可直接编辑后复制或下载为 TXT。</span>
      </p>
    </template>
  </div>
</template>

<style scoped>
.stt-cta {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border: 1px dashed var(--border-strong);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 40%, transparent);
}
.stt-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
  background: linear-gradient(135deg, var(--accent), #7c74f2);
  color: #fff;
  box-shadow: 0 8px 22px rgba(99, 102, 241, 0.4);
}
.stt-btn.danger {
  background: linear-gradient(135deg, #f87171, #ef4444);
  box-shadow: 0 8px 22px rgba(248, 113, 113, 0.35);
}
.stt-status {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}
.stt-interim {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--accent-text);
}
</style>
