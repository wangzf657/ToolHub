<script setup lang="ts">
/** 视频防抖：deshake 滤镜（运动估计范围可调），可选裁边补偿 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const range = ref(16)
const edgeFix = ref(true)

const run = async () => {
  const b = base.value
  if (!b) return
  let vf = `deshake=rx=${range.value}:ry=${range.value}`
  if (edgeFix.value) vf += ',crop=trunc(iw*0.94/2)*2:trunc(ih*0.94/2)*2'
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
      '-c:a', 'copy', '-movflags', '+faststart', b.outputName,
    ],
    { status: '正在防抖处理…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始防抖" @run="run">
    <div class="opts">
      <SliderRow v-model="range" label="检测范围（像素）" :min="8" :max="48" :step="2" unit="px" width="200px" />
      <label class="check" style="margin-bottom: 6px">
        <input v-model="edgeFix" type="checkbox" />
        裁掉 6% 边缘（补偿抖动露边）
      </label>
    </div>
    <p class="st-note">
      deshake 通过帧间运动估计平滑镜头抖动，适合轻微手持晃动；大幅跑动镜头效果有限。
      防抖后画面边缘可能出现位移空隙，默认裁掉四周 6% 再输出（分辨率略降）。
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
.st-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
