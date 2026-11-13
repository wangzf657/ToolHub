<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Contrast } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const fg = ref('#6366f1')
const bg = ref('#ffffff')

/* URL 快照（rx5）：fg/bg 写入查询参数，加载时还原 */
onMounted(() => {
  const q = new URLSearchParams(location.search)
  const f = q.get('fg')
  const b = q.get('bg')
  if (f) fg.value = f
  if (b) bg.value = b
})
watch([fg, bg], () => {
  const q = new URLSearchParams(location.search)
  q.set('fg', fg.value)
  q.set('bg', bg.value)
  history.replaceState(null, '', `${location.pathname}?${q.toString()}`)
})

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = Number.parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 非法颜色检测（rx1） */
const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim())
const fgValid = computed(() => isHex(fg.value))
const bgValid = computed(() => isHex(bg.value))
const allValid = computed(() => fgValid.value && bgValid.value)

/** WCAG 相对亮度 */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = computed(() => {
  if (!allValid.value) return NaN
  const l1 = luminance(fg.value)
  const l2 = luminance(bg.value)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
})

const ratioText = computed(() => (allValid.value ? ratio.value.toFixed(2) : '—'))

interface Level {
  label: string
  need: number
  pass: boolean
  note?: string
}

const levels = computed<Level[]>(() => [
  { label: 'AA 普通字号（≥ 4.5）', need: 4.5, pass: ratio.value >= 4.5 },
  { label: 'AA 大字号（≥ 3.0）', need: 3, pass: ratio.value >= 3, note: '大字号 ≥24px，或 ≥18.66px 粗体' },
  { label: 'AAA 普通字号（≥ 7.0）', need: 7, pass: ratio.value >= 7 },
  { label: 'AAA 大字号（≥ 4.5）', need: 4.5, pass: ratio.value >= 4.5, note: '大字号 ≥24px，或 ≥18.66px 粗体' },
  { label: 'UI 组件 / 图形（≥ 3.0）', need: 3, pass: ratio.value >= 3, note: '按钮边框、图标、进度条等非文字元素' },
])

const swap = () => {
  const t = fg.value
  fg.value = bg.value
  bg.value = t
}

/** 同色相建议色（rx4）：保持 HSL 色相/饱和度，二分调整亮度至恰好达标 */
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
  }
  return [h, s, l]
}
const hslToHex = (h: number, s: number, l: number): string => {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
const suggest = computed(() => {
  if (!allValid.value || ratio.value >= 4.5) return null
  const [h, s] = rgbToHsl(...hexToRgb(fg.value))
  const bgLum = luminance(bg.value)
  const dirDown = luminance(fg.value) > bgLum // 前景更亮 → 向暗处压亮度
  let lo = dirDown ? 0 : 0.5
  let hi = dirDown ? 0.5 : 1
  const ratioWith = (hex: string) => {
    const l = luminance(hex)
    return (Math.max(l, bgLum) + 0.05) / (Math.min(l, bgLum) + 0.05)
  }
  // 二分：朝远离背景亮度的方向找「恰好达标」的最亮（或最暗）亮度
  let best = dirDown ? 0 : 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const hex = hslToHex(h, s, mid)
    if (ratioWith(hex) >= 4.5) {
      best = mid
      // 从达标侧继续逼近边界：方向压暗时向上探，方向提亮时向下探
      if (dirDown) lo = mid
      else hi = mid
    } else if (dirDown) hi = mid
    else lo = mid
    if (hi - lo < 0.002) break
  }
  const hex = hslToHex(h, s, best)
  return { hex, newRatio: ratioWith(hex).toFixed(2) }
})

const applySuggest = () => {
  if (suggest.value) {
    fg.value = suggest.value.hex
    toast.ok(`已换用同色相建议色 ${suggest.value.hex}（新比值 ${suggest.value.newRatio}:1）`)
  }
}

