<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Scissors, Download, Sparkles } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { optimizeSvg } from '@/lib/jsEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { debounceRun } from '@/composables/usePasteRun'

const toast = useToast()
const input = ref('')
const output = ref('')
const precision = ref(2)
const removeMeta = ref(true)

const onFiles = async (files: File[]) => {
  if (!files.length) return
  input.value = await files[0].text()
  runOptimize()
}

const bytes = (s: string) => new TextEncoder().encode(s).length
const fmt = (n: number) => (n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`)
const beforeSize = ref(0)
const afterSize = ref(0)
const savedPct = ref(0)

const runOptimize = () => {
  if (!input.value.trim()) return toast.warn('请粘贴 SVG 代码或拖入文件')
  if (!/<svg[\s>]/i.test(input.value)) {
    toast.err('内容不是有效的 SVG（缺少 <svg> 根元素）')
    return
  }
  try {
    beforeSize.value = bytes(input.value)
    output.value = optimizeSvg(input.value, { precision: precision.value, removeMetadata: removeMeta.value })
    afterSize.value = bytes(output.value)
    savedPct.value = beforeSize.value ? Math.max(0, Math.round((1 - afterSize.value / beforeSize.value) * 100)) : 0
    toast.ok(`优化完成，节省 ${savedPct.value}%`)
    previewDoc.value = output.value // 优化成功即自动刷新预览（rx2）
  } catch (e) {
    toast.err(`优化失败：${(e as Error).message}`)
  }
}

const barWidth = (v: number) => {
  const max = Math.max(beforeSize.value, afterSize.value, 1)
  return `${Math.max(3, (v / max) * 100)}%`
}

const previewDoc = ref('')
const showPreview = () => {
  if (!output.value) return
  previewDoc.value = output.value
}

/* 对比滑块（rx4）：左右拖动比较原始与优化结果 */
const splitPct = ref(50)
const dragging = ref(false)
const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!dragging.value) return
  const stage = (e.currentTarget as HTMLElement)
  const rect = stage.getBoundingClientRect()
  const x = 'touches' in e ? e.touches[0]!.clientX : e.clientX
  splitPct.value = Math.min(100, Math.max(0, ((x - rect.left) / rect.width) * 100))
}

/* 预览实时化（rx2）：优化成功即刷新预览；精度/开关/输入变化 400ms 防抖自动重跑 */
let deb: { call: () => void; cancel: () => void } | null = null
onMounted(() => {
  deb = debounceRun(() => {
    if (input.value.trim()) runOptimize()
  }, 400)
})
onBeforeUnmount(() => deb?.cancel())
watch([input, precision, removeMeta], () => deb?.call())

const download = () => {
  if (!output.value) return
  saveBlob(new Blob([output.value], { type: 'image/svg+xml' }), 'optimized.svg')
  toast.ok('已下载 optimized.svg')
}
</script>

<template>
  <div class="svg-opt">
    <FileDrop label="拖入 .svg 文件，或直接粘贴代码" accept=".svg,image/svg+xml" :multiple="false" @files="onFiles" />

    <div class="row row-wrap mt-2" style="gap: 14px; align-items: center">
      <label class="check">小数精度
        <input v-model.number="precision" type="number" min="0" max="5" class="input" style="width: 70px; padding: 5px 8px" />
      </label>
      <label class="check"><input v-model="removeMeta" type="checkbox" /> 移除 metadata / 注释 / id</label>
      <span class="grow"></span>
      <button class="btn btn-primary" @click="runOptimize"><Scissors :size="15" /> 优化 SVG</button>
    </div>

    <div class="grid-2 mt-3" style="gap: 12px">
      <div>
        <span class="field-label">原始 SVG</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 200px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="优化结果" min-height="200px" />
    </div>

    <div v-if="beforeSize" class="mt-3 compare">
      <div class="cmp-row">
        <span>优化前</span>
        <div class="bar before" :style="{ width: barWidth(beforeSize) }"></div>
        <b class="mono">{{ fmt(beforeSize) }}</b>
      </div>
      <div class="cmp-row">
        <span>优化后</span>
        <div class="bar after" :style="{ width: barWidth(afterSize) }"></div>
        <b class="mono">{{ fmt(afterSize) }}</b>
      </div>
      <p class="small" style="color: #34d399; margin: 6px 0 0">节省 {{ savedPct }}% 体积</p>
    </div>

    <div class="row row-wrap mt-3">
      <button class="btn btn-ghost btn-sm" :disabled="!output" @click="showPreview"><Sparkles :size="14" /> 刷新预览</button>
      <button class="btn btn-primary btn-sm" :disabled="!output" @click="download"><Download :size="14" /> 下载 SVG</button>
    </div>

    <div v-if="previewDoc && input.trim()" class="preview mt-2">
      <span class="field-label">原 / 优对比（拖动分割线比较细节）</span>
      <div
        class="cmp-stage"
        @mousedown="dragging = true"
        @mousemove="onDrag"
        @mouseup="dragging = false"
        @mouseleave="dragging = false"
        @touchstart.prevent="dragging = true"
        @touchmove.prevent="onDrag"
        @touchend="dragging = false"
      >
        <img class="layer" :src="`data:image/svg+xml;utf8,${encodeURIComponent(input)}`" alt="原始 SVG" />
        <img class="layer clip" :style="{ width: splitPct + '%' }" :src="`data:image/svg+xml;utf8,${encodeURIComponent(previewDoc)}`" alt="优化后 SVG" />
        <div class="split" :style="{ left: splitPct + '%' }"></div>
        <span class="tag l">原始</span>
        <span class="tag r">优化后</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare {
  display: grid;
  gap: 8px;
}
.cmp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.cmp-row span:first-child {
  flex: none;
  width: 52px;
  color: var(--text-3);
}
.bar {
  height: 14px;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.bar.before {
  background: rgba(248, 113, 113, 0.55);
}
.bar.after {
  background: rgba(52, 211, 153, 0.6);
}
.cmp-row b {
  flex: none;
  min-width: 64px;
  text-align: right;
}
.cmp-stage { position: relative; display: block; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; max-height: 380px; cursor: col-resize; background: repeating-conic-gradient(#0002 0% 25%, transparent 0% 50%) 0 0 / 16px 16px; }
.cmp-stage .layer { display: block; width: 100%; height: auto; }
.cmp-stage .clip { position: absolute; inset: 0 auto 0 0; width: 50%; object-fit: contain; object-position: left top; max-width: 100%; }
.cmp-stage .split { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--accent); pointer-events: none; }
.cmp-stage .tag { position: absolute; top: 6px; font-size: 11px; padding: 1px 8px; border-radius: 999px; background: rgba(0,0,0,.55); color: #fff; }
.cmp-stage .tag.l { left: 8px; }
.cmp-stage .tag.r { right: 8px; }
.preview {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  place-items: center;
  background:
    conic-gradient(rgba(128, 128, 128, 0.15) 0 25%, transparent 0 50%, rgba(128, 128, 128, 0.15) 0 75%, transparent 0) 0 0 / 16px 16px;
}
.preview img {
  max-width: 100%;
  max-height: 300px;
}
</style>
