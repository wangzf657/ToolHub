<script setup lang="ts">
/** 艺术二维码：qr-code-styling 圆点/液体风格 + 渐变 + 中心 Logo，PNG/SVG 下载（纠错 H 级） */
import { ref, shallowRef } from 'vue'
import { Loader2, QrCode, Download, ImageUp } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const data = ref('https://toolhub.example.com')
const size = ref(320)
const dotType = ref<'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded' | 'square'>('dots')
const grad = ref(true)
const c1 = ref('#1a9c74')
const c2 = ref('#2f6fd6')
const logo = shallowRef<File | null>(null)
const logoUrl = shallowRef<string | null>(null)
const busy = ref(false)
const stage = ref<HTMLElement | null>(null)
interface QrInstance {
  update: (o: unknown) => void
  append: (el: HTMLElement) => void
  getRawData: (t: 'png' | 'svg') => Promise<Blob | null>
}
let instance: QrInstance | null = null

const options = () => ({
  width: size.value,
  height: size.value,
  type: 'canvas' as const,
  data: data.value,
  image: logoUrl.value ?? undefined,
  margin: 10,
  qrOptions: { errorCorrectionLevel: 'H' as const },
  dotsOptions: grad.value
    ? { type: dotType.value, gradient: { type: 'linear' as const, rotation: 30, colorStops: [{ offset: 0, color: c1.value }, { offset: 1, color: c2.value }] } }
    : { type: dotType.value, color: c1.value },
  backgroundOptions: { color: '#ffffff' },
  cornersSquareOptions: { color: c1.value },
  cornersDotOptions: { color: c2.value },
  imageOptions: { hideBackgroundDots: true, imageSize: 0.4 },
})

const ensure = async () => {
  if (!data.value.trim()) {
    toast.warn('请输入二维码内容')
    return false
  }
  if (!instance) {
    const QRCodeStyling = (await import('qr-code-styling')).default
    instance = new QRCodeStyling(options()) as unknown as QrInstance
    if (stage.value) {
      stage.value.innerHTML = ''
      instance.append(stage.value)
    }
  } else {
    instance.update(options())
  }
  return true
}

const onLogo = (files: File[]) => {
  const f = files[0]
  if (!f) return
  logo.value = f
  logoUrl.value = URL.createObjectURL(f)
  instance = null // 重建以注入 Logo
  ensure()
}

const download = async (t: 'png' | 'svg') => {
  if (!(await ensure())) return
  busy.value = true
  try {
    const blob = await instance!.getRawData(t)
    if (!blob) throw new Error('生成失败')
    saveBlob(blob, `艺术二维码.${t}`)
    toast.ok(`已下载 ${t.toUpperCase()}`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    busy.value = false
  }
}

const render = async () => {
  await ensure()
}
</script>

<template>
  <div>
    <div class="row row-wrap mt-2" style="gap: 14px; align-items: flex-end">
      <label class="opt wide">
        <span class="field-label">内容（链接 / 文本 / WiFi 信息）</span>
        <input v-model="data" class="input" placeholder="https://…" @change="instance && ensure()" />
      </label>
      <label class="opt">
        <span class="field-label">尺寸</span>
        <select v-model.number="size" class="select" style="width: 110px">
          <option :value="256">256px</option>
          <option :value="320">320px</option>
          <option :value="512">512px</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">点型风格</span>
        <select v-model="dotType" class="select" style="width: 130px" @change="instance = null; ensure()">
          <option value="dots">圆点</option>
          <option value="rounded">圆角</option>
          <option value="classy">优雅</option>
          <option value="classy-rounded">优雅圆角</option>
          <option value="extra-rounded">超圆润</option>
          <option value="square">经典方块</option>
        </select>
      </label>
      <label class="opt check"><input v-model="grad" type="checkbox" @change="instance = null; ensure()" /><span>渐变色</span></label>
      <label class="opt">
        <span class="field-label">主色</span>
        <input v-model="c1" type="color" class="input" style="width: 52px; padding: 2px" @change="instance = null; ensure()" />
      </label>
      <label class="opt">
        <span class="field-label">渐变辅色</span>
        <input v-model="c2" type="color" class="input" style="width: 52px; padding: 2px" @change="instance = null; ensure()" />
      </label>
    </div>

    <div class="row row-wrap mt-2" style="gap: 10px">
      <label class="btn btn-ghost btn-sm file-btn">
        <ImageUp :size="14" /> {{ logo ? '已选中心 Logo' : '上传中心 Logo（可选）' }}
        <input type="file" accept="image/*" hidden @change="(e) => onLogo(Array.from(((e.target as HTMLInputElement).files) ?? []))" />
      </label>
      <button class="btn btn-soft btn-sm" @click="render"><QrCode :size="14" /> 刷新预览</button>
      <button class="btn btn-primary btn-sm" :disabled="busy" @click="download('png')"><Loader2 v-if="busy" :size="14" class="spin" /><Download v-else :size="14" /> PNG</button>
      <button class="btn btn-ghost btn-sm" :disabled="busy" @click="download('svg')"><Download :size="14" /> SVG</button>
    </div>

    <div class="qr-stage-wrap mt-2">
      <div ref="stage" class="qr-stage"></div>
    </div>

    <p class="notice notice-info mt-2 small">纠错等级锁定 H（30% 容错），中心 Logo 不影响扫码；与「二维码生成器」互为基础款 / 风格款。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.opt.wide {
  flex: 1;
  min-width: 240px;
}
.opt.check {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.file-btn {
  position: relative;
  cursor: pointer;
  text-decoration: none !important;
}
.qr-stage-wrap {
  display: grid;
  place-items: center;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 60%, transparent);
}
.qr-stage :deep(canvas) {
  max-width: 100%;
  height: auto;
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
