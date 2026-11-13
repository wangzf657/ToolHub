<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Clipboard, ImageDown, FileCode2, QrCode as QrIcon } from 'lucide-vue-next'
import { makeQrCanvas, makeQrSvg } from '@/lib/qrEngine'
import { saveBlob, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** 快捷类型：网址 / 纯文本 / 电话 */
const quickType = ref<'url' | 'text' | 'tel'>('url')
const text = ref('')
const size = ref(320)
const ec = ref<'L' | 'M' | 'Q' | 'H'>('M')
const dark = ref('#111827')
const light = ref('#ffffff')
const margin = ref(2)

const previewText = computed(() => {
  const t = text.value.trim()
  if (!t) return ''
  if (quickType.value === 'tel') return `tel:${t.replace(/\s+/g, '')}`
  if (quickType.value === 'url' && !/^https?:\/\//i.test(t)) return `https://${t}`
  return t
})

const stage = ref<HTMLDivElement | null>(null)
const ready = ref(false)

/** 内容或选项变化时即时重绘（颜色/边距实时生效） */
let seq = 0
watch([previewText, size, ec, dark, light, margin], async () => {
  const my = ++seq
  const payload = previewText.value
  if (!payload) {
    ready.value = false
    return
  }
  try {
    const canvas = await makeQrCanvas(payload, {
      size: size.value,
      errorCorrection: ec.value,
      dark: dark.value,
      light: light.value,
      margin: margin.value,
    })
    if (my !== seq || !stage.value) return
    stage.value.replaceChildren(canvas)
    canvas.style.maxWidth = '100%'
    canvas.style.height = 'auto'
    ready.value = true
  } catch (e) {
    if (my !== seq) return
    ready.value = false
    toast.err((e as Error).message || '生成二维码失败')
  }
}, { immediate: true })

const getBlob = async (): Promise<Blob | null> => {
  const canvas = stage.value?.querySelector('canvas')
  if (!canvas) return null
  return new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
}

const downloadPng = async () => {
  const blob = await getBlob()
  if (!blob) return
  saveBlob(blob, '二维码.png')
}

const downloadSvg = async () => {
  try {
    const svg = await makeQrSvg(previewText.value, {
      size: size.value,
      errorCorrection: ec.value,
      dark: dark.value,
      light: light.value,
      margin: margin.value,
    })
    saveText(svg, '二维码.svg', 'image/svg+xml')
  } catch (e) {
    toast.err((e as Error).message || '下载失败')
  }
}

const copyImage = async () => {
  const blob = await getBlob()
  if (!blob) return
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.ok('二维码已复制，可直接粘贴（如微信 Ctrl+V）')
  } catch {
    toast.err('复制失败：当前浏览器不支持图片剪贴板写入，请改用下载')
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap quick-row">
      <button class="chip" :class="{ active: quickType === 'url' }" @click="quickType = 'url'">网址</button>
      <button class="chip" :class="{ active: quickType === 'text' }" @click="quickType = 'text'">纯文本</button>
      <button class="chip" :class="{ active: quickType === 'tel' }" @click="quickType = 'tel'">电话 tel:</button>
    </div>

    <div class="mt-1">
      <span class="field-label">{{ quickType === 'url' ? '网址（可省略 https://）' : quickType === 'tel' ? '电话号码' : '二维码内容' }}</span>
      <input
        v-model="text"
        class="input mono"
        :placeholder="quickType === 'url' ? '例如 toolhub.example.com' : quickType === 'tel' ? '例如 13800138000' : '任意文字内容'"
      />
    </div>

    <div class="row row-wrap mt-2 opt-row">
      <div class="opt">
        <span class="field-label">尺寸 {{ size }}px</span>
        <input v-model.number="size" type="range" min="128" max="1024" step="32" />
      </div>
      <div class="opt">
        <span class="field-label">纠错级别</span>
        <select v-model="ec" class="select">
          <option value="L">L — 7%（最小）</option>
          <option value="M">M — 15%（推荐）</option>
          <option value="Q">Q — 25%</option>
          <option value="H">H — 30%（最强）</option>
        </select>
      </div>
      <div class="opt">
        <span class="field-label">边距 {{ margin }} 格</span>
        <input v-model.number="margin" type="range" min="0" max="10" step="1" />
      </div>
      <div class="opt colors">
        <span class="field-label">前景 / 背景色</span>
        <div class="row" style="gap: 8px">
          <input v-model="dark" type="color" class="input" style="width: 52px; padding: 2px" title="前景色（码点颜色）" />
          <input v-model="light" type="color" class="input" style="width: 52px; padding: 2px" title="背景色" />
          <button class="btn btn-ghost btn-sm" @click="dark = '#111827'; light = '#ffffff'">还原</button>
        </div>
      </div>
    </div>

    <div class="preview-area mt-2">
      <div v-if="previewText" ref="stage" class="qr-stage"></div>
      <div v-else class="qr-empty">
        <QrIcon :size="44" />
        <p>输入内容后自动生成二维码预览</p>
      </div>
      <!-- 收尾操作前置：操作行紧贴预览区底部 -->
      <div v-if="ready" class="preview-actions">
        <button class="btn btn-primary btn-sm" @click="downloadPng"><ImageDown :size="15" /> 下载 PNG</button>
        <button class="btn btn-soft btn-sm" @click="downloadSvg"><FileCode2 :size="15" /> 下载 SVG</button>
        <button class="btn btn-ghost btn-sm" @click="copyImage"><Clipboard :size="15" /> 复制图片</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-row {
  gap: 8px;
}
.opt-row {
  gap: 24px;
}
.opt {
  min-width: 220px;
  flex: 1;
}
.preview-area {
  display: grid;
  place-items: center;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  min-height: 220px;
}
.qr-stage {
  background: #fff;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
.qr-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--text-3);
  font-size: 13.5px;
}
.preview-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 14px;
}
</style>
