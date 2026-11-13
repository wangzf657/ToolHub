<script setup lang="ts">
/**
 * 图片转 ASCII 字符画（UX1.0）：
 * - 结果区不换行：横滚逐行查看（rx1，经 :deep 覆盖 ResultBox textarea 白色等宽横滚）
 * - 弹性高度下限 420px（rx2，ResultBox 本身随视口弹性伸展）
 * - 彩色 HTML 导出：逐字符按原像素着色（rx3）
 * - 宽度预设 40/80/120/200 与滑杆联动（rx5）
 */
import { ref, shallowRef, watch } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { asciiFrom } from '@/lib/imageEngine'
import ResultBox from '@/components/common/ResultBox.vue'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const cols = ref(80)
const charsetKey = ref('classic')
const text = ref('')
const fileName = ref('ascii-art.txt')

const CHARSETS = [
  { key: 'classic', t: '经典（.:-=+*#%@）', v: ' .:-=+*#%@' },
  { key: 'dense', t: '细密（70 级灰阶）', v: " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
  { key: 'block', t: '块状（░▒▓█）', v: ' ░▒▓█' },
]
const WIDTH_PRESETS = [
  { v: 40, t: 'README 40' }, { v: 80, t: '终端 80' }, { v: 120, t: '120' }, { v: 200, t: '高清 200' },
]

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  const f = base.value?.file
  if (f) fileName.value = `${baseName(f.name)}.txt`
  render()
}

function render() {
  const c = src.value
  if (!c) return
  const cs = CHARSETS.find((x) => x.key === charsetKey.value)?.v ?? CHARSETS[0]!.v
  try {
    text.value = asciiFrom(c, cols.value, cs)
  } catch (e) {
    toast.err((e as Error).message || '生成失败')
  }
}

let timer = 0
watch([cols, charsetKey], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})

function setWidth(v: number) {
  cols.value = v
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
}

function download() {
  if (text.value) saveText(text.value, fileName.value)
}

function escapeHtml(s: string): string {
  return s === '&' ? '&amp;' : s === '<' ? '&lt;' : s === '>' ? '&gt;' : s
}

/** 彩色 HTML 导出（rx3）：每个字符按原图像素 RGB 着色 */
function downloadHtml() {
  const c = src.value
  if (!c || !text.value) return
  const cs = CHARSETS.find((x) => x.key === charsetKey.value)?.v ?? CHARSETS[0]!.v
  const rows = Math.max(1, Math.round(cols.value * (c.height / c.width) * 0.5))
  const t = document.createElement('canvas')
  t.width = cols.value
  t.height = rows
  const ctx = t.getContext('2d')!
  ctx.drawImage(c, 0, 0, cols.value, rows)
  const d = ctx.getImageData(0, 0, cols.value, rows).data
  const lines: string[] = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols.value; x++) {
      const i = (y * cols.value + x) * 4
      const lum = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!
      const ch = cs[Math.floor(((255 - lum) / 255) * (cs.length - 1))] ?? ' '
      line += `<span style="color:rgb(${d[i]},${d[i + 1]},${d[i + 2]})">${escapeHtml(ch)}</span>`
    }
    lines.push(line)
  }
  const html =
    `<!doctype html>\n<html lang="zh">\n<head>\n<meta charset="utf-8">\n<title>ASCII 字符画</title>\n` +
    `</head>\n<body style="margin:0;background:#0d1117">\n<pre style="margin:0;padding:16px;background:#0d1117;color:#fff;font:12px/0.9 'Cascadia Mono',Consolas,monospace;overflow:auto">${lines.join('\n')}\n</pre>\n</body>\n</html>\n`
  saveText(html, fileName.value.replace(/\.txt$/, '.html'), 'text/html;charset=utf-8')
  toast.ok('已导出彩色 HTML（用浏览器打开查看）')
}
</script>

<template>
  <ImageToolBase ref="base" :downloadable="false" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 16px">
      <div style="min-width: 220px">
        <span class="field-label">宽度（字符列数）：{{ cols }}</span>
        <input v-model.number="cols" type="range" min="40" max="200" step="5" />
      </div>
      <div class="chips">
        <button v-for="p in WIDTH_PRESETS" :key="p.v" class="chip" :class="{ active: cols === p.v }" @click="setWidth(p.v)">
          {{ p.t }}
        </button>
      </div>
      <div class="chips">
        <button v-for="cs in CHARSETS" :key="cs.key" class="chip" :class="{ active: charsetKey === cs.key }" @click="charsetKey = cs.key">
          {{ cs.t }}
        </button>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="!text" @click="download">下载 .txt</button>
      <button class="btn btn-soft btn-sm" :disabled="!text" @click="downloadHtml">导出彩色 .html</button>
    </div>
    <ResultBox v-model="text" title="ASCII 字符画（等宽字体查看，横向滚动）" class="mt-2 ascii-out" min-height="420px" readonly />
    <p class="muted small mt-1">提示：结果区不折行，可横向滚动逐行查看；行数约为列数 × 高宽比 × 0.5。</p>
  </ImageToolBase>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
/* rx1：字符画禁折行——等宽横滚，行首行尾纵向对齐（覆盖 ResultBox 默认换行） */
.ascii-out :deep(textarea) {
  white-space: pre;
  overflow-x: auto;
  overflow-wrap: normal;
  word-break: keep-all;
  color: var(--text);
  background: var(--panel-solid);
}
</style>
