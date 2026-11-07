<script setup lang="ts">
/** 网站图标生成器：favicon.ico + 多尺寸 PNG + HTML 引用代码，一键打包 */
import { ref, shallowRef, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob, encodeIco } from '@/lib/imageEngine'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import ResultBox from '@/components/common/ResultBox.vue'

const toast = useToast()
const file = ref<File | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const square = shallowRef<HTMLCanvasElement | null>(null)
const html = ref('')
const preview = shallowRef<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const running = ref(false)

let mounted: HTMLCanvasElement | null = null

async function onFiles(files: File[]) {
  if (!files.length) {
    file.value = null
    src.value = null
    square.value = null
    preview.value = null
    html.value = ''
    return
  }
  try {
    const c = await decodeToCanvas(files[0])
    file.value = files[0]
    const s = Math.min(c.width, c.height)
    const t = document.createElement('canvas')
    t.width = s
    t.height = s
    t.getContext('2d')!.drawImage(c, (c.width - s) / 2, (c.height - s) / 2, s, s, 0, 0, s, s)
    square.value = t
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

/** 在结果容器里显示 64px 大小的图标预览 */
watch(preview, (c) => {
  if (mounted) {
    mounted.remove()
    mounted = null
  }
  if (c && stage.value) {
    c.style.width = '64px'
    c.style.height = '64px'
    stage.value.appendChild(c)
    mounted = c
  }
})

async function generate() {
  const sq = square.value
  if (!sq) return
  running.value = true
  try {
    const ico = await encodeIco(sq, [16, 32, 48])
    // 48px 足够看清的预览
    const p = document.createElement('canvas')
    p.width = 64
    p.height = 64
    p.getContext('2d')!.imageSmoothingQuality = 'high'
    p.getContext('2d')!.drawImage(sq, 0, 0, 64, 64)
    preview.value = p
    html.value = [
      '<link rel="icon" href="/favicon.ico" sizes="any" />',
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />',
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
      '<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />',
      '<link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />',
      '<link rel="manifest" href="/site.webmanifest" />',
    ].join('\n')
    // 存起来供打包用
    generated.value = ico
  } catch (e) {
    toast.err((e as Error).message || '生成失败')
  } finally {
    running.value = false
  }
}

const generated = shallowRef<Blob | null>(null)

async function downloadAll() {
  const sq = square.value
  const ico = generated.value
  if (!sq || !ico) return
  running.value = true
  try {
    const size = (n: number) => {
      const c = document.createElement('canvas')
      c.width = n
      c.height = n
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(sq, 0, 0, n, n)
      return c
    }
    const outs: { name: string; blob: Blob }[] = [
      { name: 'favicon.ico', blob: ico },
      { name: 'favicon-16x16.png', blob: await canvasToBlob(size(16), 'image/png') },
      { name: 'favicon-32x32.png', blob: await canvasToBlob(size(32), 'image/png') },
      { name: 'apple-touch-icon.png', blob: await canvasToBlob(size(180), 'image/png') },
      { name: 'android-chrome-192x192.png', blob: await canvasToBlob(size(192), 'image/png') },
      { name: 'android-chrome-512x512.png', blob: await canvasToBlob(size(512), 'image/png') },
      { name: 'site.webmanifest', blob: new Blob([
        JSON.stringify({ name: '', short_name: '', icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ], display: 'standalone' }, null, 2) ], { type: 'application/json' }) },
    ]
    await saveMany(outs, 'favicon-pack.zip')
    toast.ok('已打包全部图标文件')
  } catch (e) {
    toast.err((e as Error).message || '打包失败')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop
      accept="image/*"
      :multiple="false"
      label="拖放一张图片（Logo / 照片）到此处"
      hint="自动居中裁成正方形，生成全套网站图标"
      @files="onFiles"
    />

    <div class="row row-wrap mt-2" style="gap: 14px">
      <button class="btn btn-primary" :disabled="!square || running" @click="generate">
        <Download :size="16" /> 生成图标与引用代码
      </button>
      <button class="btn btn-ghost" :disabled="!square || !generated" @click="downloadAll">
        <Download :size="16" /> 打包下载全部文件（ZIP）
      </button>
      <div v-if="preview" class="pv-wrap"><div ref="stage" class="pv"></div><span class="muted small">64px 效果预览</span></div>
    </div>

    <div v-if="html" class="mt-3">
      <ResultBox v-model="html" title="HTML 引用代码（放在 <head> 中）" mono readonly min-height="150px" />
      <p class="muted small mt-1">打包内含：favicon.ico（16/32/48）、16/32/180/192/512 PNG 与 site.webmanifest。</p>
    </div>
  </div>
</template>

<style scoped>
.pv-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pv {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px;
  overflow: hidden;
}
</style>
