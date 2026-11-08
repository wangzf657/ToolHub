<script setup lang="ts">
/** Word 转 Markdown：mammoth 出语义 HTML → turndown 转 MD */
import { ref } from 'vue'
import { Loader2, FileText } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { docxToHtml } from '@/lib/officeEngine'
import { htmlToMd } from '@/lib/mdEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)
const fileName = ref('')
const output = ref('')

const onFiles = async (files: File[]) => {
  if (!files.length) return
  const f = files[0]
  if (!/\.docx$/i.test(f.name)) {
    toast.err('请选择 .docx 文件（旧版 .doc 请先在 Word 中另存为 docx）')
    return
  }
  busy.value = true
  fileName.value = f.name
  try {
    const html = await docxToHtml(f)
    output.value = await htmlToMd(html)
    toast.ok('转换完成')
  } catch (e) {
    toast.err((e as Error).message || '转换失败，请确认文件未加密')
    output.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".docx" :multiple="false" label="拖入 Word 文档（.docx）" hint="保留标题层级、列表、表格与加粗斜体 · 全部本地处理" @files="onFiles" />
    <div v-if="busy" class="muted small mt-2"><Loader2 :size="14" class="spin" /> 正在解析 {{ fileName }}…</div>
    <ResultBox v-if="output" v-model="output" title="Markdown 输出" download="md" min-height="300px" />
    <p class="notice notice-info mt-2 small">转换管线：mammoth 提取语义 HTML → turndown 转 Markdown（GFM 表格规则）。图片默认以原链接保留，可手动下载后替换。</p>
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
