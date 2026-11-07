<script setup lang="ts">
/** 视频格式转换：mp4/webm/mov/mkv/avi；多个注册 slug 复用本组件 */
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import FfBase from './FfBase.vue'

const route = useRoute()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const target = ref('mp4')
const tryCopy = ref(false)

/** 根据 slug 预置目标格式与流复制默认值 */
const slug = (route.params.slug as string) ?? ''
const PRESETS: Record<string, string> = {
  'mov-to-mp4': 'mp4', 'mkv-to-mp4': 'mp4', 'avi-to-mp4': 'mp4',
  'webm-to-mp4': 'mp4', 'wmv-to-mp4': 'mp4', 'flv-to-mp4': 'mp4',
  'mp4-to-webm': 'webm', 'mp4-to-mov': 'mov', 'gif-to-mp4': 'mp4',
}
if (PRESETS[slug]) {
  target.value = PRESETS[slug]
  tryCopy.value = ['mov-to-mp4', 'mkv-to-mp4', 'mp4-to-mov'].includes(slug)
}

const FORMATS = [
  { v: 'mp4', t: 'MP4（H.264 + AAC，最通用）' },
  { v: 'webm', t: 'WebM（VP9 + Opus，网页内嵌）' },
  { v: 'mov', t: 'MOV（苹果生态）' },
  { v: 'mkv', t: 'MKV（开放容器）' },
  { v: 'avi', t: 'AVI（老式兼容）' },
]

const run = async () => {
  const b = base.value
  if (!b) return
  const out = target.value
  const args: string[] = ['-y', '-i', 'input']
  if (tryCopy.value) {
    args.push('-c', 'copy')
  } else if (out === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-c:a', 'libopus', '-b:a', '128k')
  } else {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k')
  }
  if (out === 'mp4') args.push('-movflags', '+faststart')
  const name = b.outputName.endsWith(`.${out}`) ? b.outputName : `${b.outputName.replace(/\.\w+$/, '')}.${out}`
  await b.runWithFf([...args, name], { status: `正在转换为 ${out.toUpperCase()}…` })
}
</script>

<template>
  <FfBase ref="base" :output-ext="target" button-text="开始转换" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">目标格式</span>
        <select v-model="target" class="select" style="width: 230px">
          <option v-for="f in FORMATS" :key="f.v" :value="f.v">{{ f.t }}</option>
        </select>
      </div>
      <label class="check" style="margin-bottom: 8px">
        <input v-model="tryCopy" type="checkbox" />
        尽量流复制（不重编码，速度极快，失败请关闭）
      </label>
    </div>
    <p class="conv-note">
      提示：流复制只更换容器、不改变编码，对编码兼容的源文件有效（如 MOV→MP4）；若输出失败或无法播放，
      请关闭流复制改用重编码。旧格式（AVI/WMV/FLV）建议直接重编码。
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
.conv-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
