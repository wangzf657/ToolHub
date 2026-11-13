<script setup lang="ts">
import { computed, ref } from 'vue'
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
const outName = ref('压缩后')
const result = ref<{ originalKB: number; resultKB: number } | null>(null)
const outBlob = ref<Blob | null>(null)

const pageCount = computed(() => base.value?.pageCount ?? 0)

/** 压缩率预估（按页数/体积口径提示） */
const estimate = computed(() => {
  if (!pageCount.value) return ''
  return '预计可压缩 30%~70%（扫描件与图片型 PDF 收益明显；纯文字 PDF 收益有限，建议选高画质）'
})

/** 进度换算：引擎预设模式按 i/10 上报（i 为当前页），按实际页数归一；目标体积模式已是 0~1 */
const stage = ref('')
const onProgress = (p: number) => {
  if (mode.value === 'preset' && pageCount.value > 0) {
    const frac = Math.min(1, (p * 10) / pageCount.value)
    progress.value = frac
    stage.value = p * 10 >= pageCount.value ? '正在重排生成 PDF…' : `正在渲染第 ${Math.round(p * 10)} / ${pageCount.value} 页`
  } else {
    progress.value = Math.min(1, p)
    stage.value = '正在试探压缩质量…'
  }
}

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
  stage.value = ''
  result.value = null
  try {
    const r = await compressPdf(file, {
      preset: mode.value === 'preset' ? preset.value : undefined,
      targetKB: mode.value === 'target' ? targetKB.value : undefined,
      onProgress,
    })
    outBlob.value = r.blob
    result.value = { originalKB: r.originalKB, resultKB: r.resultKB }
    const missed = mode.value === 'target' && r.resultKB > targetKB.value
    toast.ok(missed ? `压缩完成，但未达到目标 ${targetKB.value} KB（已给出最优结果）` : `压缩完成，体积减少约 ${Math.max(0, Math.round((1 - r.resultKB / r.originalKB) * 100))}%`)
  } catch (e) {
    toast.err((e as Error).message || '压缩失败')
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const download = () => {
  if (outBlob.value) saveBlob(outBlob.value, `${outName.value.trim() || '压缩后'}.pdf`)
}

/** 目标体积模式：是否未达标 */
const missedTarget = computed(() => mode.value === 'target' && !!result.value && result.value.resultKB > targetKB.value)
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
      <input v-model="outName" class="input name-input" type="text" placeholder="输出文件名（默认：压缩后）" aria-label="输出文件名" />
      <button v-if="outBlob" class="btn btn-soft" @click="download"><Download :size="15" /> 下载压缩后文件</button>
    </div>

    <div v-if="busy" class="mt-2">
      <div class="progress">
        <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
      </div>
      <p v-if="stage" class="small muted mt-1">{{ stage }}</p>
    </div>

    <p v-if="estimate && !busy" class="small muted mt-2">{{ estimate }}</p>

    <div v-if="result" class="stats mt-2">
      <div class="stat"><span class="k">原始大小</span><span class="v">{{ result.originalKB.toFixed(0) }} KB</span></div>
      <div class="stat"><span class="k">压缩后</span><span class="v accent">{{ result.resultKB.toFixed(0) }} KB</span></div>
      <div v-if="missedTarget" class="stat stat-warn">
        <span class="k">目标 {{ targetKB }} KB</span>
        <span class="v warn">未达到目标 {{ targetKB }} KB</span>
        <span class="small muted">已输出当前参数下的最优结果，可尝试更低画质或更高 scale</span>
      </div>
      <div v-else class="stat">
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
.stat-warn {
  border-color: color-mix(in srgb, var(--warn, #f59e0b) 55%, transparent);
  background: color-mix(in srgb, var(--warn, #f59e0b) 12%, transparent);
}
.v.warn {
  color: var(--warn, #f59e0b);
  font-size: 15px;
}
.name-input {
  max-width: 220px;
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
