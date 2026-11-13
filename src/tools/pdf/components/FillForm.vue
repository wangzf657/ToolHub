<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { fillForm, pdfFormFields, renderPageToBlob, type FormFieldInfo } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 填写 PDF 表单（AcroForm）：文本 / 复选 / 下拉 / 单选；填写后先预览再下载 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const fields = ref<FormFieldInfo[]>([])
const values = ref<Record<string, string | boolean>>({})
const busy = ref(false)
const loading = ref(false)
const file = ref<File | null>(null)
const result = ref<{ blob: Blob; url: string; flattened: boolean } | null>(null)

const onFiles = async (list: File[]) => {
  const f = list[0]
  file.value = f ?? null
  fields.value = []
  values.value = {}
  clearResult()
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

const hasCJK = () => Object.values(values.value).some((v) => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(String(v)))

const run = async () => {
  if (!file.value) return
  busy.value = true
  try {
    const blob = await fillForm(file.value, values.value)
    // 扁平化自证：回读输出，若仍有字段则说明该表单无法扁平化
    let flattened = true
    try {
      const rest = await pdfFormFields(blob)
      flattened = rest.length === 0
    } catch {
      /* 回读失败按已扁平化处理 */
    }
    // 结果预览：渲染输出首页为图片（PDF 原样无法直接显示在 img 中）
    let url = ''
    try {
      const jpg = await renderPageToBlob(blob, 0, { format: 'image/jpeg', quality: 0.85, scale: 1.5 })
      url = URL.createObjectURL(jpg)
    } catch {
      /* 预览失败不阻塞下载 */
    }
    result.value = { blob, url, flattened }
    if (!flattened) {
      toast.warn('该表单无法扁平化，已保留字段（阅读器需支持表单交互）')
    } else if (hasCJK()) {
      toast.ok('已生成副本；含中文字段请打开确认显示正常，若空白请改用「PDF 添加文字」书写')
    } else {
      toast.ok('表单已填写并扁平化保存')
    }
  } catch (e) {
    toast.err((e as Error).message || '填写失败')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (result.value) saveBlob(result.value.blob, '表单已填写.pdf')
}

const clearResult = () => {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="onFiles" />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spinner" /> 正在解析表单字段…</div>

    <div v-if="fields.length" class="mt-2">
      <div class="form-grid">
        <div v-for="fd in fields" :key="fd.name" class="field">
          <span class="field-label">
            {{ fd.name }}（{{ typeLabel[fd.type] }}）
            <span v-if="fd.page" class="small muted" title="字段所在页码（来自表单注解）">· 第 {{ fd.page }} 页</span>
          </span>
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
          <Loader2 v-if="busy" :size="16" class="spinner" /> 填写并生成副本
        </button>
        <button v-if="result" class="btn btn-soft" @click="download"><Download :size="15" /> 下载已填写副本</button>
        <span class="small muted">共 {{ fields.length }} 个字段；保存时自动扁平化（内容固定，不可再改）</span>
      </div>

      <!-- 结果预览：下载前先看到填写效果 -->
      <div v-if="result" class="mt-2 preview-card">
        <div class="row row-wrap">
          <span v-if="!result.flattened" class="notice notice-warn small grow">
            该表单无法扁平化，已保留字段（阅读器需支持表单交互）。
          </span>
          <span v-else class="small muted">已扁平化（输出中字段数：0 ✓）</span>
        </div>
        <img v-if="result.url" :src="result.url" alt="填写结果首页预览" class="preview-img" />
        <p v-if="result.url" class="small muted">上方为输出副本首页预览（请以打开实际文件为准）</p>
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
.preview-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 8px;
  justify-items: start;
}
.preview-img {
  max-width: 420px;
  max-height: min(60vh, 560px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
.grow {
  flex: 1;
}
</style>
