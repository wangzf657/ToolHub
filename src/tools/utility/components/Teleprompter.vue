<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Play, Pause, X, FlipHorizontal2 } from 'lucide-vue-next'

const text = ref(`大家好，欢迎来到本期节目。\n今天我们要聊一聊效率工具如何改变我们的工作方式。\n首先，让我们从一个真实的故事说起……`)
const speed = ref(60) // px/s
const fontSize = ref(26)
const mirror = ref(false)
const live = ref(false)

const stageRef = ref<HTMLDivElement | null>(null)
const innerRef = ref<HTMLDivElement | null>(null)
let raf = 0
let pos = 0
let last = 0

const start = () => {
  live.value = true
  pos = 0
  last = performance.now()
  requestAnimationFrame(step)
}

const step = (t: number) => {
  const dt = (t - last) / 1000
  last = t
  pos += speed.value * dt
  const el = innerRef.value
  const stage = stageRef.value
  if (el && stage) {
    // 滚到底后自动停
    const max = el.scrollHeight - stage.clientHeight
    if (pos >= max) {
      el.style.transform = `translateY(${-max}px)`
      live.value = false
      return
    }
    el.style.transform = `translateY(${-pos}px)`
  }
  raf = requestAnimationFrame(step)
}

const pause = () => {
  cancelAnimationFrame(raf)
  live.value = false
}

const exit = () => {
  pause()
  live.value = false
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

const fullscreen = () => {
  stageRef.value?.requestFullscreen?.().catch(() => {})
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <textarea v-model="text" class="input area" rows="6" placeholder="粘贴口播台词…"></textarea>
      <div class="row wrap gap mt-2">
        <span class="field-label">滚动速度</span>
        <input v-model.number="speed" type="number" class="input slim" min="10" max="400" />
        <span class="field-label">字号</span>
        <input v-model.number="fontSize" type="number" class="input slim" min="14" max="80" />
        <label class="check"><input v-model="mirror" type="checkbox" /> 镜像（反射板）</label>
        <button class="btn btn-primary btn-sm" @click="start"><Play :size="15" /> 全屏滚动</button>
      </div>
      <p class="hint mt-1">全屏中：空格暂停/继续，Esc 退出；滚到底自动停止。</p>
    </div>

    <div ref="stageRef" class="stage mt-2" :class="{ full: live }">
      <div ref="innerRef" class="tele mono" :class="{ mirror: mirror && live }" :style="{ fontSize: fontSize + 'px' }">{{ text }}</div>
      <div v-if="live" class="center-line"></div>
      <div v-if="live" class="ctrl">
        <button class="cbtn" @click="live ? (exit()) : start()"><Play v-if="!live" :size="18" /><Pause v-else :size="18" /></button>
        <button class="cbtn" @click="fullscreen">⛶</button>
        <button class="cbtn" @click="mirror = !mirror"><FlipHorizontal2 :size="18" /></button>
        <button class="cbtn" @click="exit"><X :size="18" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 90px; }
.area { width: 100%; resize: vertical; }
.stage { position: relative; height: 300px; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: #000; }
.stage.full { position: fixed; inset: 0; z-index: 9999; border: none; border-radius: 0; height: 100vh; }
.tele { color: #fff; padding: 40vh 15% 60vh; line-height: 2; white-space: pre-wrap; will-change: transform; }
.tele.mirror { transform-origin: center; scale: -1 1; }
.center-line { position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: rgba(255, 235, 59, .55); pointer-events: none; }
.ctrl { position: absolute; bottom: 18px; left: 0; right: 0; display: flex; justify-content: center; gap: 12px; }
.cbtn { width: 44px; height: 44px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; cursor: pointer; display: grid; place-items: center; font-size: 18px; }
.cbtn:hover { background: rgba(255,255,255,.3); }
.hint { font-size: 12px; color: var(--muted); }
</style>
