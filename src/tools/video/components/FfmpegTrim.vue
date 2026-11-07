<script setup lang="ts">
/** 裁剪视频：起止秒输入 + 预览定位 + 快速（关键帧）/精确两种模式 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const start = ref(0)
const end = ref(0)
const fast = ref(true)
const cur = ref(0)

const onTime = (t: number) => (cur.value = t)

const setStart = () => (start.value = Number(cur.value.toFixed(2)))
const setEnd = () => (end.value = Number(cur.value.toFixed(2)))

const run = async () => {
  const b = base.value
  if (!b || !b.meta) return
  const dur = b.meta.duration
  const s = Math.max(0, Math.min(start.value, dur))
  const e = Math.max(s + 0.1, Math.min(end.value || dur, dur))
  if (e - s < 0.2) return
  const name = b.outputName
  if (fast.value) {
    // -ss 在 -i 前：-to 相对定位点计时
    await b.runWithFf(
      ['-y', '-ss', String(s), '-to', String(e - s), '-i', 'input', '-c', 'copy', name],
      { status: '正在快速裁剪（流复制）…' },
    )
  } else {
    await b.runWithFf(
      [
        '-y', '-i', 'input', '-ss', String(s), '-to', String(e),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', name,
      ],
      { status: '正在精确裁剪（重编码）…' },
    )
  }
}
</script>

<template>
  <FfBase ref="base" button-text="开始裁剪" @run="run" @time="onTime">
    <div class="opts">
      <div class="opt">
        <span class="field-label">开始（秒）</span>
        <input v-model.number="start" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        <button class="btn btn-soft btn-sm" @click="setStart">设为当前</button>
      </div>
      <div class="opt">
        <span class="field-label">结束（秒，0 = 视频末尾）</span>
        <input v-model.number="end" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        <button class="btn btn-soft btn-sm" @click="setEnd">设为当前</button>
      </div>
      <label class="check" style="margin-bottom: 4px">
        <input v-model="fast" type="checkbox" />
        快速模式（流复制，秒级完成）
      </label>
      <span class="cur-time">预览当前时间：{{ cur.toFixed(2) }}s</span>
    </div>
    <p class="trim-note">
      快速模式直接复制视频流，速度极快，但切点会对齐到最近的关键帧（前后可能偏差 1–2 秒）；
      需要精确到帧请关闭快速模式（将重新编码，耗时较长）。
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
.cur-time {
  font-size: 12.5px;
  color: var(--text-3);
  margin-bottom: 6px;
}
.trim-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
