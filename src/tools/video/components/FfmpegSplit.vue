<script setup lang="ts">
/** 视频分段：按时长或等分切成多段，流复制循环截取后打包 ZIP */
import { computed, ref } from 'vue'
import FfBase from './FfBase.vue'
import { saveMany } from '@/lib/download'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'dur' | 'count'>('dur')
const segMin = ref(1)
const segCount = ref(3)
const toast = useToast()

const stem = computed(() => baseName(base.value?.outputName || 'video').replace(/\.\w+$/, ''))

const run = async () => {
  const b = base.value
  if (!b || !b.meta) return
  const dur = b.meta.duration
  const segLen =
    mode.value === 'dur'
      ? Math.max(0.5, segMin.value * 60)
      : dur / Math.max(2, Math.floor(segCount.value))
  const n = Math.min(60, Math.ceil(dur / segLen))
  if (n < 1) return
  const parts: { name: string; blob: Blob }[] = []
  for (let i = 0; i < n; i++) {
    const s = i * segLen
    const e = Math.min(dur, (i + 1) * segLen)
    const name = `${stem}-part${String(i + 1).padStart(2, '0')}.mp4`
    b.setBusy(true, `正在切分第 ${i + 1}/${n} 段…`)
    const res = await b.runWithFf(
      ['-y', '-ss', String(s), '-to', String(e - s), '-i', 'input', '-c', 'copy', name],
      { status: `正在切分第 ${i + 1}/${n} 段…` },
    )
    if (!res) return
    const data = res.get(name)
    if (!data) continue
    parts.push({ name, blob: new Blob([data as BlobPart], { type: 'video/mp4' }) })
  }
  if (parts.length) {
    await saveMany(parts, `${stem}-parts.zip`)
    toast.ok(`已切分为 ${parts.length} 段并打包下载`)
  }
}
</script>

<template>
  <FfBase ref="base" button-text="开始切分" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">切分方式</span>
        <select v-model="mode" class="select" style="width: 150px">
          <option value="dur">按每段时长</option>
          <option value="count">等分成 N 段</option>
        </select>
      </div>
      <div class="opt">
        <template v-if="mode === 'dur'">
          <span class="field-label">每段时长（分钟）</span>
          <input v-model.number="segMin" type="number" min="0.1" step="0.5" class="input" style="width: 120px" />
        </template>
        <template v-else>
          <span class="field-label">段数 N</span>
          <input v-model.number="segCount" type="number" min="2" max="60" class="input" style="width: 120px" />
        </template>
      </div>
    </div>
    <p class="split-note">
      使用流复制切分，速度快不损画质，切点按关键帧对齐；最多 60 段，超出请增大每段时长。
      微信朋友圈等平台建议每段 ≤ 60 秒（0.9 分钟更保险）。
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
.split-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
