<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    /** 执行处理并返回 Blob 的函数 */
    produce: () => Promise<Blob>
    defaultName: string
    buttonText?: string
    disabled?: boolean
  }>(),
  { buttonText: '处理并下载' },
)

const toast = useToast()
const running = ref(false)

const run = async () => {
  running.value = true
  try {
    const blob = await props.produce()
    saveBlob(blob, props.defaultName)
  } catch (e) {
    toast.err((e as Error).message || '处理失败')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="row row-wrap mt-2">
    <slot name="before" />
    <button class="btn btn-primary" :disabled="running || disabled" @click="run">
      <Loader2 v-if="running" :size="16" class="spin" />
      <Download v-else :size="16" />
      {{ buttonText }}
    </button>
    <slot />
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
