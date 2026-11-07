<script setup lang="ts">
/** 压缩视频：质量档位或目标体积（估算码率） */
import { ref } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'quality' | 'size'>('quality')
const quality = ref(28)
const targetMB = ref(10)

const QUALITIES = [
  { v: 23, t: '高画质 (CRF 23)' },
  { v: 28, t: '中等画质 (CRF 28)' },
  { v: 33, t: '低体积 (CRF 33)' },
]

const run = async () => {
  const b = base.value
  if (!b) return
  const meta = b.meta
  if (mode.value === 'size') {
    if (!meta || meta.duration <= 0) return
    const dur = meta.duration
    const kbps = Math.max(64, Math.floor((((targetMB.value * 1024 * 1024 * 8) / dur) * 0.94 - 128_000) / 1000))
    await b.runWithFf(
      [
        '-y', '-i', 'input',
        '-c:v', 'libx264', '-preset', 'veryfast',
        '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.45)}k`, '-bufsize', `${kbps * 2}k`,
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
        b.outputName,
      ],
      { status: '正在压缩（按目标体积）…' },
    )
  } else {
    await b.runWithFf(
      [
        '-y', '-i', 'input',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(quality.value),
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
        b.outputName,
      ],
      { status: '正在压缩…' },
    )
  }
}
</script>

<template>
  <FfBase ref="base" output-ext="mp4" button-text="开始压缩" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">压缩方式</span>
        <select v-model="mode" class="select" style="width: 160px">
          <option value="quality">按质量档位</option>
          <option value="size">按目标体积</option>
        </select>
      </div>
      <div v-if="mode === 'quality'" class="opt">
        <span class="field-label">画质档位</span>
        <select v-model.number="quality" class="select" style="width: 180px">
          <option v-for="q in QUALITIES" :key="q.v" :value="q.v">{{ q.t }}</option>
        </select>
      </div>
      <div v-else class="opt">
        <span class="field-label">目标大小（MB）</span>
        <input v-model.number="targetMB" type="number" min="1" max="4096" class="input" style="width: 130px" />
      </div>
    </div>
    <p class="muted small" style="font-size: 12.5px; color: var(--text-3); margin-top: 8px">
      按目标体积模式会根据视频时长换算码率，实际大小会有偏差；输出统一为 H.264 + AAC 的 MP4。
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
</style>
