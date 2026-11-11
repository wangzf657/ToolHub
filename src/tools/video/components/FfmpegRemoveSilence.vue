<script setup lang="ts">
/** 视频去静音：silencedetect 检测静音区间后，音视频按同一组剪点同步剪除（保持口型对齐） */
import { ref } from 'vue'
import FfBase from './FfBase.vue'
import SliderRow from './SliderRow.vue'
import { getFf, detectSilences, buildSyncRemoveFilter } from '@/lib/ffmpeg'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { useToast } from '@/composables/useToast'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const threshold = ref(-45)
const inner = ref(false)
const toast = useToast()

const run = async () => {
  const b = base.value
  if (!b) return
  const f = b.file()
  if (!f) {
    toast.warn('请先导入视频文件')
    return
  }
  b.setBusy(true, '加载编解码核心…')
  let ff: FFmpeg
  try {
    ff = await getFf()
  } catch {
    toast.err('编解码核心加载失败，请检查网络后重试')
    b.setBusy(false)
    return
  }
  // 第一步：干跑 silencedetect 分析静音区间（只解音频，速度快）
  b.setBusy(true, '正在分析静音区间…')
  let det: Awaited<ReturnType<typeof detectSilences>> = null
  try {
    det = await detectSilences(ff, 'input', new Uint8Array(await f.arrayBuffer()), threshold.value)
  } catch {
    det = null
  }
  if (!det) {
    toast.err('无法分析音频，请确认视频包含音轨后再试')
    b.setBusy(false)
    return
  }
  // 第二步：音视频按同一组保留区间剪除后 concat——视频时间轴随音频同步压缩，口型不再漂移
  const plan = buildSyncRemoveFilter(det.duration, det.silences, { edgePad: 0.3, inner: inner.value, innerMin: 0.4 })
  if (!plan) {
    toast.warn('整段都是静音，没有可保留的内容')
    b.setBusy(false)
    return
  }
  if (plan.cutCount === 0) {
    toast.warn('未检测到需要剪除的静音段')
    b.setBusy(false)
    return
  }
  await b.runWithFf(
    [
      '-y', '-i', 'input',
      '-filter_complex', plan.filter,
      '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', b.outputName,
    ],
    { status: `正在移除静音（共剪除 ${plan.cutCount} 处、约 ${plan.cutTotal.toFixed(1)} 秒）…` },
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
      会被整段剪除，语速明显加快——适合口播/网课，但对话类素材慎用。画面与声音按同一组剪点同步剪除
      （视频需重编码），口型与声音保持对齐。
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
