<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Wand2, Download, Copy, ArrowRight } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { scanQr, makeQrCanvas } from '@/lib/qrEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const decoded = ref('')
const manual = ref('')
const ecc = ref<'L' | 'M' | 'Q' | 'H'>('H')
const outSize = ref(512)
const qrBox = ref<HTMLDivElement | null>(null)
const busy = ref(false)
const origUrl = ref('')
const repaired = ref(false)

onBeforeUnmount(() => {
  if (origUrl.value) URL.revokeObjectURL(origUrl.value)
})

/* ---------- 解码重试链：原图 → 1.5x/2x 放大 → 二值化三档，累计 ≤5 次 ---------- */
const binarize = (src: HTMLCanvasElement, threshold: number): HTMLCanvasElement => {
  const cv = document.createElement('canvas')
  cv.width = src.width
  cv.height = src.height
  const ctx = cv.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, cv.width, cv.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = gray >= threshold ? 255 : 0
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return cv
}

const canvasToBlob = (cv: HTMLCanvasElement): Promise<Blob | null> => new Promise((r) => cv.toBlob(r, 'image/png'))

const scanWithRetry = async (file: File): Promise<string> => {
  // 第一遍：直接识别原图
  try {
    const t = await scanQr(file)
    if (t) return t
  } catch {
    /* 进入重试链 */
  }
  const bitmap = await createImageBitmap(file)
  const base = document.createElement('canvas')
  base.width = bitmap.width
  base.height = bitmap.height
  base.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  const scales = [1.5, 2]
  const thresholds = [128, 96, 160]
  let attempts = 1
  for (const scale of scales) {
    const cv = document.createElement('canvas')
    cv.width = Math.round(base.width * scale)
    cv.height = Math.round(base.height * scale)
    cv.getContext('2d')!.imageSmoothingEnabled = false
    cv.getContext('2d')!.drawImage(base, 0, 0, cv.width, cv.height)
    const variants: HTMLCanvasElement[] = [cv]
    for (const th of thresholds) {
      if (attempts >= 5) break
      variants.push(binarize(cv, th))
      attempts++
    }
    for (const v of variants) {
      if (attempts > 5) break
      const blob = await canvasToBlob(v)
      if (!blob) continue
      try {
        const t = await scanQr(blob)
        if (t) return t
      } catch {
        /* 继续下一个变体 */
      }
      attempts++
    }
  }
  throw new Error('enhance-failed')
}

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!f.type.startsWith('image/')) return toast.warn('请拖入二维码图片')
  busy.value = true
  if (origUrl.value) URL.revokeObjectURL(origUrl.value)
  origUrl.value = URL.createObjectURL(f)
  try {
    const text = await scanWithRetry(f)
    decoded.value = text
    manual.value = text
    await render()
    repaired.value = true
    toast.ok('识别成功，已重新生成干净二维码')
  } catch {
    // 与 FileDrop 边界说明一致的引导：完全无法识别时手动输入内容
    toast.warn('未能识别出该图中的二维码（可能损坏过重）。可在下方手动输入内容重新生成干净码')
    decoded.value = ''
    repaired.value = false
  } finally {
    busy.value = false
  }
}

const render = async () => {
  const t = manual.value.trim()
  if (!t || !qrBox.value) return
  qrBox.value.innerHTML = ''
  const cv = await makeQrCanvas(t, { size: outSize.value, margin: 2, errorCorrection: ecc.value })
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

const copyImage = () => {
  const cv = qrBox.value?.querySelector('canvas')
  if (!cv) return
  cv.toBlob(async (b) => {
    if (!b) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])
      toast.ok('已复制，可直接粘贴到聊天框')
    } catch {
      toast.err('复制失败：当前浏览器不支持图片剪贴板写入，请改用下载')
    }
  }, 'image/png')
}
</script>

<template>
  <div>
    <FileDrop
      :multiple="false" accept="image/*" label="拖入模糊/带 Logo 的二维码图片"
      hint="仅能修复仍可被识别的码（换纠错等级/去 Logo 重出干净码）；完全无法识别时请手动输入内容"
      @files="onFiles"
    />

    <div v-if="origUrl && decoded" class="compare mt-2">
      <img :src="origUrl" alt="原图" class="orig-thumb" />
      <span class="cmp-arrow"><ArrowRight :size="16" /></span>
      <span class="cmp-text">原码 → 新码（纠错等级 {{ ecc }}）</span>
    </div>

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
          <span class="field-label">输出尺寸</span>
          <select v-model.number="outSize" class="input slim">
            <option :value="240">240 px</option>
            <option :value="512">512 px</option>
            <option :value="1024">1024 px</option>
          </select>
          <button class="btn btn-primary btn-sm" :disabled="!manual.trim()" @click="render"><Wand2 :size="14" /> 重新生成</button>
        </div>
      </div>
      <div class="right">
        <div ref="qrBox" class="qr-box"></div>
        <div class="row wrap gap mt-2" style="justify-content: center">
          <button class="btn btn-sm" :disabled="!manual.trim()" @click="download"><Download :size="14" /> 下载 PNG</button>
          <button class="btn btn-sm" :disabled="!manual.trim()" @click="copyImage"><Copy :size="14" /> 复制图片</button>
          <RouterLink
            v-if="manual.trim()" class="btn btn-sm"
            :to="{ path: '/t/qr-code-styled', query: { text: manual.trim() } }"
          >转艺术码 →</RouterLink>
        </div>
      </div>
    </div>
    <p class="hint mt-2">用途：二维码被 Logo 挡了一部分、截图模糊、想换纠错等级时，识别内容后重新生成一张干净的新码。识别失败会自动尝试放大与二值化重试（≤5 次）。</p>
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
.compare { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.orig-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
.cmp-arrow { color: var(--text-3); }
.cmp-text { font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
</style>
