<script setup lang="ts">
/** 清除照片 EXIF：Canvas 重编码去除全部元数据，显示前后体积 */
import { ref, shallowRef } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const quality = ref(92)
const running = ref(false)
const before = ref(0)
const after = ref(0)

async function run() {
  if (!file.value) {
    toast.warn('请先选择照片')
    return
  }
  running.value = true
  try {
    before.value = file.value.size
    const canvas = await decodeToCanvas(file.value)
    const blob = await canvasToBlob(canvas, format.value, quality.value / 100)
    after.value = blob.size
    const ext = format.value === 'image/png' ? 'png' : 'jpg'
    saveBlob(blob, `${baseName(file.value.name)}-clean.${ext}`)
  } catch (e) {
    toast.err((e as Error).message || '处理失败')
  } finally {
    running.value = false
  }
}

const fmt = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)
</script>

<template>
  <div>
    <FileDrop
      accept="image/jpeg,image/*"
      :multiple="false"
      label="拖放 JPG 照片到此处"
      hint="重编码后 EXIF（含 GPS 位置）将被彻底清除"
      @files="(f) => ((file = f[0] ?? null), (before = file?.size ?? 0), (after = 0))"
    />

    <div class="row row-wrap mt-2" style="gap: 18px">
      <label class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="format" class="select" style="width: 150px">
          <option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option>
        </select>
      </label>
      <div v-if="format === 'image/jpeg'" style="min-width: 220px">
        <span class="field-label">JPG 质量：{{ quality }}%</span>
        <input v-model.number="quality" type="range" min="50" max="100" step="1" />
      </div>
      <button class="btn btn-primary" :disabled="running || !file" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" /><Download v-else :size="16" /> 清除并下载
      </button>
    </div>

    <div v-if="after > 0" class="row row-wrap mt-2" style="gap: 12px">
      <span class="badge badge-plain">处理前 {{ fmt(before) }}</span>
      <span class="badge badge-plain">处理后 {{ fmt(after) }}</span>
      <span class="badge">{{ after <= before ? '减少' : '增加' }} {{ fmt(Math.abs(before - after)) }}</span>
      <span class="muted small">体积变化来自重编码本身，与 EXIF 大小无关</span>
    </div>

    <p class="muted small mt-2">PNG / WebP 本身通常不含 EXIF；此工具对任何图片重编码后输出都是「干净」的。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
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
