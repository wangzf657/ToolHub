<script setup lang="ts">
/**
 * 旋转/翻转视频：默认「快速旋转」仅写方向标记（流复制，秒级、画质无损）；
 * 重编码档用 transpose/hflip；预览区 CSS transform 实时预演。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const op = ref('90')
const mode = ref<'meta' | 'reencode'>('meta')

const OPS = [
  { v: '90', t: '顺时针 90°' },
  { v: '180', t: '旋转 180°' },
  { v: '270', t: '顺时针 270°（逆时针 90°）' },
  { v: 'hflip', t: '水平翻转' },
  { v: 'vflip', t: '垂直翻转' },
]

const vfOf = (v: string) =>
  v === '90' ? 'transpose=1' : v === '180' ? 'transpose=1,transpose=1' : v === '270' ? 'transpose=2' : v

/** 元数据旋转仅适用于 90/180/270（翻转无法用方向标记表达） */
const metaUsable = computed(() => ['90', '180', '270'].includes(op.value))
watch([op, mode], () => {
  if (!metaUsable.value && mode.value === 'meta') mode.value = 'reencode'
})

/** 方向预演：直接给 FfBase 预览 video 加 CSS transform（纯预览，不影响产物） */
const applyPreview = () => {
  const v = base.value?.videoEl
  if (!v) return
  const map: Record<string, string> = {
    '90': 'rotate(90deg)',
    '180': 'rotate(180deg)',
    '270': 'rotate(270deg)',
    hflip: 'scaleX(-1)',
    vflip: 'scaleY(-1)',
  }
  v.style.transform = map[op.value] ?? ''
  v.style.objectFit = 'contain'
}
watch(op, applyPreview)
watch(
  () => base.value?.videoEl,
  (v) => {
    if (v) applyPreview()
  },
)
onBeforeUnmount(() => {
  const v = base.value?.videoEl
  if (v) v.style.transform = ''
})

const run = async () => {
  const b = base.value
  if (!b) return
  if (mode.value === 'meta') {
    // 快速旋转：流复制 + 写方向标记，10 秒素材秒级完成，画质比特级一致
    const rot = op.value === '90' ? '90' : op.value === '180' ? '180' : '270'
    await b.runWithFf(
      ['-y', '-i', 'input', '-metadata:s:v:0', `rotate=${rot}`, '-c', 'copy', b.outputName],
      { status: '正在写入旋转标记（流复制）…' },
    )
    toast.ok('已写入方向标记：各播放器将按新方向显示，画质无变化')
    return
  }
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', vfOf(op.value),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'copy', '-movflags', '+faststart', b.outputName,
    ],
    { status: '正在旋转/翻转（重编码）…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始处理" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">变换方式</span>
        <span class="row" style="flex-wrap: wrap; gap: 8px">
          <button v-for="o in OPS" :key="o.v" class="chip" :class="{ active: op === o.v }" @click="op = o.v">
            {{ o.t }}
          </button>
        </span>
      </div>
      <div class="opt">
        <span class="field-label">处理方式</span>
        <select v-model="mode" class="select" style="width: 230px" :disabled="!metaUsable">
          <option value="meta">快速旋转（仅改方向标记，推荐）</option>
          <option value="reencode">重编码（画面真实翻转，兼容旧播放器）</option>
        </select>
      </div>
    </div>
    <p class="rot-note">
      「快速旋转」只写方向标记（MP4 元数据），秒级完成且画质比特级一致，手机/电脑播放器均按新方向显示；
      竖拍源自带旋转标记的场景：ffmpeg 会先按原标记转为正立画面再做本次旋转，不会叠加旋转。
      「重编码」把变换烘焙进画面（-c:a copy 音轨原样保留），适合不支持方向标记的播放器。
      预览画面已实时预演本次变换。
    </p>
    <FfExpectHint text="快速旋转为流复制，秒级完成；重编码档耗时约为视频时长的 1/2~1/5。首次使用需加载约 25MB 编解码核心，处理期间请保持页面打开。" />
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
