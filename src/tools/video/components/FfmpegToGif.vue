<script setup lang="ts">
/** 视频转 GIF：截取片段 + 两步调色板（palettegen/paletteuse）单命令完成 */
import { ref, watch } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const start = ref(0)
const dur = ref(5)
const width = ref(480)
const fps = ref(12)

watch(
  () => base.value?.meta,
  (m) => {
    if (m && dur.value > m.duration) dur.value = Math.min(30, Math.max(1, Math.floor(m.duration)))
  },
)

const run = async () => {
  const b = base.value
  if (!b || !b.meta) return
  const d = Math.min(Math.max(0.2, dur.value), b.meta.duration - start.value)
  const vf = `fps=${fps.value},scale=${Math.max(16, width.value)}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`
  await b.runWithFf(
    ['-y', '-ss', String(start.value), '-t', String(d), '-i', 'input', '-vf', vf, b.outputName],
    { status: '正在生成 GIF（两步调色板）…' },
  )
}
</script>

<template>
  <FfBase ref="base" output-ext="gif" button-text="生成 GIF" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">开始时间（秒）</span>
        <input v-model.number="start" type="number" min="0" step="0.5" class="input" style="width: 100px" />
      </div>
      <div class="opt">
        <span class="field-label">截取时长（秒）</span>
        <input v-model.number="dur" type="number" min="0.2" max="30" step="0.5" class="input" style="width: 100px" />
      </div>
      <div class="opt">
        <span class="field-label">宽度（px）</span>
        <input v-model.number="width" type="number" min="64" max="1920" step="16" class="input" style="width: 100px" />
      </div>
      <SliderRow v-model="fps" label="帧率" :min="8" :max="15" :step="1" unit=" fps" width="140px" />
    </div>
    <p class="gif-note">
      从截取片段采样生成调色板再映射，画质比单次转换好得多。建议控制在 10 秒内：GIF 体积随长度与宽度迅速增大。
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
.gif-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
