<script setup lang="ts">
/** 旋转/翻转视频：transpose 与 hflip/vflip */
import { ref } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const op = ref('90')

const OPS = [
  { v: '90', t: '顺时针 90°' },
  { v: '180', t: '旋转 180°' },
  { v: '270', t: '顺时针 270°（逆时针 90°）' },
  { v: 'hflip', t: '水平翻转' },
  { v: 'vflip', t: '垂直翻转' },
]

const vfOf = (v: string) =>
  v === '90' ? 'transpose=1' : v === '180' ? 'transpose=1,transpose=1' : v === '270' ? 'transpose=2' : v

const run = async () => {
  const b = base.value
  if (!b) return
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', vfOf(op.value),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { status: '正在旋转/翻转…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始处理" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">变换方式</span>
        <span class="row" style="flex-wrap: wrap; gap: 8px">
          <button
            v-for="o in OPS"
            :key="o.v"
            class="chip"
            :class="{ active: op === o.v }"
            @click="op = o.v"
          >
            {{ o.t }}
          </button>
        </span>
      </div>
    </div>
    <p class="rot-note">
      旋转会重新编码以兼容所有播放器（手机竖拍视频的播放器自动转向除外）。只想改播放方向标记而不重编码，
      可使用「视频编辑器」的导出选项。
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
.rot-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
