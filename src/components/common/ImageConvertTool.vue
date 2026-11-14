<script setup lang="ts">
import { computed, ref } from 'vue'
import FileDrop from './FileDrop.vue'
import ImageConvertResults from './ImageConvertResults.vue'
import type { TargetMime } from '@/lib/imageConvert'
import type { PickNotice } from './imageConvertDiag'
import { useImageConvert } from './useImageConvert'
import { Download, Loader2 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    target: TargetMime
    targetLabel: string
    withQuality?: boolean
    withResize?: boolean
  }>(),
  { withQuality: true, withResize: false },
)

const picked = ref<File[]>([])
const qualityVal = ref(0.9)
const widthVal = ref<number | ''>('')
const heightVal = ref<number | ''>('')
/** JPG 底色（透明区域填充，webp-to-jpg 处方 3） */
const bgColor = ref('#ffffff')
/** WebP 无损档（png-to-webp/jpg-to-webp 处方 3） */
const lossless = ref(false)
/** 双目标：同时输出一份 WebP 副本（png-to-jpg 处方 8 / avif-to-png 处方 4） */
const alsoWebp = ref(false)
/** 完成后自动打包下载（默认关：先看结果再决定下载） */
const autoZip = ref(false)

const { running, progressPct, doneCount, etaText, pickNotices, decoderMsg, results, growth, srcHasMeta, onFiles, run, reconvert } =
  useImageConvert({ target: props.target, withQuality: props.withQuality === true, picked, qualityVal, widthVal, heightVal, bgColor, lossless, alsoWebp, autoZip })

const isJpeg = computed(() => props.target === 'image/jpeg')
const isWebp = computed(() => props.target === 'image/webp')
const isPng = computed(() => props.target === 'image/png')

const noticeClass = (k: PickNotice['kind']) => (k === 'animated' || k === 'bmp32' ? 'notice-warn' : 'notice-info')
</script>

<template>
  <div class="convert-tool">
    <FileDrop
      accept="image/*"
      :multiple="true"
      label="拖放图片到此处，或点击选择（支持批量）"
      hint="支持 PNG / JPG / WebP / GIF（动图仅取首帧）/ AVIF / BMP / SVG / HEIC / TIFF"
      @files="onFiles"
    />

    <!-- 拖入预检提示（解码器 / 动图 / 多页 / 能力说明） -->
    <div v-for="(n, i) in pickNotices" :key="i" class="notice mt-2 small" :class="noticeClass(n.kind)">
      <span v-for="(l, j) in n.lines" :key="j" style="display: block">{{ l }}</span>
      <RouterLink v-if="n.link" :to="n.link.to">{{ n.link.label }} →</RouterLink>
    </div>

    <div class="opts row row-wrap mt-2">
      <label v-if="props.withQuality && !(isWebp && lossless)" class="opt">
        <span class="field-label">质量（{{ Math.round(qualityVal * 100) }}%）</span>
        <input v-model.number="qualityVal" type="range" min="0.3" max="1" step="0.05" />
      </label>
      <label v-if="props.withResize" class="opt">
        <span class="field-label">宽度（px，可选）</span>
        <input v-model="widthVal" type="number" class="input" style="width: 120px" placeholder="自动" />
      </label>
      <label v-if="props.withResize" class="opt">
        <span class="field-label">高度（px，可选）</span>
        <input v-model="heightVal" type="number" class="input" style="width: 120px" placeholder="自动" />
      </label>
      <label v-if="isJpeg" class="opt">
        <span class="field-label">JPG 底色（透明区域填充）</span>
        <input v-model="bgColor" type="color" class="color-input" />
      </label>
      <label v-if="isWebp && props.withQuality" class="check opt-check"><input v-model="lossless" type="checkbox" /> 无损压缩（体积更大，文字 / 线稿无损）</label>
      <label v-if="!isWebp" class="check opt-check"><input v-model="alsoWebp" type="checkbox" /> 同时输出一份 WebP（对比体积）</label>
      <label class="check opt-check"><input v-model="autoZip" type="checkbox" /> 完成后自动打包下载</label>
    </div>
    <p v-if="isPng" class="small muted" style="margin: 6px 2px 0">PNG 为无损格式，照片类源文件的输出体积可能显著增大。</p>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="running || !picked.length" @click="run">
        <Loader2 v-if="running" :size="16" class="spin" />
        <Download v-else :size="16" />
        转换为{{ props.targetLabel }}{{ picked.length > 1 ? `（${picked.length} 张）` : '' }}
      </button>
      <span v-if="running" class="muted small">{{ etaText || `正在处理 ${doneCount}/${picked.length}…` }}</span>
    </div>

    <div v-if="running" class="progress mt-2">
      <div class="progress-bar" :style="{ width: progressPct + '%' }"></div>
      <span class="progress-pct">{{ Math.round(progressPct) }}%</span>
    </div>
    <!-- 解码器加载等待态（壳级能力 a：不许无反馈地干等） -->
    <div v-if="decoderMsg" class="notice notice-info mt-2 small" style="display: flex; align-items: center; gap: 6px">
      <Loader2 :size="13" class="spin" /> {{ decoderMsg }}
    </div>

    <!-- 结果区：警示条 + 汇总 + 分组列表 + 逐张下载/重转（预览先行，不再盲盒直下 zip） -->
    <ImageConvertResults
      v-if="results.length"
      class="mt-2"
      :results="results"
      :main-label="props.targetLabel"
      :with-quality="props.withQuality === true"
      :src-has-meta="srcHasMeta"
      :growth="growth"
      @reconvert="reconvert"
    />
  </div>
</template>

<style scoped>
.opts {
  gap: 18px;
  align-items: flex-end;
}
.opt {
  display: grid;
  gap: 4px;
}
.opt-check {
  margin-bottom: 8px;
}
.color-input {
  width: 64px;
  height: 34px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-solid);
  cursor: pointer;
}
.progress {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.2s ease;
}
.progress-pct {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10.5px;
  color: var(--text-2);
  text-shadow: 0 0 4px var(--bg);
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
