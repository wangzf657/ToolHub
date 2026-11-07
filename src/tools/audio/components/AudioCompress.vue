<script setup lang="ts">
/**
 * 压缩音频：按目标 MB 估算码率或直接选质量档 → encodeMp3；
 * 可选单声道混合减半信息量；显示处理前后体积对比。
 */
import { computed, ref } from 'vue'
import { Info } from 'lucide-vue-next'
import AudioToolBase from './AudioToolBase.vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { encodeMp3 } from '@/lib/audioEngine'
import { baseName } from '@/lib/download'
import { sizeLabel, toMono } from './shared'

const base = ref<InstanceType<typeof AudioToolBase> | null>(null)
const mode = ref<'size' | 'quality'>('size')
const targetMB = ref(5)
const quality = ref(128)
const mono = ref(false)
const resultSize = ref(0)

const qualities = [320, 192, 128, 96, 64]

function onClear() {
  resultSize.value = 0
}

/** 码率估算：目标体积 → 码率；质量档直接用所选值 */
const estimate = computed(() => {
  const buf = base.value?.buffer
  const f = base.value?.file
  if (!buf || !f) return null
  if (mode.value === 'quality') return { kbps: quality.value, dur: buf.duration, curSize: f.size }
  const targetBytes = targetMB.value * 1024 * 1024
  const raw = (targetBytes * 8) / Math.max(0.1, buf.duration) / 1000
  return { kbps: Math.max(32, Math.min(320, Math.round(raw / 8) * 8)), dur: buf.duration, curSize: f.size }
})

async function produce(): Promise<Blob> {
  const b = base.value
  if (!b?.buffer || !b.file) throw new Error('请先加载音频文件')
  const est = estimate.value
  if (!est) throw new Error('请先加载音频文件')
  b.setBusy(true)
  try {
    const src = mono.value ? toMono(b.buffer) : b.buffer
    const blob = await encodeMp3(src, est.kbps)
    resultSize.value = blob.size
    return blob
  } finally {
    b.setBusy(false)
  }
}

const outName = computed(() => `${baseName(base.value?.file?.name ?? 'audio')}-compressed.mp3`)
</script>

<template>
  <AudioToolBase ref="base" @clear="onClear">
    <div class="row row-wrap mt-2">
      <button class="chip" :class="{ active: mode === 'size' }" @click="mode = 'size'">压到指定大小</button>
      <button class="chip" :class="{ active: mode === 'quality' }" @click="mode = 'quality'">按质量档压缩</button>
    </div>

    <div v-if="mode === 'size'" class="row row-wrap mt-2">
      <label class="opt">
        <span class="field-label">目标大小（MB）</span>
        <input v-model.number="targetMB" class="input" type="number" min="0.1" max="500" step="0.5" />
      </label>
      <label v-if="estimate" class="check mt-auto"><input v-model="mono" type="checkbox" /> 转为单声道（信息量减半，同码率更清晰）</label>
    </div>

    <div v-else class="row row-wrap mt-2">
      <button v-for="q in qualities" :key="q" class="chip" :class="{ active: quality === q }" @click="quality = q">
        {{ q }} kbps
      </button>
      <label class="check mt-auto"><input v-model="mono" type="checkbox" /> 转为单声道（体积可再降约一半）</label>
    </div>

    <div v-if="estimate" class="notice notice-info mt-2">
      <Info :size="15" />
      <span>
        当前 {{ sizeLabel(estimate.curSize) }} · 时长 {{ estimate.dur.toFixed(1) }} 秒
        <template v-if="mode === 'size'"> → 按目标 {{ targetMB }} MB 估算码率 {{ estimate.kbps }} kbps</template>
        <template v-else> → 使用 {{ estimate.kbps }} kbps，预计约 {{ sizeLabel((estimate.kbps * 1000 * estimate.dur) / 8) }}</template>
      </span>
    </div>
    <div v-if="resultSize" class="small mt-1 cmp-ok">压缩完成：处理后体积 {{ sizeLabel(resultSize) }}</div>

    <DownloadButton :produce="produce" :default-name="outName" button-text="压缩并下载" />
  </AudioToolBase>
</template>

<style scoped>
.opt {
  min-width: 150px;
}
.mt-auto {
  margin-top: auto;
}
.cmp-ok {
  color: var(--ok);
}
</style>
