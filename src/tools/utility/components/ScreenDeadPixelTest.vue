<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Play, Square, MonitorSmartphone } from 'lucide-vue-next'

const colors = [
  { name: '红', css: '#ff0000' },
  { name: '绿', css: '#00ff00' },
  { name: '蓝', css: '#0000ff' },
  { name: '白', css: '#ffffff' },
  { name: '黑', css: '#000000' },
  { name: '灰', css: '#808080' },
]
const idx = ref(0)
const cycling = ref(false)
const custom = ref('#7f7fff')
const flashRepair = ref(false)
const flashOn = ref(true)

const overlay = ref<HTMLDivElement | null>(null)
let timer: number | null = null

const start = () => {
  stopCycle()
  cycling.value = true
  idx.value = 0
  try {
    void overlay.value?.requestFullscreen?.()
  } catch { /* 全屏失败不阻塞 */ }
  if (flashRepair.value) {
    timer = window.setInterval(() => {
      flashOn.value = !flashOn.value
    }, 60)
  }
}

const stopCycle = () => {
  cycling.value = false
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

const next = () => {
  idx.value = (idx.value + 1) % colors.length
}

onBeforeUnmount(() => {
  stopCycle()
  if (timer !== null) clearInterval(timer)
})
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <button class="btn btn-primary" @click="cycling ? stopCycle() : start()">
          <Square v-if="cycling" :size="16" /><Play v-else :size="16" /> {{ cycling ? '退出测试（Esc）' : '开始测试（全屏）' }}
        </button>
        <button class="btn btn-sm" @click="next" :disabled="!cycling">切换纯色</button>
        <label class="check"><input v-model="flashRepair" type="checkbox" /> 闪烁修复模式（仅对亚像素卡死有效）</label>
      </div>
      <div class="row wrap gap mt-2">
        <span class="field-label">自定义色</span>
        <input v-model="custom" type="color" class="input" style="width: 52px; height: 34px; padding: 2px" />
        <button class="btn btn-sm" :disabled="!cycling" @click="idx = -1">显示自定义色</button>
        <span class="spacer"></span>
        <MonitorSmartphone :size="15" class="muted" />
        <span class="hint">手机也能测：横屏 + 全屏更准确</span>
      </div>
      <p class="hint mt-1">用法：全屏后逐色检查——坏点为固定黑点，亮点为固定发光点；每个颜色停留几秒，用硬卡（不刮伤屏）轻擦可疑处排除灰尘。</p>
    </div>

    <div v-if="cycling" ref="overlay" class="overlay" :style="{ background: idx === -1 ? custom : flashRepair ? (flashOn ? (idx === -1 ? custom : colors[idx]!.css) : '#000') : idx === -1 ? custom : colors[idx]!.css }" @click="next">
      <p class="ov-hint">{{ idx === -1 ? '自定义色' : colors[idx]!.name }} · 点击切换 · Esc 退出</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.spacer { flex: 1; }
.muted { color: var(--muted); }
.overlay { position: fixed; inset: 0; z-index: 9999; background: #000; }
.ov-hint { position: fixed; bottom: 14px; left: 0; right: 0; text-align: center; color: rgba(255,255,255,.4); font-size: 12px; mix-blend-mode: difference; }
.hint { font-size: 12px; color: var(--muted); }
</style>
