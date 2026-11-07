<script setup lang="ts">
import { ref, watch } from 'vue'
import { ImageDown } from 'lucide-vue-next'
import { BARCODE_FORMATS, makeBarcode } from '@/lib/qrEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref('')
const format = ref('CODE128')
const width = ref(2)
const height = ref(90)
const showValue = ref(true)

const canvas = ref<HTMLCanvasElement | null>(null)
const ok = ref(false)
const errMsg = ref('')

const render = async () => {
  if (!canvas.value) return
  const t = text.value.trim()
  if (!t) {
    ok.value = false
    errMsg.value = ''
    return
  }
  try {
    await makeBarcode(canvas.value, t, format.value, {
      width: width.value,
      height: height.value,
      displayValue: showValue.value,
    })
    ok.value = true
    errMsg.value = ''
  } catch {
    ok.value = false
    errMsg.value = `「${t}」不符合 ${format.value} 码制要求，请检查内容（例如 EAN-13 需 12–13 位数字，CODE39 仅支持字母数字与 - . $ / + % 空格）`
  }
}

watch([text, format, width, height, showValue], render, { immediate: true })

const download = async () => {
  if (!canvas.value || !ok.value) return
  try {
    const blob = await new Promise<Blob | null>((r) => canvas.value!.toBlob(r, 'image/png'))
    if (!blob) throw new Error('导出失败')
    saveBlob(blob, `barcode-${text.value.trim() || 'out'}.png`)
  } catch (e) {
    toast.err((e as Error).message || '下载失败')
  }
}
</script>

<template>
  <div>
    <div class="grid-2">
      <div>
        <span class="field-label">条码内容</span>
        <input v-model="text" class="input mono" placeholder="例如 6901028180019 或 HELLO-2024" />
      </div>
      <div>
        <span class="field-label">码制格式</span>
        <select v-model="format" class="select">
          <option v-for="f in BARCODE_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </div>
    </div>

    <div class="row row-wrap mt-2 opt-row">
      <div class="opt">
        <span class="field-label">条宽（{{ width }}px）</span>
        <input v-model.number="width" type="range" min="1" max="5" step="1" />
      </div>
      <div class="opt">
        <span class="field-label">条高（{{ height }}px）</span>
        <input v-model.number="height" type="range" min="40" max="200" step="10" />
      </div>
      <label class="check opt-check">
        <input v-model="showValue" type="checkbox" />
        <span>显示文本</span>
      </label>
    </div>

    <div class="preview-area mt-2">
      <canvas ref="canvas" class="barcode-canvas"></canvas>
      <p v-if="errMsg" class="notice notice-warn">{{ errMsg }}</p>
      <p v-else-if="!ok && !text.trim()" class="muted small">输入内容后自动渲染条形码预览</p>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!ok" @click="download">
        <ImageDown :size="16" /> 下载 PNG
      </button>
    </div>
  </div>
</template>

<style scoped>
.opt-row {
  gap: 24px;
}
.opt {
  min-width: 200px;
  flex: 1;
}
.opt-check {
  align-self: flex-end;
  padding-bottom: 8px;
}
.preview-area {
  display: grid;
  place-items: center;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  min-height: 160px;
  gap: 10px;
}
.barcode-canvas {
  max-width: 100%;
  height: auto;
}
</style>
