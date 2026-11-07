<script setup lang="ts">
/** PNG 转 ICO：生成含 16–256 六档尺寸的 Windows 图标文件 */
import { ref } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { encodeIco } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)

function onLoaded(c: HTMLCanvasElement) {
  // 图标要求方形：居中裁成正方形再输出
  const s = Math.min(c.width, c.height)
  const t = document.createElement('canvas')
  t.width = s
  t.height = s
  t.getContext('2d')!.drawImage(c, (c.width - s) / 2, (c.height - s) / 2, s, s, 0, 0, s, s)
  base.value?.setOutput(t)
}

/** ICO 无法用 canvas.toBlob 导出，走自定义编码 */
async function produceIco(): Promise<Blob> {
  const c = base.value?.output ?? base.value?.source
  if (!c) throw new Error('请先载入图片')
  return encodeIco(c, [16, 32, 48, 64, 128, 256])
}
</script>

<template>
  <div>
    <p class="muted small mt-1">
      生成包含 16 / 32 / 48 / 64 / 128 / 256 六档尺寸的标准 .ico 文件，可直接用作 Windows 应用图标。
      非方形图片会自动居中裁成正方形，建议使用透明背景 PNG。
    </p>
    <ImageToolBase
      ref="base"
      accept="image/png,image/*"
      mime="image/x-icon"
      suffix="-icon"
      button-text="下载 .ico"
      :produce-blob="produceIco"
      @loaded="onLoaded"
    />
  </div>
</template>
