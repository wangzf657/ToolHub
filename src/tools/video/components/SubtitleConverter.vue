<script setup lang="ts">
/** 字幕格式转换（不用 ffmpeg）：SRT/VTT/SBV/TXT 互转 + 平移 + 帧率换算 + 去样式 + 拆分长句 */
import { computed, ref } from 'vue'
import { Upload } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { parseSubs, serializeSubs, shiftCues, rescaleCues, stripCueStyling, splitCues, mergeCues, type SubFormat } from '@/lib/subtitles'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('')
const srcName = ref('subtitles')
const outFormat = ref<SubFormat>('srt')
const shift = ref(0)
const doRescale = ref(false)
const fpsFrom = ref(25)
const fpsTo = ref(30)
const doStrip = ref(true)
const doSplit = ref(false)
const maxChars = ref(42)
const doMerge = ref(false)

const cues = computed(() => {
  if (!input.value.trim()) return []
  try {
    return parseSubs(input.value).cues
  } catch {
    return []
  }
})

const output = computed(() => {
  if (!cues.value.length) return ''
  let list = [...cues.value]
  if (doStrip.value) list = stripCueStyling(list)
  if (doMerge.value) list = mergeCues(list, maxChars.value)
  if (doSplit.value) list = splitCues(list, maxChars.value)
  if (shift.value !== 0) list = shiftCues(list, shift.value)
  if (doRescale.value && fpsFrom.value !== fpsTo.value) list = rescaleCues(list, fpsFrom.value, fpsTo.value)
  return serializeSubs(list, outFormat.value)
})

const onFile = async (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  input.value = await f.text()
  srcName.value = baseName(f.name)
  toast.ok(`已读取 ${f.name}`)
}

const download = () => {
  if (!output.value) return
  const mime = outFormat.value === 'txt' ? 'text/plain;charset=utf-8' : 'text/plain;charset=utf-8'
  saveText(output.value, `${srcName.value}.${outFormat.value}`, mime)
  toast.ok('已开始下载')
}

const stats = computed(() => `${cues.value.length} 条字幕 · ${input.value.length} 字符`)
</script>

<template>
  <div class="sub-cvt">
    <div class="pane">
      <div class="pane-head">
        <span class="pane-title">输入字幕（自动识别 SRT / VTT / SBV）</span>
        <label class="btn btn-soft btn-sm">
          <Upload :size="14" /> 上传文件
          <input type="file" accept=".srt,.vtt,.sbv,.txt" style="display: none" @change="onFile" />
        </label>
      </div>
      <textarea v-model="input" class="textarea mono" placeholder="粘贴字幕内容，或点击右上角上传文件…"></textarea>
      <p class="pane-meta">{{ stats }}</p>
    </div>

    <div class="opts">
      <div class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="outFormat" class="select" style="width: 130px">
          <option value="srt">SRT</option>
          <option value="vtt">WebVTT</option>
          <option value="sbv">SBV</option>
          <option value="txt">纯文本</option>
        </select>
      </div>
      <div class="opt">
        <span class="field-label">时间平移（秒，可为负）</span>
        <input v-model.number="shift" type="number" step="0.5" class="input" style="width: 110px" />
      </div>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="doStrip" type="checkbox" />
        去除样式标签
      </label>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="doSplit" type="checkbox" />
        拆分长句
      </label>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="doMerge" type="checkbox" />
        合并短句
      </label>
      <div v-if="doSplit || doMerge" class="opt">
        <span class="field-label">每行字符上限</span>
        <input v-model.number="maxChars" type="number" min="10" max="120" class="input" style="width: 90px" />
      </div>
      <label class="check" style="margin-bottom: 6px">
        <input v-model="doRescale" type="checkbox" />
        帧率换算
      </label>
      <template v-if="doRescale">
        <div class="opt">
          <span class="field-label">原帧率</span>
          <select v-model.number="fpsFrom" class="select" style="width: 90px">
            <option :value="23.976">23.976</option>
            <option :value="24">24</option>
            <option :value="25">25</option>
            <option :value="29.97">29.97</option>
            <option :value="30">30</option>
          </select>
        </div>
        <div class="opt">
          <span class="field-label">目标帧率</span>
          <select v-model.number="fpsTo" class="select" style="width: 90px">
            <option :value="23.976">23.976</option>
            <option :value="24">24</option>
            <option :value="25">25</option>
            <option :value="29.97">29.97</option>
            <option :value="30">30</option>
          </select>
        </div>
      </template>
    </div>

    <div class="pane mt-2">
      <div class="pane-head">
        <span class="pane-title">输出（{{ outFormat.toUpperCase() }}）</span>
        <button class="btn btn-primary btn-sm" :disabled="!output" @click="download">下载文件</button>
      </div>
      <ResultBox v-model="output" :readonly="true" download="" />
    </div>
  </div>
</template>

<style scoped>
.pane {
  display: grid;
  gap: 6px;
}
.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pane-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.pane-meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
}
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
</style>
