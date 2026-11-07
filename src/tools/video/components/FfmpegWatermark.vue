<script setup lang="ts">
/** 视频加水印：图片九宫格定位 + 缩放 + 透明度（overlay + colorchannelmixer） */
import { ref, shallowRef } from 'vue'
import { FileImage } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const wmFile = shallowRef<File | null>(null)
const pos = ref('br')
const margin = ref(24)
const scale = ref(100)
const opacity = ref(0.8)

const onWm = (files: File[]) => (wmFile.value = files[0] ?? null)

const POS = [
  { v: 'tl', t: '左上' }, { v: 'tc', t: '上中' }, { v: 'tr', t: '右上' },
  { v: 'ml', t: '左中' }, { v: 'c', t: '居中' }, { v: 'mr', t: '右中' },
  { v: 'bl', t: '左下' }, { v: 'bc', t: '下中' }, { v: 'br', t: '右下' },
]

const xyOf = (p: string, m: number): string => {
  switch (p) {
    case 'tl': return `${m}:${m}`
    case 'tc': return `(W-w)/2:${m}`
    case 'tr': return `W-w-${m}:${m}`
    case 'ml': return `${m}:(H-h)/2`
    case 'c': return `(W-w)/2:(H-h)/2`
    case 'mr': return `W-w-${m}:(H-h)/2`
    case 'bl': return `${m}:H-h-${m}`
    case 'bc': return `(W-w)/2:H-h-${m}`
    default: return `W-w-${m}:H-h-${m}`
  }
}

const run = async () => {
  const b = base.value
  if (!b) return
  if (!wmFile.value) return
  const [x, y] = xyOf(pos.value, margin.value).split(':')
  const fc = `[1:v]format=rgba,colorchannelmixer=aa=${opacity.value.toFixed(2)},scale=iw*${scale.value / 100}:-1[wm];[0:v][wm]overlay=${x}:${y}[v]`
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-i', 'wm.png', '-filter_complex', fc,
      '-map', '[v]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { extraFiles: [{ name: 'wm.png', data: wmFile.value }], status: '正在合成水印…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始合成" @run="run">
    <div class="mt-2">
      <div class="field-label">水印图片（PNG 透明底最佳）</div>
      <FileDrop
        v-if="!wmFile"
        accept="image/*"
        :multiple="false"
        label="拖放水印图片"
        hint="支持 PNG / JPG / WebP"
        @files="onWm"
      />
      <div v-else class="wm-row">
        <FileImage :size="16" />
        <span class="grow" style="overflow: hidden; text-overflow: ellipsis">{{ wmFile.name }}</span>
        <button class="btn btn-ghost btn-sm" @click="wmFile = null">更换</button>
      </div>
    </div>
    <div class="opts">
      <div class="opt">
        <span class="field-label">位置</span>
        <select v-model="pos" class="select" style="width: 110px">
          <option v-for="p in POS" :key="p.v" :value="p.v">{{ p.t }}</option>
        </select>
      </div>
      <SliderRow v-model="margin" label="边距" :min="0" :max="200" :step="4" unit="px" width="140px" />
      <SliderRow v-model="scale" label="缩放" :min="10" :max="100" :step="5" unit="%" width="140px" />
      <SliderRow v-model="opacity" label="不透明度" :min="0.1" :max="1" :step="0.05" width="140px" />
    </div>
  </FfBase>
</template>

<style scoped>
.wm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13.5px;
  max-width: 480px;
}
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
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
</style>
