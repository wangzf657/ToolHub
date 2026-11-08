<script setup lang="ts">
/** Markdown 转 Word：marked.lexer AST → docx（标题/段落/列表/表格/代码块） */
import { ref } from 'vue'
import { Loader2, FileText } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { mdToDocxBlob } from '@/lib/mdEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('# 标题\n\n一段**加粗**与*斜体*，[链接](https://example.com)。\n\n- 列表项一\n- 列表项二\n\n| 功能 | 状态 |\n| --- | --- |\n| 本地转换 | ✅ |')
const busy = ref(false)

const onFiles = async (files: File[]) => {
  if (!files.length) return
  if (!/\.(md|markdown|txt)$/i.test(files[0].name)) {
    toast.err('请选择 .md / .markdown 文件')
    return
  }
  input.value = await files[0].text()
  toast.ok('已载入 Markdown 文件')
}

const run = async () => {
  if (!input.value.trim()) return toast.warn('请输入或载入 Markdown 内容')
  busy.value = true
  try {
    const blob = await mdToDocxBlob(input.value)
    saveBlob(blob, 'markdown.docx')
    toast.ok('Word 文档已生成')
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2">
      <FileDrop accept=".md,.markdown,.txt" :multiple="false" label="拖入 .md 文件（或直接在下方粘贴）" hint="标题/列表/表格/代码块/引用 全部本地生成" @files="onFiles" />
    </div>
    <div class="mt-2">
      <span class="field-label">Markdown 输入</span>
      <textarea v-model="input" class="textarea mono" style="min-height: 280px" spellcheck="false"></textarea>
    </div>
    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <FileText v-else :size="16" /> 生成 Word 文档
      </button>
      <span class="muted small">生成 .docx（creator = ToolHub），图片以占位符标注，链接保留可点击。</span>
    </div>
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
