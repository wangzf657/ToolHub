<script setup lang="ts">
/**
 * 视频倒放：倒放 / 回弹 / 双次循环（x2 已改流复制秒级完成）；支持区间倒放与回弹静音；
 * 结果区内嵌预览播放器，点下载才落盘。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import { mimeFor } from '@/lib/ffmpeg'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'reverse' | 'boomerang' | 'x2'>('reverse')
const rangeOn = ref(false)
const rs = ref(0)
const re = ref(0)
const boomMute = ref(false)

const srcExt = computed(() => {
  const n = base.value?.files[0]?.name ?? ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : 'mp4'
})
const width = computed(() => base.value?.meta?.width ?? 0)

/* ---------- 安全时长表：按源分辨率联动高亮当前档 ---------- */
const LIMITS = [
  { label: '480p（854×480）', max: 90, test: (w: number) => w > 0 && w <= 640 },
  { label: '720p（1280×720）', max: 30, test: (w: number) => w > 640 && w <= 1280 },
  { label: '1080p（1920×1080）', max: 15, test: (w: number) => w > 1280 },
]

/* ---------- 结果预览 ---------- */
const resultUrl = ref('')
const resultSize = ref(0)
const resultName = ref('')
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)
onBeforeUnmount(() => {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})

/* ---------- 处理中离开确认 ---------- */
let running = false
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (running) {
    e.preventDefault()
    e.returnValue = ''
  }
}
window.addEventListener('beforeunload', onBeforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

const ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart']

const run = async () => {
  const b = base.value
  if (!b || !b.files.length) return
  running = true
  try {
    if (mode.value === 'x2') {
      // x2 改流复制：-stream_loop 1 正放两遍，秒级完成且无画质损失
      const res = await b.runWithFf(
        ['-y', '-stream_loop', '1', '-i', 'input', '-c', 'copy', b.outputName],
        { status: '正在循环拼接（流复制，秒级）…' },
      )
      if (res) showResult(res, b)
      return
    }
    if (mode.value === 'reverse' && rangeOn.value) {
      // 区间倒放：头段原序 + 中段反转 + 尾段原序，单条 filter_complex 完成
      const s = Math.max(0, Math.min(rs.value, re.value))
      const e = Math.max(rs.value, re.value)
      if (e - s < 0.2) {
        toast.warn('倒放区间太短（<0.2s），请调整起止时间')
        return
      }
      const fc =
        `[0:v]trim=start=0:end=${s},setpts=PTS-STARTPTS[hv];` +
        `[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS,reverse[mvr];` +
        `[0:v]trim=start=${e},setpts=PTS-STARTPTS[tv];` +
        `[0:a]atrim=start=0:end=${s},asetpts=PTS-STARTPTS[ha];` +
        `[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS,areverse[mra];` +
        `[0:a]atrim=start=${e},asetpts=PTS-STARTPTS[ta];` +
        `[hv][ha][mvr][mra][tv][ta]concat=n=3:v=1:a=1[v][a]`
      const res = await b.runWithFf(
        ['-y', '-i', 'input', '-filter_complex', fc, '-map', '[v]', '-map', '[a]', ...ENC, b.outputName],
        { status: `正在倒放 ${s.toFixed(1)}s~${e.toFixed(1)}s 区间…` },
      )
      if (res) showResult(res, b)
      return
    }
    if (mode.value === 'reverse') {
      const res = await b.runWithFf(
        ['-y', '-i', 'input', '-vf', 'reverse', '-af', 'areverse', ...ENC, b.outputName],
        { status: '正在倒放（视频与音频同步反转）…' },
      )
      if (res) showResult(res, b)
      return
    }
    // 回弹
    const fc = boomMute.value
      ? '[0:v]split[v1][v2];[v2]reverse[rv];[v1][rv]concat=n=2:v=1:a=0[v]'
      : '[0:v]split[v1][v2];[0:a]split[a1][a2];[v2]reverse[rv];[a2]areverse[ra];[v1][rv][a1][ra]concat=n=2:v=1:a=1[v][a]'
    const maps = boomMute.value ? ['-map', '[v]', '-an'] : ['-map', '[v]', '-map', '[a]']
    const res = await b.runWithFf(
      ['-y', '-i', 'input', '-filter_complex', fc, ...maps, ...ENC, b.outputName],
      { status: '正在生成回弹效果…' },
    )
    if (res) showResult(res, b)
  } finally {
    running = false
  }
}

const showResult = (results: Map<string, Uint8Array>, b: { files: File[] }) => {
  const [n, data] = results.entries().next().value as [string, Uint8Array]
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  const blob = new Blob([data as BlobPart], { type: mimeFor(srcExt.value) })
  resultUrl.value = URL.createObjectURL(blob)
  resultSize.value = blob.size
  resultName.value = n
  const src = b.files[0]?.size ?? 0
  toast.ok(`处理完成：源 ${fmtSize(src)} → 输出 ${fmtSize(blob.size)}，请预览确认后下载`)
}
</script>

<template>
  <FfBase ref="base" button-text="开始处理" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">模式</span>
        <select v-model="mode" class="select" style="width: 220px">
          <option value="reverse">倒放（含声音反转）</option>
          <option value="boomerang">回弹（正放 + 倒放）</option>
          <option value="x2">循环 2 次（流复制，秒级）</option>
        </select>
      </div>
      <label v-if="mode === 'reverse'" class="check" style="margin-bottom: 6px">
        <input v-model="rangeOn" type="checkbox" /> 只倒放区间
      </label>
      <template v-if="mode === 'reverse' && rangeOn">
        <div class="opt">
          <span class="field-label">开始（秒）</span>
          <input v-model.number="rs" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        </div>
        <div class="opt">
          <span class="field-label">结束（秒）</span>
          <input v-model.number="re" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        </div>
      </template>
      <label v-if="mode === 'boomerang'" class="check" style="margin-bottom: 6px">
        <input v-model="boomMute" type="checkbox" /> 回弹静音（去掉音轨）
      </label>
    </div>

    <div class="safe-table mt-2">
      <span class="st-title">内存安全参考（整段读入内存处理）：</span>
      <span
        v-for="l in LIMITS" :key="l.label" class="st-item"
        :class="{ on: l.test(width) }"
      >{{ l.label }} ≤{{ l.max }}s</span>
    </div>
    <p class="rev-note">
      倒放需要把整段视频读入内存处理，请按上表控制时长；更长素材建议先用「裁剪视频」截取片段。
      「循环 2 次」已改用流复制，秒级完成、无画质损失——循环 N 次请用「视频循环拼接」。
    </p>
    <FfExpectHint text="倒放/回弹为整段读入 + 重编码，耗时约为视频时长的 1~3 倍（按安全时长表控制则数秒到数十秒）；循环 2 次为流复制秒级。首次使用需加载约 25MB 编解码核心，处理期间请保持页面打开。" />

    <div v-if="resultUrl" class="result-card mt-2">
      <video :src="resultUrl" controls class="result-video"></video>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">输出 {{ fmtSize(resultSize) }}</span>
        <a class="btn btn-primary btn-sm" :href="resultUrl" :download="resultName"><Download :size="14" /> 下载输出文件</a>
      </div>
    </div>
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
.safe-table { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12.5px; }
.st-title { color: var(--text-3); }
.st-item { padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-3); font-variant-numeric: tabular-nums; }
.st-item.on { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); font-weight: 700; }
.rev-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
.result-card { max-width: 560px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.result-video { width: 100%; max-height: 320px; border-radius: 10px; background: #000; display: block; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
</style>
