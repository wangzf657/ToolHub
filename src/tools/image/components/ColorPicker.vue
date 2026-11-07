<script setup lang="ts">
/** 图片取色器：悬停实时显示坐标与颜色，点按固定取色，历史可复制 HEX / RGB */
import { ref, shallowRef, nextTick } from 'vue'
import { Copy, Trash2 } from 'lucide-vue-next'
import { decodeToCanvas, rgbToHex } from '@/lib/imageEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const toast = useToast()
const src = shallowRef<HTMLCanvasElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const hover = ref<{ x: number; y: number; hex: string; rgb: string } | null>(null)
const history = ref<{ hex: string; rgb: string }[]>([])

let mounted: HTMLCanvasElement | null = null

async function onFiles(files: File[]) {
  if (!files.length) {
    resetAll()
    return
  }
  try {
    const c = await decodeToCanvas(files[0])
    src.value = c
    await nextTick()
    if (mounted) mounted.remove()
    if (stageEl.value) {
      c.style.maxWidth = '100%'
      c.style.height = 'auto'
      c.style.display = 'block'
      c.style.cursor = 'crosshair'
      stageEl.value.appendChild(c)
      mounted = c
    }
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

function resetAll() {
  src.value = null
  hover.value = null
  history.value = []
  if (mounted) {
    mounted.remove()
    mounted = null
  }
}

function pickAt(e: MouseEvent, commit: boolean) {
  const c = mounted
  if (!c) return
  const rect = c.getBoundingClientRect()
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * c.width)
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * c.height)
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) {
    if (!commit) hover.value = null
    return
  }
  const d = c.getContext('2d')!.getImageData(x, y, 1, 1).data
  const hex = rgbToHex(d[0], d[1], d[2])
  const rgb = `rgb(${d[0]}, ${d[1]}, ${d[2]})`
  if (commit) {
    if (!history.value.some((h) => h.hex === hex)) history.value.unshift({ hex, rgb })
    if (history.value.length > 24) history.value.pop()
  } else {
    hover.value = { x, y, hex, rgb }
  }
}

async function copy(v: string) {
  if (await copyText(v)) toast.ok(`已复制 ${v}`)
  else toast.err('复制失败')
}
</script>

<template>
  <div>
    <FileDrop
      v-if="!src"
      accept="image/*"
      :multiple="false"
      label="拖放图片到此处"
      hint="鼠标悬停取色，单击固定到历史记录"
      @files="onFiles"
    />
    <div v-else>
      <div class="row row-wrap mt-1" style="gap: 14px">
        <template v-if="hover">
          <span class="swatch" :style="{ background: hover.hex }"></span>
          <span class="mono small">({{ hover.x }}, {{ hover.y }})</span>
          <span class="mono small">{{ hover.hex }}</span>
          <span class="mono small muted">{{ hover.rgb }}</span>
        </template>
        <span v-else class="muted small">把鼠标移到图上即可实时取色，单击固定颜色</span>
        <button class="btn btn-ghost btn-sm" style="margin-left: auto" @click="resetAll">换一张</button>
      </div>

      <div ref="stageEl" class="stage mt-2" @mousemove="pickAt($event, false)" @mouseleave="hover = null" @click="pickAt($event, true)"></div>

      <div v-if="history.length" class="mt-3">
        <div class="row">
          <span class="field-label">取色历史（{{ history.length }}）</span>
          <button class="btn btn-ghost btn-sm" style="margin-left: auto" @click="history = []"><Trash2 :size="14" /> 清空</button>
        </div>
        <div class="hist mt-1">
          <div v-for="(h, i) in history" :key="i" class="hist-row">
            <span class="swatch" :style="{ background: h.hex }"></span>
            <code class="mono">{{ h.hex }}</code>
            <code class="mono muted">{{ h.rgb }}</code>
            <button class="mini-btn" title="复制 HEX" aria-label="复制 HEX" @click="copy(h.hex)"><Copy :size="13" /></button>
            <button class="mini-btn" title="复制 RGB" aria-label="复制 RGB" @click="copy(h.rgb)"><Copy :size="13" /></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  display: inline-block;
  flex: none;
}
.hist {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 520px;
}
.hist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
}
.hist-row code:first-of-type {
  width: 86px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: pointer;
  margin-left: 2px;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn:last-of-type {
  margin-left: auto;
}
</style>
