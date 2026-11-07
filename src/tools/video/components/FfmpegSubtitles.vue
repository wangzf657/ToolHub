<script setup lang="ts">
/** 视频加字幕：SRT/VTT/SBV 解析后统一为 SRT 烧录进画面；另提供纯转换下载 */
import { computed, ref, shallowRef } from 'vue'
import { Captions, FileText } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import SliderRow from './SliderRow.vue'
import { parseSubs, serializeSubs } from '@/lib/subtitles'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const subFile = shallowRef<File | null>(null)
const subText = ref('')
const fontSize = ref(24)
const outline = ref(1)
const toast = useToast()

const cues = computed(() => {
  if (!subText.value) return []
  try {
    return parseSubs(subText.value).cues
  } catch {
    return []
  }
})

const onSub = async (files: File[]) => {
  const f = files[0]
  if (!f) {
    subFile.value = null
    subText.value = ''
    return
  }
  subFile.value = f
  subText.value = await f.text()
}

/** 仅转换：不烧录，直接下载标准 SRT */
const convertOnly = () => {
  if (!cues.value.length) return
  const stem = subFile.value ? baseName(subFile.value.name) : 'subtitles'
  saveText(serializeSubs(cues.value, 'srt'), `${stem}.srt`, 'text/plain;charset=utf-8')
  toast.ok('已导出标准 SRT 字幕')
}

const run = async () => {
  const b = base.value
  if (!b || !cues.value.length) return
  const srt = serializeSubs(cues.value, 'srt')
  const style = `FontSize=${fontSize.value},Outline=${outline.value}`
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', `subtitles=subs.srt:force_style='${style}'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { extraFiles: [{ name: 'subs.srt', data: srt }], status: '正在烧录字幕…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="烧录字幕" @run="run">
    <div class="mt-2">
      <div class="field-label">字幕文件（SRT / VTT / SBV，自动识别）</div>
      <FileDrop
        v-if="!subFile"
        accept=".srt,.vtt,.sbv,text/vtt,application/x-subrip"
        :multiple="false"
        label="拖放字幕文件"
        hint="解析在本地完成"
        @files="onSub"
      />
      <div v-else class="sub-row">
        <FileText :size="16" />
        <span class="grow">{{ subFile.name }}</span>
        <span class="sub-count">{{ cues.length }} 条字幕</span>
        <button class="btn btn-ghost btn-sm" @click="subFile = null; subText = ''">更换</button>
      </div>
    </div>
    <div class="opts">
      <SliderRow v-model="fontSize" label="字幕字号" :min="12" :max="60" :step="2" width="150px" />
      <SliderRow v-model="outline" label="描边粗细" :min="0" :max="4" :step="1" width="130px" />
      <button class="btn btn-soft" style="margin-bottom: 4px" :disabled="!cues.length" @click="convertOnly">
        <Captions :size="15" /> 仅转换字幕（导出标准 SRT）
      </button>
    </div>
    <p class="sub-note">
      烧录会把字幕画进画面（需重编码）；如需外挂字幕请用「仅转换字幕」导出后与视频同名放置。
    </p>
  </FfBase>
</template>

<style scoped>
.sub-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13.5px;
  max-width: 520px;
}
.sub-count {
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
.sub-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
}
</style>
