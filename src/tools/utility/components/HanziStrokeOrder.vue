<script setup lang="ts">
import { ref } from 'vue'
import { Play, Pause, Eraser, PenTool } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

/** 汉字笔顺演示：hanzi-writer 按字从 CDN 加载笔顺数据（每字约 10KB） */
const toast = useToast()

const text = ref('永')
const quizMode = ref(false)
const busy = ref(false)
const info = ref('')
const loadFailed = ref(false)

const boxRef = ref<HTMLDivElement | null>(null)
interface WriterLike { animateCharacter: (o?: unknown) => Promise<void>; quiz: (o?: unknown) => Promise<void>; _cur?: string }
let writer: WriterLike | null = null
let animating = false

/* ---------- 笔顺数据源：版本锁定 + jsdelivr/unpkg/npmmirror 依次切换（CDN 韧性） ---------- */
const DATA_VERSION = '2.0'
const DATA_SOURCES = [
  (ch: string) => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@${DATA_VERSION}/${encodeURIComponent(ch)}.json`,
  (ch: string) => `https://unpkg.com/hanzi-writer-data@${DATA_VERSION}/${encodeURIComponent(ch)}.json`,
  (ch: string) => `https://registry.npmmirror.com/hanzi-writer-data/${DATA_VERSION}/files/${encodeURIComponent(ch)}.json`,
]
/** 会话内记住首个可用源，后续字直接从它开始 */
let srcStart = 0

const loadCharData = (c: string, onComplete: (d: unknown) => void): void => {
  loadFailed.value = false
  const tryFrom = async (start: number) => {
    let lastErr = ''
    for (let k = 0; k < DATA_SOURCES.length; k++) {
      const idx = (start + k) % DATA_SOURCES.length
      try {
        const r = await fetch(DATA_SOURCES[idx](c))
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = (await r.json()) as unknown
        srcStart = idx
        onComplete(d)
        return
      } catch (e) {
        lastErr = (e as Error).message
      }
    }
    // 所有源都失败：明确终态 + 重试按钮（不再静默）
    info.value = ''
    busy.value = false
    loadFailed.value = true
    toast.err(`笔顺数据加载失败（${lastErr}）：已尝试 jsdelivr / unpkg / npmmirror 三个源`)
  }
  void tryFrom(srcStart)
}

const isCjk = (c: string) => /[\u4e00-\u9fff]/.test(c)

const play = async (mode: 'animate' | 'quiz') => {
  const ch = [...text.value.trim()][0]
  if (!ch) return toast.warn('请输入一个汉字')
  // 非汉字即时拦截：不发任何 CDN 请求
  if (!isCjk(ch)) return toast.warn('请输入汉字（笔顺库仅覆盖 CJK 汉字）')
  if (!boxRef.value) return
  busy.value = true
  info.value = `正在加载「${ch}」的笔顺数据…`
  try {
    const mod = await import('hanzi-writer')
    const HanziWriter = (mod.default ?? mod) as unknown as typeof import('hanzi-writer').default
    if (!writer || (writer as unknown as { _cur?: string })._cur !== ch) {
      boxRef.value.innerHTML = ''
      const target = document.createElement('div')
      target.style.width = '240px'
      target.style.height = '240px'
      boxRef.value.appendChild(target)
      const opts = {
        width: 240,
        height: 240,
        padding: 10,
        strokeColor: '#8b7355',
        radicalColor: '#a855f7',
        showOutline: true,
        delayBetweenStrokes: 260,
        strokeAnimationSpeed: 1.2,
        charDataLoader: loadCharData,
      }
      writer = HanziWriter.create(target, ch, opts as never) as unknown as WriterLike
      writer._cur = ch
    }
    info.value = ''
    animating = true
    if (mode === 'quiz') await writer.quiz({ showHintAfterMisses: 2 })
    else await writer.animateCharacter()
    animating = false
  } catch (e) {
    animating = false
    if ((e as Error).message.includes('不在笔顺库')) info.value = ''
  } finally {
    busy.value = false
  }
}

/** 加载失败后的重试：从下一个源开始再轮一遍 */
const retryLoad = () => {
  const ch = [...text.value.trim()][0]
  if (!ch) return
  srcStart = (srcStart + 1) % DATA_SOURCES.length
  writer = null
  loadFailed.value = false
  void play('animate')
}

const playAll = async () => {
  // 多字逐个播放
  const chars = [...text.value.trim()].slice(0, 4)
  if (!chars.length) return toast.warn('请输入汉字（最多连播 4 个）')
  for (const c of chars) {
    if (c !== (writer as unknown as { _cur?: string } | null)?._cur) text.value = c
    await new Promise((r) => setTimeout(r, 30))
    await play('animate')
    await new Promise((r) => setTimeout(r, 420))
  }
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <input v-model="text" class="input" style="width: 160px" placeholder="输入汉字（1 个）" @keyup.enter="play('animate')" />
        <button class="btn btn-primary btn-sm" :disabled="busy || animating" @click="play('animate')"><Play :size="15" /> 播放笔顺</button>
        <button class="btn btn-sm" @click="playAll" :disabled="busy">逐字连播（≤4 字）</button>
        <label class="check"><input v-model="quizMode" type="checkbox" @change="quizMode && play('quiz')" /> 描红练习模式</label>
        <button v-if="quizMode" class="btn btn-sm" @click="play('quiz')"><PenTool :size="14" /> 重新描写</button>
      </div>
      <p class="hint mt-1">笔顺数据按字从 CDN 加载（hanzi-writer-data，每字约 10KB，浏览器缓存）；描红模式用鼠标/触屏按笔顺描写。查询「一」级常用字覆盖最好。</p>
    </div>

    <div class="stage mt-2">
      <div ref="boxRef" class="writer-box"></div>
      <p v-if="info" class="hint">{{ info }}</p>
      <div v-if="loadFailed" class="fail-card">
        <p>笔顺数据加载失败（jsdelivr / unpkg / npmmirror 均不可达或该字不在笔顺库中）</p>
        <button class="btn btn-primary btn-sm" @click="retryLoad">重试</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.stage { display: grid; place-items: center; min-height: 280px; }
.writer-box { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--panel-solid, #fff); }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
.fail-card { display: grid; justify-items: center; gap: 10px; padding: 14px 18px; border: 1px solid rgba(248, 113, 113, 0.3); background: rgba(248, 113, 113, 0.06); border-radius: 12px; color: var(--text-2); font-size: 13px; text-align: center; }
.fail-card p { margin: 0; }
</style>
