<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { batesNumbering } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 贝茨编号：前缀 + 位数，多文件连续编号 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const prefix = ref('ABC-')
const digits = ref(6)
const fontSize = ref(10)
const position = ref<'bottom-right' | 'bottom-center'>('bottom-right')
const busy = ref(false)

const run = async () => {
  const files = base.value?.files ?? []
  if (!files.length) {
    toast.warn('请先添加 PDF 文件（可多个，编号跨文件连续）')
    return
  }
  if (digits.value < 1 || digits.value > 10) {
    toast.warn('位数请填写 1-10 之间的整数')
    return
  }
  busy.value = true
  try {
    const out = await batesNumbering(files, { prefix: prefix.value, digits: digits.value, fontSize: fontSize.value, position: position.value })
    await saveMany(out, '贝茨编号结果.zip')
    toast.ok(`已完成 ${out.length} 个文件的贝茨编号`)
  } catch (e) {
    toast.err((e as Error).message || '编号失败（前缀仅支持西文字符）')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入一个或多个 PDF（编号跨文件连续）" />

    <div class="grid-4 mt-2">
      <div>
        <span class="field-label">前缀</span>
        <input v-model="prefix" class="input" placeholder="如 ABC-" />
      </div>
      <div>
        <span class="field-label">数字位数</span>
        <input v-model.number="digits" type="number" class="input" min="1" max="10" />
      </div>
      <div>
        <span class="field-label">字号（pt）</span>
        <input v-model.number="fontSize" type="number" class="input" min="6" max="24" />
      </div>
      <div>
        <span class="field-label">位置</span>
        <select v-model="position" class="select">
          <option value="bottom-right">右下角</option>
          <option value="bottom-center">底部居中</option>
        </select>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <PackageOpen v-else :size="16" /> 开始编号并下载
      </button>
      <span class="small muted">效果预览：{{ prefix }}{{ '0'.repeat(Math.max(0, digits - 1)) }}1</span>
    </div>

    <p class="notice notice-info mt-2 small">
      编号从 <b>1</b> 开始、跨文件连续递增（如 ABC-000001 → ABC-000002 …），暂不支持自定义起始号；前缀仅支持西文字符。
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
