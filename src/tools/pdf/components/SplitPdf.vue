<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { extractPages, parsePageSpec, splitPdf } from '@/lib/pdfEngine'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 拆分 PDF：每页一档 / 每 N 页一档 / 按区间，逐个下载或打包 ZIP */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const progress = ref(0)
const mode = ref<'each' | 'chunk' | 'range'>('each')
const chunkSize = ref(10)
const rangeSpec = ref('')
const prefix = ref('')
const results = ref<{ name: string; blob: Blob }[]>([])

const pageCount = computed(() => base.value?.pageCount ?? 0)
const fileRef = computed<File | undefined>(() => base.value?.files[0])

/** 拆分方式对应的产出份数（用于大页数预警与按钮提示） */
const plannedCount = computed(() => {
  const total = pageCount.value
  if (!total) return 0
  if (mode.value === 'each') return total
  if (mode.value === 'chunk') return Math.max(1, chunkSize.value) ? Math.ceil(total / Math.max(1, chunkSize.value)) : 0
  const parts = rangeSpec.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  return parts.length
})

/** 大页数预警（>100 页文档） */
const bigWarn = computed(() => pageCount.value > 100)

const safeName = (label: string) => {
  const p = prefix.value.trim()
  return p ? `${p}${label}` : label
}

const run = async () => {
  const file = fileRef.value
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  const total = pageCount.value
  if (mode.value === 'chunk' && (!chunkSize.value || chunkSize.value < 1)) {
    toast.warn('每档页数请填写不小于 1 的整数')
    return
  }
  if (mode.value === 'range') {
    const parts = rangeSpec.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    if (!parts.length) {
      toast.warn('请输入区间，如：1-5,8')
      return
    }
  }
  busy.value = true
  progress.value = 0
  results.value = []
  try {
    if (mode.value === 'each') {
      const list = await splitPdf(file, (p) => (progress.value = p))
      results.value = list.map((r) => ({ name: safeName(r.name), blob: r.blob }))
    } else if (mode.value === 'chunk') {
      // 每 N 页一档：逐段调用 extractPages，单次 load/save
      const n = Math.max(1, Math.floor(chunkSize.value))
      const chunks = Math.ceil(total / n)
      const out: { name: string; blob: Blob }[] = []
      for (let c = 0; c < chunks; c++) {
        const from = c * n + 1
        const to = Math.min(total, (c + 1) * n)
        const blob = await extractPages(file, `${from}-${to}`)
        out.push({ name: safeName(`第${from}-${to}页.pdf`), blob })
        progress.value = (c + 1) / chunks
      }
      results.value = out
    } else {
      // 按区间：逗号分隔的每段各自成一档（"1-5,8" → 2 个文件）
      const parts = rangeSpec.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
      const out: { name: string; blob: Blob }[] = []
      for (let i = 0; i < parts.length; i++) {
        const idx = parsePageSpec(parts[i], total)
        if (!idx.length) {
          toast.warn(`区间「${parts[i]}」没有匹配到任何页（文档共 ${total} 页），已跳过`)
          continue
        }
        const spec = `${Math.min(...idx) + 1}-${Math.max(...idx) + 1}`
        const blob = await extractPages(file, spec)
        const label = idx.length === 1 ? `第${idx[0] + 1}页` : `第${idx[0] + 1}-${idx[idx.length - 1] + 1}页`
        out.push({ name: safeName(`${label}.pdf`), blob })
        progress.value = (i + 1) / parts.length
      }
      if (!out.length) throw new Error('区间没有匹配到任何页')
      results.value = out
    }
    toast.ok(`已拆分为 ${results.value.length} 个文件`)
  } catch (e) {
    toast.err((e as Error).message || '拆分失败，请确认文件有效')
  } finally {
    busy.value = false
  }
}

const dl = (item: { name: string; blob: Blob }) => saveBlob(item.blob, item.name)
const pack = () => void saveMany(results.value, '拆分结果.zip')
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (results = [])" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">拆分方式</span>
        <select v-model="mode" class="select">
          <option value="each">每页一档</option>
          <option value="chunk">每 N 页一档</option>
          <option value="range">按区间拆分</option>
        </select>
      </div>
      <div v-if="mode === 'chunk'">
        <span class="field-label">每档页数</span>
        <input v-model.number="chunkSize" type="number" class="input" min="1" step="1" />
      </div>
      <div v-if="mode === 'range'">
        <span class="field-label">区间（逗号分隔，每段一个文件）</span>
        <input v-model="rangeSpec" type="text" class="input" placeholder="如 1-5,8" />
      </div>
      <div>
        <span class="field-label">输出名前缀（可选）</span>
        <input v-model="prefix" type="text" class="input" placeholder="如：标书" />
      </div>
    </div>

    <p v-if="bigWarn && !busy" class="notice notice-warn mt-2 small">
      该文档共 {{ pageCount }} 页，按当前方式将生成 {{ plannedCount || pageCount }} 个文件，建议使用「打包下载全部（ZIP）」一次拿走。
    </p>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始拆分
      </button>
      <span v-if="plannedCount && !busy" class="small muted">将生成 {{ plannedCount }} 个文件</span>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="results.length" class="mt-2">
      <div class="row row-wrap mb-2">
        <button class="btn btn-soft" @click="pack"><PackageOpen :size="15" /> 打包下载全部（ZIP）</button>
        <span class="small muted">共 {{ results.length }} 个文件</span>
      </div>
      <div class="list">
        <div v-for="(r, i) in results" :key="r.name + i" class="item">
          <span class="name">{{ r.name }}</span>
          <span class="small muted">{{ (r.blob.size / 1024).toFixed(0) }} KB</span>
          <button class="btn btn-ghost btn-sm" @click="dl(r)"><Download :size="14" /> 下载</button>
        </div>
      </div>
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
/* 结果列表弹性高度：视口为主，下限 420px，页面本身不出滚动条 */
.list {
  display: grid;
  gap: 6px;
  height: max(420px, calc(100vh - 360px));
  overflow: auto;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.name {
  flex: 1;
  font-size: 13px;
}
</style>
