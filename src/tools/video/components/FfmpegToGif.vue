<script setup lang="ts">
/** 视频转 GIF：截取片段 + 两步调色板（palettegen/paletteuse）；可视化选段、dither 选项、结果预览与体积徽章 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import SliderRow from './SliderRow.vue'
import { mimeFor } from '@/lib/ffmpeg'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const start = ref(0)
const dur = ref(5)
const width = ref(480)
const fps = ref(12)
const dither = ref<'bayer' | 'floyd_steinberg' | 'none'>('bayer')

const srcDur = computed(() => base.value?.meta?.duration ?? 0)

watch(
  () => base.value?.meta,
  (m) => {
    if (m && dur.value > m.duration) dur.value = Math.min(30, Math.max(1, Math.floor(m.duration)))
  },
)

/** 可视化选段：读预览播放头的 currentTime 一键设为起点/终点推算 */
const setStartFromPreview = () => {
  const v = base.value?.videoEl
  if (!v) return
  start.value = Number(v.currentTime.toFixed(1))
  toast.ok(`已设起点 ${start.value}s`)
}
const setEndFromPreview = () => {
  const v = base.value?.videoEl
  if (!v) return
  const e = Number(v.currentTime.toFixed(1))
  dur.value = Math.max(0.2, Math.min(30, Number((e - start.value).toFixed(1))))
  toast.ok(`已按当前帧设终点，截取时长 ${dur.value}s`)
}

const run = async () => {
  const b = base.value
  if (!b || !b.meta) return
  // 前置校验：起点超出视频时长时不触发 ffmpeg
  if (start.value >= b.meta.duration) {
    toast.warn(`开始时间（${start.value}s）超出视频时长（${b.meta.duration.toFixed(1)}s），已钳制到片尾前 5 秒`)
    start.value = Math.max(0, b.meta.duration - 5)
    return
  }
  const d = Math.min(Math.max(0.2, dur.value), b.meta.duration - start.value)
  const ditherArg = dither.value === 'bayer' ? 'bayer:bayer_scale=4' : dither.value === 'none' ? 'none' : 'floyd_steinberg'
  const vf = `fps=${fps.value},scale=${Math.max(16, width.value)}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=${ditherArg}`
  const res = await b.runWithFf(
    ['-y', '-ss', String(start.value), '-t', String(d), '-i', 'input', '-vf', vf, b.outputName],
    { status: '正在生成 GIF（两步调色板）…' },
  )
  if (res) {
    const [n, data] = res.entries().next().value as [string, Uint8Array]
    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    const blob = new Blob([data as BlobPart], { type: mimeFor('gif') })
    resultUrl.value = URL.createObjectURL(blob)
    resultSize.value = blob.size
    resultName.value = n
    const frames = Math.round(d * fps.value)
    const src = b.files[0]?.size ?? 0
    savedPct.value = src > 0 ? Math.round((1 - blob.size / src) * 100) : 0
    toast.ok(`GIF 已生成（约 ${frames} 帧），请预览后下载`)
  }
}

/* ---------- 结果预览 + 体积徽章 ---------- */
const resultUrl = ref('')
const resultSize = ref(0)
const resultName = ref('')
const savedPct = ref(0)
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)
onBeforeUnmount(() => {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <FfBase ref="base" output-ext="gif" button-text="生成 GIF" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">开始时间（秒）</span>
        <input v-model.number="start" type="number" min="0" step="0.5" class="input" style="width: 100px" />
        <button class="btn btn-soft btn-sm" title="把预览当前时刻设为起点" @click="setStartFromPreview">设为起点</button>
      </div>
      <div class="opt">
        <span class="field-label">截取时长（秒）</span>
        <input v-model.number="dur" type="number" min="0.2" max="30" step="0.5" class="input" style="width: 100px" />
        <button class="btn btn-soft btn-sm" title="把预览当前时刻设为终点" @click="setEndFromPreview">设为终点</button>
      </div>
      <div class="opt">
        <span class="field-label">宽度（px）</span>
        <input v-model.number="width" type="number" min="64" max="1920" step="16" class="input" style="width: 100px" />
      </div>
      <div class="opt">
        <span class="field-label">抖动算法</span>
        <select v-model="dither" class="select" style="width: 170px">
          <option value="bayer">Bayer（默认，体积小）</option>
          <option value="floyd_steinberg">Floyd（渐变更平滑）</option>
          <option value="none">无抖动（色带明显）</option>
        </select>
      </div>
      <SliderRow v-model="fps" label="帧率" :min="8" :max="15" :step="1" unit=" fps" width="140px" />
    </div>
    <p v-if="srcDur > 0" class="gif-note">选段 {{ start.toFixed(1) }}s → {{ Math.min(srcDur, start + dur).toFixed(1) }}s（约 {{ dur.toFixed(1) }}s）</p>
    <p class="gif-note">
      从截取片段采样生成调色板再映射，画质比单次转换好得多。建议控制在 10 秒内：GIF 体积随长度与宽度迅速增大。
    </p>
    <FfExpectHint text="GIF 编码较慢（两步调色板 + 逐帧编码），10 秒选段约需 30~90 秒；首次使用需加载约 25MB 编解码核心。处理期间请保持页面打开，勿刷新或关闭标签页。" />

    <div v-if="resultUrl" class="result-card mt-2">
      <p class="rc-title">GIF 结果</p>
      <img :src="resultUrl" alt="GIF 预览" class="result-gif" />
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">
          源 {{ fmtSize(base?.files[0]?.size ?? 0) }} → GIF {{ fmtSize(resultSize) }}
          <template v-if="savedPct > 0">（省 {{ savedPct }}%）</template>
        </span>
        <a class="btn btn-primary btn-sm" :href="resultUrl" :download="resultName"><Download :size="14" /> 下载 GIF</a>
      </div>
    </div>
  </FfBase>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  margin-top: 14px;
}
.opt {
  display: grid;
  gap: 4px;
}
.gif-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
.result-card { max-width: 560px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.rc-title { margin: 0 0 8px; font-weight: 600; font-size: 14px; }
.result-gif { max-width: 100%; max-height: 300px; border-radius: 10px; background: #f3f4f6; display: block; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
</style>
