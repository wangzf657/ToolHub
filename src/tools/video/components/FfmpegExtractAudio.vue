<script setup lang="ts">
/** 提取视频音轨：mp3 / m4a / wav；多个注册 slug 复用本组件 */
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import FfBase from './FfBase.vue'

const route = useRoute()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const format = ref('mp3')

const slug = (route.params.slug as string) ?? ''
const PRESETS: Record<string, string> = { 'mp4-to-mp3': 'mp3', 'mov-to-mp3': 'mp3', 'mp4-to-wav': 'wav' }
if (PRESETS[slug]) format.value = PRESETS[slug]

const run = async () => {
  const b = base.value
  if (!b) return
  const out = format.value
  const name = `${b.outputName.replace(/\.\w+$/, '')}.${out}`
  const extra: string[] = out === 'mp3' ? ['-c:a', 'libmp3lame', '-q:a', '3'] : out === 'wav' ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'aac', '-b:a', '192k']
  b.outputName = name
  await b.runWithFf(['-y', '-i', 'input', '-vn', ...extra, name], { status: '正在提取音频…' })
}
</script>

<template>
  <FfBase ref="base" :output-ext="format" button-text="提取音频" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">音频格式</span>
        <select v-model="format" class="select" style="width: 180px">
          <option value="mp3">MP3（通用，压缩）</option>
          <option value="m4a">M4A / AAC（体积小）</option>
          <option value="wav">WAV（无损，体积大）</option>
        </select>
      </div>
    </div>
    <p class="ext-note">MP3 使用 VBR 质量 3（约 175kbps），M4A 为 192kbps AAC；WAV 适合剪辑与语音识别。</p>
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
.ext-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
}
</style>
