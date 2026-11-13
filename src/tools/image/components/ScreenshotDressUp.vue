<script setup lang="ts">
import { ref } from 'vue'
import { Image as ImageIcon, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { toPng } from 'html-to-image'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const imgUrl = ref('')
const imgName = ref('截图')
const shell = ref<'browser' | 'phone' | 'none'>('browser')
const radius = ref(14)
const bg = ref('gradient-1')
const pad = ref(40)
const caption = ref('')
const busy = ref(false)
/** rx1 地址栏可编辑；留空隐藏地址栏 */
const addr = ref('https://toolhub.example')
/** rx3 自定义渐变 */
const bgMode = ref<'preset' | 'custom'>('preset')
const c1 = ref('#6366f1')
const c2 = ref('#ec4899')
const angle = ref(135)
/** rx4 阴影 */
const shadowOn = ref(true)
const shadowBlur = ref(60)

const BGS = [
  { k: 'gradient-1', css: 'linear-gradient(135deg,#6366f1,#ec4899)' },
  { k: 'gradient-2', css: 'linear-gradient(135deg,#0ea5e9,#22d3ee)' },
  { k: 'gradient-3', css: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { k: 'gradient-4', css: 'linear-gradient(135deg,#10b981,#0ea5e9)' },
  { k: 'solid-light', css: '#f1f5f9' },
  { k: 'solid-dark', css: '#0f172a' },
]
const bgCss = () =>
  bgMode.value === 'custom' ? `linear-gradient(${angle.value}deg, ${c1.value}, ${c2.value})` : (BGS.find((b) => b.k === bg.value)?.css ?? BGS[0]!.css)
const shadowCss = () => (shadowOn.value ? `0 24px ${shadowBlur.value}px rgba(0,0,0,.35)` : 'none')

const onFiles = (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!f.type.startsWith('image/')) return toast.warn('请拖入图片文件')
  imgUrl.value = URL.createObjectURL(f)
  imgName.value = f.name.replace(/\.[^.]+$/, '')
}

const stageRef = ref<HTMLDivElement | null>(null)

const exportPng = async () => {
  if (!stageRef.value || !imgUrl.value) return toast.warn('请先拖入一张截图')
  busy.value = true
  try {
    const url = await toPng(stageRef.value, { pixelRatio: 2, cacheBust: true })
    const blob = await (await fetch(url)).blob()
    saveBlob(blob, `${imgName.value}-美化.png`)
    toast.ok('已导出 PNG')
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept="image/*" label="拖入截图（PNG/JPG）" @files="onFiles" />

    <div v-if="imgUrl" class="mt-2">
      <div class="opts-panel">
        <div class="row wrap gap">
          <span class="field-label">设备壳</span>
          <label class="seg" :class="{ active: shell === 'browser' }"><input v-model="shell" type="radio" value="browser" class="sr" /> 浏览器</label>
          <label class="seg" :class="{ active: shell === 'phone' }"><input v-model="shell" type="radio" value="phone" class="sr" /> 手机</label>
          <label class="seg" :class="{ active: shell === 'none' }"><input v-model="shell" type="radio" value="none" class="sr" /> 仅圆角</label>
          <span class="field-label">圆角</span>
          <input v-model.number="radius" type="number" class="input n-input" min="0" max="40" />
          <span class="field-label">留白</span>
          <input v-model.number="pad" type="number" class="input n-input" min="10" max="120" />
        </div>
        <div class="row wrap gap mt-2">
          <span class="field-label">背景</span>
          <label class="seg" :class="{ active: bgMode === 'preset' }"><input v-model="bgMode" type="radio" value="preset" class="sr" /> 预设</label>
          <label class="seg" :class="{ active: bgMode === 'custom' }"><input v-model="bgMode" type="radio" value="custom" class="sr" /> 自定义渐变</label>
          <template v-if="bgMode === 'preset'">
            <button v-for="b in BGS" :key="b.k" class="swatch" :style="{ background: b.css }" :class="{ active: bg === b.k }" @click="bg = b.k"></button>
          </template>
          <template v-else>
            <input v-model="c1" type="color" class="color-in" title="起始色" />
            <input v-model="c2" type="color" class="color-in" title="结束色" />
            <span class="field-label">角度 {{ angle }}°</span>
            <input v-model.number="angle" type="range" min="0" max="360" step="5" style="width: 110px" />
          </template>
        </div>
        <div class="row wrap gap mt-2">
          <label class="check"><input v-model="shadowOn" type="checkbox" /> 投影</label>
          <template v-if="shadowOn">
            <span class="field-label">强度 {{ shadowBlur }}px</span>
            <input v-model.number="shadowBlur" type="range" min="0" max="80" step="5" style="width: 120px" />
          </template>
        </div>
        <input v-model="caption" class="input mt-2" placeholder="底部说明文字（可选，如：ToolHub 新版界面）" />
        <input v-if="shell === 'browser'" v-model="addr" class="input mt-2" placeholder="地址栏文字（留空则隐藏地址栏）" />
      </div>

      <div class="mt-2 center">
        <div ref="stageRef" class="stage" :style="{ background: bgCss(), padding: `${pad}px` }">
          <div v-if="shell === 'browser'" class="win" :style="{ borderRadius: `${radius}px`, boxShadow: shadowCss() }">
            <div v-if="addr.trim()" class="win-bar">
              <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
              <span class="addr">{{ addr }}</span>
            </div>
            <img :src="imgUrl" class="shot" :style="{ borderRadius: addr.trim() ? `0 0 ${radius}px ${radius}px` : `${radius}px` }" alt="截图" />
          </div>
          <div v-else-if="shell === 'phone'" class="phone" :style="{ borderRadius: `${radius + 10}px`, boxShadow: shadowCss() }">
            <div class="notch"></div>
            <img :src="imgUrl" class="shot" :style="{ borderRadius: `${radius}px` }" alt="截图" />
          </div>
          <div v-else class="plain" :style="{ borderRadius: `${radius}px`, boxShadow: shadowCss() }">
            <img :src="imgUrl" class="shot" :style="{ borderRadius: `${radius}px` }" alt="截图" />
          </div>
          <p v-if="caption" class="cap">{{ caption }}</p>
        </div>
        <button class="btn btn-primary mt-2" :disabled="busy" @click="exportPng"><Download :size="16" /> {{ busy ? '导出中…' : '导出 PNG（2x）' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.seg { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.n-input { width: 70px; }
.color-in { width: 34px; height: 28px; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: none; cursor: pointer; }
.center { display: flex; flex-direction: column; align-items: center; }
.stage { border-radius: 18px; max-width: 780px; width: 100%; }
.win { overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.3); background: var(--panel-solid, #1e293b); }
.win-bar { display: flex; align-items: center; gap: 7px; padding: 10px 14px; background: rgba(127,127,127,.15); }
.dot { width: 11px; height: 11px; border-radius: 50%; }
.dot.r { background: #ff5f57; }
.dot.y { background: #febc2e; }
.dot.g { background: #28c840; }
.addr { margin-left: 8px; font-size: 12px; opacity: .65; background: rgba(127,127,127,.15); border-radius: 6px; padding: 2px 12px; }
.phone { position: relative; padding: 0; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.3); background: var(--panel-solid, #1e293b); border: 6px solid rgba(127,127,127,.35); }
.notch { width: 120px; height: 18px; background: rgba(127,127,127,.35); border-radius: 0 0 12px 12px; margin: 0 auto; }
.plain { overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.3); }
.shot { display: block; width: 100%; height: auto; }
.cap { text-align: center; color: rgba(255,255,255,.92); font-size: 14px; margin-top: 12px; text-shadow: 0 1px 4px rgba(0,0,0,.3); }
.swatch { width: 30px; height: 22px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; }
.swatch.active { border-color: var(--accent); }
</style>
