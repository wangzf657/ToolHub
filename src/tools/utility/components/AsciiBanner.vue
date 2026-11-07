<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'
import { asciiBanner } from '@/lib/textEngine'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref('TOOLHUB')
const fills = ['█', '▓', '#', '*', '='] as const
const fill = ref<string>('█')

const banner = (): string => {
  if (!text.value.trim()) return ''
  try {
    return asciiBanner(text.value, fill.value)
  } catch {
    return ''
  }
}

const copied = ref(false)
const doCopy = async () => {
  const b = banner()
  if (!b) return
  const okFlag = await copyText(b)
  if (okFlag) {
    copied.value = true
    toast.ok('已复制字符画（粘贴时请使用等宽字体）')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const download = () => {
  const b = banner()
  if (!b) return
  saveText(b, 'ascii-banner.txt')
}
</script>

<template>
  <div>
    <div class="in-card">
      <div class="grid-2">
        <div>
          <span class="field-label">文本（最多 12 个字符，英文数字为主）</span>
          <input v-model="text" class="input mono" placeholder="例如 TOOLHUB" />
        </div>
        <div>
          <span class="field-label">填充字符</span>
          <div class="row" style="gap: 8px">
            <button
              v-for="f in fills"
              :key="f"
              class="chip fill-chip mono"
              :class="{ active: fill === f }"
              @click="fill = f"
            >{{ f }}</button>
          </div>
        </div>
      </div>
    </div>

    <pre class="banner mt-2 mono">{{ banner() || '输入文本后生成 5 行高的字符画大字…' }}</pre>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="!banner()" @click="doCopy">
        <Check v-if="copied" :size="16" />
        <Copy v-else :size="16" /> 复制
      </button>
      <button class="btn btn-ghost" :disabled="!banner()" @click="download">⬇ 下载 txt</button>
      <span class="muted small">字符画需粘贴在等宽字体（代码块、README 代码区）中才能对齐</span>
    </div>
  </div>
</template>

<style scoped>
.in-card {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.fill-chip {
  font-size: 16px;
  width: 42px;
  justify-content: center;
}
.banner {
  margin: 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--code-bg);
  font-size: 12px;
  line-height: 1.25;
  overflow: auto;
  white-space: pre;
  min-height: 140px;
}
</style>
