<script setup lang="ts">
/** 视频导出图片（不用 ffmpeg）：每秒 N 帧或全部帧（上限 600）序列，ZIP 打包 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Film, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadVideo, exportFrames, type VideoMeta } from '@/lib/videoEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = shallowRef<File | null>(null)
const meta = shallowRef<VideoMeta | null>(null)
const mode = ref<'fps' | 'all'>('fps')
const fps = ref(2)
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const busy = ref(false)
const progress = ref(0)

const ext = () => (format.value === 'image/png' ? 'png' : 'jpg')

/** 估算总帧数（用于按钮与上限提示） */
const estTotal = computed(() => {
  if (!meta.value) return 0
  const n = mode.value === 'fps' ? meta.value.duration * fps.value : meta.value.duration * 30
  return Math.max(1, Math.floor(n))
})

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
  } catch (e) {
    toast.err((e as Error).message || '视频加载失败')
  }
}

const run = async () => {
  if (!meta.value || !file.value) return
  const effFps = mode.value === 'fps' ? Math.max(0.1, fps.value) : Math.min(30, 600 / Math.max(1, meta.value.duration))
  const total = Math.floor(meta.value.duration * effFps)
  if (total > 600) {
    toast.warn(`预计 ${total} 帧，超过 600 帧上限，请降低帧率或先用「裁剪视频」截短`)
    return
  }
  busy.value = true
  progress.value = 0
  const files: { name: string; blob: Blob }[] = []
  try {
    await exportFrames(meta.value, {
      fps: effFps,
      onProgress: (p) => (progress.value = p),
      onFrame: async (c, i) => {
        const blob = await canvasToBlob(c, format.value, 0.92)
        files.push({ name: `frame-${String(i + 1).padStart(4, '0')}.${ext()}`, blob })
      },
    })
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
      <div class="meta-bar mt-2">
        <span>{{ meta.width }}×{{ meta.height }}</span>
        <span>时长 {{ Math.floor(meta.duration / 60) }}:{{ String(Math.floor(meta.duration % 60)).padStart(2, '0') }}</span>
        <span>预计 {{ estTotal }} 帧</span>
      </div>

      <div class="opts">
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
.meta-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12.5px;
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
