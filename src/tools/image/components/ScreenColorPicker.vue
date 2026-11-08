<script setup lang="ts">
/** 屏幕取色器：EyeDropper API（Chrome/Edge 95+），历史色板 localStorage，不支持时降级引导 */
import { ref } from 'vue'
import { Pipette, Copy, Check, Trash2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

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
    // eslint-disable-next-line no-new-func
    const EyeDropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    const { sRGBHex } = await new EyeDropper().open()
    history.value = [sRGBHex.toUpperCase(), ...history.value.filter((c) => c !== sRGBHex.toUpperCase())].slice(0, 18)
    persist()
    toast.ok(`已取色 ${sRGBHex.toUpperCase()}（可去「颜色转换器」继续换算）`)
  } catch {
    // 用户按 Esc 取消，不打扰
  }
}

const doCopy = async (c: string) => {
  const okFlag = await navigator.clipboard.writeText(c).then(() => true).catch(() => false)
  if (okFlag) {
    copied.value = c
    setTimeout(() => (copied.value = ''), 1200)
  } else toast.err('复制失败')
}

const clearHistory = () => {
  history.value = []
  persist()
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2">
      <button class="btn btn-primary" @click="pick"><Pipette :size="16" /> 从屏幕取色</button>
      <button v-if="history.length" class="btn btn-ghost btn-sm" @click="clearHistory"><Trash2 :size="14" /> 清空历史</button>
      <span class="muted small">点击后鼠标变吸管，单击屏幕任意位置取色（本页之外的窗口也可）</span>
    </div>

    <div v-if="!supported" class="notice notice-warn">
      当前浏览器不支持屏幕取色（需要 Chrome 95+ / Edge 95+）。Firefox / Safari 用户可先用「图片取色器」对截图取色。
    </div>

    <div v-if="history.length" class="palette">
      <div v-for="c in history" :key="c" class="swatch" @click="doCopy(c)">
        <span class="chip" :style="{ background: c }"></span>
        <code class="mono">{{ c }}</code>
        <Check v-if="copied === c" :size="13" class="ok" />
        <Copy v-else :size="13" class="dim" />
      </div>
    </div>
    <p v-else class="muted small mt-2">取过的颜色会出现在这里（保存在本地浏览器）。</p>
  </div>
</template>

<style scoped>
.palette {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
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
.ok {
  color: var(--accent-text);
}
.dim {
  color: var(--text-3);
}
</style>
