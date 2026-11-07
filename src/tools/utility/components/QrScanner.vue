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

const onFiles = async (files: File[]) => {
  const file = files[0]
  if (!file) return
  loading.value = true
  result.value = ''
  try {
    result.value = await scanQr(file)
    fileName.value = file.name
  } catch (e) {
    toast.err((e as Error).message || '识别失败')
  } finally {
    loading.value = false
  }
}

const doCopy = async () => {
  if (!result.value) return
  const okFlag = await copyText(result.value)
  if (okFlag) {
    copied.value = true
    toast.ok('已复制到剪贴板')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const openLink = () => {
  if (/^https?:\/\//i.test(result.value)) window.open(result.value, '_blank', 'noopener')
}

const isLink = () => /^https?:\/\//i.test(result.value)
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
        <span class="io-title"><ImageUp :size="14" /> 来自 {{ fileName }} 的解码结果</span>
      </div>
      <pre class="code-block mt-1">{{ result }}</pre>

      <div class="row row-wrap mt-2">
        <button class="btn btn-primary btn-sm" @click="doCopy">
          <Check v-if="copied" :size="15" />
          <Copy v-else :size="15" /> 复制内容
        </button>
        <button v-if="isLink()" class="btn btn-ghost btn-sm" @click="openLink">
          <ExternalLink :size="15" /> 打开链接
        </button>
        <span v-if="isLink()" class="badge badge-plain">检测到网址链接</span>
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
</style>
