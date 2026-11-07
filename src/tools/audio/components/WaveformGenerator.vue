<script setup lang="ts">
/**
 * 音频波形图生成：自绘 canvas（对称镜像 / 底部柱状两种样式），
 * 自定义颜色、背景（透明/纯色）与输出尺寸，实时预览，导出 PNG。
 */
import { ref, shallowRef, watch } from 'vue'
import { Download, Loader2, Waves } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import { baseName, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const buffer = shallowRef<AudioBuffer | null>(null)

const style = ref<'mirror' | 'bars'>('mirror')
const color = ref('#6366f1')
const bgMode = ref<'transparent' | 'solid'>('transparent')
const bgColor = ref('#101828')
const width = ref(1920)
const height = ref(400)
const exporting = ref(false)
const preview = ref<HTMLCanvasElement | null>(null)

function onLoaded(buf: AudioBuffer) {
  buffer.value = buf
}
function onClear() {
  buffer.value = null
}

/** 在 ctx 上以 W×H 绘制波形（预览与导出共用同一实现） */
function render(ctx: CanvasRenderingContext2D, buf: AudioBuffer, W: number, H: number): void {
  if (bgMode.value === 'solid') {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, W, H)
  } else {
    ctx.clearRect(0, 0, W, H)
  }
  const data = buf.getChannelData(0)
  ctx.fillStyle = color.value
  if (style.value === 'mirror') {
    // 对称镜像：逐像素取峰值幅度，围绕中线对称
    const mid = H / 2
    for (let x = 0; x < W; x++) {
      const s0 = Math.floor((x / W) * data.length)
      const s1 = Math.max(s0 + 1, Math.floor(((x + 1) / W) * data.length))
      let amp = 0
      for (let i = s0; i < s1 && i < data.length; i++) {
        const a = Math.abs(data[i])
        if (a > amp) amp = a
      }
      const h = Math.max(1, amp * mid * 0.92 * 2)
      ctx.fillRect(x, mid - h / 2, 1, h)
    }
  } else {
    // 底部柱状：3px 柱 + 2px 间隙
    const slot = 5
    const cols = Math.max(1, Math.floor(W / slot))
    for (let c = 0; c < cols; c++) {
      const s0 = Math.floor((c / cols) * data.length)
      const s1 = Math.max(s0 + 1, Math.floor(((c + 1) / cols) * data.length))
      let amp = 0
      for (let i = s0; i < s1 && i < data.length; i++) {
        const a = Math.abs(data[i])
        if (a > amp) amp = a
      }
      const h = Math.max(2, amp * H * 0.92)
      ctx.fillRect(c * slot, H - h, slot - 2, h)
    }
  }
}

const PREVIEW_W = 1200
const PREVIEW_H = 280

function draw() {
  const c = preview.value
  if (!c) return
  c.width = PREVIEW_W
  c.height = PREVIEW_H
  const ctx = c.getContext('2d')
  if (!ctx) return
  if (buffer.value) render(ctx, buffer.value, PREVIEW_W, PREVIEW_H)
}

watch([style, color, bgMode, bgColor, buffer], draw, { flush: 'post' })
watch(preview, draw, { flush: 'post' })

async function exportPng() {
  const buf = buffer.value
  if (!buf) {
    toast.warn('请先加载音频文件')
    return
  }
  exporting.value = true
  try {
    const W = Math.max(200, Math.min(4096, Math.round(width.value)))
    const H = Math.max(100, Math.min(4096, Math.round(height.value)))
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    render(ctx, buf, W, H)
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG 编码失败')
    const name = base.value?.file ? baseName(base.value.file.name) : 'waveform'
    saveBlob(blob, `${name}-waveform.png`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <AudioToolBase ref="base" :show-wave="false" @loaded="onLoaded" @clear="onClear">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: style === 'mirror' }" @click="style = 'mirror'">对称镜像</button>
      <button class="chip" :class="{ active: style === 'bars' }" @click="style = 'bars'">底部柱状</button>
      <label class="wg-color"><input v-model="color" type="color" title="波形颜色" /> 波形颜色</label>
      <label class="wg-color"><input v-model="bgColor" type="color" title="背景颜色" /> 背景颜色</label>
      <label class="check"><input v-model="bgMode" type="radio" value="transparent" name="wg-bg" /> 透明背景</label>
      <label class="check"><input v-model="bgMode" type="radio" value="solid" name="wg-bg" /> 纯色背景</label>
    </div>

    <div class="wg-preview mt-2" :class="{ checker: bgMode === 'transparent' }">
      <canvas ref="preview" class="wg-canvas"></canvas>
      <p v-if="!buffer" class="wg-empty"><Waves :size="18" /> 加载音频后在这里预览波形</p>
    </div>

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">宽度（px）</span>
        <input v-model.number="width" class="input" type="number" min="200" max="4096" step="10" />
      </label>
      <label class="opt">
        <span class="field-label">高度（px）</span>
        <input v-model.number="height" class="input" type="number" min="100" max="4096" step="10" />
      </label>
      <button class="btn btn-primary mt-auto" :disabled="exporting || !buffer" @click="exportPng">
        <Loader2 v-if="exporting" :size="16" class="spin" />
        <Download v-else :size="16" />
        导出 PNG（{{ width }}×{{ height }}）
      </button>
    </div>
  </AudioToolBase>
</template>

<style scoped>
.wg-color {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  color: var(--text-2);
  cursor: pointer;
}
.wg-preview {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
}
.wg-preview.checker {
  background:
    repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px,
    color-mix(in srgb, var(--panel-solid) 60%, transparent);
}
.wg-canvas {
  display: block;
  width: 100%;
  height: auto;
}
.wg-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  margin: 0;
  color: var(--text-3);
  font-size: 13.5px;
}
.opt {
  min-width: 120px;
}
.mt-auto {
  margin-top: auto;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
