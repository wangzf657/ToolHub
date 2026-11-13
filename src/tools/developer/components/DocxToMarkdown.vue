<script setup lang="ts">
/** Word 转 Markdown：mammoth 出语义 HTML → turndown 转 MD */
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'
import { docxToHtml } from '@/lib/officeEngine'
import { htmlToMd } from '@/lib/mdEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)
const fileName = ref('')
const output = ref('')
/** 图片策略（rx2）：忽略（无 data URI）或 base64 内嵌 */
const imgMode = ref<'ignore' | 'base64'>('base64')
/** 内嵌图片数量（rx5） */
const imgCount = ref(0)

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
    let html = await docxToHtml(f)
    if (imgMode.value === 'ignore') {
      // 忽略模式：剥离图片标签，输出无 data URI
      html = html.replace(/<img[^>]*>/gi, '')
      imgCount.value = 0
    } else {
      imgCount.value = (html.match(/data:image\//g) ?? []).length
    }
    output.value = await htmlToMd(html)
    if (imgMode.value === 'base64' && imgCount.value > 0) toast.ok(`转换完成，已内嵌 ${imgCount.value} 张图片（base64）`)
    else toast.ok('转换完成')
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

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: center">
      <span class="field-label" style="margin: 0">图片策略</span>
      <label class="check"><input v-model="imgMode" type="radio" value="base64" /> 内嵌 base64（文件体积大、可独立分发）</label>
      <label class="check"><input v-model="imgMode" type="radio" value="ignore" /> 忽略图片（输出干净，体积缩小 90%+）</label>
      <span v-if="imgMode === 'base64' && imgCount" class="muted small">上次内嵌 {{ imgCount }} 张图片</span>
    </div>

    <div v-if="busy" class="muted small mt-2"><Loader2 :size="14" class="spin" /> 正在解析 {{ fileName }}…</div>
    <ResultBox v-if="output" v-model="output" title="Markdown 输出" download="md" min-height="480px" />
    <p class="notice notice-info mt-2 small">
      转换管线：mammoth 提取语义 HTML → turndown 转 Markdown（GFM 表格规则）。Word 内嵌图片将转为 base64 内嵌文本（可用上方「忽略图片」两态切换，忽略模式下输出无 data URI）。删除线等少数 Word 特性不在 mammoth 默认映射内，可能丢失。
    </p>
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
