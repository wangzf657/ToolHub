<script setup lang="ts">
/** 视频格式转换：mp4/webm/mov/mkv/avi；10 个注册 slug 复用本组件（含源-目标联动/参数面/分源提示） */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Download, RefreshCw } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import { mimeFor } from '@/lib/ffmpeg'

const route = useRoute()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const target = ref('mp4')
const tryCopy = ref(false)
const deinterlace = ref(false)
const fixTs = ref(false)
const stripMeta = ref(false)
const height = ref(0) // 0 = 保持原分辨率
const abitrate = ref(128)
const vp9Fast = ref(true)
const gifFps = ref(12) // 0 = 跟随源
const convFailed = ref(false)
const sameTarget = ref(false)
const alphaLikely = ref(false)

const resultUrl = ref('')
const resultSize = ref(0)
const resultName = ref('')

/** 根据 slug 预置目标格式与流复制默认值 */
const slug = (route.params.slug as string) ?? ''
const PRESETS: Record<string, string> = {
  'mov-to-mp4': 'mp4', 'mkv-to-mp4': 'mp4', 'avi-to-mp4': 'mp4',
  'webm-to-mp4': 'mp4', 'wmv-to-mp4': 'mp4', 'flv-to-mp4': 'mp4',
  'mp4-to-webm': 'webm', 'mp4-to-mov': 'mov', 'gif-to-mp4': 'mp4',
}
const presetSlug = !!PRESETS[slug]
if (presetSlug) {
  target.value = PRESETS[slug]!
  tryCopy.value = ['mov-to-mp4', 'mkv-to-mp4', 'mp4-to-mov'].includes(slug)
}

const FORMATS = [
  { v: 'mp4', t: 'MP4（H.264 + AAC，最通用）' },
  { v: 'webm', t: 'WebM（VP9 + Opus，网页内嵌）' },
  { v: 'mov', t: 'MOV（苹果生态）' },
  { v: 'mkv', t: 'MKV（开放容器）' },
  { v: 'avi', t: 'AVI（老式兼容）' },
]

const srcExt = computed(() => {
  const n = base.value?.files[0]?.name ?? ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : ''
})
const isGifSrc = computed(() => srcExt.value === 'gif')
const dur = computed(() => base.value?.meta?.duration ?? 0)

/** 源-目标联动：母工具页载入后按容器预选目标；源即目标时改道提示 */
watch(() => base.value?.files, (list) => {
  convFailed.value = false
  sameTarget.value = false
  alphaLikely.value = false
  if (!list?.length) return
  if (isGifSrc.value) alphaLikely.value = false
  const n = list[0]!.name.toLowerCase()
  if (/alpha|transparent/.test(n)) alphaLikely.value = true
  if (presetSlug) return
  if (/^(mov|mkv)$/.test(srcExt.value)) {
    target.value = 'mp4'
    tryCopy.value = true
  }
  if (srcExt.value && srcExt.value === target.value) sameTarget.value = true
})

/** HEVC/无预览提示：浏览器解不出预览时流复制产物可能不兼容部分设备 */
const hevcLikely = computed(() => !!base.value?.files.length && !base.value?.meta)

const expectText = computed(() => {
  if (slug === 'webm-to-mp4')
    return 'WebM(VP9) 解码较慢，总耗时约为视频时长 3~5 倍；1080p 源建议选 720p 输出提速。首次使用需加载约 25MB 编解码核心，处理期间请保持页面打开。'
  if (slug === 'mp4-to-webm')
    return 'WebM(VP9) 编码很慢，耗时约为视频时长 5~10 倍，仅建议网页内嵌使用；一般转换建议 MP4 输出。转换中进度缓慢属正常，请勿刷新。'
  if (slug === 'gif-to-mp4')
    return '动图转换通常很快（GIF 帧率低），首次使用需加载约 25MB 编解码核心，之后浏览器缓存、可离线使用。'
  return '浏览器本地处理速度约为视频时长的 1/2~1/5（重编码类；流复制类通常秒级完成），首次使用需加载约 25MB 编解码核心。处理期间请保持页面打开，勿刷新或关闭标签页。'
})

const run = async () => {
  const b = base.value
  if (!b || !b.files.length) return
  convFailed.value = false
  const out = target.value
  const args: string[] = ['-y']
  if (fixTs.value) args.push('-fflags', '+genpts')
  args.push('-i', 'input')
  const copy = tryCopy.value && !isGifSrc.value && !deinterlace.value && !stripMeta.value && !height.value
  if (copy) {
    args.push('-c', 'copy')
  } else {
    if (out === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32')
      if (vp9Fast.value) args.push('-cpu-used', '4')
      args.push('-c:a', 'libopus', '-b:a', `${abitrate}k`)
    } else {
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', `${abitrate}k`)
    }
    const vf: string[] = []
    if (deinterlace.value) vf.push('yadif')
    if (height.value) vf.push(`scale=-2:${height.value}`)
    if (isGifSrc.value) vf.push('scale=trunc(iw/2)*2:trunc(ih/2)*2', 'format=yuv420p')
    if (vf.length) args.push('-vf', vf.join(','))
    if (isGifSrc.value && gifFps.value > 0) args.push('-r', String(gifFps.value))
    if (stripMeta.value) args.push('-map_metadata', '-1')
  }
  if (out === 'mp4') args.push('-movflags', '+faststart')
  const name = b.outputName.endsWith(`.${out}`) ? b.outputName : `${b.outputName.replace(/\.\w+$/, '')}.${out}`
  const res = await b.runWithFf([...args, name], {
    status: `正在转换为 ${out.toUpperCase()}…`,
    onDone: (results) => {
      const [n, data] = results.entries().next().value as [string, Uint8Array]
      if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
      const blob = new Blob([data as BlobPart], { type: mimeFor(out) })
      resultUrl.value = URL.createObjectURL(blob)
      resultSize.value = blob.size
      resultName.value = n
    },
  })
  if (!res) convFailed.value = true
}

