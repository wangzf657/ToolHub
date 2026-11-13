<script setup lang="ts">
/** 视频导出图片（不用 ffmpeg）：每秒 N 帧或全部帧（上限 600），支持时间段导出、预览廊勾选跳段、JPG 质量档 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Film, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadVideo, exportFrames, seekTo, captureFrame, type VideoMeta } from '@/lib/videoEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = shallowRef<File | null>(null)
const meta = shallowRef<VideoMeta | null>(null)
const mode = ref<'fps' | 'all'>('fps')
const fps = ref(2)
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const jpgQ = ref(0.92)
const busy = ref(false)
const progress = ref(0)
const rangeOn = ref(false)
const rs = ref(0)
const re = ref(0)

const ext = () => (format.value === 'image/png' ? 'png' : 'jpg')
const effStart = computed(() => (rangeOn.value ? Math.max(0, Math.min(rs.value, re.value)) : 0))
const effEnd = computed(() => {
  if (!rangeOn.value || !meta.value) return meta.value?.duration ?? 0
  const d = meta.value.duration
  return Math.min(d, Math.max(rs.value, re.value))
})

/** 预估总帧数与 all 模式的等效帧率（上限 600 帧） */
const estFps = computed(() => {
  if (!meta.value) return 0
  const span = Math.max(0.1, effEnd.value - effStart.value)
  return mode.value === 'fps' ? Math.max(0.1, fps.value) : Math.min(30, 600 / span)
})
const estTotal = computed(() => Math.max(1, Math.floor((effEnd.value - effStart.value) * estFps.value)))

const onFiles = async (files: File[]) => {
  if (meta.value) {
    URL.revokeObjectURL(meta.value.url)
    meta.value = null
  }
  const f = files[0]
  if (!f) return
  file.value = f
  try {
    meta.value = await loadVideo(f)
    rs.value = 0
    re.value = meta.value.duration
  } catch (e) {
    toast.err((e as Error).message || '视频加载失败')
  }
}
watch(rangeOn, (v) => {
  if (v && meta.value) {
    rs.value = 0
    re.value = Number(meta.value.duration.toFixed(1))
  }
})

/* ---------- 预览廊：≤32 张采样九宫格，勾选「跳过」的时间段在导出时剔除 ---------- */
interface Tile {
  s: number
  e: number
  url: string
  skip: boolean
}
const tiles = ref<Tile[]>([])
const building = ref(false)

const buildGallery = async () => {
  if (!meta.value) return
  building.value = true
  const m = meta.value
  const span = Math.max(0.1, effEnd.value - effStart.value)
  const n = Math.min(32, Math.max(4, Math.ceil(span * Math.max(0.2, estFps.value) / 4)))
  const out: Tile[] = []
  const w = 110
  for (let i = 0; i < n; i++) {
    const s = effStart.value + (span * i) / n
    const e = effStart.value + (span * (i + 1)) / n
    try {
      await seekTo(m, s + 0.02)
      const c = captureFrame(m, s + 0.02)
      const h = Math.max(1, Math.round((c.height / c.width) * w))
      const small = document.createElement('canvas')
      small.width = w
      small.height = h
      small.getContext('2d')!.drawImage(c, 0, 0, w, h)
      out.push({ s, e, url: small.toDataURL('image/jpeg', 0.6), skip: false })
      tiles.value = [...out]
    } catch {
      /* 跳过失败帧 */
    }
  }
  building.value = false
}
watch([mode, fps, rangeOn, rs, re, () => meta.value?.duration], () => {
  tiles.value = []
})

