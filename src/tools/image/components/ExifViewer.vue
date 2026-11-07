<script setup lang="ts">
/** EXIF 信息查看：本地解析 JPEG 元数据（相机 / 参数 / 时间 / GPS） */
import { ref, shallowRef } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { readExif, type ExifData } from '@/lib/imageEngine'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const rows = ref<ExifData[]>([])
const loading = ref(false)

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    rows.value = []
    return
  }
  const f = files[0]
  file.value = f
  loading.value = true
  try {
    rows.value = await readExif(f)
  } catch (e) {
    toast.err((e as Error).message || '解析失败')
  } finally {
    loading.value = false
  }
}

const isJpeg = () => (file.value?.type || '').includes('jpeg') || /\.jpe?g$/i.test(file.value?.name || '')
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖放照片到此处"
      hint="支持 JPG（含相机 EXIF）；PNG / WebP 通常没有元数据"
      @files="onFiles"
    />

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="15" class="spin" /> 正在解析…</div>

    <template v-else-if="file">
      <div v-if="rows.length" class="table-wrap mt-2">
        <table class="data-table">
          <thead>
            <tr><th>标签</th><th>值</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i">
              <td class="muted">{{ r.tag }}</td>
              <td class="mono">{{ r.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="isJpeg()" class="notice notice-info mt-2">
        这张 JPG 里没有读到 EXIF —— 可能发布平台已清除，或不是相机直出照片。
      </div>
      <div v-else class="notice notice-info mt-2">
        当前格式（PNG / WebP 等）通常不包含 EXIF 元数据。想查看相机参数请提供 JPG 原片。
      </div>
    </template>

    <p class="muted small mt-2">解析完全在你的浏览器本地完成，照片不会上传到任何服务器。</p>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
