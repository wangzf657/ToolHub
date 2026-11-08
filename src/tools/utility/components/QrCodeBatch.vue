<script setup lang="ts">
/** 二维码批量生成：CSV(内容,文件名) 或多行文本 → 逐条 PNG → 打包 ZIP */
import { ref } from 'vue'
import { Loader2, Layers } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { makeQrCanvas } from '@/lib/qrEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const size = ref(400)
const busy = ref(false)
const done = ref(0)
const failed = ref<string[]>([])
const summary = ref('')

const onFiles = async (files: File[]) => {
  if (!files.length) return
  const text = await files[0].text()
  input.value = text.slice(0, 500000)
  toast.ok('已载入文件，点「批量生成」开始')
}

const run = async () => {
  if (!input.value.trim()) return toast.warn('请粘贴多行文本或载入 CSV')
  const lines = input.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 1000)
  if (!lines.length) return toast.warn('没有有效行')
  if (lines.length > 1000) toast.warn('已截取前 1000 行')
  busy.value = true
  failed.value = []
  done.value = 0
  const out: { name: string; blob: Blob }[] = []
  try {
    // CSV 首行为表头时识别列序（内容,文件名）
    const isCsv = lines[0].includes(',')
    const rows = isCsv && /内容|链接|text|url/i.test(lines[0]) ? lines.slice(1) : lines
    for (let i = 0; i < rows.length; i++) {
      const line = rows[i]
      let content = line
      let name = `qr-${String(i + 1).padStart(3, '0')}`
      if (line.includes(',')) {
        const parts = line.split(',')
        content = (parts[0] ?? '').trim()
        name = (parts[1] ?? '').trim().replace(/[\\/:*?"<>|]/g, '') || name
      }
      if (!content) {
        failed.value.push(`第 ${i + 1} 行：内容为空`)
        continue
      }
      try {
        const canvas = await makeQrCanvas(content, { size: size.value, margin: 2, errorCorrection: 'M' })
        const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'))
        out.push({ name: `${name}.png`, blob })
      } catch (e) {
        failed.value.push(`第 ${i + 1} 行：${(e as Error).message.slice(0, 40)}`)
      }
      done.value++
    }
    if (!out.length) {
      toast.err('没有成功生成的行')
      return
    }
    await saveMany(out, out.length > 1 ? '批量二维码.zip' : out[0].name)
    summary.value = `成功 ${out.length} 张${failed.value.length ? `，失败 ${failed.value.length} 行` : ''}`
    toast.ok(summary.value)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.txt" :multiple="false" label="拖入 CSV（首列内容，第二列文件名）或多行文本" hint="也支持直接粘贴：每行一个链接/文本 · 上限 1000 条" @files="onFiles" />

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">尺寸（px）</span>
        <select v-model.number="size" class="select" style="width: 110px">
          <option :value="256">256</option>
          <option :value="400">400</option>
          <option :value="600">600</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <Layers v-else :size="16" /> 批量生成{{ done ? `（${done}）` : '' }}
      </button>
      <span v-if="summary" class="muted small">{{ summary }}</span>
    </div>

    <div class="mt-2">
      <span class="field-label">行数据（每行一个，CSV 逗号分隔「内容,文件名」）</span>
      <textarea v-model="input" class="textarea mono" style="min-height: 200px" spellcheck="false" placeholder="https://a.com,首页&#10;https://b.com,产品页&#10;WiFi:T:WPA;S:名称;P:密码;;"></textarea>
    </div>

    <div v-if="failed.length" class="notice notice-err mt-2">
      <p v-for="(f, i) in failed.slice(0, 8)" :key="i" class="small">{{ f }}</p>
      <p v-if="failed.length > 8" class="small muted">…等 {{ failed.length }} 条失败</p>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
