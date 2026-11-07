<script setup lang="ts">
/**
 * ffmpeg 兜底版音频底座（needModel 的转换类工具用）：
 * FileDrop → getFf 横幅（首次约 25MB 提示）→ run(args 工厂, 输出扩展名) 执行转码并返回 Blob，
 * 自带进度条。命令直接走 ff.writeFile / exec / readFile，避免输出名误判。
 */
import { ref } from 'vue'
import { FileAudio, Info, RotateCcw } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { getFf, mimeFor } from '@/lib/ffmpeg'
import { sizeLabel, u8ToBlob } from './shared'

const emit = defineEmits<{ file: [file: File]; clear: [] }>()

const file = ref<File | null>(null)
const busy = ref(false)
const progress = ref(0)
const note = ref('')

function loadFile(f: File) {
  file.value = f
  emit('file', f)
}

function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    emit('clear')
  } else loadFile(files[0])
}

function resetAll() {
  file.value = null
  progress.value = 0
  note.value = ''
  emit('clear')
}

/**
 * 执行一条 ffmpeg 命令。
 * build 收到 (输入文件名, 输出文件名) 返回完整参数数组（不要带 -y，也不要把输出名放在 -y 后）；
 * outExt 决定输出扩展名与 MIME。返回输出 Blob；失败抛出中文错误。
 */
async function run(build: (inName: string, outName: string) => string[], outExt: string): Promise<Blob> {
  if (!file.value) throw new Error('请先选择音频文件')
  busy.value = true
  progress.value = 0
  note.value = '正在加载 ffmpeg 引擎（首次约 25MB，完成后浏览器缓存、可离线使用）…'
  try {
    const ff = await getFf()
    note.value = ''
    const dot = file.value.name.lastIndexOf('.')
    const inExt = dot > 0 ? file.value.name.slice(dot + 1).toLowerCase().replace(/[^\w]/g, '') || 'bin' : 'bin'
    const inName = `input.${inExt}`
    const outName = `output.${outExt}`
    const buf = new Uint8Array(await file.value.arrayBuffer())
    try {
      await ff.writeFile(inName, buf)
    } catch {
      await ff.deleteFile(inName)
      await ff.writeFile(inName, buf)
    }
    const onProg = ({ progress: p }: { progress: number }) => {
      progress.value = Math.min(1, Math.max(0, p))
    }
    ff.on('progress', onProg)
    try {
      await ff.exec(build(inName, outName))
    } finally {
      ff.off('progress', onProg)
      try {
        await ff.deleteFile(inName)
      } catch {
        /* 忽略 */
      }
    }
    const out = await ff.readFile(outName)
    try {
      await ff.deleteFile(outName)
    } catch {
      /* 忽略 */
    }
    if (typeof out === 'string' || !out.length) throw new Error('ffmpeg 未产生输出文件，请调整参数或换用其他目标格式')
    return u8ToBlob(out, mimeFor(outExt))
  } catch (e) {
    const msg = (e as Error).message || '处理失败'
    throw new Error(`ffmpeg 处理失败：${msg}`)
  } finally {
    busy.value = false
  }
}

defineExpose({ file, run, loadFile, reset: resetAll, busy, progress })
</script>

<template>
  <div>
    <FileDrop
      v-if="!file"
      accept="audio/*"
      :multiple="false"
      label="拖放音频到此处，或点击选择"
      hint="M4A / FLAC / OGG / AAC / OPUS / WMA 等格式将由 ffmpeg 引擎在浏览器内处理"
      @files="onFiles"
    />
    <div v-else>
      <div class="ff-file">
        <FileAudio :size="15" />
        <span class="ff-name" :title="file.name">{{ file.name }}</span>
        <span class="muted small">{{ sizeLabel(file.size) }}</span>
        <button class="btn btn-ghost btn-sm" @click="resetAll"><RotateCcw :size="14" /> 换一个</button>
      </div>
      <div class="notice notice-warn mt-1">
        <Info :size="15" />
        <span>本步骤使用 ffmpeg 引擎（浏览器内运行）：首次使用需从 CDN 加载约 25MB 核心，之后浏览器缓存、可离线使用；文件不会上传到任何服务器。</span>
      </div>
      <slot />
      <div v-if="busy" class="ff-progress mt-1">
        <div class="ff-bar"><div class="ff-fill" :style="{ width: `${Math.round(progress * 100)}%` }"></div></div>
        <span class="small muted">{{ note || `处理中 ${Math.round(progress * 100)}%` }}</span>
      </div>
      <div v-else-if="note" class="small muted mt-1">{{ note }}</div>
    </div>
  </div>
</template>

<style scoped>
.ff-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 13.5px;
}
.ff-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.ff-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ff-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-3) 18%, transparent);
  overflow: hidden;
}
.ff-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), #7c74f2);
  transition: width 0.2s ease;
}
</style>