const copy = async () => {
  const okFlag = await copyText(`对比度 ${ratioText.value}:1（${fg.value} on ${bg.value}）`)
  okFlag ? toast.ok('结果已复制') : toast.err('复制失败')
}
</script>

<template>
  <div class="contrast-check">
    <div class="row row-wrap" style="gap: 16px; align-items: end">
      <div>
        <span class="field-label">前景色（文字）</span>
        <div class="row" style="gap: 6px; flex-wrap: nowrap">
          <input v-model="fg" type="color" class="color-pick" />
          <input v-model="fg" type="text" class="input mono" style="width: 110px" spellcheck="false" :class="{ 'input-bad': !fgValid }" />
        </div>
        <p v-if="!fgValid" class="small" style="margin: 3px 0 0; color: var(--err)">无法识别的颜色（需 #RGB 或 #RRGGBB）</p>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-bottom: 2px" @click="swap">⇄ 交换</button>
      <div>
        <span class="field-label">背景色</span>
        <div class="row" style="gap: 6px; flex-wrap: nowrap">
          <input v-model="bg" type="color" class="color-pick" />
          <input v-model="bg" type="text" class="input mono" style="width: 110px" spellcheck="false" :class="{ 'input-bad': !bgValid }" />
        </div>
        <p v-if="!bgValid" class="small" style="margin: 3px 0 0; color: var(--err)">无法识别的颜色（需 #RGB 或 #RRGGBB）</p>
      </div>
    </div>

    <div class="mt-3 ratio-card" :class="{ dim: !allValid }" :style="allValid ? { background: bg, color: fg } : {}">
      <div class="ratio-num mono">{{ ratioText }}<small v-if="allValid">:1</small></div>
      <div v-if="allValid" class="ratio-sample">
        <p style="font-size: 20px; font-weight: 700; margin: 0 0 4px">大字号标题预览（18pt+）</p>
        <p style="font-size: 14.5px; margin: 0">普通字号正文预览：浏览器本地计算，数据不出设备。</p>
      </div>
      <div v-else class="ratio-sample muted small">无法识别的颜色：修正输入后显示比值与预览。</div>
    </div>

    <div class="mt-3 levels">
      <div v-for="l in levels" :key="l.label" class="level-row" :class="{ pass: l.pass }">
        <span class="lv-badge">{{ allValid ? (l.pass ? '通过' : '未通过') : '—' }}</span>
        <span>{{ l.label }}<span v-if="l.note" class="muted small" style="margin-left: 8px">{{ l.note }}</span></span>
      </div>
    </div>

    <div v-if="suggest" class="notice notice-warn mt-2">
      对比度不足 4.5:1。试试同色相的建议色 <button class="btn btn-soft btn-sm" style="margin: 0 6px" @click="applySuggest">{{ suggest.hex }}</button>（新比值约 {{ suggest.newRatio }}:1，保持原色相不变）
    </div>

    <button class="btn btn-ghost btn-sm mt-2" @click="copy"><Contrast :size="14" /> 复制结果</button>

    <p class="notice notice-info mt-2 small">
      计算口径：WCAG 2.x 相对亮度公式 L = 0.2126R + 0.7152G + 0.0722B（sRGB 线性化），对比度 = (L亮 + 0.05) / (L暗 + 0.05)。
    </p>
  </div>
</template>

<style scoped>
.color-pick {
  width: 44px;
  height: 38px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: none;
  cursor: pointer;
  padding: 2px;
}
.ratio-card {
  border-radius: 14px;
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 26px;
  border: 1px solid var(--border);
  transition: background 0.2s, color 0.2s;
}
.ratio-num {
  font-size: 46px;
  font-weight: 800;
  line-height: 1;
  flex: none;
}
.ratio-num small {
  font-size: 20px;
}
.levels {
  display: grid;
  gap: 7px;
}
.level-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13.5px;
  color: var(--text-2);
}
.lv-badge {
  flex: none;
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}
.level-row.pass .lv-badge {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
</style>
