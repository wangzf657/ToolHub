<script setup lang="ts">
/** GIF 逐帧提取：gifuct-js 解码 + disposal 合成 → 单帧下载 / 全帧 ZIP */
import { ref, shallowRef } from 'vue'
import { Loader2, Package, Images } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob, saveMany, withExt } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const frames = shallowRef<{ canvas: HTMLCanvasElement; delay: number }[]>([])
const selectedIndex = ref<number | null>(null)

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

const onFiles = async (files: File[]) => {
  if (!files.length) return
  const f = files[0]
  if (!/\.gif$/i.test(f.name) && f.type !== 'image/gif') {
    toast.err('请选择 GIF 文件')
    return
  }
  file.value = f
  frames.value = []
  selectedIndex.value = null
  busy.value = true
  try {
    const { parseGIF, decompressFrames } = await import('gifuct-js')
    const buf = await f.arrayBuffer()
    const gif = parseGIF(buf)
    const raw = decompressFrames(gif, true)
    if (!raw.length) throw new Error('GIF 中没有可提取的帧')
    // disposal 合成：整帧画布 + 每帧 patch 绘制（disposal 2/3 在 patch 前清空目标区）
    const canvas = document.createElement('canvas')
    canvas.width = gif.lsd.width
    canvas.height = gif.lsd.height
    const ctx = canvas.getContext('2d')!
    const out: { canvas: HTMLCanvasElement; delay: number }[] = []
    for (const fr of raw) {
      if (fr.disposalType === 2 || fr.disposalType === 3) {
        ctx.clearRect(fr.dims.left, fr.dims.top, fr.dims.width, fr.dims.height)
      }
      const img = new ImageData(new Uint8ClampedArray(fr.patch), fr.dims.width, fr.dims.height)
      ctx.putImageData(img, fr.dims.left, fr.dims.top)
      const snap = document.createElement('canvas')
      snap.width = gif.lsd.width
      snap.height = gif.lsd.height
      snap.getContext('2d')!.drawImage(canvas, 0, 0)
      out.push({ canvas: snap, delay: fr.delay })
    }
    frames.value = out
    toast.ok(`共 ${out.length} 帧 · ${gif.lsd.width}×${gif.lsd.height}`)
  } catch (e) {
    toast.err((e as Error).message || 'GIF 解析失败')
  } finally {
    busy.value = false
  }
}

const pickFrame = (i: number) => {
  selectedIndex.value = selectedIndex.value === i ? null : i
}

const downloadOne = async (i: number) => {
  const f = frames.value[i]
  if (!f) return
  const blob = await new Promise<Blob>((r) => f.canvas.toBlob((b) => r(b!), 'image/png'))
  saveBlob(blob, withExt(file.value?.name ?? 'frame', `frame${String(i + 1).padStart(3, '0')}.png`))
}

const downloadAll = async () => {
  if (!frames.value.length) return
  const files: { name: string; blob: Blob }[] = []
  for (let i = 0; i < frames.value.length; i++) {
    const blob = await new Promise<Blob>((r) => frames.value[i].canvas.toBlob((b) => r(b!), 'image/png'))
    files.push({ name: `frame${String(i + 1).padStart(3, '0')}.png`, blob })
  }
  await saveMany(files, `${file.value?.name.replace(/\.gif$/i, '') ?? 'gif'}-frames.zip`)
  toast.ok(`已打包 ${files.length} 帧`)
}

const totalDelay = () => frames.value.reduce((s, f) => s + f.delay, 0)
</script>

<template>
  <div>
    <FileDrop accept="image/gif" :multiple="false" label="拖入 GIF 文件" hint="逐帧解码为 PNG · 帧延迟展示 · 全部本地处理" @files="onFiles" />

    <div v-if="busy" class="muted small mt-2"><Loader2 :size="14" class="spin" /> 正在解码帧…</div>

    <div v-if="frames.length" class="mt-2">
      <div class="row row-wrap mb-2" style="gap: 10px">
        <span class="muted small">{{ frames.length }} 帧 · {{ file && fmtSize(file.size) }} · 总时长 {{ (totalDelay() / 1000).toFixed(2) }}s</span>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" @click="downloadAll"><Package :size="14" /> 打包全部帧 ZIP</button>
      </div>
      <div class="frame-grid">
        <div
          v-for="(f, i) in frames"
          :key="i"
          class="frame-item"
          :class="{ sel: selectedIndex === i }"
          :title="`第 ${i + 1} 帧 · ${f.delay}ms`"
          @click="pickFrame(i)"
        >
          <img :src="f.canvas.toDataURL('image/webp', 0.7)" :style="{ imageRendering: 'auto' }" alt="" />
          <span class="frame-no">{{ i + 1 }}<em>{{ f.delay }}ms</em></span>
          <button class="frame-dl" title="下载此帧 PNG" @click.stop="downloadOne(i)"><Images :size="12" /> PNG</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.frame-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
.frame-item {
  position: relative;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
}
.frame-item.sel {
  border-color: var(--accent);
}
.frame-item img {
  width: 100%;
  display: block;
  aspect-ratio: 1;
  object-fit: contain;
}
.frame-no {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 11px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.frame-no em {
  margin-left: 4px;
  font-style: normal;
  opacity: 0.85;
}
.frame-dl {
  position: absolute;
  bottom: 4px;
  right: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
}
.frame-dl:hover {
  background: var(--accent);
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
