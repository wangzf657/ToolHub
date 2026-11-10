<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2, Wand2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeGifFrames, encodeGifFrames } from '@/lib/fileExt'
import { applyOps } from '@/lib/imageEngine'
import type { ImageOp } from '@/lib/imageEngine'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * GIF 编辑器：解码全帧 → 裁剪 / 缩放 / 旋转 / 变速 / 倒放 → gifenc 重编码下载。
 * 帧画布经 imageEngine.applyOps 逐帧处理。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')
const done = ref(false)
const preview = ref('')

// 裁剪（比例坐标：距左/上百分比 + 宽高百分比）
const cropOn = ref(false)
const cropX = ref(10)
const cropY = ref(10)
const cropW = ref(80)
const cropH = ref(80)
// 缩放
const scalePct = ref(100)
// 旋转
const rotate = ref<0 | 90 | 180 | 270>(0)
// 变速（delay 倍率）
const speed = ref(100)
// 倒放
const reverse = ref(false)

const origFrames = ref(0)
const outFrames = ref(0)
const outW = ref(0)
const outH = ref(0)

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.gif$/i.test(f.name) && f.type !== 'image/gif') {
    toast.err('请选择 GIF 文件')
    return
  }
  file.value = f
  done.value = false
}

/** 裁剪单帧（比例坐标 → 像素） */
const cropCanvas = (src: HTMLCanvasElement): HTMLCanvasElement => {
  const x = Math.round((cropX.value / 100) * src.width)
  const y = Math.round((cropY.value / 100) * src.height)
  const w = Math.min(src.width - x, Math.max(1, Math.round((cropW.value / 100) * src.width)))
  const h = Math.min(src.height - y, Math.max(1, Math.round((cropH.value / 100) * src.height)))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h)
  return c
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择 GIF 文件')
    return
  }
  if (cropOn.value && (cropW.value <= 0 || cropH.value <= 0)) {
    toast.warn('裁剪宽高需大于 0%')
    return
  }
  busy.value = true
  progress.value = 0
  done.value = false
  try {
    stage.value = '正在解码全帧…'
    const { frames } = await decodeGifFrames(file.value)
    origFrames.value = frames.length

    stage.value = '正在逐帧处理…'
    // 逐帧套用操作：裁剪 → 缩放 → 旋转
    const w0 = frames[0].canvas.width
    const h0 = frames[0].canvas.height
    let outSize: [number, number] = [w0, h0]
    if (cropOn.value) {
      outSize = [
        Math.round((cropW.value / 100) * w0),
        Math.round((cropH.value / 100) * h0),
      ]
    }
    if (scalePct.value !== 100) {
      outSize = [Math.round(outSize[0] * (scalePct.value / 100)), Math.round(outSize[1] * (scalePct.value / 100))]
    }
    const swap = rotate.value === 90 || rotate.value === 270
    // outSize 为旋转前尺寸；旋转后宽高互换用于展示
    outW.value = Math.max(1, swap ? outSize[1] : outSize[0])
    outH.value = Math.max(1, swap ? outSize[0] : outSize[1])

    const ops: ImageOp[] = []
    if (scalePct.value !== 100) ops.push({ op: 'resize', width: Math.max(1, outSize[0]), height: Math.max(1, outSize[1]), mode: 'fit' })
    if (rotate.value) ops.push({ op: 'rotate', deg: rotate.value })

    let processed = frames.map((f) => {
      let c = f.canvas
      if (cropOn.value) c = cropCanvas(c)
      if (ops.length) c = applyOps(c, ops)
      return { canvas: c, delay: f.delay }
    })
    if (reverse.value) processed = [...processed].reverse()
    // 变速：delay 乘倍率（100 = 原速）
    const rate = speed.value / 100
    processed = processed.map((f) => ({ canvas: f.canvas, delay: Math.max(20, Math.round(f.delay / rate)) }))
    outFrames.value = processed.length

    stage.value = `正在重编码（${processed.length} 帧）…`
    const blob = await encodeGifFrames(processed, undefined, (p) => (progress.value = 0.3 + p * 0.7))
    preview.value = URL.createObjectURL(blob)
    done.value = true
    toast.ok(`编辑完成：${processed.length} 帧 · ${outW.value}×${outH.value}`)
  } catch (e) {
    toast.err((e as Error).message || 'GIF 编辑失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const download = () => {
  if (!preview.value || !file.value) return
  const a = document.createElement('a')
  a.href = preview.value
  a.download = `${baseName(file.value.name)}-编辑.gif`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
</script>

<template>
  <div>
    <FileDrop accept="image/gif" :multiple="false" label="拖入 GIF 动图" hint="裁剪 / 缩放 / 旋转 / 变速 / 倒放，逐帧本地处理" @files="open" />

    <div class="grid-2 mt-2">
      <div class="opt">
        <label class="row" style="gap: 6px; cursor: pointer">
          <input v-model="cropOn" type="checkbox" /> <span class="small">裁剪</span>
        </label>
        <div v-if="cropOn" class="grid-4 mt-1">
          <div><span class="field-label">左</span><input v-model.number="cropX" type="number" class="input" min="0" max="90" /></div>
          <div><span class="field-label">上</span><input v-model.number="cropY" type="number" class="input" min="0" max="90" /></div>
          <div><span class="field-label">宽%</span><input v-model.number="cropW" type="number" min="1" max="100" /></div>
          <div><span class="field-label">高%</span><input v-model.number="cropH" type="number" min="1" max="100" /></div>
        </div>
      </div>
      <div>
        <span class="field-label">旋转</span>
        <select v-model.number="rotate" class="select">
          <option :value="0">不旋转</option>
          <option :value="90">顺时针 90°</option>
          <option :value="180">180°</option>
          <option :value="270">270°</option>
        </select>
      </div>
      <div>
        <span class="field-label">缩放（{{ scalePct }}%）</span>
        <input v-model.number="scalePct" type="range" class="range" min="25" max="100" step="5" />
      </div>
      <div>
        <span class="field-label">速度（{{ speed < 100 ? '加快' : speed > 100 ? '放慢' : '原速' }}）</span>
        <input v-model.number="speed" type="range" class="range" min="25" max="400" step="25" />
      </div>
    </div>

    <label class="row mt-1" style="gap: 8px; cursor: pointer">
      <input v-model="reverse" type="checkbox" /> <span class="small">倒放</span>
    </label>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" /> <Wand2 v-else :size="16" /> 应用并生成
      </button>
      <button v-if="done" class="btn btn-soft" @click="download"><Download :size="15" /> 下载 GIF</button>
    </div>

    <div v-if="busy" class="mt-2">
      <div class="progress"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
      <p class="small muted mt-1">{{ stage }}</p>
    </div>

    <p v-if="done" class="small muted mt-1">{{ origFrames }} 帧 → {{ outFrames }} 帧 · {{ outW }}×{{ outH }} · {{ speed }}% 速度{{ reverse ? ' · 倒放' : '' }}</p>

    <div v-if="preview" class="preview-box mt-2"><img :src="preview" alt="编辑结果预览" /></div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.opt {
  min-width: 200px;
}
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.preview-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: repeating-conic-gradient(rgba(127, 127, 127, 0.1) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}
.preview-box img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 380px;
}
</style>
