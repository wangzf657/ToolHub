<script setup lang="ts">
/** 视频配乐：音乐淡入淡出 + 音量 + 保留原声混合或替换（视频流 copy） */
import { ref, shallowRef, watch } from 'vue'
import { Music } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import SliderRow from './SliderRow.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const music = shallowRef<File | null>(null)
const fadeIn = ref(2)
const fadeOut = ref(2)
const vol = ref(0.8)
const mix = ref(true)

const onMusic = (files: File[]) => (music.value = files[0] ?? null)

watch(
  () => base.value?.meta,
  (m) => {
    if (m && fadeOut.value > m.duration) fadeOut.value = Math.min(5, Math.floor(m.duration / 2))
  },
)

const run = async () => {
  const b = base.value
  if (!b || !b.meta || !music.value) return
  const d = b.meta.duration
  const fo = Math.min(fadeOut.value, Math.max(0, d / 2))
  const chain = `volume=${vol.value.toFixed(2)},afade=t=in:st=0:d=${fadeIn.value}${
    fo > 0.2 ? `,afade=t=out:st=${Math.max(0.1, d - fo).toFixed(2)}:d=${fo.toFixed(2)}` : ''
  }`
  const fc = mix.value
    ? `[1:a]${chain}[m];[0:a][m]amix=inputs=2:duration=first[a]`
    : `[1:a]${chain}[m]`
  const args = [
    '-y', '-i', 'input', '-i', 'music', '-filter_complex', fc,
    '-map', '0:v', '-map', mix.value ? '[a]' : '[m]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', b.outputName,
  ]
  await b.runWithFf(args, { extraFiles: [{ name: 'music', data: music.value }], status: '正在合成配乐…' })
}
</script>

<template>
  <FfBase ref="base" button-text="开始配乐" @run="run">
    <div class="mt-2">
      <div class="field-label">背景音乐</div>
      <FileDrop
        v-if="!music"
        accept="audio/*"
        :multiple="false"
        label="拖放音乐文件"
        hint="MP3 / M4A / WAV / OGG"
        @files="onMusic"
      />
      <div v-else class="music-row">
        <Music :size="16" />
        <span class="grow" style="overflow: hidden; text-overflow: ellipsis">{{ music.name }}</span>
        <button class="btn btn-ghost btn-sm" @click="music = null">更换</button>
      </div>
    </div>
    <div class="opts">
      <SliderRow v-model="fadeIn" label="淡入" :min="0" :max="10" :step="0.5" unit="s" width="130px" />
      <SliderRow v-model="fadeOut" label="淡出" :min="0" :max="10" :step="0.5" unit="s" width="130px" />
      <SliderRow v-model="vol" label="音乐音量" :min="0.05" :max="1.5" :step="0.05" width="140px" />
      <div class="opt">
        <span class="field-label">原声处理</span>
        <select v-model="mix" class="select" style="width: 170px">
          <option :value="true">保留原声并混合</option>
          <option :value="false">替换原声（只用音乐）</option>
        </select>
      </div>
    </div>
    <p class="music-note">
      混合模式需要原视频带有音轨（无音轨请选「替换原声」）。画面直接流复制不重编码，速度较快；
      音乐比视频长时会被截断到视频结束。
    </p>
  </FfBase>
</template>

<style scoped>
.music-row {
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
.music-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
