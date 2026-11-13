<script setup lang="ts">
/**
 * 翻转图片（UX1.0）：
 * - F-质量实时（rx1）：下载行 PNG｜JPG｜WebP chips + 质量（仅 JPG/WebP 显示滑杆）+ 实时体积 + 记忆。
 * - 快捷键（rx3）：H/V 触发镜像 chips，输入框聚焦时不响应。
 * - 方向修正合并（rx5）：同页提供「旋转」分组，90° 旋转 + 水平镜像一次导出（注册表 desc 建议随更新）。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { FlipHorizontal, FlipVertical } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import ExportBar from './ExportBar.vue'
import { applyOps, canvasToBlob } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const flipH = ref(false)
const flipV = ref(false)
const quarter = ref(0) // 旋转分组：0/90/180/270
const out = shallowRef<HTMLCanvasElement | null>(null)

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  flipH.value = false
  flipV.value = false
  quarter.value = 0
  render()
}

function render(): HTMLCanvasElement | null {
  const s = src.value
  if (!s) return null
  const ops = []
  if (flipH.value) ops.push({ op: 'flip' as const, axis: 'h' as const })
  if (flipV.value) ops.push({ op: 'flip' as const, axis: 'v' as const })
  let c = ops.length ? applyOps(s, ops) : s
  if (quarter.value !== 0) {
    const deg = quarter.value === 90 ? 90 : quarter.value === 180 ? 180 : 270
    c = applyOps(c, [{ op: 'rotate', deg: deg as 90 | 180 | 270 }])
  }
  out.value = c
  base.value?.setOutput(ops.length || quarter.value ? c : null)
  return c
}

async function produce(mime: string, quality: number): Promise<Blob> {
  const c = out.value ?? render()
  if (!c) throw new Error('尚未载入图片')
  return canvasToBlob(c, mime, quality)
}

/* 快捷键 H/V（输入控件聚焦时不响应） */
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return
  const k = e.key.toLowerCase()
  if (k === 'h') flipH.value = !flipH.value
  else if (k === 'v') flipV.value = !flipV.value
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch([flipH, flipV, quarter], render)
</script>

<template>
  <ImageToolBase ref="base" suffix="-flipped" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 18px">
      <div class="grp">
        <span class="field-label">镜像</span>
        <div class="row">
          <button class="chip" :class="{ active: flipH }" @click="flipH = !flipH">
            <FlipHorizontal :size="15" /> 水平镜像（H）
          </button>
          <button class="chip" :class="{ active: flipV }" @click="flipV = !flipV">
            <FlipVertical :size="15" /> 垂直翻转（V）
          </button>
        </div>
      </div>
      <div class="grp">
        <span class="field-label">旋转</span>
        <div class="row">
          <button class="chip" :class="{ active: quarter === 90 }" @click="quarter = quarter === 90 ? 0 : 90">90°</button>
          <button class="chip" :class="{ active: quarter === 180 }" @click="quarter = quarter === 180 ? 0 : 180">180°</button>
          <button class="chip" :class="{ active: quarter === 270 }" @click="quarter = quarter === 270 ? 0 : 270">270°</button>
        </div>
      </div>
    </div>
    <ExportBar
      class="mt-2"
      :produce="produce"
      :base-name="base?.file ? base.file.name.replace(/\.[^.]+$/, '') : 'image'"
      :dirty-token="`${flipH}-${flipV}-${quarter}`"
    />
  </ImageToolBase>
</template>

<style scoped>
.grp {
  display: grid;
  gap: 6px;
}
</style>
