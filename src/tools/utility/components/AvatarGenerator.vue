<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw, Download, Loader2 } from 'lucide-vue-next'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

/** @dicebear 系列风格（从已装的 collection 里挑无需外链素材的） */
const STYLES = [
  { value: 'adventurer', label: '冒险家（卡通人像）' },
  { value: 'avataaars', label: 'Avataaars（经典头像）' },
  { value: 'bottts', label: '机器人' },
  { value: 'fun-emoji', label: '趣味表情' },
  { value: 'pixel-art', label: '像素风' },
  { value: 'identicon', label: '几何图案' },
  { value: 'initials', label: '字母缩写' },
  { value: 'croodles', label: '涂鸦' },
] as const

type StyleName = (typeof STYLES)[number]['value']

const style = ref<StyleName>('adventurer')
const seed = ref('toolhub')
const size = ref(240)
const busy = ref(false)
const batch = ref<{ seed: string; svg: string }[]>([])

const renderOne = async (styleName: StyleName, seedStr: string): Promise<string> => {
  const core = await import('@dicebear/core')
  const collection = await import('@dicebear/collection')
  const createAvatar = (core as unknown as { createAvatar: Fn }).createAvatar
  const packs = collection as unknown as Record<string, { default?: unknown }>
  const api = packs[styleName]?.default ?? packs[styleName]
  const avatar = createAvatar(api, { seed: seedStr, size: size.value })
  return avatar.toString()
}

type Fn = (pack: unknown, opts: { seed: string; size: number }) => { toString: () => string }

const genBatch = async () => {
  busy.value = true
  try {
    batch.value = []
    for (let i = 0; i < 8; i++) {
      const s = `${seed.value || 'toolhub'}-${i + 1}`
      batch.value.push({ seed: s, svg: await renderOne(style.value, s) })
    }
  } catch (e) {
    toast.err(`生成失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const regen = () => {
  seed.value = Math.random().toString(36).slice(2, 10)
  void genBatch()
}

const svgToPng = async (svgText: string): Promise<Blob> => {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('SVG 渲染失败'))
    img.src = url
  })
  const cv = document.createElement('canvas')
  cv.width = cv.height = size.value
  const g = cv.getContext('2d')!
  g.drawImage(img, 0, 0, size.value, size.value)
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('导出失败'))), 'image/png'))
}

const saveOne = async (item: { seed: string; svg: string }) => {
  busy.value = true
  try {
    saveBlob(await svgToPng(item.svg), `头像-${item.seed}.png`)
  } catch (e) {
    toast.err((e as Error).message)
  } finally {
    busy.value = false
  }
}

const saveAll = async () => {
  busy.value = true
  try {
    const files = []
    for (const item of batch.value) files.push({ name: `头像-${item.seed}.png`, blob: await svgToPng(item.svg) })
    saveMany(files, '头像合集.zip')
    toast.ok('已打包下载')
  } catch (e) {
    toast.err((e as Error).message)
  } finally {
    busy.value = false
  }
}

void genBatch()
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="field-label">风格</span>
        <select v-model="style" class="input" @change="genBatch()">
          <option v-for="s in STYLES" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <span class="field-label">种子</span>
        <input v-model="seed" class="input" style="width: 160px" placeholder="同一 seed 同一头像" />
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="genBatch()"><RefreshCw v-if="!busy" :size="14" /><Loader2 v-else :size="14" class="spin" /> 按种子生成</button>
        <button class="btn btn-sm" :disabled="busy" @click="regen">🎲 随机一批</button>
        <span class="field-label">尺寸</span>
        <select v-model.number="size" class="input slim" @change="genBatch()">
          <option :value="120">120px</option>
          <option :value="240">240px</option>
          <option :value="480">480px</option>
        </select>
        <button class="btn btn-sm" :disabled="busy || !batch.length" @click="saveAll"><Download :size="14" /> 全部下载</button>
      </div>
      <p class="hint mt-1">DiceBear 风格库本地渲染（同一 seed 恒定同一头像，适合给用户/角色生成稳定头像），点击单张下载 PNG。</p>
    </div>

    <div class="grid mt-2">
      <div v-for="b in batch" :key="b.seed" class="cell" title="点击下载 PNG" @click="saveOne(b)">
        <div class="svg" v-html="b.svg"></div>
        <span class="s">{{ b.seed }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.slim { width: 90px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.cell { border: 1px solid var(--border); border-radius: 12px; padding: 8px; cursor: pointer; text-align: center; }
.cell:hover { border-color: var(--accent); }
.svg :deep(svg) { width: 100%; height: auto; border-radius: 10px; }
.s { font-size: 11px; color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
