<script setup lang="ts">
/** 图片九宫格切分：等分网格 → 缩略图预览 → 打包下载 ZIP */
import { ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { decodeToCanvas, splitGrid, canvasToBlob } from '@/lib/imageEngine'
import { saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const rows = ref(3)
const cols = ref(3)
const tiles = shallowRef<HTMLCanvasElement[]>([])
const saving = ref(false)

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    src.value = null
    tiles.value = []
    return
  }
  try {
    src.value = await decodeToCanvas(files[0])
    file.value = files[0]
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function render() {
  if (!src.value) {
    tiles.value = []
    return
  }
  tiles.value = splitGrid(src.value, rows.value, cols.value)
}

let timer = 0
watch([rows, cols, src], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})

const thumb = (c: HTMLCanvasElement) => c.toDataURL('image/png')

async function download() {
  if (!tiles.value.length || !file.value) return
  saving.value = true
  try {
    const base = baseName(file.value.name)
    const outs: { name: string; blob: Blob }[] = []
    let i = 1
    for (const t of tiles.value) {
      outs.push({ name: `${base}-${i}.png`, blob: await canvasToBlob(t, 'image/png') })
      i++
    }
    await saveMany(outs, `${base}-九宫格.zip`)
    toast.ok(`已导出 ${outs.length} 张切片`)
  } catch (e) {
    toast.err((e as Error).message || '导出失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="切成等分网格，适合发朋友圈九宫格"
      @files="onFiles"
    />

    <div class="row row-wrap mt-2" style="gap: 24px">
      <div style="min-width: 200px">
        <span class="field-label">行数：{{ rows }}</span>
        <input v-model.number="rows" type="range" min="2" max="5" step="1" />
      </div>
      <div style="min-width: 200px">
        <span class="field-label">列数：{{ cols }}</span>
        <input v-model.number="cols" type="range" min="2" max="5" step="1" />
      </div>
      <button class="btn btn-primary" :disabled="!tiles.length || saving" @click="download">
        <Download :size="16" /> 打包下载（{{ tiles.length }} 张）
      </button>
    </div>

    <div v-if="tiles.length" class="thumb-grid mt-2">
      <img v-for="(t, i) in tiles" :key="i" :src="thumb(t)" class="thumb" :style="{ aspectRatio: `${t.width} / ${t.height}` }" />
    </div>
    <p v-if="tiles.length" class="muted small mt-1">
      每片 {{ tiles[0].width }} × {{ tiles[0].height }} px（图片边缘不足整除的部分会被裁掉）
    </p>
  </div>
</template>

<style scoped>
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}
.thumb {
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--border);
  display: block;
  object-fit: cover;
}
</style>
