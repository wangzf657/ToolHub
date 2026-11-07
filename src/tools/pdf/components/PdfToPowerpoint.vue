<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfToImages } from '@/lib/pdfEngine'
import { imagesToPptx } from '@/lib/officeEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转 PPT：每页一张幻灯片图片（首次需加载导出组件） */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const stage = ref('')

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    stage.value = '正在把页面渲染为高清图片…'
    const imgs = await pdfToImages(file, {
      format: 'image/png',
      scale: 2,
      onProgress: (p) => (progress.value = p * 0.7),
    })
    stage.value = '正在生成 .pptx（首次使用需下载导出组件）…'
    const blob = await imagesToPptx(imgs.map((i) => ({ blob: i.blob })), '演示文稿')
    saveBlob(blob, '幻灯片.pptx')
    toast.ok(`已生成 ${imgs.length} 页幻灯片`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 PPT 并下载
      </button>
      <span class="small muted">每页以高清图片铺满 16:9 幻灯片</span>
    </div>

    <div v-if="busy" class="mt-2">
      <p class="small muted mb-2">{{ stage }}</p>
      <div class="progress"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <p class="notice notice-warn mt-2 small">
      首次使用需下载 PPT 导出组件（约 1 MB），完成后浏览器会缓存、离线可用。幻灯片内为页面图片，文字不可直接编辑——需要可编辑文本请用「PDF 转 Word」。
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
</style>
