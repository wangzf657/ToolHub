<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, FileCode2, Loader2 } from 'lucide-vue-next'
import { toPng } from 'html-to-image'
import { saveBlob, saveText } from '@/lib/download'
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

/** 预设章型：一键填充文案与星标组合 */
const PRESETS = [
  { label: '公章', org: '示例科技有限公司', center: '', star: true },
  { label: '合同专用章', org: '示例科技有限公司', center: '合同专用章', star: true },
  { label: '财务专用章', org: '示例科技有限公司', center: '财务专用章', star: true },
  { label: '发票专用章', org: '示例科技有限公司', center: '发票专用章', star: false },
]
const applyPreset = (p: { org: string; center: string; star: boolean }) => {
  org.value = p.org
  center.value = p.center
  star.value = p.star
}

/** 环绕文字字号自适应：按字数缩放，14 字也不溢出弧线 */
const orgFontSize = computed(() => {
  const n = Math.max(1, [...org.value].length)
  return Math.max(10, Math.min(19, Math.round((240 / n) * 0.92)))
})

const svg = computed(() => {
  const rx = shape.value === 'circle' ? 110 : 120
  const ry = 110
  return `<svg viewBox="0 0 260 260" width="260" height="260" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="130" cy="130" rx="${rx}" ry="${ry}" fill="none" stroke="${ink.value}" stroke-width="5"/>
  <path id="${id}" d="M 32 130 A 98 98 0 1 1 228 130" fill="none"/>
  <text font-size="${orgFontSize.value}" font-family="'KaiTi','STKaiti','楷体',serif" fill="${ink.value}" font-weight="700" letter-spacing="2">
    <textPath href="#${id}" startOffset="50%" text-anchor="middle">${org.value}</textPath>
  </text>
  ${star.value ? `<path d="M130 106 L137 126 L158 126 L141 139 L147 160 L130 147 L113 160 L119 139 L102 126 L123 126 Z" fill="${ink.value}"/>` : ''}
  ${center.value ? `<text x="130" y="180" text-anchor="middle" font-size="24" font-family="'KaiTi','STKaiti','楷体',serif" fill="${ink.value}" font-weight="700">${center.value}</text>` : ''}
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

/** SVG 矢量导出：文字仍为 text 节点，可无损缩放二次编辑 */
const exportSvg = () => {
  saveText(svg.value, '印章示意.svg', 'image/svg+xml')
  toast.ok('已导出 SVG 矢量文件')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap" style="gap: 8px; align-items: center">
        <span class="field-label" style="margin: 0">预设章型</span>
        <button v-for="p in PRESETS" :key="p.label" class="chip" @click="applyPreset(p)">{{ p.label }}</button>
      </div>
      <div class="grid2 mt-2">
        <div><span class="field-label">单位名称（环绕文字，超长自动缩小字号）</span><input v-model="org" class="input" /></div>
        <div><span class="field-label">中心文字（留空不绘制）</span><input v-model="center" class="input" /></div>
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
      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy" @click="exportPng"><Loader2 v-if="busy" :size="15" class="spin" /><Download v-else :size="15" /> 导出 PNG</button>
        <button class="btn btn-ghost" @click="exportSvg"><FileCode2 :size="15" /> 导出 SVG 矢量</button>
      </div>
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
