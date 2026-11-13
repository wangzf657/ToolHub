<script setup lang="ts">
/**
 * 音频处理导出块（本目录共用）：执行按钮 + MP3 编码进度条 + 结果卡（试听播放器/体积徽章/下载）。
 * 替代 DownloadButton：完成后不自动落盘，先试听、点下载才保存（试听闭环处方家族）。
 */
import { onBeforeUnmount, ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { sizeLabel } from './shared'

const props = withDefaults(
  defineProps<{
    /** 执行处理并返回 Blob；可选 onProgress 回调透传给 encodeMp3 */
    produce: (onProgress?: (p: number) => void) => Promise<Blob>
    defaultName: string
    buttonText?: string
    disabled?: boolean
  }>(),
  { buttonText: '处理并生成' },
)

const toast = useToast()
const running = ref(false)
const progress = ref(0)
const resultUrl = ref('')
const resultBlob = ref<Blob | null>(null)
const lastName = ref(props.defaultName)

onBeforeUnmount(() => {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})

const run = async () => {
  if (running.value) return
  running.value = true
  progress.value = 0
  try {
    const blob = await props.produce((p) => (progress.value = p))
    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    resultBlob.value = blob
    resultUrl.value = URL.createObjectURL(blob)
    lastName.value = props.defaultName
    toast.ok('处理完成，请试听后在结果卡下载')
  } catch (e) {
    toast.err((e as Error).message || '处理失败，请调整参数后重试')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="running || disabled" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        {{ buttonText }}
      </button>
      <slot />
    </div>

    <div v-if="running || progress > 0" class="prog mt-2">
      <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, Math.round(progress * 100))}%` }"></div></div>
      <span class="muted small">处理中 {{ Math.round(progress * 100) }}%</span>
    </div>

    <div v-if="resultUrl" class="result-card mt-2">
      <p class="rc-title">处理结果</p>
      <audio :src="resultUrl" controls class="rc-audio"></audio>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">输出 {{ sizeLabel(resultBlob?.size ?? 0) }}</span>
        <a class="btn btn-primary btn-sm" :href="resultUrl" :download="lastName"><Download :size="14" /> 下载</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prog { display: grid; gap: 5px; max-width: 560px; }
.prog-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c74f2); border-radius: 999px; transition: width 0.2s ease; }
.result-card { max-width: 620px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.rc-title { margin: 0 0 8px; font-weight: 600; font-size: 14px; }
.rc-audio { width: 100%; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
