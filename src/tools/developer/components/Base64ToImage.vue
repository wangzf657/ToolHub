<script setup lang="ts">
import { ref } from 'vue'
import { Image as ImageIcon, Download } from 'lucide-vue-next'
import { saveBlob, copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const text = ref('')
const src = ref('')
const info = ref<{ w: number; h: number; bytes: number; mime: string } | null>(null)
const error = ref('')

/** 归一化输入为 data URI，并推断 mime */
function normalize(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  s = s.replace(/^["']|["'];?$/g, '').replace(/\s+/g, '')
  const m = s.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (m) return `data:${m[1] || 'image/png'};base64,${m[3]}`
  // 纯 base64：猜测 mime
  if (/^[A-Za-z0-9+/\-_]+={0,2}$/.test(s)) {
    const head = atob(s.slice(0, 24).padEnd(24, 'A')).slice(0, 4)
    let mime = 'image/png'
    if (head.startsWith('ÿØ')) mime = 'image/jpeg'
    else if (head.startsWith('GIF8')) mime = 'image/gif'
    else if (head.startsWith('RIFF')) mime = 'image/webp'
    return `data:${mime};base64,${s}`
  }
  return null
}

const preview = () => {
  error.value = ''
  info.value = null
  const uri = normalize(text.value)
  if (!uri) {
    error.value = '无法识别输入：请粘贴 data URI（data:image/png;base64,…）或纯 Base64 字符串。'
    return
  }
  const img = new Image()
  img.onload = () => {
    const base64Part = uri.split(',')[1] ?? ''
    info.value = {
      w: img.naturalWidth,
      h: img.naturalHeight,
      bytes: Math.floor((base64Part.length * 3) / 4),
      mime: uri.slice(5, uri.indexOf(';')),
    }
    src.value = uri
    toast.ok(`图片加载成功（${img.naturalWidth}×${img.naturalHeight}）`)
  }
  img.onerror = () => {
    error.value = 'Base64 已识别，但不是有效的图片数据，无法渲染预览。'
  }
  img.src = uri
}

const ext = () => {
  const mime = info.value?.mime ?? 'png'
  if (mime.includes('jpeg')) return 'jpg'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('svg')) return 'svg'
  return 'png'
}

const download = () => {
  if (!src.value) return
  fetch(src.value)
    .then((r) => r.blob())
    .then((b) => saveBlob(b, `image.${ext()}`))
    .catch(() => toast.err('下载失败'))
}

const sizeLabel = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`)

const copyUri = async () => {
  if (!src.value) return
  const okFlag = await copyText(src.value)
  okFlag ? toast.ok('data URI 已复制') : toast.err('复制失败')
}
</script>

<template>
  <div class="b64img">
    <span class="field-label">Base64 / Data URI 输入</span>
    <textarea v-model="text" class="textarea mono" style="min-height: 130px" placeholder="data:image/png;base64,iVBORw0KGgo… 或纯 Base64 字符串"></textarea>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="preview"><ImageIcon :size="16" /> 加载预览</button>
      <button v-if="src" class="btn btn-ghost" @click="download"><Download :size="16" /> 下载 .{{ ext() }}</button>
      <button v-if="src" class="btn btn-ghost" @click="copyUri">复制 Data URI</button>
    </div>

    <div v-if="error" class="notice notice-err mt-2">{{ error }}</div>

    <div v-if="src" class="grid-2 mt-3" style="gap: 16px; align-items: start">
      <div class="preview-card">
        <img :src="src" alt="预览" />
      </div>
      <div v-if="info" class="meta">
        <div class="meta-row"><span>尺寸</span><b>{{ info.w }} × {{ info.h }} px</b></div>
        <div class="meta-row"><span>类型</span><b>{{ info.mime }}</b></div>
        <div class="meta-row"><span>解码后大小</span><b>{{ sizeLabel(info.bytes) }}</b></div>
        <div class="meta-row"><span>Base64 长度</span><b>{{ (text.replace(/\s+/g, '').length).toLocaleString() }} 字符</b></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    conic-gradient(rgba(128, 128, 128, 0.18) 0 25%, transparent 0 50%, rgba(128, 128, 128, 0.18) 0 75%, transparent 0) 0 0 / 16px 16px;
  padding: 12px;
  display: grid;
  place-items: center;
  min-height: 160px;
}
.preview-card img {
  max-width: 100%;
  max-height: 320px;
  border-radius: 6px;
}
.meta {
  display: grid;
  gap: 8px;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.meta-row span {
  color: var(--text-3);
}
</style>
