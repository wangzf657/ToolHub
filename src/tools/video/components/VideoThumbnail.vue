<script setup lang="ts">
/** 视频截帧（不用 ffmpeg）：单帧 JPG/PNG 下载，或按间隔批量抽帧打包 ZIP */
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { Camera, Images, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadVideo, seekTo, captureFrame, exportFrames, type VideoMeta } from '@/lib/videoEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = shallowRef<File | null>(null)
const meta = shallowRef<VideoMeta | null>(null)
const mode = ref<'single' | 'batch'>('single')
const time = ref(0)
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const interval = ref(5)
const busy = ref(false)
const progress = ref(0)
const cur = ref(0)
const previewUrl = ref('')

const ext = () => (format.value === 'image/png' ? 'png' : 'jpg')

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
    time.value = 0
  } catch (e) {
    toast.err((e as Error).message || '视频加载失败')
  }
}

const onTime = () => {
  if (meta.value?.video) cur.value = meta.value.video.currentTime
}

const setCur = () => (time.value = Number(cur.value.toFixed(2)))

/** 抓取单帧：先更新预览画布 */
const grab = async () => {
  if (!meta.value) return
  busy.value = true
  try {
    await seekTo(meta.value, time.value)
    const c = captureFrame(meta.value, time.value)
    previewUrl.value = c.toDataURL(format.value)
    const blob = await canvasToBlob(c, format.value, 0.92)
    saveBlob(blob, `${baseName(file.value!.name)}.${ext()}`)
    toast.ok('已截取并下载')
  } catch (e) {
    toast.err((e as Error).message || '截帧失败')
  } finally {
    busy.value = false
  }
}

/** 批量抽帧 */
const batch = async () => {
  if (!meta.value) return
  const iv = Math.max(0.2, interval.value)
  const fps = 1 / iv
  const total = Math.floor(meta.value.duration / iv)
  if (total > 2000) {
    toast.warn(`约 ${total} 帧，请增大间隔（上限 2000 帧）`)
    return
  }
  busy.value = true
  progress.value = 0
  const files: { name: string; blob: Blob }[] = []
  try {
    await exportFrames(meta.value, {
      fps,
      onProgress: (p) => (progress.value = p),
      onFrame: async (c, i) => {
        const blob = await canvasToBlob(c, format.value, 0.92)
        files.push({ name: `frame-${String(i + 1).padStart(4, '0')}.${ext()}`, blob })
      },
    })
    await saveMany(files, `${baseName(file.value!.name)}-frames.zip`)
    toast.ok(`已抽取 ${files.length} 帧并打包下载`)
  } catch (e) {
    toast.err((e as Error).message || '抽帧失败')
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
      <div class="preview-wrap mt-2">
        <video :src="meta.url" controls class="preview" @timeupdate="onTime"></video>
        <div class="meta-bar">
          <span>{{ meta.width }}×{{ meta.height }}</span>
          <span>时长 {{ Math.floor(meta.duration / 60) }}:{{ String(Math.floor(meta.duration % 60)).padStart(2, '0') }}</span>
          <span>预览当前 {{ cur.toFixed(2) }}s</span>
        </div>
      </div>

      <div class="opts">
        <div class="opt">
          <span class="field-label">模式</span>
          <select v-model="mode" class="select" style="width: 130px">
            <option value="single">单帧截图</option>
            <option value="batch">按间隔批量</option>
          </select>
        </div>
        <template v-if="mode === 'single'">
          <div class="opt">
            <span class="field-label">时间点（秒）</span>
            <span class="row" style="gap: 6px">
              <input v-model.number="time" type="number" min="0" :max="meta.duration" step="0.1" class="input" style="width: 100px" />
              <button class="btn btn-soft btn-sm" @click="setCur">设为当前</button>
            </span>
          </div>
        </template>
        <div v-else class="opt">
          <span class="field-label">间隔（秒）</span>
          <input v-model.number="interval" type="number" min="0.2" step="0.5" class="input" style="width: 100px" />
        </div>
        <div class="opt">
          <span class="field-label">图片格式</span>
          <select v-model="format" class="select" style="width: 110px">
            <option value="image/jpeg">JPG（体积小）</option>
            <option value="image/png">PNG（无损）</option>
          </select>
        </div>
      </div>

      <div v-if="previewUrl" class="shot-wrap mt-2">
        <img :src="previewUrl" class="shot" alt="截帧预览" />
      </div>

      <div v-if="busy" class="prog-wrap mt-2">
        <div class="prog-head">
          <span>正在抽帧…</span>
          <span>{{ Math.round(progress * 100) }}%</span>
        </div>
        <div class="prog-track"><div class="prog-fill" :style="{ width: `${Math.max(2, progress * 100)}%` }"></div></div>
      </div>

      <div class="row mt-2">
        <button v-if="mode === 'single'" class="btn btn-primary" :disabled="busy" @click="grab">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <Camera v-else :size="16" />
          截取当前帧
        </button>
        <button v-else class="btn btn-primary" :disabled="busy" @click="batch">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <Images v-else :size="16" />
          批量抽帧（{{ Math.floor(meta.duration / Math.max(0.2, interval)) }} 帧）
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.preview-wrap {
  max-width: 560px;
}
.preview {
  width: 100%;
  max-height: 340px;
  border-radius: 12px;
  background: #000;
  display: block;
}
.meta-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--text-3);
  padding: 8px 2px 0;
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
.shot-wrap {
  max-width: 560px;
}
.shot {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--border);
}
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
