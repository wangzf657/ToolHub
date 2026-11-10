<script setup lang="ts">
import { ref } from 'vue'
import { Download, Layers, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PSD 转 JPG：ag-psd 本地解析（initializeCanvas 注入浏览器 canvas）。
 * 导出合成图 JPG/PNG，附带尺寸/图层数信息；顶层图层可逐个导出透明 PNG。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const quality = ref(0.9)
const loaded = ref(false)
const width = ref(0)
const height = ref(0)
const layerCount = ref(0)
const composite = ref<HTMLCanvasElement | null>(null)
const layers = ref<{ name: string; canvas: HTMLCanvasElement | null }[]>([])

interface AgPsdLayer {
  name?: string
  hidden?: boolean
  canvas?: HTMLCanvasElement
  children?: AgPsdLayer[]
}
interface AgPsd {
  width: number
  height: number
  canvas?: HTMLCanvasElement
  children?: AgPsdLayer[]
  imageData?: { length: number }
}

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.psd$/i.test(f.name) && f.type !== 'image/vnd.adobe.photoshop') {
    toast.err('请选择 .psd 文件')
    return
  }
  if (f.size > 100 * 1024 * 1024) {
    toast.warn('PSD 超过 100MB，解析可能较慢或失败，请耐心等待')
  }
  file.value = f
  busy.value = true
  loaded.value = false
  composite.value = null
  layers.value = []
  try {
    const agpsd = await import('ag-psd')
    agpsd.initializeCanvas(() => document.createElement('canvas'))
    const psd = agpsd.readPsd(await f.arrayBuffer()) as AgPsd
    width.value = psd.width
    height.value = psd.height
    composite.value = psd.canvas ?? null
    // 顶层图层（含组），带独立画布的可导出
    const walk = (nodes: AgPsdLayer[] | undefined, depth: number, acc: { name: string; canvas: HTMLCanvasElement | null; depth: number }[]) => {
      for (const n of nodes ?? []) {
        const isGroup = Array.isArray(n.children)
        acc.push({ name: `${'　'.repeat(depth)}${isGroup ? '▸ ' : ''}${n.name ?? '图层'}`, canvas: isGroup ? null : n.canvas ?? null, depth })
        if (n.children) walk(n.children, depth + 1, acc)
      }
    }
    const acc: { name: string; canvas: HTMLCanvasElement | null; depth: number }[] = []
    walk(psd.children, 0, acc)
    layerCount.value = acc.length
    layers.value = acc.slice(0, 200)
    loaded.value = true
    if (!composite.value) toast.warn('该 PSD 未存储合成图，可尝试导出单个图层')
    else toast.ok(`解析成功：${psd.width}×${psd.height}`)
  } catch (e) {
    toast.err((e as Error).message || 'PSD 解析失败：文件可能损坏或版本过新')
  } finally {
    busy.value = false
  }
}

const downloadComposite = async () => {
  if (!composite.value || !file.value) return
  try {
    const blob = await canvasToBlob(composite.value, format.value, format.value === 'image/jpeg' ? quality.value : undefined)
    const ext = format.value === 'image/jpeg' ? 'jpg' : 'png'
    saveBlob(blob, `${baseName(file.value.name)}.${ext}`)
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  }
}

const downloadLayer = async (l: { name: string; canvas: HTMLCanvasElement | null }) => {
  if (!l.canvas) return
  const blob = await canvasToBlob(l.canvas, 'image/png')
  saveBlob(blob, `${l.name.replace(/[\\/:*?"<>|　]/g, '').trim() || '图层'}.png`)
}

const downloadAllLayers = async () => {
  const withCanvas = layers.value.filter((l) => l.canvas)
  if (!withCanvas.length) return
  const files: { name: string; blob: Blob }[] = []
  for (const l of withCanvas) {
    files.push({ name: `${l.name.replace(/[\\/:*?"<>|　]/g, '').trim() || '图层'}.png`, blob: await canvasToBlob(l.canvas!, 'image/png') })
  }
  saveMany(files, `${file.value ? baseName(file.value.name) : 'psd'}-图层.zip`)
}
</script>

<template>
  <div>
    <FileDrop accept=".psd,image/vnd.adobe.photoshop" :multiple="false" label="拖入 .psd 文件" hint="本地解析合成图与图层，文件不上传" @files="open" />

    <div v-if="busy" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在解析 PSD…</div>

    <div v-if="loaded" class="mt-2">
      <div class="stats">
        <div class="stat"><span class="k">画布尺寸</span><span class="v">{{ width }} × {{ height }}</span></div>
        <div class="stat"><span class="k">图层数</span><span class="v"><Layers :size="15" style="vertical-align: -2px" /> {{ layerCount }}</span></div>
        <div class="stat"><span class="k">文件大小</span><span class="v">{{ file && fmtSize(file.size) }}</span></div>
      </div>

      <div v-if="composite" class="mt-2">
        <div class="row row-wrap" style="gap: 10px">
          <span class="field-label">合成图输出</span>
          <select v-model="format" class="select" style="max-width: 130px">
            <option value="image/jpeg">JPG（白底）</option>
            <option value="image/png">PNG（透明）</option>
          </select>
          <input v-if="format === 'image/jpeg'" v-model.number="quality" type="range" min="0.5" max="0.95" step="0.05" style="max-width: 140px" />
          <span class="grow"></span>
          <button class="btn btn-primary btn-sm" @click="downloadComposite"><Download :size="14" /> 下载合成图</button>
        </div>
        <img v-if="composite" :src="composite.toDataURL('image/jpeg', 0.6)" class="preview mt-1" alt="PSD 合成图预览" />
      </div>

      <div v-if="layers.length" class="mt-2">
        <div class="row row-wrap" style="gap: 10px">
          <span class="field-label">图层（缩进表示层级，仅像素图层可导出 PNG）</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="downloadAllLayers"><Download :size="14" /> 全部图层 PNG（ZIP）</button>
        </div>
        <div class="list mt-1">
          <div v-for="(l, i) in layers" :key="i" class="entry" :class="{ dim: !l.canvas }">
            <span class="name">{{ l.name }}</span>
            <button v-if="l.canvas" class="mini-btn" title="导出透明 PNG" @click="downloadLayer(l)"><Download :size="14" /></button>
            <span v-else class="muted small">组/空图层</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.grow {
  flex: 1;
}
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 120px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 15px;
  font-weight: 700;
}
.preview {
  max-width: 100%;
  max-height: 420px;
  border: 1px solid var(--border);
  border-radius: 10px;
  display: block;
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 280px;
  overflow: auto;
}
.entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.entry:last-child {
  border-bottom: none;
}
.entry.dim {
  color: var(--text-3);
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-btn {
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
}
</style>
