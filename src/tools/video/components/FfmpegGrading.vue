<script setup lang="ts">
/** 视频调色：电影感/暖调/黑白等预设 + 手动 eq 滑杆（亮度/对比/饱和/伽马） */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const preset = ref('none')

const PRESETS = [
  { v: 'none', t: '不调色' },
  { v: 'cinema', t: '电影感' },
  { v: 'warm', t: '暖调' },
  { v: 'cool', t: '冷调' },
  { v: 'mono', t: '黑白' },
  { v: 'vivid', t: '鲜艳' },
]
const APPLY: Record<string, string> = {
  cinema: 'eq=contrast=1.1:saturation=0.9',
  warm: 'colorbalance=rs=0.12:gs=0.02:bs=-0.12',
  cool: 'colorbalance=rs=-0.12:bs=0.12',
  mono: 'hue=s=0',
  vivid: 'eq=saturation=1.3:contrast=1.05',
}

const manual = ref(false)
const brightness = ref(0)
const contrast = ref(1)
const saturation = ref(1)
const gamma = ref(1)

const vf = () => {
  if (manual.value) {
    const parts: string[] = []
    if (brightness.value !== 0) parts.push(`brightness=${brightness.value.toFixed(2)}`)
    if (contrast.value !== 1) parts.push(`contrast=${contrast.value.toFixed(2)}`)
    if (saturation.value !== 1) parts.push(`saturation=${saturation.value.toFixed(2)}`)
    if (gamma.value !== 1) parts.push(`gamma=${gamma.value.toFixed(2)}`)
    return parts.length ? `eq=${parts.join(':')}` : ''
  }
  return preset.value === 'none' ? '' : APPLY[preset.value] ?? ''
}

const pickPreset = (v: string) => {
  preset.value = v
  manual.value = false
}

const run = async () => {
  const b = base.value
  if (!b) return
  const f = vf()
  const args = ['-y', '-i', 'input']
  if (f) args.push('-vf', f)
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
    '-c:a', 'copy', '-movflags', '+faststart', b.outputName,
  )
  await b.runWithFf(args, { status: '正在调色…' })
}
</script>

<template>
  <FfBase ref="base" button-text="开始调色" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">风格预设</span>
        <span class="row" style="flex-wrap: wrap; gap: 8px">
          <button v-for="p in PRESETS" :key="p.v" class="chip" :class="{ active: !manual && preset === p.v }" @click="pickPreset(p.v)">
            {{ p.t }}
          </button>
          <button class="chip" :class="{ active: manual }" @click="manual = true">手动调整</button>
        </span>
      </div>
    </div>
    <div v-if="manual" class="opts">
      <SliderRow v-model="brightness" label="亮度" :min="-0.5" :max="0.5" :step="0.02" width="170px" />
      <SliderRow v-model="contrast" label="对比度" :min="0.5" :max="2" :step="0.05" width="170px" />
      <SliderRow v-model="saturation" label="饱和度" :min="0" :max="3" :step="0.05" width="170px" />
      <SliderRow v-model="gamma" label="伽马" :min="0.5" :max="2" :step="0.05" width="170px" />
    </div>
    <p class="gr-note">调色需要重新编码画面（音频原样复制）。黑白模式用 hue 去饱和，暖/冷调用 colorbalance 偏移通道。</p>
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
.gr-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
