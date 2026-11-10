<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcw, Copy } from 'lucide-vue-next'
import { MBTI_QUESTIONS, MBTI_TYPES } from '@/lib/utilNames'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const idx = ref(0)
const scores = ref({ E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 })
const done = ref(false)

const answer = (choice: 'a' | 'b') => {
  const q = MBTI_QUESTIONS[idx.value]!
  const key = choice === 'a' ? q.sa : q.sb
  scores.value[key]++
  if (idx.value >= MBTI_QUESTIONS.length - 1) done.value = true
  else idx.value++
}

const result = computed(() => {
  const s = scores.value
  const type = `${s.E >= s.I ? 'E' : 'I'}${s.S >= s.N ? 'S' : 'N'}${s.T >= s.F ? 'T' : 'F'}${s.J >= s.P ? 'J' : 'P'}`
  const pct = (a: number, b: number) => Math.round((a / Math.max(1, a + b)) * 100)
  return {
    type,
    dims: [
      { label: '外向 E / 内向 I', left: pct(s.E, s.I), l: s.E, r: s.I },
      { label: '实感 S / 直觉 N', left: pct(s.S, s.N), l: s.S, r: s.N },
      { label: '思考 T / 情感 F', left: pct(s.T, s.F), l: s.T, r: s.F },
      { label: '判断 J / 知觉 P', left: pct(s.J, s.P), l: s.J, r: s.P },
    ],
    desc: MBTI_TYPES[type] ?? { name: type, lines: ['', '', ''] },
  }
})

const restart = () => {
  idx.value = 0
  scores.value = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
  done.value = false
}

const doCopy = async () => {
  const r = result.value
  const ok = await copyText(`我的 MBTI 是 ${r.type}（${r.desc.name}）：${r.dims.map((d) => d.label.split(' / ').join(' ') + ' ' + d.left + '%').join('，')}`)
  ok ? toast.ok('已复制结果') : toast.err('复制失败')
}
</script>

<template>
  <div>
    <div v-if="!done" class="opts-panel quiz">
      <div class="progress"><div class="fill" :style="{ width: (idx / MBTI_QUESTIONS.length) * 100 + '%' }"></div></div>
      <p class="q-count">第 {{ idx + 1 }} / {{ MBTI_QUESTIONS.length }} 题</p>
      <h3 class="q-text">{{ MBTI_QUESTIONS[idx]!.q }}</h3>
      <div class="opts">
        <button class="opt" @click="answer('a')">{{ MBTI_QUESTIONS[idx]!.a }}</button>
        <button class="opt" @click="answer('b')">{{ MBTI_QUESTIONS[idx]!.b }}</button>
      </div>
      <p class="hint">凭直觉选择更符合你的那一个；28 题约需 3 分钟。娱乐向自测，非专业量表。</p>
    </div>

    <div v-else class="opts-panel result">
      <p class="r-type">{{ result.type }}</p>
      <p class="r-name">{{ result.desc.name }}</p>
      <div v-for="d in result.dims" :key="d.label" class="dim">
        <span class="dim-l">{{ d.label.split(' / ')[0] }} {{ d.l }}</span>
        <div class="dim-bar"><div class="dim-fill" :style="{ width: d.left + '%' }"></div></div>
        <span class="dim-r">{{ d.r }} {{ d.label.split(' / ')[1] }}</span>
      </div>
      <ul class="r-lines">
        <li v-for="(l, i) in result.desc.lines" :key="i">{{ l }}</li>
      </ul>
      <div class="row gap mt-2">
        <button class="btn btn-primary btn-sm" @click="doCopy"><Copy :size="14" /> 复制结果</button>
        <button class="btn btn-sm" @click="restart"><RotateCcw :size="14" /> 再测一次</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz { max-width: 560px; margin: 0 auto; }
.progress { height: 5px; background: var(--surface-2, rgba(127,127,127,.15)); border-radius: 3px; margin-bottom: 14px; }
.fill { height: 100%; background: var(--accent); border-radius: 3px; }
.q-count { font-size: 12px; color: var(--muted); }
.q-text { font-size: 19px; margin: 10px 0 20px; }
.opts { display: flex; flex-direction: column; gap: 10px; }
.opt { padding: 14px 18px; border: 1px solid var(--border); border-radius: 12px; background: transparent; cursor: pointer; text-align: left; font-size: 15px; color: var(--text); }
.opt:hover { border-color: var(--accent); background: var(--accent-soft); }
.hint { font-size: 12px; color: var(--muted); margin-top: 14px; }
.result { max-width: 560px; margin: 0 auto; }
.r-type { text-align: center; font-size: 46px; font-weight: 800; color: var(--accent-text); }
.r-name { text-align: center; margin-bottom: 18px; }
.dim { display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: 13px; }
.dim-l { width: 64px; }
.dim-r { width: 64px; text-align: right; }
.dim-bar { flex: 1; height: 8px; border-radius: 4px; background: var(--surface-2, rgba(127,127,127,.15)); overflow: hidden; }
.dim-fill { height: 100%; background: var(--accent); }
.r-lines { margin: 14px 0; padding-left: 18px; font-size: 14px; line-height: 1.9; }
.gap { gap: 10px; }
</style>
