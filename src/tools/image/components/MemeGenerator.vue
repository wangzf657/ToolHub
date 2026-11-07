<script setup lang="ts">
/** 表情包制作：上下两行白字黑描边经典梗图 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const topText = ref('')
const bottomText = ref('')
const size = ref(0) // 0 = 自动（图宽 / 10）
const stroke = ref(true)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  size.value = 0
  render()
}

function drawLine(ctx: CanvasRenderingContext2D, text: string, w: number, y: number, fs: number) {
  ctx.font = `700 ${fs}px Impact, 'Microsoft YaHei', sans-serif`
  ctx.textAlign = 'center'
  if (stroke.value) {
    ctx.lineWidth = Math.max(3, fs / 8)
    ctx.strokeStyle = '#000000'
    ctx.lineJoin = 'round'
    ctx.strokeText(text, w / 2, y)
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, w / 2, y)
}

function render() {
  if (!src.value) return
  const has = topText.value.trim() || bottomText.value.trim()
  if (!has) {
    base.value?.setOutput(null)
    return
  }
  const c = document.createElement('canvas')
  c.width = src.value.width
  c.height = src.value.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src.value, 0, 0)
  const fs = size.value > 0 ? size.value : Math.max(20, Math.round(c.width / 10))
  const lines = (t: string) => t.split('\n')
  const topLines = lines(topText.value.trim())
  topLines.forEach((t, i) => drawLine(ctx, t, c.width, fs * (1.1 + i * 1.05), fs))
  const botLines = lines(bottomText.value.trim())
  botLines.forEach((t, i) => {
    const idx = botLines.length - 1 - i
    drawLine(ctx, t, c.width, c.height - fs * (0.35 + idx * 1.05), fs)
  })
  base.value?.setOutput(c)
}

let timer = 0
watch([topText, bottomText, size, stroke], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" suffix="-meme" @loaded="onLoaded">
    <div class="mt-2 grid-2" style="max-width: 640px">
      <label class="opt">
        <span class="field-label">顶部文字</span>
        <textarea v-model="topText" class="textarea" style="min-height: 72px" placeholder="WHEN YOU…（支持换行）"></textarea>
      </label>
      <label class="opt">
        <span class="field-label">底部文字</span>
        <textarea v-model="bottomText" class="textarea" style="min-height: 72px" placeholder="…打开这个网站"></textarea>
      </label>
    </div>
    <div class="row row-wrap mt-2" style="gap: 24px">
      <div style="max-width: 360px; min-width: 220px">
        <span class="field-label">字号：{{ size > 0 ? size + ' px' : '自动（图宽 / 10）' }}</span>
        <input v-model.number="size" type="range" min="0" max="160" step="2" />
      </div>
      <label class="check" style="margin-top: 18px"><input v-model="stroke" type="checkbox" /> 黑色描边</label>
    </div>
  </ImageToolBase>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.opt .textarea {
  min-height: 72px;
  height: auto;
}
</style>
