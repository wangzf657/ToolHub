<script setup lang="ts">
/** 视频音频降噪：afftdn 去底噪 + loudnorm 响度标准化，画面流复制 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const nr = ref(12)
const nf = ref(-25)
const loud = ref(true)

const run = async () => {
  const b = base.value
  if (!b) return
  let af = `afftdn=nr=${nr.value}:nf=${nf.value}`
  if (loud.value) af += ',loudnorm=I=-16:TP=-1.5'
  await b.runWithFf(
    ['-y', '-i', 'input', '-af', af, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', b.outputName],
    { status: '正在降噪…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始降噪" @run="run">
    <div class="opts">
      <SliderRow v-model="nr" label="降噪强度" :min="1" :max="30" :step="1" width="180px" />
      <SliderRow v-model="nf" label="噪声本底" :min="-40" :max="-10" :step="1" unit=" dB" width="180px" />
      <label class="check" style="margin-bottom: 6px">
        <input v-model="loud" type="checkbox" />
        响度标准化（对齐 -16 LUFS）
      </label>
    </div>
    <p class="dn-note">
      适合清理风扇声、嘶声与持续底噪；对突发的撞击声效果有限。降噪强度过高可能让声音发闷，建议从 10 附近微调。
      画面直接流复制，只处理音频。
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
.dn-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
