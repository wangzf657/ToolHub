<script setup lang="ts">
/** 视频循环拼接：重复 N 次流复制，或「正放+倒放」回弹效果 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import { useToast } from '@/composables/useToast'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'repeat' | 'boomerang'>('repeat')
const times = ref(3)
const toast = useToast()

const run = async () => {
  const b = base.value
  if (!b) return
  if (mode.value === 'repeat') {
    const n = Math.max(2, Math.min(50, Math.floor(times.value)))
    await b.runWithFf(
      ['-y', '-stream_loop', String(n - 1), '-i', 'input', '-c', 'copy', b.outputName],
      { status: `正在循环拼接 ${n} 次…` },
    )
    return
  }
  // 回弹：先生成倒放片段，再 concat
  const stem = b.outputName.replace(/\.\w+$/, '')
  b.outputName = `${stem}-boomerang.mp4`
  let rev: Uint8Array | undefined
  const r1 = await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', 'reverse', '-af', 'areverse',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', 'rev.mp4',
    ],
    {
      status: '正在生成倒放片段…',
      onDone: (results) => {
        rev = results.get('rev.mp4')
      },
    },
  )
  if (!r1 || !rev) return
  await b.runWithFf(['-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', b.outputName], {
    extraFiles: [
      { name: 'rev.mp4', data: rev },
      { name: 'list.txt', data: "file 'input'\nfile 'rev.mp4'" },
    ],
    status: '正在拼接回弹视频…',
  })
  toast.ok('回弹视频已生成')
}
</script>

<template>
  <FfBase ref="base" button-text="开始处理" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">循环方式</span>
        <select v-model="mode" class="select" style="width: 190px">
          <option value="repeat">重复播放 N 次</option>
          <option value="boomerang">回弹（正放 + 倒放）</option>
        </select>
      </div>
      <div v-if="mode === 'repeat'" class="opt">
        <span class="field-label">重复次数</span>
        <input v-model.number="times" type="number" min="2" max="50" class="input" style="width: 100px" />
      </div>
    </div>
    <p class="loop-note">
      重复模式使用流复制，瞬间完成；回弹模式需先生成倒放片段（会重编码），耗时与视频长度成正比。
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
.loop-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
