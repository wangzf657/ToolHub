<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { pdfInfo } from '@/lib/pdfEngine'
import { useToast } from '@/composables/useToast'

/**
 * PDF 工具通用基座：文件载入 + 页数查询 + 错误提示 + 加载态。
 * 通过默认插槽把 files / pageCount 暴露给具体工具。
 */
const props = withDefaults(
  defineProps<{
    /** 是否允许多文件 */
    multiple?: boolean
    label?: string
    hint?: string
  }>(),
  { multiple: false, label: '拖入 PDF 文件，或点击选择', hint: '在你的设备上处理 —— 从不上传' },
)

const emit = defineEmits<{ files: [files: File[]] }>()

const dropRef = ref<InstanceType<typeof FileDrop> | null>(null)
const files = ref<File[]>([])
const loading = ref(false)
const pageCount = ref(0)
const toast = useToast()

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

const onFiles = async (list: File[]) => {
  files.value = list
  emit('files', list)
  pageCount.value = 0
  if (list.length === 1) {
    loading.value = true
    try {
      pageCount.value = (await pdfInfo(list[0])).pages
    } catch (e) {
      toast.err((e as Error).message || '无法读取该 PDF，请确认文件有效且未损坏')
    } finally {
      loading.value = false
    }
  }
}

/** 清空（同时清掉内部 FileDrop 的列表） */
const clear = () => {
  files.value = []
  pageCount.value = 0
  dropRef.value?.clear()
  emit('files', [])
}

/** 读取文件的 Uint8Array（供引擎使用） */
const readBytes = async (f: File | Blob) => new Uint8Array(await f.arrayBuffer())

defineExpose({ files, clear, readBytes, pageCount, loading })
</script>

<template>
  <div>
    <FileDrop
      ref="dropRef"
      accept="application/pdf,.pdf"
      :multiple="props.multiple"
      :label="props.label"
      :hint="props.hint"
      @files="onFiles"
    />
    <div v-if="loading" class="row mt-1 small muted">
      <Loader2 :size="14" class="spin" /> 正在读取文档信息…
    </div>
    <p v-else-if="files.length === 1 && pageCount" class="mt-1 small muted">
      已载入 <b>{{ pageCount }}</b> 页 · {{ fmtSize(files[0].size) }}
    </p>
    <slot :files="files" :page-count="pageCount" />
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
