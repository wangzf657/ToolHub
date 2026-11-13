<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check, ExternalLink, ScanLine, ImageUp } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { scanQr } from '@/lib/qrEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const loading = ref(false)
const result = ref('')
const fileName = ref('')
const copied = ref(false)

/** 会话历史：最近 10 条解码记录（含原图缩略），可点击复制 */
interface HistItem {
  text: string
  file: string
  thumb: string
}
const history = ref<HistItem[]>([])

const thumbOf = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const w = 80
      const h = Math.max(1, Math.round((img.height / img.width) * w))
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(cv.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve('')
    }
    img.src = url
  })

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  loading.value = true
  result.value = ''
  try {
    const text = await scanQr(file)
    result.value = text
    fileName.value = file.name
    const thumb = await thumbOf(file)
    history.value = [{ text, file: file.name, thumb }, ...history.value.filter((h) => h.text !== text)].slice(0, 10)
  } catch (e) {
    toast.err((e as Error).message || '识别失败')
  } finally {
    loading.value = false
  }
}

const doCopy = async (t?: string) => {
  const body = t ?? result.value
  if (!body) return
  const okFlag = await copyText(body)
  if (okFlag) {
    copied.value = true
    toast.ok('已复制到剪贴板')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const openLink = (t?: string) => {
  const body = t ?? result.value
  if (/^https?:\/\//i.test(body)) window.open(body, '_blank', 'noopener')
}

const isLink = (t?: string) => /^https?:\/\//i.test(t ?? result.value)
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖入或点击选择二维码图片"
      hint="支持截图、照片；仅在本地解码，不会上传"
      @files="onFiles"
    />

    <div v-if="loading" class="notice notice-info mt-2">
      <ScanLine :size="16" /> 正在本地解码图片…
    </div>

    <div v-else-if="result" class="mt-2">
      <div class="io-head">
        <img v-if="history[0]?.thumb" :src="history[0].thumb" class="scan-thumb" alt="原图缩略" />
        <span class="io-title"><ImageUp :size="14" /> 来自 {{ fileName }} 的解码结果</span>
      </div>
      <pre class="code-block mt-1">{{ result }}</pre>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary btn-sm" @click="doCopy()">
          <Check v-if="copied" :size="15" />
          <Copy v-else :size="15" /> 复制内容
        </button>
        <button v-if="isLink()" class="btn btn-ghost btn-sm" @click="openLink()">
          <ExternalLink :size="15" /> 打开链接
        </button>
        <span v-if="isLink()" class="badge badge-plain">检测到网址链接</span>
      </div>
    </div>

    <div v-if="history.length > 1" class="mt-2">
      <span class="io-title">本次会话解码历史（最近 {{ history.length }} 条）</span>
      <div class="hist mt-1">
        <div v-for="(h, i) in history" :key="i" class="hist-row" :class="{ cur: h.text === result }">
          <img v-if="h.thumb" :src="h.thumb" class="scan-thumb" alt="" />
          <span class="hist-text mono" :title="h.text">{{ h.text }}</span>
          <span class="muted small">{{ h.file }}</span>
          <button class="btn btn-ghost btn-sm" @click="result = h.text; doCopy(h.text)"><Copy :size="13" /> 复制</button>
          <button v-if="isLink(h.text)" class="btn btn-ghost btn-sm" @click="openLink(h.text)"><ExternalLink :size="13" /> 打开</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.io-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.io-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.code-block {
  white-space: pre-wrap;
  word-break: break-all;
}
.scan-thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
  flex: none;
}
.hist {
  display: grid;
  gap: 6px;
  max-height: 300px;
  overflow: auto;
}
.hist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
}
.hist-row.cur {
  border-color: var(--accent);
}
.hist-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
</style>
