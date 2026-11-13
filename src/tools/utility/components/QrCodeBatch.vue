<script setup lang="ts">
/** 二维码批量生成：真 CSV 解析（引号/转义逗号）+ 纠错/边距选项 + {序号} 命名模板 → ZIP */
import { ref } from 'vue'
import { Loader2, Layers } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { makeQrCanvas, scanQr } from '@/lib/qrEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const size = ref(400)
const ecc = ref<'L' | 'M' | 'Q' | 'H'>('M')
const margin = ref(2)
const nameTpl = ref('qr_{序号3}')
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

/** 单行 CSV 解析：支持引号包裹字段与转义引号（"a,b""c" → a,b"c） */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuote = false
      } else cur += ch
    } else if (ch === '"') {
      inQuote = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

/** 命名模板：{序号N} → 按位数补零的序号 */
const applyTemplate = (tpl: string, i: number): string => {
  return tpl.replace(/\{序号(\d*)\}/g, (_, digits) => String(i).padStart(Number(digits) || 1, '0'))
}

const run = async () => {
  if (!input.value.trim()) return toast.warn('请粘贴多行文本或载入 CSV')
  const lines = input.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 1000)
  if (!lines.length) return toast.warn('没有有效行')
  busy.value = true
  failed.value = []
  done.value = 0
  const out: { name: string; blob: Blob }[] = []
  try {
    // CSV 首行为表头时识别列序（内容,文件名）
    const isCsv = lines[0].includes(',')
    const rows = isCsv && /内容|链接|text|url/i.test(lines[0]) ? lines.slice(1) : lines
    const usedNames = new Set<string>()
    for (let i = 0; i < rows.length; i++) {
      const line = rows[i]
      let content = line
      let name = ''
      if (line.includes(',')) {
        const parts = parseCsvLine(line)
        content = parts[0] ?? ''
        name = (parts[1] ?? '').replace(/[\\/:*?"<>|]/g, '')
      }
      if (!name) name = applyTemplate(nameTpl.value || 'qr_{序号3}', i + 1)
      while (usedNames.has(name)) name += '-1'
      usedNames.add(name)
      if (!content) {
        failed.value.push(`第 ${i + 1} 行：内容为空`)
        continue
      }
      try {
        const canvas = await makeQrCanvas(content, { size: size.value, margin: margin.value, errorCorrection: ecc.value })
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

/** 自检：试生成一张并反扫，验证纠错等级与边距配置可用 */
const selfCheck = async () => {
  try {
    const canvas = await makeQrCanvas('toolhub-self-check', { size: 320, margin: margin.value, errorCorrection: ecc.value })
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (blob) {
      await scanQr(blob)
      toast.ok(`自检通过：纠错 ${ecc.value} / 边距 ${margin.value} 可正常扫码`)
    }
  } catch {
    toast.warn('自检未通过：请调整纠错等级或边距后重试')
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".csv,.txt" :multiple="false" label="拖入 CSV（首列内容，第二列文件名）或多行文本" hint="也支持直接粘贴：每行一个链接/文本 · 支持引号包裹字段与转义逗号 · 上限 1000 条" @files="onFiles" />

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">尺寸（px）</span>
        <select v-model.number="size" class="select" style="width: 110px">
          <option :value="256">256</option>
          <option :value="400">400</option>
          <option :value="600">600</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">纠错等级</span>
        <select v-model="ecc" class="select" style="width: 120px">
          <option value="L">L（7%）</option>
          <option value="M">M（15%，默认）</option>
          <option value="Q">Q（25%）</option>
          <option value="H">H（30%，可遮挡）</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">边距（0~8 格）</span>
        <input v-model.number="margin" type="number" min="0" max="8" class="input" style="width: 90px" />
      </label>
      <label class="opt">
        <span class="field-label">命名模板（{<!-- -->{序号3}} = 001 起）</span>
        <input v-model="nameTpl" class="input" style="width: 170px" placeholder="qr_{序号3}" />
      </label>
      <button class="btn btn-ghost btn-sm" @click="selfCheck">配置自检</button>
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <Layers v-else :size="16" /> 批量生成{{ done ? `（${done}）` : '' }}
      </button>
      <span v-if="summary" class="muted small">{{ summary }}</span>
    </div>

    <div class="mt-2">
      <span class="field-label">行数据（每行一个，CSV 逗号分隔「内容,文件名」；带引号字段已支持）</span>
      <textarea v-model="input" class="textarea mono" style="min-height: 200px" spellcheck="false" placeholder="https://a.com,首页&#10;&quot;a,b 是内容&quot;,产品页&#10;WiFi:T:WPA;S:名称;P:密码;;"></textarea>
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
