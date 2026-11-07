<script setup lang="ts">
/** 照片拼图：多图网格拼贴，列数 / 间距 / 背景色可调（顺序在文件列表里用 ↑↓ 调整） */
import { ref, shallowRef, watch } from 'vue'
import { Loader2, Download } from 'lucide-vue-next'
import { decodeToCanvas, collage, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const files = ref<File[]>([])
const canvases = shallowRef<HTMLCanvasElement[]>([])
const cols = ref(3)
const gap = ref(10)
const bg = ref('#ffffff')
const out = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const loading = ref(false)
const saving = ref(false)

let mounted: HTMLCanvasElement | null = null

async function loadAll(list: File[]) {
  if (!list.length) {
    canvases.value = []
    out.value = null
    return
  }
  loading.value = true
  const arr: HTMLCanvasElement[] = []
  try {
    for (const f of list) arr.push(await decodeToCanvas(f))
    canvases.value = arr
    render()
  } catch (e) {
    toast.err((e as Error).message || '有图片解码失败')
  } finally {
    loading.value = false
  }
}

function render() {
  if (canvases.value.length < 1) {
    out.value = null
    return
  }
  out.value = collage(canvases.value, cols.value, gap.value, bg.value)
}

watch(out, (c) => {
  if (mounted) {
    mounted.remove()
    mounted = null
  }
  if (c && stage.value) {
    c.style.maxWidth = '100%'
    c.style.height = 'auto'
    c.style.display = 'block'
    c.style.margin = '0 auto'
    stage.value.appendChild(c)
    mounted = c
  }
})

let timer = 0
watch([cols, gap, bg], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})

async function download() {
  if (!out.value) return
  saving.value = true
  try {
    const blob = await canvasToBlob(out.value, 'image/png')
    saveBlob(blob, `photo-collage.png`)
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
      :multiple="true"
      label="拖放多张照片到此处（支持批量）"
      hint="在下方文件列表里用 ↑ ↓ 调整每张图的位置"
      @files="(f) => ((files = f), loadAll(f))"
    />

    <div class="row row-wrap mt-2" style="gap: 18px">
      <div style="min-width: 200px">
        <span class="field-label">列数：{{ cols }}</span>
        <input v-model.number="cols" type="range" min="2" max="5" step="1" />
      </div>
      <div style="min-width: 200px">
        <span class="field-label">间距：{{ gap }} px</span>
        <input v-model.number="gap" type="range" min="0" max="40" step="1" />
      </div>
      <label class="opt">
        <span class="field-label">背景色</span>
        <input v-model="bg" type="color" />
      </label>
    </div>

    <div v-if="loading" class="row mt-2 muted small"><Loader2 :size="15" class="spin" /> 正在解码 {{ files.length }} 张图片…</div>
    <div v-else-if="files.length" class="muted small mt-2">已加载 {{ canvases.length }} 张，网格约 {{ cols }} 列 × {{ Math.ceil(canvases.length / cols) }} 行</div>

    <div v-show="out" ref="stage" class="stage mt-2"></div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!out || saving" @click="download">
        <Loader2 v-if="saving" :size="16" class="spin" /><Download v-else :size="16" /> 下载拼图 PNG
      </button>
      <span class="muted small">每格取所有图中最小的宽高，多余部分居中放置</span>
    </div>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.stage {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
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
