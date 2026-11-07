<script setup lang="ts">
/** 视频去静音：silenceremove 掐头去尾（可选内部压缩），画面流复制 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const threshold = ref(-45)
const inner = ref(false)

const run = async () => {
  const b = base.value
  if (!b) return
  const th = `${threshold.value}dB`
  const edge = `silenceremove=start_periods=1:start_threshold=${th}:start_silence=0.3`
  const af = inner.value
    ? `${edge}:stop_periods=-1:stop_threshold=${th}:stop_duration=0.4`
    : `${edge},areverse,${edge},areverse`
  await b.runWithFf(
    ['-y', '-i', 'input', '-af', af, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', b.outputName],
    { status: '正在移除静音…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始处理" @run="run">
    <div class="opts">
      <SliderRow v-model="threshold" label="静音判定阈值" :min="-70" :max="-30" :step="1" unit=" dB" width="200px" />
      <label class="check" style="margin-bottom: 6px">
        <input v-model="inner" type="checkbox" />
        同时压缩中间停顿（口播加速）
      </label>
    </div>
    <p class="rs-note">
      默认只剪掉开头与结尾的静音（保留 0.3s 缓冲），节奏自然。开启「压缩中间停顿」后超过 0.4 秒的停顿
      会被整段剪除，语速明显加快——适合口播/网课，但对话类素材慎用。画面流复制不重编码。
    </p>
  </FfBase>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: flex-end;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  margin-top: 14px;
}
.rs-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
