<script setup lang="ts">
/** 视频尺寸调整：预设分辨率 + 适配/裁满/拉伸三种画幅模式 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const preset = ref('1280x720')
const customW = ref(1080)
const customH = ref(1920)
const mode = ref<'pad' | 'cover' | 'stretch'>('pad')

const PRESETS = [
  { v: '1920x1080', t: '1080p 横屏 16:9' },
  { v: '1280x720', t: '720p 横屏 16:9' },
  { v: '854x480', t: '480p 横屏' },
  { v: '1080x1920', t: '1080p 竖屏 9:16' },
  { v: '720x1280', t: '720p 竖屏 9:16' },
  { v: '1080x1080', t: '方形 1:1' },
  { v: 'custom', t: '自定义…' },
]

const dims = () => {
  if (preset.value !== 'custom') {
    const [w, h] = preset.value.split('x').map(Number)
    return { w, h }
  }
  return { w: Math.max(16, Math.round(customW.value / 2) * 2), h: Math.max(16, Math.round(customH.value / 2) * 2) }
}

const run = async () => {
  const b = base.value
  if (!b) return
  const { w, h } = dims()
  const vf =
    mode.value === 'pad'
      ? `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`
      : mode.value === 'cover'
        ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
        : `scale=${w}:${h}`
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { status: '正在调整尺寸…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始调整" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">目标尺寸</span>
        <select v-model="preset" class="select" style="width: 170px">
          <option v-for="p in PRESETS" :key="p.v" :value="p.v">{{ p.t }}</option>
        </select>
      </div>
      <div v-if="preset === 'custom'" class="opt row" style="gap: 8px">
        <input v-model.number="customW" type="number" min="16" class="input" style="width: 90px" placeholder="宽" />
        <span>×</span>
        <input v-model.number="customH" type="number" min="16" class="input" style="width: 90px" placeholder="高" />
      </div>
      <div class="opt">
        <span class="field-label">画幅模式</span>
        <select v-model="mode" class="select" style="width: 220px">
          <option value="pad">适配（留黑边，不裁切）</option>
          <option value="cover">裁满（填满画幅并居中裁切）</option>
          <option value="stretch">直接拉伸（可能变形）</option>
        </select>
      </div>
    </div>
    <p class="resize-note">
      竖屏平台（抖音/视频号）选 1080×1920；方形（小红书/微博）选 1:1。「裁满」会裁掉超出部分的画面，
      「适配」完整保留画面并填充黑边。
    </p>
  </FfBase>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
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
.resize-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
