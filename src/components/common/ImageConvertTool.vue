<script setup lang="ts">
import { ref } from 'vue'
import FileDrop from './FileDrop.vue'
import { convertImage, extFor, type TargetMime } from '@/lib/imageConvert'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { Download, Loader2 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    target: TargetMime
    targetLabel: string
    withQuality?: boolean
    withResize?: boolean
  }>(),
  { withQuality: true, withResize: false },
)

const toast = useToast()
const picked = ref<File[]>([])
const qualityVal = ref(0.9)
const widthVal = ref<number | ''>('')
const heightVal = ref<number | ''>('')
const running = ref(false)
const progressPct = ref(0)
const doneCount = ref(0)

const onFiles = (list: File[]) => {
  picked.value = list
}

const run = async () => {
  if (!picked.value.length) {
    toast.warn('请先选择要转换的图片')
    return
  }
  running.value = true
  progressPct.value = 0
  doneCount.value = 0
  const outs: { name: string; blob: Blob }[] = []
  try {
    for (let i = 0; i < picked.value.length; i++) {
      const f = picked.value[i]
      const blob = await convertImage(f, {
        target: props.target,
        quality: qualityVal.value,
        width: widthVal.value === '' ? undefined : Number(widthVal.value),
        height: heightVal.value === '' ? undefined : Number(heightVal.value),
      })
      const base = f.name.replace(/\.[^.]+$/, '')
      outs.push({ name: `${base}.${extFor(props.target)}`, blob })
      doneCount.value = i + 1
      progressPct.value = ((i + 1) / picked.value.length) * 100
    }
    await saveMany(outs, `已转换-${outs.length}张.zip`)
    toast.ok(`成功转换 ${outs.length} 张图片`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="convert-tool">
    <FileDrop
      accept="image/*"
      :multiple="true"
      label="拖放图片到此处，或点击选择（支持批量）"
      hint="支持 PNG / JPG / WebP / GIF / AVIF / BMP / SVG / HEIC / TIFF"
      @files="onFiles"
    />

    <div class="opts row row-wrap mt-2">
      <label v-if="props.withQuality" class="opt">
        <span class="field-label">质量（{{ Math.round(qualityVal * 100) }}%）</span>
        <input v-model.number="qualityVal" type="range" min="0.3" max="1" step="0.05" />
      </label>
      <label v-if="props.withResize" class="opt">
        <span class="field-label">宽度（px，可选）</span>
        <input v-model="widthVal" type="number" class="input" style="width: 120px" placeholder="自动" />
      </label>
      <label v-if="props.withResize" class="opt">
        <span class="field-label">高度（px，可选）</span>
        <input v-model="heightVal" type="number" class="input" style="width: 120px" placeholder="自动" />
      </label>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="running || !picked.length" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Download v-else :size="16" />
        转换为{{ props.targetLabel }}{{ picked.length > 1 ? `（${picked.length} 张）` : '' }}
      </button>
      <span v-if="running" class="muted small">正在处理 {{ doneCount }}/{{ picked.length }}…</span>
    </div>

    <div v-if="running" class="progress mt-2">
      <div class="progress-bar" :style="{ width: progressPct + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.opts {
  gap: 18px;
  align-items: flex-end;
}
.opt {
  display: grid;
  gap: 4px;
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.2s ease;
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
