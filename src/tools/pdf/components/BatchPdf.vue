<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfToPdfa, protectPdf, setMetadata, stampText } from '@/lib/pdfEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { hexToRgb01 } from './cjkText'

/** PDF 批量处理：加密 / 清元数据 / 水印 / PDF/A，逐个处理后打包 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const action = ref<'encrypt' | 'clean' | 'watermark' | 'pdfa'>('clean')
const password = ref('')
const wmText = ref('机密')
const wmColor = ref('#9aa2b1')
const wmOpacity = ref(0.25)
const busy = ref(false)
const progress = ref(0)

const run = async () => {
  const files = base.value?.files ?? []
  if (!files.length) {
    toast.warn('请先添加要处理的 PDF 文件')
    return
  }
  if (action.value === 'encrypt' && password.value.length < 4) {
    toast.warn('请设置至少 4 位的密码')
    return
  }
  if (action.value === 'watermark' && !wmText.value.trim()) {
    toast.warn('请输入水印文字（仅支持西文字符）')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const out: { name: string; blob: Blob }[] = []
    const rgb = hexToRgb01(wmColor.value)
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const name = f.name.replace(/\.pdf$/i, '')
      let blob: Blob
      if (action.value === 'encrypt') blob = await protectPdf(f, password.value)
      else if (action.value === 'clean')
        blob = await setMetadata(f, { title: '', author: '', subject: '', keywords: '', creator: '' })
      else if (action.value === 'watermark')
        blob = await stampText(f, { text: wmText.value, color: rgb, opacity: wmOpacity.value })
      else blob = await pdfToPdfa(f)
      out.push({ name: `${name}-${action.value === 'encrypt' ? '加密' : action.value === 'clean' ? '清理' : action.value === 'watermark' ? '水印' : 'PDF-A'}.pdf`, blob })
      progress.value = (i + 1) / files.length
    }
    await saveMany(out, '批量处理结果.zip')
    toast.ok(`已处理 ${out.length} 个文件`)
  } catch (e) {
    toast.err((e as Error).message || '批量处理失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入一批 PDF 文件" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">批处理动作</span>
        <select v-model="action" class="select">
          <option value="clean">清理元数据</option>
          <option value="encrypt">加密（统一密码）</option>
          <option value="watermark">加水印</option>
          <option value="pdfa">转 PDF/A</option>
        </select>
      </div>
      <div v-if="action === 'encrypt'">
        <span class="field-label">统一密码</span>
        <input v-model="password" type="password" class="input" placeholder="至少 4 位" />
      </div>
      <template v-if="action === 'watermark'">
        <div>
          <span class="field-label">水印文字（西文）</span>
          <input v-model="wmText" class="input" />
        </div>
        <div>
          <span class="field-label">不透明度：{{ Math.round(wmOpacity * 100) }}%</span>
          <input v-model.number="wmOpacity" type="range" class="range" min="0.05" max="0.6" step="0.05" />
        </div>
      </template>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <PackageOpen v-else :size="16" /> 批量处理并打包
      </button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <p class="notice notice-info mt-2 small">
      动作说明：清理元数据会清空标题/作者/主题/关键词/创建程序；加密对全部文件使用同一密码；加水印为居中斜排；PDF/A 写入归档元数据。结果自动打包为 ZIP。
    </p>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
</style>
