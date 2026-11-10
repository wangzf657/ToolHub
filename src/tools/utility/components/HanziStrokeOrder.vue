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

const boxRef = ref<HTMLDivElement | null>(null)
interface WriterLike { animateCharacter: (o?: unknown) => Promise<void>; quiz: (o?: unknown) => Promise<void>; _cur?: string }
let writer: WriterLike | null = null
let animating = false

const play = async (mode: 'animate' | 'quiz') => {
  const ch = [...text.value.trim()][0]
  if (!ch) return toast.warn('请输入一个汉字')
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
        charDataLoader: (c: string, onComplete: (d: unknown) => void) => {
          void fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${c}.json`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`「${c}」不在笔顺库中`))))
            .then((d) => onComplete(d))
            .catch((e: Error) => {
              toast.err(e.message)
              info.value = ''
              busy.value = false
              throw e
          })
        },
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
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.stage { display: grid; place-items: center; min-height: 280px; }
.writer-box { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--panel-solid, #fff); }
.hint { font-size: 12px; color: var(--muted); text-align: center; }
</style>
