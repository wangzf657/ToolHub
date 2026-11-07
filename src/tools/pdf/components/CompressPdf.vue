<script setup lang="ts">
import { ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { compressPdf } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 压缩 PDF：质量档位或目标体积（二分逼近），栅格化重编码 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const mode = ref<'preset' | 'target'>('preset')
const preset = ref<'low' | 'medium' | 'high'>('medium')
const targetKB = ref(500)
const busy = ref(false)
const progress = ref(0)
const result = ref<{ originalKB: number; resultKB: number } | null>(null)
const outBlob = ref<Blob | null>(null)

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (mode.value === 'target' && (!targetKB.value || targetKB.value < 10)) {
    toast.warn('目标体积请填写不小于 10 KB 的数值')
    return
  }
  busy.value = true
  progress.value = 0
  result.value = null
  try {
    const r = await compressPdf(file, {
      preset: mode.value === 'preset' ? preset.value : undefined,
      targetKB: mode.value === 'target' ? targetKB.value : undefined,
      onProgress: (p) => (progress.value = p),
    })
    outBlob.value = r.blob
    result.value = { originalKB: r.originalKB, resultKB: r.resultKB }
    const pctv = Math.max(0, Math.round((1 - r.resultKB / r.originalKB) * 100))
    toast.ok(`压缩完成，体积减少约 ${pctv}%`)
  } catch (e) {
    toast.err((e as Error).message || '压缩失败')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (outBlob.value) saveBlob(outBlob.value, '压缩后.pdf')
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => ((result = null), (outBlob = null))" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">压缩方式</span>
        <select v-model="mode" class="select">
          <option value="preset">按质量档位</option>
          <option value="target">压到指定体积</option>
        </select>
      </div>
      <div v-if="mode === 'preset'">
        <span class="field-label">质量档位</span>
        <select v-model="preset" class="select">
          <option value="high">高（最清晰）</option>
          <option value="medium">中（推荐）</option>
          <option value="low">低（最小体积）</option>
        </select>
      </div>
      <div v-else>
        <span class="field-label">目标体积（KB）</span>
        <input v-model.number="targetKB" type="number" class="input" min="10" step="50" />
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 开始压缩
      </button>
      <button v-if="outBlob" class="btn btn-soft" @click="download"><Download :size="15" /> 下载压缩后文件</button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="result" class="stats mt-2">
      <div class="stat"><span class="k">原始大小</span><span class="v">{{ result.originalKB.toFixed(0) }} KB</span></div>
      <div class="stat"><span class="k">压缩后</span><span class="v accent">{{ result.resultKB.toFixed(0) }} KB</span></div>
      <div class="stat">
        <span class="k">压缩率</span>
        <span class="v accent">-{{ Math.max(0, Math.round((1 - result.resultKB / result.originalKB) * 100)) }}%</span>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      压缩采用「逐页栅格化 + JPG 重编码」：扫描件与图片型 PDF 效果显著；纯文字 PDF 建议选高画质。压缩后页面变为图片，不可再选中文字。
    </p>
  </div>
</template>

<style scoped>
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
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 110px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 17px;
  font-weight: 700;
}
.v.accent {
  color: var(--accent-text);
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
