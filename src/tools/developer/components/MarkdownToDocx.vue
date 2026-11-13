<script setup lang="ts">
/** Markdown 转 Word：marked.lexer AST → docx（标题/段落/列表/表格/代码块） */
import { ref } from 'vue'
import { Loader2, FileText, Eye } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { mdToDocxBlob } from '@/lib/mdEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('# 标题\n\n一段**加粗**与*斜体*，[链接](https://example.com)。\n\n- 列表项一\n- 列表项二\n\n| 功能 | 状态 |\n| --- | --- |\n| 本地转换 | ✅ |')
const busy = ref(false)
/** 产物预览（rx1）：生成后 mammoth 回读展示 */
const previewHtml = ref('')
const previewBusy = ref(false)

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
    // 生成后自动回读预览（rx1）
    void readBack(blob)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}

/** mammoth 回读：无需打开 Word 即可确认标题/表格/代码块样式 */
const readBack = async (blob: Blob) => {
  previewBusy.value = true
  try {
    const mammoth = await import('mammoth')
    const r = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })
    previewHtml.value = r.value
  } catch {
    previewHtml.value = ''
  } finally {
    previewBusy.value = false
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2">
      <FileDrop accept=".md,.markdown,.txt" :multiple="false" label="拖入 .md 文件（或直接在下方粘贴）" hint="标题/列表/表格/代码块/引用 全部本地生成" @files="onFiles" />
    </div>
    <!-- 执行按钮首屏可达（rx4）：随选项置顶 -->
    <div class="row row-wrap mt-2" style="gap: 10px; align-items: center">
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <FileText v-else :size="16" /> 生成 Word 文档
      </button>
      <span class="muted small">生成 .docx（creator = ToolHub），图片以占位符标注，链接保留可点击。</span>
    </div>
    <div class="mt-2">
      <span class="field-label">Markdown 输入</span>
      <textarea v-model="input" class="textarea mono" style="min-height: 280px" spellcheck="false"></textarea>
    </div>

    <!-- 产物预览（rx1） -->
    <div v-if="previewBusy" class="muted small mt-2"><Loader2 :size="13" class="spin" style="vertical-align: -2px" /> 回读预览生成中…</div>
    <div v-else-if="previewHtml" class="mt-3">
      <div class="row row-wrap" style="gap: 8px; align-items: center">
        <span class="field-label"><Eye :size="14" style="vertical-align: -2px" /> 产物预览（Word 回读，无需打开 Word）</span>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html — mammoth 回读的受控 HTML，仅本地生成内容 -->
      <div class="docx-preview prose mt-1" v-html="previewHtml"></div>
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
.docx-preview {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 20px;
  background: #fff;
  color: #24292f;
  font-size: 14px;
  line-height: 1.75;
  max-height: 420px;
  overflow: auto;
}
.docx-preview :deep(h1) { font-size: 1.7em; }
.docx-preview :deep(h2) { font-size: 1.4em; }
.docx-preview :deep(table) { border-collapse: collapse; }
.docx-preview :deep(th),
.docx-preview :deep(td) { border: 1px solid #d0d7de; padding: 6px 12px; }
.docx-preview :deep(pre) { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow: auto; }
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
