<script setup lang="ts">
import { ref } from 'vue'
import { Wand2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { scanQr, makeQrCanvas } from '@/lib/qrEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const decoded = ref('')
const manual = ref('')
const ecc = ref<'L' | 'M' | 'Q' | 'H'>('H')
const qrBox = ref<HTMLDivElement | null>(null)
const busy = ref(false)

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!f.type.startsWith('image/')) return toast.warn('请拖入二维码图片')
  busy.value = true
  try {
    const text = await scanQr(f)
    if (!text) {
      toast.warn('未能识别出二维码内容，可在下方手动输入内容重新生成')
      return
    }
    decoded.value = text
    manual.value = text
    await render()
    toast.ok('识别成功，已重新生成干净二维码')
  } catch (e) {
    toast.err(`识别失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const render = async () => {
  const t = manual.value.trim()
  if (!t || !qrBox.value) return
  qrBox.value.innerHTML = ''
  const cv = await makeQrCanvas(t, { size: 240, margin: 2, errorCorrection: ecc.value })
  cv.style.maxWidth = '240px'
  qrBox.value.appendChild(cv)
}

const download = () => {
  const cv = qrBox.value?.querySelector('canvas')
  if (!cv) return toast.warn('请先生成二维码')
  cv.toBlob((b) => {
    if (b) {
      saveBlob(b, '二维码-修复版.png')
      toast.ok('已下载')
    }
  }, 'image/png')
}
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept="image/*" label="拖入模糊/带 Logo 的二维码图片" hint="本地识别并重新生成高纠错干净码" @files="onFiles" />

    <div class="mt-2 two">
      <div class="opts-panel">
        <h4 class="h4">二维码内容</h4>
        <textarea v-model="manual" class="input area mono" rows="5" placeholder="识别结果会填到这里，也可手动输入链接或文本"></textarea>
        <div class="row wrap gap mt-2">
          <span class="field-label">纠错等级</span>
          <select v-model="ecc" class="input slim">
            <option value="H">H（最高 30%，推荐盖 Logo）</option>
            <option value="Q">Q（25%）</option>
            <option value="M">M（15%）</option>
            <option value="L">L（7%）</option>
          </select>
          <button class="btn btn-primary btn-sm" :disabled="!manual.trim()" @click="render"><Wand2 :size="14" /> 重新生成</button>
        </div>
      </div>
      <div class="right">
        <div ref="qrBox" class="qr-box"></div>
        <button class="btn btn-sm mt-2" :disabled="!manual.trim()" @click="download"><Download :size="14" /> 下载 PNG</button>
      </div>
    </div>
    <p class="hint mt-2">用途：二维码被 Logo 挡了一部分、截图模糊、想换纠错等级时，识别内容后重新生成一张干净的新码。</p>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.two { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: start; }
.area { width: 100%; resize: vertical; }
.h4 { margin-bottom: 8px; font-size: 14px; }
.right { display: flex; flex-direction: column; align-items: center; }
.qr-box { width: 240px; height: 240px; padding: 10px; border: 1px solid var(--border); border-radius: 12px; display: grid; place-items: center; }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
</style>
