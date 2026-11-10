<script setup lang="ts">
import { computed, ref } from 'vue'
import { X, FlipHorizontal2 } from 'lucide-vue-next'

const text = ref('接机 · 请往 3 号口')
const color = ref('#ffffff')
const bg = ref('#e11d48')
const speed = ref(80) // px/s
const fontSize = ref(72)
const dir = ref<'ltr' | 'rtl'>('ltr')
const mirror = ref(false)
const live = ref(false)

const RECENT_KEY = 'toolhub-marquee'
const recent = ref<string[]>(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[])

const textStyle = computed(() => ({
  color: color.value,
  fontSize: fontSize.value + 'px',
  transform: mirror.value ? 'scaleX(-1)' : undefined,
  animation: `marquee-run ${speed.value}s linear infinite`,
  animationDirection: dir.value === 'rtl' ? 'reverse' : 'normal',
}))

const start = () => {
  recent.value = [text.value, ...recent.value.filter((x) => x !== text.value)].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  live.value = true
}

const exit = () => {
  live.value = false
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') exit()
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <input v-model="text" class="input" placeholder="输入弹幕文字，如：生日快乐" @keyup.enter="start" />
      <div class="row wrap gap mt-2">
        <span class="field-label">文字色</span>
        <input v-model="color" type="color" class="input" style="width: 40px; height: 30px; padding: 2px" />
        <span class="field-label">背景色</span>
        <input v-model="bg" type="color" class="input" style="width: 40px; height: 30px; padding: 2px" />
        <span class="field-label">字号</span>
        <input v-model.number="fontSize" type="number" class="input slim" min="24" max="200" />
        <span class="field-label">滚动时长（秒）</span>
        <input v-model.number="speed" type="number" class="input slim" min="2" max="200" />
        <select v-model="dir" class="input slim"><option value="ltr">左→右</option><option value="rtl">右→左</option></select>
        <label class="check"><input v-model="mirror" type="checkbox" /> 镜像（自拍用）</label>
        <button class="btn btn-primary btn-sm" @click="start">全屏启动</button>
      </div>
      <div v-if="recent.length" class="chips mt-2">
        <button v-for="r in recent" :key="r" class="chip-btn" @click="text = r">{{ r }}</button>
      </div>
      <p class="hint mt-1">全屏后：Esc 退出。演唱会接机/应援把手机横过来效果更好。</p>
    </div>

    <div v-if="live" class="overlay" :style="{ background: bg }" tabindex="0" @keydown="onKey">
      <div class="track-wrap">
        <span class="track mono" :style="textStyle">{{ text }}</span>
      </div>
      <button class="exit" @click="exit"><X :size="20" /></button>
      <button class="exit mirror" @click="mirror = !mirror"><FlipHorizontal2 :size="20" /></button>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 90px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-btn { padding: 3px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.hint { font-size: 12px; color: var(--muted); }
.overlay { position: fixed; inset: 0; z-index: 9999; overflow: hidden; display: flex; align-items: center; }
.track-wrap { width: 100%; white-space: nowrap; }
.track { display: inline-block; font-weight: 800; padding-left: 100%; }
@keyframes marquee-run { from { transform: translateX(0); } to { transform: translateX(-100%); } }
.exit { position: absolute; top: 14px; right: 14px; border: none; background: rgba(0,0,0,.35); color: #fff; border-radius: 50%; width: 44px; height: 44px; display: grid; place-items: center; cursor: pointer; }
.exit.mirror { right: 70px; }
</style>
