<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import { toPng } from 'html-to-image'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** 印章风格示意图生成器（仅供文档示意/PPT 配图，不得伪造真实印章） */
const toast = useToast()

const org = ref('示例科技有限公司')
const center = ref('合同专用章')
const shape = ref<'circle' | 'ellipse'>('circle')
const ink = ref('#e02020')
const star = ref(true)
const busy = ref(false)

const id = `arc-${Math.random().toString(36).slice(2, 8)}`

const svg = computed(() => {
  const rx = shape.value === 'circle' ? 110 : 120
  const ry = 110
  return `<svg viewBox="0 0 260 260" width="260" height="260" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="130" cy="130" rx="${rx}" ry="${ry}" fill="none" stroke="${ink.value}" stroke-width="5"/>
  <path id="${id}" d="M 32 130 A 98 98 0 1 1 228 130" fill="none"/>
  <text font-size="19" font-family="'KaiTi','STKaiti','楷体',serif" fill="${ink.value}" font-weight="700" letter-spacing="2">
    <textPath href="#${id}" startOffset="50%" text-anchor="middle">${org.value}</textPath>
  </text>
  ${star.value ? `<path d="M130 106 L137 126 L158 126 L141 139 L147 160 L130 147 L113 160 L119 139 L102 126 L123 126 Z" fill="${ink.value}"/>` : ''}
  <text x="130" y="180" text-anchor="middle" font-size="24" font-family="'KaiTi','STKaiti','楷体',serif" fill="${ink.value}" font-weight="700">${center.value}</text>
</svg>`
})

const stageRef = ref<HTMLDivElement | null>(null)

const exportPng = async () => {
  if (!stageRef.value) return
  busy.value = true
  try {
    const url = await toPng(stageRef.value, { pixelRatio: 3 })
    saveBlob(await (await fetch(url)).blob(), '印章示意.png')
    toast.ok('已导出透明底 PNG')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="grid2">
        <div><span class="field-label">单位名称（环绕文字）</span><input v-model="org" class="input" /></div>
        <div><span class="field-label">中心文字</span><input v-model="center" class="input" /></div>
        <div>
          <span class="field-label">形状</span>
          <label class="check"><input v-model="shape" type="radio" value="circle" /> 正圆</label>
          <label class="check"><input v-model="shape" type="radio" value="ellipse" /> 椭圆</label>
        </div>
        <div>
          <span class="field-label">印泥色</span>
          <input v-model="ink" type="color" class="input" style="width: 44px; height: 30px; padding: 2px" />
          <label class="check"><input v-model="star" type="checkbox" /> 中心五角星</label>
        </div>
      </div>
    </div>

    <div class="mt-2 center">
      <div ref="stageRef" v-html="svg"></div>
      <button class="btn btn-primary mt-2" :disabled="busy" @click="exportPng"><Loader2 v-if="busy" :size="15" class="spin" /><Download v-else :size="15" /> 导出 PNG</button>
      <p class="hint mt-1">⚠ 本工具生成的是设计示意图，仅用于文档排版示意 / PPT 配图 / 产品原型，**不得用于伪造任何真实印章**（伪造印章属违法行为）。</p>
    </div>
  </div>
</template>

<style scoped>
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; align-items: end; }
.gap { gap: 10px; align-items: center; }
.center { display: flex; flex-direction: column; align-items: center; }
.hint { font-size: 12px; color: var(--muted); text-align: center; max-width: 480px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
</style>
