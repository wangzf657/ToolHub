<script setup lang="ts">
/** PPTX 压缩瘦身：解 zip → 重压缩 ppt/media 图片（无透明转 JPG）→ 清理未引用媒体 → 重打包 */
import { computed, ref } from 'vue'
import { FileArchive, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { compressPptx, estimateSavings, type CompressResult } from './pptxCompress'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = ref<File | null>(null)
const quality = ref(80)
const maxEdge = ref(0) // 图片最大边长（0 = 不限）
const busy = ref(false)
const progress = ref(0)
const estimating = ref(false)
const estimatePct = ref<number | null>(null)
const result = ref<(CompressResult & { sampleUrl?: string; sampleBeforeUrl?: string }) | null>(null)
const zoomFull = ref(false)

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

/* 质量三档预设 + 滑杆微调 */
const presets = [
  { label: '标准', v: 80 },
  { label: '经济', v: 70 },
  { label: '极限', v: 60 },
]
const activePreset = computed(() => presets.find((p) => p.v === quality.value)?.label ?? '自定义')

const onFiles = (files: File[]) => {
  file.value = files[0] ?? null
  result.value = null
  estimatePct.value = null
  void doEstimate()
}

/** 压缩前预估：抽样最大的 10 张媒体图试算，按字节占比外推（标注「估算」） */
const doEstimate = async () => {
  if (!file.value) return
  estimating.value = true
  try {
    const r = await estimateSavings(file.value, { quality: quality.value, maxEdge: maxEdge.value })
    estimatePct.value = r.pct
  } catch {
    estimatePct.value = null
  } finally {
    estimating.value = false
  }
}

const run = async () => {
  if (!file.value) return toast.warn('请先选择 .pptx 文件')
  if (file.value.size > 50 * 1024 * 1024) toast.warn('文件较大，处理可能需要十几秒')
  busy.value = true
  progress.value = 0
  result.value = null
  try {
    const r = await compressPptx(file.value, {
      quality: quality.value,
      maxEdge: maxEdge.value,
      onProgress: (p) => (progress.value = p),
    })
    const savedPct = Math.max(0, Math.round((1 - r.after / Math.max(1, r.before)) * 100))
    let extra = ''
    // PNG 无收益提示：PNG 字节占比高且节省有限时解释原因
    if (r.pngShare > 0.6 && savedPct < 5) {
      extra = '；该文件媒体以 PNG 为主（透明图形/截图为主时常见），PNG 以保留画质为主，收益有限——若无需透明可先用图片工具批量转 JPG'
    }
    const urls: CompressResult & { sampleUrl?: string; sampleBeforeUrl?: string } = { ...r }
    if (r.sample) {
      urls.sampleBeforeUrl = URL.createObjectURL(r.sample.before)
      urls.sampleUrl = URL.createObjectURL(r.sample.after)
    }
    result.value = urls
    saveBlob(r.out, `压缩副本-${file.value.name}`)
    toast.ok(`完成：${fmtSize(file.value.size)} → ${fmtSize(r.out.size)}${extra}`)
  } catch (e) {
    toast.err((e as Error).message || '压缩失败，请确认是有效的 .pptx 文件')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop accept=".pptx" :multiple="false" label="拖入 PowerPoint 文件（.pptx）" hint="本地解包重压缩图片与清理未引用媒体 · 原文件不动" @files="onFiles" />

    <div class="row row-wrap mt-2 preset-row">
      <span class="field-label">质量档位</span>
      <button
        v-for="p in presets"
        :key="p.v"
        class="chip"
        :class="{ on: quality === p.v }"
        type="button"
        @click="quality = p.v"
      >
        {{ p.label }}（{{ p.v }}）
      </button>
      <input v-model.number="quality" type="range" min="40" max="95" step="5" class="slider" aria-label="JPG 质量微调" />
      <span class="small muted">JPG 质量 {{ quality }}（{{ activePreset }}）</span>
    </div>

    <div class="row row-wrap mt-1" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">图片最大边长</span>
        <select v-model.number="maxEdge" class="select" style="width: 150px">
          <option :value="0">不限（仅重编码）</option>
          <option :value="1920">1920 px</option>
          <option :value="1280">1280 px</option>
        </select>
      </label>
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <FileArchive v-else :size="16" /> 开始压缩
      </button>
      <span v-if="file" class="muted small">当前：{{ fmtSize(file.size) }}</span>
      <span v-if="estimating" class="muted small">正在预估收益…</span>
      <span v-else-if="estimatePct !== null && file" class="muted small">预计可省约 {{ estimatePct }}%（抽样估算，以实际为准）</span>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="result" class="notice notice-ok mt-2">
      完成：{{ fmtSize(result.before) }} → <strong>{{ fmtSize(result.after) }}</strong>
      （节省 {{ Math.max(0, Math.round((1 - result.after / Math.max(1, result.before)) * 100)) }}%）· 媒体图 {{ result.imgs }} 张 · 清理未引用 {{ result.removed }} 张
    </div>

    <!-- 画质对比：首张重编码图 原图 | 压缩后 并排 -->
    <div v-if="result?.sampleBeforeUrl && result?.sampleUrl" class="compare mt-2">
      <div class="cmp-cell">
        <span class="small muted">原图（{{ fmtSize(result.sample!.before.size) }}）</span>
        <img :src="result.sampleBeforeUrl" alt="重编码前" :style="zoomFull ? '' : 'max-height: 180px'" />
      </div>
      <div class="cmp-cell">
        <span class="small muted">压缩后（{{ fmtSize(result.sample!.after.size) }}）</span>
        <img :src="result.sampleUrl" alt="重编码后" :style="zoomFull ? '' : 'max-height: 180px'" />
      </div>
    </div>
    <button v-if="result?.sampleUrl" class="btn btn-ghost btn-sm mt-1" @click="zoomFull = !zoomFull">
      {{ zoomFull ? '缩小显示' : '按原始尺寸查看' }}
    </button>

    <p class="notice notice-info mt-2 small">原理：pptx 即 ZIP 包，图片在 ppt/media/。含透明的图保留 PNG（可叠加降采样），不透明的转 JPG；输出为副本可直接替换使用。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.preset-row {
  gap: 10px;
  align-items: center;
}
.chip {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12.5px;
  cursor: pointer;
}
.chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}
.slider {
  width: 160px;
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
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.compare {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.cmp-cell {
  display: grid;
  gap: 4px;
}
.cmp-cell img {
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
</style>
