<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { fillForm, pdfFormFields, type FormFieldInfo } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 填写 PDF 表单（AcroForm）：文本 / 复选 / 下拉 / 单选 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const fields = ref<FormFieldInfo[]>([])
const values = ref<Record<string, string | boolean>>({})
const busy = ref(false)
const loading = ref(false)
const file = ref<File | null>(null)

const onFiles = async (list: File[]) => {
  const f = list[0]
  file.value = f ?? null
  fields.value = []
  values.value = {}
  if (!f) return
  loading.value = true
  try {
    fields.value = await pdfFormFields(f)
    const init: Record<string, string | boolean> = {}
    for (const fd of fields.value) {
      if (fd.type === 'text') init[fd.name] = fd.value ?? ''
      else if (fd.type === 'checkbox') init[fd.name] = fd.value === '是'
      else if (fd.type === 'dropdown' || fd.type === 'radio') init[fd.name] = fd.value ?? ''
    }
    values.value = init
    if (!fields.value.length) toast.warn('该 PDF 没有检测到可填写的表单字段')
  } catch (e) {
    toast.err((e as Error).message || '读取表单失败')
  } finally {
    loading.value = false
  }
}

const typeLabel: Record<FormFieldInfo['type'], string> = {
  text: '文本',
  checkbox: '复选框',
  radio: '单选',
  dropdown: '下拉',
  optionlist: '选项列表',
  button: '按钮',
  unknown: '其他',
}

const run = async () => {
  if (!file.value) return
  busy.value = true
  try {
    const blob = await fillForm(file.value, values.value)
    saveBlob(blob, '表单已填写.pdf')
    toast.ok('表单已填写并扁平化保存')
  } catch (e) {
    toast.err((e as Error).message || '填写失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spinner" /> 正在解析表单字段…</div>

    <div v-if="fields.length" class="mt-2">
      <div class="form-grid">
        <div v-for="fd in fields" :key="fd.name" class="field">
          <span class="field-label">{{ fd.name }}（{{ typeLabel[fd.type] }}）</span>
          <input
            v-if="fd.type === 'text'"
            v-model="values[fd.name] as string"
            class="input"
            type="text"
          />
          <label v-else-if="fd.type === 'checkbox'" class="check mt-1">
            <input v-model="values[fd.name] as boolean" type="checkbox" /> 勾选
          </label>
          <select
            v-else-if="fd.type === 'dropdown' || fd.type === 'radio'"
            v-model="values[fd.name] as string"
            class="select"
          >
            <option value="">（不选择）</option>
            <option v-for="o in fd.options ?? []" :key="o" :value="o">{{ o }}</option>
          </select>
          <span v-else class="small muted">该字段类型暂不支持填写</span>
        </div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="run">
          <Loader2 v-if="busy" :size="16" class="spinner" /> 填写并下载
        </button>
        <span class="small muted">共 {{ fields.length }} 个字段；保存时自动扁平化（内容固定，不可再改）</span>
      </div>
    </div>

    <p v-else-if="file && !loading" class="notice notice-info mt-2 small">
      未发现 AcroForm 表单字段。部分 PDF 用文字下划线模拟表单，这类「伪表单」请用「PDF 添加文字」在对应位置书写。
    </p>
  </div>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.field {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
