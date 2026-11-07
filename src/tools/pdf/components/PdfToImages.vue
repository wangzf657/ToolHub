<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfToImages } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转图片（pdf-to-jpg / pdf-to-png 复用本组件，默认格式跟随路由 slug） */
const toast = useToast()
const route = useRoute()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)

const format = ref<'image/jpeg' | 'image/png'>(
  String(route.params.slug || '').includes('png') ? 'image/png' : 'image/jpeg',
)
const quality = ref(0.9)
const scale = ref(2)
const busy = ref(false)
const progress = ref(0)

const isJpg = computed(() => format.value === 'image/jpeg')

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const out = await pdfToImages(file, {
      format: format.value,
      quality: quality.value,
      scale: scale.value,
      onProgress: (p) => (progress.value = p),
    })
    const ext = isJpg.value ? 'jpg' : 'png'
    await saveMany(out, `PDF转图片-${ext}.zip`)
    toast.ok(`已导出 ${out.length} 张图片`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">图片格式</span>
        <select v-model="format" class="select">
          <option value="image/jpeg">JPG（体积小）</option>
          <option value="image/png">PNG（无损）</option>
        </select>
      </div>
      <div v-if="isJpg">
        <span class="field-label">JPG 质量：{{ Math.round(quality * 100) }}%</span>
        <input v-model.number="quality" type="range" class="range" min="0.4" max="1" step="0.05" />
      </div>
      <div>
        <span class="field-label">清晰度倍数：{{ scale }}x</span>
        <input v-model.number="scale" type="range" class="range" min="1" max="4" step="0.5" />
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <PackageOpen v-else :size="16" /> 导出并打包下载
      </button>
      <span class="small muted">倍数越高越清晰、文件越大；多页自动打包为 ZIP</span>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
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
