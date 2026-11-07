<script setup lang="ts">
/** 图片转 ASCII 字符画：列数 / 字符集可调，复制或下载 .txt */
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

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  const f = base.value?.file
  if (f) fileName.value = `${baseName(f.name)}.txt`
  render()
}

function render() {
  const c = src.value
  if (!c) return
  const cs = CHARSETS.find((x) => x.key === charsetKey.value)?.v ?? CHARSETS[0].v
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

function download() {
  if (text.value) saveText(text.value, fileName.value)
}
</script>

<template>
  <ImageToolBase ref="base" :downloadable="false" @loaded="onLoaded">
    <div class="row row-wrap mt-2" style="gap: 24px">
      <div style="min-width: 220px">
        <span class="field-label">宽度（字符列数）：{{ cols }}</span>
        <input v-model.number="cols" type="range" min="40" max="200" step="5" />
      </div>
      <div class="chips">
        <button v-for="cs in CHARSETS" :key="cs.key" class="chip" :class="{ active: charsetKey === cs.key }" @click="charsetKey = cs.key">
          {{ cs.t }}
        </button>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="!text" @click="download">下载 .txt</button>
    </div>
    <ResultBox v-model="text" title="ASCII 字符画（等宽字体查看）" class="mt-2" min-height="260px" readonly />
    <p class="muted small mt-1">提示：把文本粘贴到等宽字体环境（代码编辑器 / 终端）里才不会变形；行数约为列数 × 高宽比 × 0.5。</p>
  </ImageToolBase>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