const run = async () => {
  if (!meta.value || !file.value) return
  const effFps = estFps.value
  const total = estTotal.value
  if (total > 600) {
    toast.warn(`预计 ${total} 帧，超过 600 帧上限，请降低帧率或先用「裁剪视频」截短`)
    return
  }
  const skipped = tiles.value.filter((t) => t.skip)
  busy.value = true
  progress.value = 0
  const files: { name: string; blob: Blob }[] = []
  try {
    await exportFrames(meta.value, {
      fps: effFps,
      start: effStart.value,
      end: effEnd.value,
      onProgress: (p) => (progress.value = p),
      onFrame: async (c, i, t) => {
        // 勾选跳过的时间段：命中则不导出该帧
        if (skipped.some((k) => t >= k.s && t < k.e)) return
        const q = format.value === 'image/jpeg' ? jpgQ.value : undefined
        const blob = await canvasToBlob(c, format.value, q ?? 0.92)
        files.push({ name: `frame-${String(i + 1).padStart(4, '0')}.${ext()}`, blob })
      },
    })
    if (!files.length) {
      toast.warn('所有帧都在被勾选跳过的时间段内，未导出任何图片；请取消勾选后重试')
      return
    }
    await saveMany(files, `${baseName(file.value.name)}-images.zip`)
    toast.ok(`已导出 ${files.length} 张图片并打包下载`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    busy.value = false
    progress.value = 0
  }
}

onBeforeUnmount(() => {
  if (meta.value) URL.revokeObjectURL(meta.value.url)
})
</script>

<template>
  <div>
    <FileDrop accept="video/*" :multiple="false" label="拖放视频到此处，或点击选择" hint="纯浏览器解码，无需加载 ffmpeg" @files="onFiles" />

    <template v-if="meta && file">
      <div class="opts mt-2">
        <div class="opt">
          <span class="field-label">导出方式</span>
          <select v-model="mode" class="select" style="width: 160px">
            <option value="fps">每秒 N 帧</option>
            <option value="all">尽量全部帧（上限 600）</option>
          </select>
        </div>
        <div v-if="mode === 'fps'" class="opt">
          <span class="field-label">每秒帧数</span>
          <input v-model.number="fps" type="number" min="0.1" max="30" step="1" class="input" style="width: 100px" />
        </div>
        <div class="opt">
          <span class="field-label">图片格式</span>
          <select v-model="format" class="select" style="width: 110px">
            <option value="image/jpeg">JPG（体积小）</option>
            <option value="image/png">PNG（无损）</option>
          </select>
        </div>
        <div v-if="format === 'image/jpeg'" class="opt">
          <span class="field-label">JPG 质量</span>
          <select v-model.number="jpgQ" class="select" style="width: 110px">
            <option :value="0.6">60（最小）</option>
            <option :value="0.92">92（推荐）</option>
            <option :value="1">100（最高）</option>
          </select>
        </div>
        <label class="check" style="margin-bottom: 6px">
          <input v-model="rangeOn" type="checkbox" /> 只导出时间段
        </label>
        <template v-if="rangeOn">
          <div class="opt">
            <span class="field-label">开始（秒）</span>
            <input v-model.number="rs" type="number" min="0" step="0.1" class="input" style="width: 100px" />
          </div>
          <div class="opt">
            <span class="field-label">结束（秒）</span>
            <input v-model.number="re" type="number" min="0" step="0.1" class="input" style="width: 100px" />
          </div>
        </template>
      </div>
      <p class="est-line">
        {{ mode === 'all' ? `上限 600 帧（约 ${estFps.toFixed(1)} fps）` : `预计 ${estTotal} 帧` }}
        · 范围 {{ effStart.toFixed(1) }}s ~ {{ effEnd.toFixed(1) }}s
        <button class="btn btn-ghost btn-sm" style="margin-left: 8px" :disabled="building" @click="buildGallery">生成导出预览廊</button>
      </p>

      <div v-if="tiles.length" class="gallery mt-2">
        <button
          v-for="(t, i) in tiles" :key="i" class="tile" :class="{ skip: t.skip }"
          :title="`${t.s.toFixed(1)}s ~ ${t.e.toFixed(1)}s，点击切换「跳过」`"
          @click="t.skip = !t.skip"
        >
          <img :src="t.url" alt="" />
          <i>{{ t.s.toFixed(1) }}s</i>
          <span v-if="t.skip" class="skip-tag">已跳过</span>
        </button>
        <p class="gallery-hint">点击缩略图切换「跳过该时间段」；导出的 ZIP 将不含被跳过时段的帧。</p>
      </div>

      <div v-if="busy" class="prog-wrap mt-2">
        <div class="prog-head">
          <span>正在导出帧…</span>
          <span>{{ Math.round(progress * 100) }}%</span>
        </div>
        <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, progress * 100)}%` }"></div></div>
      </div>

      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="run">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <Film v-else :size="16" />
          导出图片序列
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.est-line { font-size: 12.5px; color: var(--accent-text); margin-top: 8px; font-variant-numeric: tabular-nums; }
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.opt {
  display: grid;
  gap: 4px;
}
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; max-width: 640px; }
.tile { position: relative; padding: 0; border: 2px solid var(--border); border-radius: 8px; overflow: hidden; cursor: pointer; background: none; }
.tile img { width: 100%; height: 62px; object-fit: cover; display: block; }
.tile i { position: absolute; left: 4px; bottom: 2px; font-style: normal; font-size: 10px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.9); font-variant-numeric: tabular-nums; }
.tile.skip { opacity: 0.45; border-color: rgba(248, 113, 113, 0.6); }
.skip-tag { position: absolute; top: 4px; right: 4px; font-size: 10px; color: #fff; background: rgba(239, 68, 68, 0.85); border-radius: 4px; padding: 1px 5px; }
.gallery-hint { grid-column: 1 / -1; font-size: 12px; color: var(--text-3); margin: 0; }
.prog-wrap {
  display: grid;
  gap: 6px;
  max-width: 560px;
}
.prog-head {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--text-2);
}
.prog-track {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  overflow: hidden;
  border: 1px solid var(--border);
}
.prog-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #7c74f2);
  border-radius: 999px;
  transition: width 0.2s ease;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
