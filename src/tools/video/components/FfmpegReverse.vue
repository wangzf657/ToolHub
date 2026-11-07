<script setup lang="ts">
/** 视频倒放：倒放 / 回弹 / 双次循环，video+audio 反转后 concat */
import { ref } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'reverse' | 'boomerang' | 'x2'>('reverse')

const run = async () => {
  const b = base.value
  if (!b) return
  if (mode.value === 'reverse') {
    await b.runWithFf(
      [
        '-y', '-i', 'input', '-vf', 'reverse', '-af', 'areverse',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
      ],
      { status: '正在倒放（视频与音频同步反转）…' },
    )
    return
  }
  const fc =
    mode.value === 'boomerang'
      ? '[0:v]split[v1][v2];[0:a]split[a1][a2];[v2]reverse[rv];[a2]areverse[ra];[v1][rv][a1][ra]concat=n=2:v=1:a=1[v][a]'
      : '[0:v]split[v1][v2];[0:a]split[a1][a2];[v1][a1][v2][a2]concat=n=2:v=1:a=1[v][a]'
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { status: mode.value === 'boomerang' ? '正在生成回弹效果…' : '正在拼接两遍…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始处理" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">模式</span>
        <select v-model="mode" class="select" style="width: 220px">
          <option value="reverse">倒放（含声音反转）</option>
          <option value="boomerang">回弹（正放 + 倒放）</option>
          <option value="x2">循环 2 次（正放两遍）</option>
        </select>
      </div>
    </div>
    <p class="rev-note">
      倒放需要把整段视频读入内存处理，长视频耗时与内存占用都较高，建议先用「裁剪视频」截取 30 秒内的片段。
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
.rev-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