const retryReencode = () => {
  tryCopy.value = false
  void run()
}

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)
</script>

<template>
  <FfBase ref="base" :output-ext="target" button-text="开始转换" @run="run">
    <div v-if="sameTarget && !presetSlug" class="notice notice-warn mt-2">源已是 {{ target.toUpperCase() }}，流复制只会重打包容器；如需改变编码/体积请用「压缩视频」。</div>
    <div v-if="hevcLikely" class="notice notice-warn mt-2">无法预览该编码（可能为 HEVC 高效格式）：流复制产物在部分设备不兼容，建议取消勾选「流复制」改用重编码。</div>
    <div v-if="alphaLikely && slug === 'webm-to-mp4'" class="notice notice-warn mt-2">源可能含透明通道（Alpha）：转 MP4 后透明背景将丢失。</div>
    <div v-if="dur > 1200" class="notice notice-info mt-2">长视频（{{ Math.round(dur / 60) }} 分钟）建议先用「视频分段」切成小段再转换，更稳更快：<RouterLink to="/t/split-video">视频分段 →</RouterLink></div>

    <div class="opts">
      <div v-if="!presetSlug" class="opt">
        <span class="field-label">目标格式</span>
        <select v-model="target" class="select" style="width: 230px">
          <option v-for="f in FORMATS" :key="f.v" :value="f.v">{{ f.t }}</option>
        </select>
      </div>
      <div v-if="!isGifSrc" class="opt">
        <span class="field-label">分辨率</span>
        <select v-model.number="height" class="select" style="width: 130px" :disabled="tryCopy">
          <option :value="0">保持原分辨率</option>
          <option :value="1080">1080p</option>
          <option :value="720">720p（提速）</option>
          <option :value="480">480p</option>
        </select>
      </div>
      <div v-if="!tryCopy" class="opt">
        <span class="field-label">音频码率</span>
        <select v-model.number="abitrate" class="select" style="width: 110px">
          <option :value="128">128k</option>
          <option :value="192">192k</option>
          <option :value="96">96k</option>
        </select>
      </div>
      <div v-if="isGifSrc" class="opt">
        <span class="field-label">帧率</span>
        <select v-model.number="gifFps" class="select" style="width: 130px">
          <option :value="10">10 fps</option>
          <option :value="12">12 fps</option>
          <option :value="15">15 fps</option>
          <option :value="0">跟随源</option>
        </select>
      </div>
      <div v-if="target === 'webm' && !tryCopy" class="opt">
        <span class="field-label">编码速度</span>
        <select v-model="vp9Fast" class="select" style="width: 130px">
          <option :value="true">快速档（推荐）</option>
          <option :value="false">高质量（很慢）</option>
        </select>
      </div>
      <label v-if="!presetSlug || slug === 'avi-to-mp4'" class="check" style="margin-bottom: 8px">
        <input v-model="deinterlace" type="checkbox" /> 去隔行（老录像推荐）
      </label>
      <label v-if="srcExt === 'flv' || slug === 'flv-to-mp4'" class="check" style="margin-bottom: 8px">
        <input v-model="fixTs" type="checkbox" /> 修复时间戳（老网络流推荐）
      </label>
      <label class="check" style="margin-bottom: 8px">
        <input v-model="stripMeta" type="checkbox" /> 清除位置/设备信息
      </label>
      <label v-if="!isGifSrc" class="check" style="margin-bottom: 8px">
        <input v-model="tryCopy" type="checkbox" />
        尽量流复制（不重编码，速度极快，失败请关闭）
      </label>
    </div>
    <p class="conv-note">
      提示：流复制只更换容器、不改变编码，对编码兼容的源文件有效（如 MOV→MP4）；若输出失败或无法播放，
      请关闭流复制改用重编码。旧格式（AVI/WMV/FLV）建议直接重编码。
      <template v-if="slug === 'wmv-to-mp4'">本页支持 WMV1/WMV2/WMV3（Windows Media Video 7/8/9）；MSS2 屏幕录制格式可能失败。</template>
      <template v-if="slug === 'mp4-to-mov'">H.264 源保持流复制可直接导入 Final Cut / 达芬奇；iPhone HEVC 录制建议关闭流复制重编码为 H.264。时间码轨随流复制保留（如有）。</template>
    </p>
    <div v-if="base?.meta && base.meta.width <= 960 && base.meta.height > 0" class="notice notice-ok mt-2">源为低分辨率，转换速度通常快于高清视频。</div>

    <FfExpectHint :text="expectText" />

    <div v-if="convFailed && tryCopy" class="row mt-2">
      <button class="btn btn-sm" @click="retryReencode"><RefreshCw :size="14" /> 流复制失败？改用重编码重试</button>
    </div>

    <div v-if="resultUrl" class="result-card mt-2">
      <video :src="resultUrl" controls class="result-video"></video>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">源 {{ fmtSize(base?.files[0]?.size ?? 0) }} → 输出 {{ fmtSize(resultSize) }}</span>
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
.conv-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
.result-card { max-width: 560px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.result-video { width: 100%; max-height: 300px; border-radius: 10px; background: #000; display: block; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
</style>
