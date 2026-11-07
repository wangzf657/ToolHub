<script setup lang="ts">
/** 绿幕抠像：chromakey 抠成透明 WebM，或替换为纯色背景 */
import { computed, ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'alpha' | 'color'>('alpha')
const keyColor = ref('#00ff00')
const similarity = ref(0.3)
const blend = ref(0.1)
const bgColor = ref('#2233aa')

const hex = (c: string) => c.replace('#', '0x')

/** 输出扩展名：透明模式必须 WebM（VP9 alpha） */
const outExt = computed(() => (mode.value === 'alpha' ? 'webm' : 'mp4'))

const run = async () => {
  const b = base.value
  if (!b) return
  const ck = `chromakey=${hex(keyColor.value)}:${similarity.value.toFixed(2)}:${blend.value.toFixed(2)}`
  if (mode.value === 'alpha') {
    await b.runWithFf(
      [
        '-y', '-i', 'input', '-vf', ck, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32',
        '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', b.outputName,
      ],
      { status: '正在抠像（输出带透明通道 WebM）…' },
    )
    return
  }
  const m = b.meta
  const w = Math.max(2, Math.round((m?.width ?? 1280) / 2) * 2)
  const h = Math.max(2, Math.round((m?.height ?? 720) / 2) * 2)
  const fc = `color=c=${hex(bgColor.value)}:s=${w}x${h}[bg];[0:v]${ck}[fg];[bg][fg]overlay=0:0[v]`
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-filter_complex', fc, '-map', '[v]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { status: '正在替换背景…' },
  )
}
</script>

<template>
  <FfBase ref="base" :output-ext="outExt" button-text="开始抠像" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">抠像键色</span>
        <select v-model="keyColor" class="select" style="width: 130px">
          <option value="#00ff00">绿幕</option>
          <option value="#0000ff">蓝幕</option>
        </select>
      </div>
      <SliderRow v-model="similarity" label="相似度" :min="0.05" :max="0.5" :step="0.01" width="160px" />
      <SliderRow v-model="blend" label="边缘混合" :min="0.01" :max="0.3" :step="0.01" width="160px" />
      <div class="opt">
        <span class="field-label">输出方式</span>
        <select v-model="mode" class="select" style="width: 190px">
          <option value="alpha">透明通道（WebM）</option>
          <option value="color">替换为纯色背景（MP4）</option>
        </select>
      </div>
      <div v-if="mode === 'color'" class="opt">
        <span class="field-label">背景颜色</span>
        <input v-model="bgColor" type="color" />
      </div>
    </div>
    <p class="gs-note">
      透明模式输出 WebM（VP9 + alpha），可在支持透明视频的网页与剪辑软件中使用；MP4 不支持透明通道。
      相似度越高抠得越狠（连浅绿色衣服也会被抠掉），边缘混合控制锯齿柔化。
    </p>
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
.gs-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
