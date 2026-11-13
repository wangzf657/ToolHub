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
const outFormat = ref<SubFormat | 'ass'>('srt')
const shift = ref(0)
const doRescale = ref(false)
const fpsFrom = ref(25)
const fpsTo = ref(30)
const doStrip = ref(true)
const doSplit = ref(false)
const maxChars = ref(42)
const doMerge = ref(false)

const parseError = ref('')
const detectedFormat = ref('')

/** 极简 ASS 解析：Dialogue 行 9 逗号切分，时间 h:mm:ss.cc → 秒 */
function parseAss(text: string) {
  const cues: { start: number; end: number; text: string }[] = []
  const toSec = (s: string) => {
    const m = /(\d+):(\d+):([\d.]+)/.exec(s.trim())
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('Dialogue:')) continue
    const parts = line.slice(9).split(',')
    if (parts.length < 10) continue
    const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').trim()
    cues.push({ start: toSec(parts[1]), end: toSec(parts[2]), text })
  }
  return cues
}

function fmtAssTime(sec: number): string {
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = (s % 60).toFixed(2).padStart(5, '0')
  return `${h}:${String(m).padStart(2, '0')}:${ss}`
}

function serializeAss(cues: { start: number; end: number; text: string }[]): string {
  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Microsoft YaHei,64,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,60,60,40,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]
  const lines = cues.map((c) => `Dialogue: 0,${fmtAssTime(c.start)},${fmtAssTime(c.end)},Default,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`)
  return [...head, ...lines, ''].join('\n')
}

const cues = computed(() => {
  if (!input.value.trim()) return []
  try {
    if (/^\s*\[Script Info\]|^Dialogue:/m.test(input.value)) {
      detectedFormat.value = 'ASS/SSA'
      return parseAss(input.value)
    }
    const r = parseSubs(input.value)
    detectedFormat.value = r.format.toUpperCase()
    parseError.value = ''
    return r.cues
  } catch (e) {
    parseError.value = (e as Error).message || '解析失败：未识别出字幕时间轴'
    return []
  }
})

const clampedCount = computed(() => {
  if (shift.value >= 0) return 0
  return cues.value.filter((c) => c.start + shift.value < 0).length
})

/** 中文语境下合并不加空格（CJK 相邻直接拼接） */
const joinCjk = (s: string) => s.replace(/([\u4e00-\u9fff]) ([\u4e00-\u9fff])/g, '$1$2')

const output = computed(() => {
  if (!cues.value.length) return ''
  let list = [...cues.value]
  if (doStrip.value) list = stripCueStyling(list)
  if (doMerge.value) list = mergeCues(list, maxChars.value)
  if (doSplit.value) list = splitCues(list, maxChars.value)
  if (shift.value !== 0) list = shiftCues(list, shift.value)
  if (doRescale.value && fpsFrom.value !== fpsTo.value) list = rescaleCues(list, fpsFrom.value, fpsTo.value)
  if (outFormat.value === 'ass') return serializeAss(list)
  const out = serializeSubs(list, outFormat.value)
  return doMerge.value ? joinCjk(out) : out
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
  saveText(output.value, `${srcName.value}.${outFormat.value}`, 'text/plain;charset=utf-8')
  toast.ok('已开始下载')
}

const stats = computed(() => {
  if (parseError.value) return `解析失败：${parseError.value}`
  const fmtTag = detectedFormat.value ? `识别为 ${detectedFormat.value} · ` : ''
  return `${fmtTag}${cues.value.length} 条字幕 · ${input.value.length} 字符`
})
</script>

<template>
  <div class="sub-cvt">
    <div class="pane">
      <div class="pane-head">
        <span class="pane-title">输入字幕（自动识别 SRT / VTT / SBV）</span>
        <label class="btn btn-soft btn-sm">
          <Upload :size="14" /> 上传文件
          <input type="file" accept=".srt,.vtt,.sbv,.ass,.ssa,.txt" style="display: none" @change="onFile" />
        </label>
      </div>
      <textarea v-model="input" class="textarea mono" placeholder="粘贴字幕内容，或点击右上角上传文件…"></textarea>
      <p class="pane-meta" :class="{ 'pane-err': parseError }">{{ stats }}<template v-if="detectedFormat && !parseError"> · 支持含样式的 ASS 输入（样式行将按「去样式」开关处理）</template></p>
    </div>

    <div class="opts">
      <div class="opt">
        <span class="field-label">输出格式</span>
        <select v-model="outFormat" class="select" style="width: 130px">
          <option value="srt">SRT</option>
          <option value="vtt">WebVTT</option>
          <option value="sbv">SBV</option>
          <option value="ass">ASS</option>
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
        <span class="pane-title">输出（{{ String(outFormat).toUpperCase() }}）</span>
        <button class="btn btn-primary btn-sm" :disabled="!output" @click="download">下载文件</button>
      </div>
      <ResultBox v-model="output" :readonly="true" download="" />
      <p v-if="clampedCount > 0" class="clamp-warn">⚠ 平移后 {{ clampedCount }} 条字幕起点为负，已被挤到片头（钳到 0）；如需保留请减小平移量</p>
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
.pane-err {
  color: var(--err);
}
.clamp-warn {
  font-size: 12.5px;
  color: #d97706;
  margin: 0;
}
</style>
