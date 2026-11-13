<script setup lang="ts">
/** 语音输入：webkitSpeechRecognition 连续识别，中间结果实时显示；电平条反馈、静默提醒、草稿自动保存。 */
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
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
const netFail = ref(false)
const silentHint = ref(false)

const DRAFT_KEY = 'toolhub.stt-draft'

/* ---------- 电平条：getUserMedia + AnalyserNode，说话时跳动；静默 10s 提示一次 ---------- */
const level = ref(0)
let micStream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let rafId = 0
let lastSoundAt = 0
let hintShownForSilence = false

async function startMeter() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    return // 电平条拿不到麦克风不拦识别主流程
  }
  audioCtx = audioCtx ?? new AudioContext()
  void audioCtx.resume()
  const src = audioCtx.createMediaStreamSource(micStream)
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 512
  src.connect(analyser)
  lastSoundAt = performance.now()
  hintShownForSilence = false
  const buf = new Uint8Array(analyser.frequencyBinCount)
  const tick = () => {
    if (!analyser) return
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / buf.length)
    level.value = Math.min(1, rms * 4)
    if (rms > 0.02) {
      lastSoundAt = performance.now()
      hintShownForSilence = false
      silentHint.value = false
    } else if (performance.now() - lastSoundAt > 10_000 && !hintShownForSilence) {
      // 每段静默只提醒一次，不循环弹
      hintShownForSilence = true
      silentHint.value = true
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function stopMeter() {
  cancelAnimationFrame(rafId)
  analyser = null
  micStream?.getTracks().forEach((t) => t.stop())
  micStream = null
  level.value = 0
  silentHint.value = false
}

/* ---------- 草稿自动保存 ---------- */
try {
  const saved = localStorage.getItem(DRAFT_KEY)
  if (saved) finalText.value = saved
} catch {
  /* 隐私模式下忽略 */
}
watch(finalText, (v) => {
  try {
    if (v) localStorage.setItem(DRAFT_KEY, v)
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* 忽略 */
  }
})

const clearDraft = () => {
  finalText.value = ''
  interim.value = ''
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* 忽略 */
  }
}

/* ---------- 识别主流程 ---------- */
let netErrStreak = 0

function start() {
  if (!Ctor) return
  netFail.value = false
  netErrStreak = 0
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
    } else if (e.error === 'network') {
      // 连续 3 次网络错误 → 停止自动重启，给出明确终态而非无限「正在聆听」
      netErrStreak++
      if (netErrStreak >= 3) {
        netFail.value = true
        toast.err('网络不可用，语音识别需联网。已停止识别，恢复网络后请重新开始')
        stop()
      }
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      toast.warn(`识别出现问题（${e.error}），正在自动继续…`)
    }
    // no-speech 等由 onend 自动重启接管
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
    void startMeter()
  } catch {
    toast.err('无法启动语音识别，请稍后重试')
  }
}

function stop() {
  listening.value = false
  interim.value = ''
  rec.value?.stop()
  stopMeter()
}

/** 聆听中切换语言：重启识别使新语言即时生效 */
const pickLang = (l: string) => {
  if (lang.value === l) return
  lang.value = l
  if (listening.value) {
    try {
      rec.value?.stop() // onend 自动按新 lang 重启
      toast.ok(`已切换到${l === 'zh-CN' ? '中文' : l === 'yue' ? '粤语' : '英语'}识别`)
    } catch {
      /* 忽略 */
    }
  }
}

onBeforeUnmount(() => {
  listening.value = false
  rec.value?.abort()
  stopMeter()
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
      <div class="notice notice-ok av-badge">✓ 当前浏览器支持语音识别（识别由浏览器引擎完成，需联网）</div>

      <div class="row row-wrap">
        <span class="field-label" style="margin: 0">识别语言</span>
        <button class="chip" :class="{ active: lang === 'zh-CN' }" @click="pickLang('zh-CN')">中文（普通话）</button>
        <button class="chip" :class="{ active: lang === 'en-US' }" @click="pickLang('en-US')">English</button>
        <button class="chip" :class="{ active: lang === 'yue' }" @click="pickLang('yue')">粤语</button>
      </div>

      <div class="stt-cta mt-2">
        <button v-if="!listening" class="stt-btn" title="开始识别" aria-label="开始识别" @click="start"><Mic :size="24" /></button>
        <button v-else class="stt-btn danger" title="停止识别" aria-label="停止识别" @click="stop"><Square :size="20" /></button>
        <div class="stt-side">
          <p class="stt-status">{{ listening ? '正在聆听，说话即可…' : '点击麦克风开始连续识别' }}</p>
          <div class="level-line">
            <span class="level-track"><span class="level-fill" :style="{ width: `${Math.round(level * 100)}%` }"></span></span>
            <span v-if="listening" class="muted small">{{ level > 0.03 ? '检测到声音' : '静默中' }}</span>
          </div>
          <p v-if="silentHint && listening" class="stt-silent">没听到声音，请靠近麦克风或检查系统输入设备</p>
          <p v-if="interim" class="stt-interim">{{ interim }}</p>
        </div>
      </div>

      <div v-if="netFail" class="notice notice-warn mt-2">
        <MicOff :size="15" />
        <span>网络不可用，语音识别需联网。请检查网络连接后重新开始识别。</span>
      </div>

      <ResultBox v-model="finalText" class="mt-2" title="识别结果（可直接编辑）" download="txt" placeholder="识别出的文字会累积在这里，也可手动修改…" />
      <div class="row row-wrap mt-1">
        <button class="btn btn-ghost btn-sm" :disabled="!finalText" @click="clearDraft">清空结果与草稿</button>
        <span class="muted small">识别内容已自动存为草稿，刷新或下次打开本页自动恢复</span>
      </div>
      <p class="notice notice-info mt-2">
        <Info :size="15" />
        <span>识别由浏览器内置引擎完成；Chrome / Edge 会把语音发送给其语音服务用于识别，本站本身不收集任何数据。识别结果可直接编辑后复制或下载为 TXT。</span>
      </p>
    </template>
  </div>
</template>

<style scoped>
.av-badge {
  margin-bottom: 12px;
}
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
.stt-side {
  flex: 1;
  min-width: 0;
}
.stt-status {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}
.level-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.level-track {
  width: 160px;
  max-width: 40vw;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  border: 1px solid var(--border);
  overflow: hidden;
  display: inline-block;
}
.level-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #34d399, var(--accent));
  border-radius: 999px;
  transition: width 0.08s linear;
}
.stt-silent {
  margin: 6px 0 0;
  font-size: 13px;
  color: #d97706;
}
.stt-interim {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--accent-text);
}
</style>
