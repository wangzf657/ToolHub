<script setup lang="ts">
/**
 * 音频淡入淡出：线性走 transformBuffer；指数 / S 形曲线在组件内
 * 直接对声道数据做逐样本渐变（指数用立方近似，S 形用余弦过渡）。
 */
import { computed, ref } from 'vue'
import { Play } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { createBuffer, encodeWav, encodeMp3, playBuffer, transformBuffer } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'

type Curve = 'linear' | 'exp' | 'sigmoid'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const fadeIn = ref(2)
const fadeOut = ref(2)
const curve = ref<Curve>('linear')
const fmt = ref<'wav' | 'mp3'>('mp3')
const kbps = ref(192)

const curves: { value: Curve; label: string }[] = [
  { value: 'linear', label: '线性' },
  { value: 'exp', label: '指数' },
  { value: 'sigmoid', label: 'S 形' },
]

/** 渐变形状：t ∈ [0,1] → 增益系数 */
function shape(t: number, kind: Curve): number {
  if (kind === 'linear') return t
  if (kind === 'exp') return Math.pow(t, 3) // 立方近似指数过渡（对数/指数听感）
  return 0.5 - 0.5 * Math.cos(Math.PI * t) // S 形：余弦平滑过渡
}

/** 独立的曲线淡入淡出实现（transformBuffer 仅支持线性） */
function curvedFade(buf: AudioBuffer, fin: number, fout: number, kind: Curve): AudioBuffer {
  const sr = buf.sampleRate
  const len = buf.length
  const out = createBuffer(buf.numberOfChannels, len, sr)
  const fi = Math.min(len, Math.round(Math.max(0, fin) * sr))
  const fo = Math.min(len, Math.round(Math.max(0, fout) * sr))
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c)
    const dst = out.getChannelData(c)
    dst.set(src)
    for (let i = 0; i < fi; i++) dst[i] *= shape(i / fi, kind)
    for (let i = 0; i < fo; i++) dst[len - 1 - i] *= shape(i / fo, kind)
  }
  return out
}

function apply(buf: AudioBuffer): AudioBuffer {
  if (curve.value === 'linear') {
    return transformBuffer(buf, { fadeIn: fadeIn.value, fadeOut: fadeOut.value })
  }
  return curvedFade(buf, fadeIn.value, fadeOut.value, curve.value)
}

function preview() {
  const b = base.value
  if (!b?.buffer) return
  playBuffer(apply(b.buffer))
}

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const out = apply(b.buffer)
    return fmt.value === 'mp3' ? await encodeMp3(out, kbps.value) : encodeWav(out)
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-fade.${fmt.value}`)
</script>

<template>
  <AudioToolBase ref="base">
    <div class="grid-2 mt-2">
      <label>
        <span class="field-label">淡入时长（秒，0 为关闭）</span>
        <input v-model.number="fadeIn" class="input" type="number" min="0" step="0.5" />
      </label>
      <label>
        <span class="field-label">淡出时长（秒，0 为关闭）</span>
        <input v-model.number="fadeOut" class="input" type="number" min="0" step="0.5" />
      </label>
    </div>

    <div class="row row-wrap mt-2">
      <span class="field-label" style="margin: 0">渐变曲线</span>
      <button v-for="c in curves" :key="c.value" class="chip" :class="{ active: curve === c.value }" @click="curve = c.value">
        {{ c.label }}
      </button>
    </div>

    <div class="row row-wrap mt-1">
      <button class="btn btn-soft btn-sm" :disabled="!base?.buffer" @click="preview"><Play :size="14" /> 试听效果</button>
    </div>

    <div class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">导出格式</span>
        <select v-model="fmt" class="select">
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
        </select>
      </label>
      <label v-if="fmt === 'mp3'" class="opt grow">
        <span class="field-label">MP3 码率 {{ kbps }} kbps</span>
        <input v-model.number="kbps" type="range" min="64" max="320" step="32" />
      </label>
    </div>

    <DownloadButton :produce="produce" :default-name="outName" button-text="添加淡入淡出并下载" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 130px;
}
</style>
