<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { insertBlankPages } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 插入空白页：开头 / 结尾 / 指定页之后 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const position = ref<'start' | 'end' | 'after'>('end')
const after = ref(1)
const count = ref(1)
const busy = ref(false)

const run = async () => {
  const file = base.value?.files[0]
  const total = base.value?.pageCount ?? 0
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!count.value || count.value < 1 || count.value > 100) {
    toast.warn('插入张数请填写 1-100')
    return
  }
  if (position.value === 'after' && (after.value < 1 || after.value > total)) {
    toast.warn(`「第 n 页之后」请填写 1-${total} 之间的页码`)
    return
  }
  busy.value = true
  try {
    const blob = await insertBlankPages(file, {
      // 引擎类型只声明 start/end，实现中以 else 分支支持「第 n 页之后」
      position: (position.value === 'after' ? 'after' : position.value) as 'start' | 'end',
      after: position.value === 'after' ? after.value : undefined,
      count: count.value,
    })
    saveBlob(blob, '插入空白页.pdf')
    toast.ok(`已插入 ${count.value} 张空白页`)
  } catch (e) {
    toast.err((e as Error).message || '插入失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">插入位置</span>
        <select v-model="position" class="select">
          <option value="start">文档开头</option>
          <option value="end">文档结尾</option>
          <option value="after">第 n 页之后</option>
        </select>
      </div>
      <div v-if="position === 'after'">
        <span class="field-label">在哪一页之后</span>
        <input v-model.number="after" type="number" class="input" min="1" />
      </div>
      <div>
        <span class="field-label">插入张数</span>
        <input v-model.number="count" type="number" class="input" min="1" max="100" />
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 插入并下载
      </button>
      <span class="small muted">空白页尺寸自动匹配原文档第一页</span>
    </div>
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
