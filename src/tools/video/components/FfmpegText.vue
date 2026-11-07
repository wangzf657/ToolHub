<script setup lang="ts">
/** 视频加文字：drawtext + textfile（避免转义），支持字号/颜色/位置/时间段 */
import { computed, ref, watch } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const text = ref('')
const fontSize = ref(48)
const color = ref('#ffffff')
const pos = ref('bc')
const useTime = ref(false)
const tStart = ref(0)
const tEnd = ref(0)

const hasCJK = computed(() => /[\u4e00-\u9fff\u3040-\u30ff]/.test(text.value))

watch(
  () => base.value?.meta,
  (m) => {
    if (m && !useTime.value) tEnd.value = Math.round(m.duration)
  },
)

const POS = [
  { v: 'tl', t: '左上' }, { v: 'tc', t: '上中' }, { v: 'tr', t: '右上' },
  { v: 'ml', t: '左中' }, { v: 'c', t: '居中' }, { v: 'mr', t: '右中' },
  { v: 'bl', t: '左下' }, { v: 'bc', t: '下中' }, { v: 'br', t: '右下' },
]

const xyOf = (p: string, m: number): string => {
  switch (p) {
    case 'tl': return `${m}:${m}`
    case 'tc': return `(w-text_w)/2:${m}`
    case 'tr': return `w-text_w-${m}:${m}`
    case 'ml': return `${m}:(h-text_h)/2`
    case 'c': return `(w-text_w)/2:(h-text_h)/2`
    case 'mr': return `w-text_w-${m}:(h-text_h)/2`
    case 'bl': return `${m}:h-text_h-${m}`
    case 'bc': return `(w-text_w)/2:h-text_h-${m}`
    default: return `w-text_w-${m}:h-text_h-${m}`
  }
}

const hexName = (hex: string) => hex.replace('#', '0x')

const run = async () => {
  const b = base.value
  if (!b || !text.value.trim()) return
  const [x, y] = xyOf(pos.value, 32).split(':')
  let filter = `drawtext=textfile=tf.txt:fontcolor=${hexName(color.value)}:fontsize=${fontSize.value}:x=${x}:y=${y}:shadowx=2:shadowy=2`
  if (useTime.value) filter += `:enable='between(t,${tStart.value},${tEnd.value})'`
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', filter,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { extraFiles: [{ name: 'tf.txt', data: text.value }], status: '正在渲染文字…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始添加" @run="run">
    <div class="mt-2">
      <span class="field-label">文字内容</span>
      <textarea v-model="text" class="textarea" style="min-height: 72px" placeholder="输入要显示在视频上的文字…"></textarea>
    </div>
    <div v-if="hasCJK" class="notice notice-warn mt-1">
      内核内置字体缺少中文字形，中文可能显示为方块。建议改用「视频加字幕」（支持中文烧录），
      或此处仅输入英文与数字。
    </div>
    <div class="opts">
      <SliderRow v-model="fontSize" label="字号" :min="16" :max="160" :step="2" unit="px" width="140px" />
      <div class="opt">
        <span class="field-label">颜色</span>
        <input v-model="color" type="color" />
      </div>
      <div class="opt">
        <span class="field-label">位置</span>
        <select v-model="pos" class="select" style="width: 100px">
          <option v-for="p in POS" :key="p.v" :value="p.v">{{ p.t }}</option>
        </select>
      </div>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="useTime" type="checkbox" />
        只在指定时间段显示
      </label>
      <template v-if="useTime">
        <div class="opt">
          <span class="field-label">开始（秒）</span>
          <input v-model.number="tStart" type="number" min="0" step="0.5" class="input" style="width: 90px" />
        </div>
        <div class="opt">
          <span class="field-label">结束（秒）</span>
          <input v-model.number="tEnd" type="number" min="0" step="0.5" class="input" style="width: 90px" />
        </div>
      </template>
    </div>
    <p class="text-note">文字带浅色投影增强可读性；若提示字体相关错误，请改用「视频加水印」贴图方案。</p>
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
.text-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
}
</style>
