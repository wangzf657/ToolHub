<script setup lang="ts">
/** 圆形头像裁剪：居中方裁 + 圆形蒙版，输出透明背景 PNG */
import { ref } from 'vue'
import ImageToolBase from './ImageToolBase.vue'
import { circleCrop } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)

function onLoaded(c: HTMLCanvasElement) {
  base.value?.setOutput(circleCrop(c))
}
</script>

<template>
  <ImageToolBase
    ref="base"
    suffix="-circle"
    button-text="下载圆形 PNG"
    label="拖放头像图片到此处"
    @loaded="onLoaded"
  >
    <p class="muted small mt-1">自动取图片中央的最大正方形区域裁成圆形，四周透明。需要偏移裁剪时请先用「裁剪图片」调整。</p>
  </ImageToolBase>
</template>
