<script setup lang="ts">
import { ref } from 'vue'
import { Eraser, Loader2, Save } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { getMetadata, setMetadata, type PdfMetadata } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 元数据编辑：回填 → 修改 → 保存；一键清空 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const loading = ref(false)
const form = ref<Required<Pick<PdfMetadata, 'title' | 'author' | 'subject' | 'keywords' | 'creator'>>>({
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
})

const onFiles = async (list: File[]) => {
  const f = list[0]
  if (!f) return
  loading.value = true
  try {
    const meta = await getMetadata(f)
    form.value = {
      title: meta.title ?? '',
      author: meta.author ?? '',
      subject: meta.subject ?? '',
      keywords: meta.keywords ?? '',
      creator: meta.creator ?? '',
    }
  } catch (e) {
    toast.err((e as Error).message || '读取元数据失败')
  } finally {
    loading.value = false
  }
}

const clearAll = () => {
  form.value = { title: '', author: '', subject: '', keywords: '', creator: '' }
  toast.ok('已清空全部字段，保存后生效')
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  try {
    const blob = await setMetadata(file, form.value)
    saveBlob(blob, file.name.replace(/\.pdf$/i, '') + '-元数据.pdf')
    toast.ok('元数据已保存')
  } catch (e) {
    toast.err((e as Error).message || '保存失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spinner" /> 正在读取元数据…</div>

    <div class="grid-2 mt-2">
      <div>
        <span class="field-label">标题</span>
        <input v-model="form.title" class="input" placeholder="文档标题" />
      </div>
      <div>
        <span class="field-label">作者</span>
        <input v-model="form.author" class="input" placeholder="作者名" />
      </div>
      <div>
        <span class="field-label">主题</span>
        <input v-model="form.subject" class="input" placeholder="主题 / 摘要" />
      </div>
      <div>
        <span class="field-label">关键词（逗号分隔）</span>
        <input v-model="form.keywords" class="input" placeholder="关键词1, 关键词2" />
      </div>
      <div>
        <span class="field-label">创建程序</span>
        <input v-model="form.creator" class="input" placeholder="生成该 PDF 的应用" />
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <Save v-else :size="16" /> 保存并下载
      </button>
      <button class="btn btn-ghost" :disabled="!base?.files.length" @click="clearAll">
        <Eraser :size="15" /> 一键清空全部字段
      </button>
    </div>

    <p class="notice notice-info mt-2 small">
      打开文件后自动回填当前属性；「一键清空」适合对外发布前抹去作者与软件信息。
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
