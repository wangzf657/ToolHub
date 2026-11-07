<script setup lang="ts">
/** 双视频拼接：左右 hstack / 上下 vstack，第二路先缩放到对齐尺寸 */
import { computed, ref, shallowRef } from 'vue'
import { Columns2, Rows2, X } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadVideo, type VideoMeta } from '@/lib/videoEngine'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const second = shallowRef<File | null>(null)
const meta2 = shallowRef<VideoMeta | null>(null)
const dir = ref<'h' | 'v'>('h')
const mixAudio = ref(true)

const onSecond = async (files: File[]) => {
  if (meta2.value) {
    URL.revokeObjectURL(meta2.value.url)
    meta2.value = null
  }
  const f = files[0]
  if (!f) {
    second.value = null
    return
  }
  second.value = f
  try {
    meta2.value = await loadVideo(f)
  } catch (e) {
    second.value = null
    toast.err((e as Error).message || '第二个视频加载失败')
  }
}

const outExt = computed(() => {
  const n = base.value?.outputName ?? ''
  const m = n.match(/\.\w+$/)
  return m ? m[0].slice(1) : 'mp4'
})

const run = async () => {
  const b = base.value
  if (!b || !second.value || !b.meta) return
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  // 第一路保持原尺寸，第二路对齐：并排对齐高度，堆叠对齐宽度
  const scale =
    dir.value === 'h'
      ? `scale=-2:${even(b.meta.height)}`
      : `scale=${even(b.meta.width)}:-2`
  const stack = dir.value === 'h' ? 'hstack' : 'vstack'
  const fc = mixAudio.value
    ? `[1:v]${scale}[s];[0:v][s]${stack}[v];[0:a][1:a]amix=inputs=2:duration=longest[a]`
    : `[1:v]${scale}[s];[0:v][s]${stack}[v]`
  const name = b.outputName.endsWith(`.${outExt.value}`) ? b.outputName : `${b.outputName.replace(/\.\w+$/, '')}.${outExt.value}`
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-i', 'second', '-filter_complex', fc,
      '-map', '[v]', '-map', mixAudio.value ? '[a]' : '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', name,
    ],
    {
      files: [
        { name: 'input', data: b.file()! },
        { name: 'second', data: second.value },
      ],
      status: '正在拼接双视频…',
    },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始拼接" @run="run">
    <div class="mt-2">
      <div class="field-label">第二个视频</div>
      <FileDrop
        v-if="!second"
        accept="video/*"
        :multiple="false"
        label="拖放第二个视频"
        hint="与第一个视频拼接对比"
        @files="onSecond"
      />
      <div v-else class="sec-row">
        <span class="grow" style="overflow: hidden; text-overflow: ellipsis">{{ second.name }}</span>
        <span v-if="meta2" class="sec-meta">{{ meta2.width }}×{{ meta2.height }} · {{ Math.round(meta2.duration) }}s</span>
        <button class="btn btn-ghost btn-sm" @click="second = null"><X :size="14" /></button>
      </div>
    </div>
    <div class="opts">
      <div class="opt">
        <span class="field-label">排列方向</span>
        <span class="row" style="gap: 8px">
          <button class="chip" :class="{ active: dir === 'h' }" @click="dir = 'h'">
            <Columns2 :size="14" /> 左右并排
          </button>
          <button class="chip" :class="{ active: dir === 'v' }" @click="dir = 'v'">
            <Rows2 :size="14" /> 上下堆叠
          </button>
        </span>
      </div>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="mixAudio" type="checkbox" />
        混合两路音频
      </label>
    </div>
    <p class="sbs-note">
      第二路视频会自动缩放到与第一路对齐（并排对齐高度、堆叠对齐宽度），不裁切不变形；
      长度不一致时以较长的一路为准（短的一路定格结束帧之后的黑屏由播放器决定）。混合音频要求两路都有音轨。
    </p>
  </FfBase>
</template>

<style scoped>
.sec-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13.5px;
  max-width: 520px;
}
.sec-meta {
  font-size: 12px;
  color: var(--text-3);
  flex: none;
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
.sbs-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
