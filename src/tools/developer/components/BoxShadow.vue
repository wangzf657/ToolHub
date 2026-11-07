<script setup lang="ts">
import { computed, ref } from 'vue'
import { Box, Copy, Check } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const x = ref(0)
const y = ref(10)
const blur = ref(24)
const spread = ref(0)
const color = ref('#000000')
const alpha = ref(30)
const inset = ref(false)

const rgba = computed(() => {
  const hex = color.value.replace('#', '')
  const n = Number.parseInt(hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${(alpha.value / 100).toFixed(2)})`
})

const css = computed(() => `${inset.value ? 'inset ' : ''}${x.value}px ${y.value}px ${blur.value}px ${spread.value}px ${rgba.value}`)

const copied = ref(false)
const doCopy = async () => {
  const okFlag = await copyText(`box-shadow: ${css.value};`)
  if (okFlag) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toast.ok('box-shadow 已复制')
  } else toast.err('复制失败')
}

const reset = () => {
  x.value = 0
  y.value = 10
  blur.value = 24
  spread.value = 0
  alpha.value = 30
  inset.value = false
}
</script>

<template>
  <div class="shadow-gen">
    <div class="layout">
      <div class="stage">
        <div class="demo-box" :style="{ boxShadow: css }">预览盒子</div>
      </div>

      <div class="controls">
        <div class="ctrl"><span>偏移 X</span><input v-model.number="x" type="range" min="-50" max="50" /><b class="mono">{{ x }}px</b></div>
        <div class="ctrl"><span>偏移 Y</span><input v-model.number="y" type="range" min="-50" max="50" /><b class="mono">{{ y }}px</b></div>
        <div class="ctrl"><span>模糊</span><input v-model.number="blur" type="range" min="0" max="100" /><b class="mono">{{ blur }}px</b></div>
        <div class="ctrl"><span>扩散</span><input v-model.number="spread" type="range" min="-30" max="50" /><b class="mono">{{ spread }}px</b></div>
        <div class="ctrl">
          <span>颜色</span>
          <input v-model="color" type="color" class="color-pick" />
          <input v-model="color" type="text" class="input mono" style="width: 100px" />
          <span style="margin-left: 10px">不透明度</span>
          <input v-model.number="alpha" type="range" min="0" max="100" style="flex: 1" />
          <b class="mono">{{ alpha }}%</b>
        </div>
        <label class="check mt-1"><input v-model="inset" type="checkbox" /> 内阴影（inset）</label>
        <div class="row mt-2" style="gap: 8px">
          <button class="btn btn-ghost btn-sm" @click="reset">重置</button>
        </div>
      </div>
    </div>

    <div class="mt-3 code-card">
      <div class="row" style="align-items: center; margin-bottom: 6px">
        <span class="field-label" style="margin: 0"><Box :size="14" style="vertical-align: -2px" /> CSS 代码</span>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" @click="doCopy">
          <Check v-if="copied" :size="14" color="#34d399" />
          <Copy v-else :size="14" /> 复制
        </button>
      </div>
      <pre class="code mono">box-shadow: {{ css }};</pre>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: stretch;
}
.stage {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #f8fafc;
  display: grid;
  place-items: center;
  min-height: 220px;
}
.demo-box {
  width: 160px;
  height: 110px;
  border-radius: 12px;
  background: #ffffff;
  color: #475569;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 600;
  transition: box-shadow 0.15s ease;
}
.controls {
  display: grid;
  gap: 10px;
  align-content: start;
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: var(--text-2);
}
.ctrl > span:first-child {
  flex: none;
  width: 62px;
}
.ctrl input[type='range'] {
  flex: 1;
}
.ctrl b {
  flex: none;
  width: 52px;
  text-align: right;
  font-size: 12.5px;
}
.color-pick {
  width: 38px;
  height: 30px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: none;
  padding: 2px;
  cursor: pointer;
}
.code-card pre {
  margin: 0;
  padding: 13px 15px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--text-2);
  font-size: 13.5px;
  overflow-x: auto;
}
@media (max-width: 760px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
