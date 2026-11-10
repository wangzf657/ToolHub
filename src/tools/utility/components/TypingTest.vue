<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { TimerReset, Play } from 'lucide-vue-next'
import { renderChart } from '@/lib/chartEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const DURATION = ref(60)
const LANG = ref<'zh' | 'en'>('zh')
const input = ref('')
const started = ref(false)
const finished = ref(false)
const elapsed = ref(0)

const ZH_SAMPLE = '效率工具是现代生活的加速器。把重复的工作交给自动化的流程，把宝贵的注意力留给真正的思考。每天进步一点点，时间会给出答案。键盘敲击的声音，像雨点落在窗台上，节奏清晰而坚定。'
const EN_SAMPLE = 'The quick brown fox jumps over the lazy dog while programmers debug code and write tools that help people work faster and smarter every day with keyboard shortcuts.'

const target = computed(() => (LANG.value === 'zh' ? ZH_SAMPLE : EN_SAMPLE))

const loadHist = () => {
  try {
    return JSON.parse(localStorage.getItem('toolhub-typing') ?? '[]') as { wpm: number; acc: number }[]
  } catch {
    return []
  }
}

const history = ref<{ wpm: number; acc: number }[]>(loadHist())

let timer: number | null = null
const wpmHistory = ref<{ t: number; cpm: number }[]>([])
const chartRef = ref<HTMLCanvasElement | null>(null)

const correctChars = ref(0)

const start = () => {
  input.value = ''
  correctChars.value = 0
  elapsed.value = 0
  wpmHistory.value = []
  finished.value = false
  started.value = true
  timer = window.setInterval(() => {
    elapsed.value++
    // 每 5 秒记录一次速度
    if (elapsed.value % 5 === 0) {
      const minutes = elapsed.value / 60
      const cpm = correctChars.value / Math.max(0.01, minutes)
      wpmHistory.value.push({ t: elapsed.value, cpm: Math.round(cpm) })
    }
    if (elapsed.value >= DURATION.value) finish()
  }, 1000)
}

const finish = () => {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  started.value = false
  finished.value = true
  const minutes = DURATION.value / 60
  const cpm = correctChars.value / Math.max(0.01, minutes)
  const wpm = Math.round(LANG.value === 'zh' ? cpm / 5 : cpm)
  const acc = accuracy.value
  history.value = [{ wpm, acc }, ...history.value].slice(0, 10)
  localStorage.setItem('toolhub-typing', JSON.stringify(history.value))
  drawChart()
  toast.ok(`完成：${LANG.value === 'zh' ? `${Math.round(cpm)} 字/分` : `${wpm} WPM`}，正确率 ${acc}%`)
}

const drawChart = () => {
  const cv = chartRef.value
  if (!cv || !wpmHistory.value.length) return
  renderChart(
    cv,
    'line',
    wpmHistory.value.map((x) => `${x.t}s`),
    [{ label: '速度（字符/分）', data: wpmHistory.value.map((x) => x.cpm) }],
    { legend: true },
  )
}

const stats = computed(() => {
  const typed = input.value
  let correct = 0
  for (let i = 0; i < typed.length; i++) if (typed[i] === target.value[i]) correct++
  correctChars.value = correct
  const minutes = Math.max(1 / 60, elapsed.value / 60)
  const cpm = correct / minutes
  return {
    correct,
    wrong: typed.length - correct,
    cpm: Math.round(cpm),
    wpm: Math.round(cpm / (LANG.value === 'zh' ? 5 : 1)),
    acc: typed.length ? Math.round((correct / typed.length) * 100) : 100,
  }
})
const accuracy = computed(() => stats.value.acc)

const rendered = computed(() => {
  const t = target.value
  const typed = input.value
  const out: { ch: string; state: 'ok' | 'bad' | 'pending' | 'cursor' }[] = []
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!
    if (i < typed.length) out.push({ ch, state: typed[i] === ch ? 'ok' : 'bad' })
    else if (i === typed.length) out.push({ ch, state: 'cursor' })
    else out.push({ ch, state: 'pending' })
  }
  return out
})

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    if (!started.value && !finished.value) start()
    else if (started.value) finish()
  }
}

onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <label class="seg" :class="{ active: LANG === 'zh' }"><input v-model="LANG" type="radio" value="zh" class="sr" /> 中文（字/分）</label>
        <label class="seg" :class="{ active: LANG === 'en' }"><input v-model="LANG" type="radio" value="en" class="sr" /> 英文（WPM）</label>
        <span class="field-label">时长</span>
        <select v-model.number="DURATION" class="input slim" :disabled="started">
          <option :value="30">30 秒</option>
          <option :value="60">60 秒</option>
          <option :value="120">2 分钟</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="started" @click="start"><Play :size="15" /> 开始</button>
        <span class="hint">Tab 键也可开始 / 结束</span>
      </div>
    </div>

    <div v-if="started || finished" class="stats mt-2">
      <div class="stat"><span class="v">{{ LANG === 'zh' ? stats.cpm : stats.wpm }}</span><span class="l">{{ LANG === 'zh' ? '字/分' : 'WPM' }}</span></div>
      <div class="stat"><span class="v">{{ stats.acc }}%</span><span class="l">正确率</span></div>
      <div class="stat"><span class="v">{{ stats.correct }}</span><span class="l">正确</span></div>
      <div class="stat bad"><span class="v">{{ stats.wrong }}</span><span class="l">错误</span></div>
      <div class="stat" :class="{ warn: DURATION - elapsed <= 10 }"><span class="v">{{ Math.max(0, DURATION - elapsed) }}</span><span class="l">剩余秒</span></div>
    </div>

    <div v-if="started || finished" class="sample mt-2 mono" @keydown="onKeydown">
      <template v-for="(s, i) in rendered" :key="i">
        <span v-if="s.state === 'ok'" class="c ok">{{ s.ch }}</span>
        <span v-else-if="s.state === 'bad'" class="c bad">{{ s.ch }}</span>
        <span v-else-if="s.state === 'cursor'" class="c cursor">{{ s.ch }}</span>
        <span v-else class="c pending">{{ s.ch }}</span>
      </template>
    </div>
    <textarea v-if="started" v-model="input" class="input area mt-2" rows="4" autofocus placeholder="在这里跟随上方文字输入（输入法直接打字即可）…"></textarea>
    <p v-if="started" class="hint mt-1">中文模式按字计速（Composition 输入法友好）；错误字会实时标红。计时结束自动结算。</p>

    <div v-if="finished" class="mt-2">
      <canvas ref="chartRef" width="640" height="220"></canvas>
      <h4 class="h4 mt-2">历史成绩（本机保存）</h4>
      <div class="chips">
        <span v-for="(h, i) in history" :key="i" class="chip-h">#{{ history.length - i }} · {{ h.wpm }} {{ LANG === 'zh' ? '字/分' : 'WPM' }} · {{ h.acc }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.seg { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.slim { width: 100px; }
.stats { display: flex; gap: 10px; flex-wrap: wrap; }
.stat { padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; gap: 2px; min-width: 84px; }
.stat .v { font-size: 22px; font-weight: 700; }
.stat .l { font-size: 12px; color: var(--muted); }
.stat.bad .v { color: var(--err); }
.stat.warn .v { color: var(--warn); }
.sample { padding: 14px 16px; border: 1px solid var(--border); border-radius: 10px; font-size: 16px; line-height: 2; max-height: 200px; overflow: auto; }
.c.ok { color: var(--text); }
.c.bad { color: var(--err); background: rgba(239,68,68,.12); border-radius: 3px; }
.c.cursor { background: var(--accent); color: #fff; border-radius: 3px; }
.c.pending { color: var(--muted); }
.area { width: 100%; resize: vertical; }
.hint { font-size: 12px; color: var(--muted); }
.h4 { margin-bottom: 8px; font-size: 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-h { padding: 3px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
</style>
