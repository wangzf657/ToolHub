<script setup lang="ts">
/** 旋转图片：90/180/270 直角旋转 + 自定义角度自由旋转（扩展画布填透明） */
import { ref, shallowRef, watch } from 'vue'
import { RotateCw, RotateCcw, Undo2 } from 'lucide-vue-next'
import ImageToolBase from './ImageToolBase.vue'
import { applyOps } from '@/lib/imageEngine'

const base = ref<InstanceType<typeof ImageToolBase> | null>(null)
const src = shallowRef<HTMLCanvasElement | null>(null)
const quarter = ref(0) // 累计直角角度 0/90/180/270
const angle = ref(0) // 自由角度 -180..180（叠加在直角之上）

function onLoaded(c: HTMLCanvasElement) {
  src.value = c
  quarter.value = 0
  angle.value = 0
  render()
}

function rotate(dir: 1 | -1) {
  quarter.value = (quarter.value + dir * 90 + 360) % 360
}

function resetAngle() {
  quarter.value = 0
  angle.value = 0
  render()
}

function render() {
  if (!src.value) return
  let c = src.value
  if (quarter.value !== 0) {
    const deg = quarter.value === 90 ? 90 : quarter.value === 180 ? 180 : 270
    c = applyOps(c, [{ op: 'rotate', deg: deg as 90 | 180 | 270 }])
  }
  if (angle.value !== 0) {
    // 自由旋转：扩展画布到旋转后的外接矩形，其余区域透明
    const rad = (angle.value * Math.PI) / 180
    const w = c.width
    const h = c.height
    const nw = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)))
    const nh = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)))
    const t = document.createElement('canvas')
    t.width = nw
    t.height = nh
    const ctx = t.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(nw / 2, nh / 2)
    ctx.rotate(rad)
    ctx.drawImage(c, -w / 2, -h / 2)
    c = t
  }
  base.value?.setOutput(c)
}

let timer = 0
watch([quarter, angle], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 100)
})
</script>

<template>
  <ImageToolBase ref="base" @loaded="onLoaded">
    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost btn-sm" @click="rotate(-1)"><RotateCcw :size="15" /> 逆时针 90°</button>
      <button class="btn btn-ghost btn-sm" @click="rotate(1)"><RotateCw :size="15" /> 顺时针 90°</button>
      <button class="btn btn-ghost btn-sm" @click="rotate(1), rotate(1)">180°</button>
      <button class="btn btn-ghost btn-sm" @click="resetAngle"><Undo2 :size="15" /> 复位</button>
    </div>
    <div class="mt-2" style="max-width: 420px">
      <span class="field-label">自由角度：{{ angle }}°（叠加在直角之上，扩展画布填透明）</span>
      <input v-model.number="angle" type="range" min="-180" max="180" step="1" />
    </div>
  </ImageToolBase>
</template>
