<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Copy, Check, Trash2, Maximize2, Minimize2, Download } from 'lucide-vue-next'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    modelValue: string
    title?: string
    /** 提供下载扩展名后显示下载按钮 */
    download?: string
    mono?: boolean
    readonly?: boolean
    placeholder?: string
    /** 结果区下限高度（实际高度随视口弹性伸展） */
    minHeight?: string
  }>(),
  { title: '', mono: true, readonly: false, minHeight: '220px' },
)
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()
const toast = useToast()
const copied = ref(false)
/** 全屏查看：结果区铺满视口，Esc/按钮退出 */
const fullscreen = ref(false)

/** 弹性高度：视口越高结果区越大，下限取调用方 minHeight，上限防超长屏浪费 */
const flexHeight = computed(() => `clamp(${props.minHeight}, calc(100dvh - 380px), 780px)`)

const doCopy = async () => {
  if (!props.modelValue) return
  const okFlag = await copyText(props.modelValue)
  if (okFlag) {
    copied.value = true
    toast.ok('已复制到剪贴板')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const doDownload = () => {
  if (props.download) saveText(props.modelValue, `结果.${props.download}`)
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && fullscreen.value) fullscreen.value = false
}
watch(fullscreen, (on) => {
  document.documentElement.classList.toggle('rb-lock', on)
  if (on) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.documentElement.classList.remove('rb-lock')
})

const chars = computed(() => props.modelValue.length)
</script>

<template>
  <div class="result-box">
    <div v-if="title || modelValue" class="rb-head">
      <span class="rb-title">{{ title }}</span>
      <span class="rb-meta">{{ chars }} 字符</span>
      <span class="rb-actions">
        <button class="mini-btn" title="复制" aria-label="复制" :disabled="!modelValue" @click="doCopy">
          <Check v-if="copied" :size="13" color="#34d399" />
          <Copy v-else :size="13" />
        </button>
        <button v-if="download" class="mini-btn" title="下载为文件" aria-label="下载为文件" :disabled="!modelValue" @click="doDownload"><Download :size="13" /></button>
        <button v-if="!readonly" class="mini-btn" title="清空" aria-label="清空" :disabled="!modelValue" @click="emit('update:modelValue', '')">
          <Trash2 :size="13" />
        </button>
        <button class="mini-btn" title="全屏查看" aria-label="全屏查看" :disabled="!modelValue" @click="fullscreen = true">
          <Maximize2 :size="13" />
        </button>
      </span>
    </div>
    <textarea
      :value="modelValue"
      class="textarea mono rb-flex"
      :class="{ ro: readonly }"
      :readonly="readonly"
      :placeholder="placeholder ?? '结果将显示在这里…'"
      :style="{ minHeight, height: flexHeight }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>

    <!-- 全屏查看层：大结果（长 JSON/代码/文本）免滚动条中滚条 -->
    <Teleport to="body">
      <div v-if="fullscreen" class="rb-overlay" @click.self="fullscreen = false">
        <div class="rb-full">
          <div class="rb-full-head">
            <span class="rb-title">{{ title || '全屏结果' }}</span>
            <span class="rb-meta">{{ chars }} 字符</span>
            <span class="rb-actions">
              <button class="mini-btn" title="复制" aria-label="复制" @click="doCopy">
                <Check v-if="copied" :size="13" color="#34d399" />
                <Copy v-else :size="13" />
              </button>
              <button v-if="download" class="mini-btn" title="下载为文件" aria-label="下载为文件" @click="doDownload"><Download :size="13" /></button>
              <button class="mini-btn" title="退出全屏（Esc）" aria-label="退出全屏" @click="fullscreen = false">
                <Minimize2 :size="13" />
              </button>
            </span>
          </div>
          <textarea
            :value="modelValue"
            class="textarea mono"
            :class="{ ro: readonly }"
            :readonly="readonly"
            style="height: calc(100dvh - 130px); min-height: 0"
          ></textarea>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.result-box {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.rb-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.rb-meta {
  font-size: 12px;
  color: var(--text-3);
}
.rb-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.textarea.ro {
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
}
.rb-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 24px;
}
.rb-full {
  width: min(1200px, 100%);
  height: calc(100dvh - 48px);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 10px;
  background: var(--panel-solid);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 24px 70px rgb(0 0 0 / 0.35);
}
.rb-full-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>

<style>
/* 全屏时锁定页面滚动（Teleport 到 body，scoped 管不到） */
html.rb-lock {
  overflow: hidden;
}
</style>
