<script setup lang="ts">
/**
 * 屏幕取色器（UX1.0）：
 * - 多格式复制（rx1）：每条历史 HEX/RGB/HSL 三个复制按钮（HSL 按标准公式换算）。
 * - 单条删除（rx2）：hover 显示 × 删除，删除后持久化一致。
 * - 支持状态常驻（rx3）：按钮旁支持/不支持 chip，不支持文案注明含移动端浏览器。
 * - 最近色大预览（rx5）：按钮左侧 48px 大色块 + HEX 大字，附「去颜色转换器」跳转
 *   （useToast 仅纯文本无法内嵌链接，以常驻跳转入口替代 toast 内链接）。
 */
import { ref } from 'vue'
import { Pipette, Copy, Check, Trash2, X, ArrowRight } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/download'

const toast = useToast()
const supported = ref(typeof window !== 'undefined' && 'EyeDropper' in window)
const history = ref<string[]>(load())
const copied = ref('')

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem('toolhub:colors') ?? '[]')
  } catch {
    return []
  }
}
const persist = () => localStorage.setItem('toolhub:colors', JSON.stringify(history.value))

const pick = async () => {
  if (!supported.value) {
    toast.err('当前浏览器不支持 EyeDropper API，请使用 Chrome / Edge 95+，或改用「图片取色器」')
    return
  }
  try {
    const EyeDropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    const { sRGBHex } = await new EyeDropper().open()
    history.value = [sRGBHex.toUpperCase(), ...history.value.filter((c) => c !== sRGBHex.toUpperCase())].slice(0, 18)
    persist()
    toast.ok(`已取色 ${sRGBHex.toUpperCase()}`)
  } catch {
    // 用户按 Esc 取消，不打扰
  }
}

async function doCopy(c: string, label = c) {
  const okFlag = await copyText(c)
  if (okFlag) {
    copied.value = label
    setTimeout(() => (copied.value = ''), 1200)
  } else toast.err('复制失败')
}

/** HEX → RGB / HSL（标准公式，rx1） */
function toRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbText = (hex: string) => {
  const [r, g, b] = toRgb(hex)
  return `rgb(${r}, ${g}, ${b})`
}
const hslText = (hex: string) => {
  const [r0, g0, b0] = toRgb(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r0, g0, b0)
  const min = Math.min(r0, g0, b0)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0)) / 6
    else if (max === g0) h = ((b0 - r0) / d + 2) / 6
    else h = ((r0 - g0) / d + 4) / 6
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

const removeAt = (i: number) => {
  history.value = history.value.filter((_, j) => j !== i)
  persist()
}
const clearHistory = () => {
  history.value = []
  persist()
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 12px">
      <!-- 最近色大预览（rx5） -->
      <div v-if="history.length" class="latest">
        <span class="latest-chip" :style="{ background: history[0] }"></span>
        <div class="latest-meta">
          <code class="mono latest-hex">{{ history[0] }}</code>
          <span class="row" style="gap: 10px">
            <button class="link-btn" @click="doCopy(history[0]!)">复制 HEX</button>
            <RouterLink class="link-btn" to="/t/color-converter">去颜色转换器 <ArrowRight :size="12" /></RouterLink>
          </span>
        </div>
      </div>
      <button class="btn btn-primary" @click="pick"><Pipette :size="16" /> 从屏幕取色</button>
      <span class="chip-supp" :class="supported ? 'ok' : 'no'">
        {{ supported ? '当前浏览器支持取色' : '当前浏览器不支持取色（含移动端浏览器）' }}
      </span>
      <button v-if="history.length" class="btn btn-ghost btn-sm" @click="clearHistory"><Trash2 :size="14" /> 清空历史</button>
    </div>
    <p class="muted small mb-2">点击「从屏幕取色」后鼠标变吸管，单击屏幕任意位置取色（本页之外的窗口也可）。</p>

    <div v-if="!supported" class="notice notice-warn">
      当前浏览器不支持屏幕取色（需要 Chrome 95+ / Edge 95+，移动端浏览器均不支持）。可先用「图片取色器」对截图取色。
    </div>

    <div v-if="history.length" class="palette">
      <div v-for="(c, i) in history" :key="c" class="swatch">
        <span class="chip" :style="{ background: c }"></span>
        <code class="mono">{{ c }}</code>
        <span class="row fmt" style="gap: 4px">
          <button class="mini-btn" title="复制 HEX" @click="doCopy(c, c + '#hex')">HEX</button>
          <button class="mini-btn" title="复制 RGB" @click="doCopy(rgbText(c), c + '#rgb')">RGB</button>
          <button class="mini-btn" title="复制 HSL" @click="doCopy(hslText(c), c + '#hsl')">HSL</button>
          <button class="mini-btn danger" title="删除该色" :aria-label="`删除 ${c}`" @click="removeAt(i)"><X :size="12" /></button>
          <Check v-if="copied === c + '#hex'" :size="13" class="ok" />
          <Check v-else-if="copied === c + '#rgb'" :size="13" class="ok" />
          <Check v-else-if="copied === c + '#hsl'" :size="13" class="ok" />
        </span>
      </div>
    </div>
    <p v-else class="muted small mt-2">取过的颜色会出现在这里（保存在本地浏览器）。</p>
  </div>
</template>

<style scoped>
.latest {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.latest-chip {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  border: 1px solid var(--border);
  flex: none;
}
.latest-meta {
  display: grid;
  gap: 3px;
}
.latest-hex {
  font-size: 17px;
  font-weight: 700;
}
.link-btn {
  border: none;
  background: none;
  color: var(--accent-text);
  cursor: pointer;
  font-size: 12.5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  text-decoration: underline;
}
.chip-supp {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
}
.chip-supp.ok {
  color: #34d399;
  border-color: color-mix(in srgb, #34d399 45%, transparent);
}
.chip-supp.no {
  color: var(--warn);
  border-color: color-mix(in srgb, var(--warn) 45%, transparent);
}
.palette {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}
.swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.swatch:hover {
  border-color: var(--accent);
}
.chip {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid var(--border);
  flex: none;
}
.swatch code {
  flex: 1;
  font-size: 13px;
}
.fmt {
  opacity: 0;
  transition: opacity 0.12s;
}
.swatch:hover .fmt {
  opacity: 1;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  height: 22px;
  padding: 0 6px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 11px;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn.danger:hover {
  border-color: var(--err, #e5484d);
  color: var(--err, #e5484d);
}
.ok {
  color: var(--accent-text);
}
</style>
