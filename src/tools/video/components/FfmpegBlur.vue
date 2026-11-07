<script setup lang="ts">
/** 视频局部打码：全屏模糊档位或指定区域模糊（可限定时段） */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'full' | 'region'>('region')
const strength = ref(8)
const x = ref(0)
const y = ref(0)
const w = ref(200)
const h = ref(120)
const useTime = ref(false)
const tStart = ref(0)
const tEnd = ref(0)

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

const run = async () => {
  const b = base.value
  if (!b) return
  const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', '-movflags', '+faststart']
  let args: string[]
  if (mode.value === 'full') {
    args = ['-y', '-i', 'input', '-vf', `boxblur=${strength.value}:2`, ...enc, b.outputName]
  } else {
    const bw = even(w.value)
    const bh = even(h.value)
    const bx = Math.max(0, x.value)
    const by = Math.max(0, y.value)
    let fc = `[0:v]split[base][bl];[bl]boxblur=${strength.value}:2[blb];[blb]crop=${bw}:${bh}:${bx}:${by}[reg];[base][reg]overlay=${bx}:${by}`
    if (useTime.value) fc += `:enable='between(t,${tStart.value},${tEnd.value})'`
    args = ['-y', '-i', 'input', '-filter_complex', fc, '-map', '[v]', '-map', '0:a?', ...enc, b.outputName]
  }
  await b.runWithFf(args, { status: '正在打码…' })
}
</script>

<template>
  <FfBase ref="base" button-text="开始打码" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">打码方式</span>
        <select v-model="mode" class="select" style="width: 150px">
          <option value="region">指定区域</option>
          <option value="full">全屏模糊</option>
        </select>
      </div>
      <SliderRow v-model="strength" label="模糊强度" :min="2" :max="20" :step="1" width="150px" />
      <template v-if="mode === 'region'">
        <div class="opt row" style="gap: 8px">
          <span>
            <span class="field-label">X</span>
            <input v-model.number="x" type="number" min="0" class="input" style="width: 80px" />
          </span>
          <span>
            <span class="field-label">Y</span>
            <input v-model.number="y" type="number" min="0" class="input" style="width: 80px" />
          </span>
          <span>
            <span class="field-label">宽</span>
            <input v-model.number="w" type="number" min="2" class="input" style="width: 80px" />
          </span>
          <span>
            <span class="field-label">高</span>
            <input v-model.number="h" type="number" min="2" class="input" style="width: 80px" />
          </span>
        </div>
        <label class="check" style="margin-bottom: 6px">
          <input v-model="useTime" type="checkbox" />
          限定时间段
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
      </template>
    </div>
    <p class="blur-note">
      区域坐标按输出视频的像素坐标填写（左上角为原点），可先用「视频截帧」查看尺寸。需要马赛克效果可把强度调到 15 以上。
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
.blur-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
