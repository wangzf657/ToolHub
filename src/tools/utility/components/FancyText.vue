<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'
import { FANCY_STYLES, fancyText } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const text = ref('Hello ToolHub')
const copiedIdx = ref(-1)

const doCopy = async (out: string, i: number) => {
  if (!out) return
  const okFlag = await copyText(out)
  if (okFlag) {
    copiedIdx.value = i
    toast.ok('已复制该风格')
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else {
    toast.err('复制失败')
  }
}
</script>

<template>
  <div>
    <div class="in-card">
      <span class="field-label">输入一次，下方 8 种风格实时预览</span>
      <input v-model="text" class="input" placeholder="输入要变换的文字，例如你的昵称" />
    </div>

    <div class="list mt-2">
      <div v-for="(s, i) in FANCY_STYLES" :key="s.key" class="style-row" @click="doCopy(fancyText(text, s.key as never), i)">
        <div class="style-head">
          <span class="style-label">{{ s.label }}</span>
          <Check v-if="copiedIdx === i" :size="15" color="var(--ok)" />
          <Copy v-else :size="15" class="style-copy" />
        </div>
        <div class="style-out">{{ text ? fancyText(text, s.key as never) : '（输入后预览）' }}</div>
      </div>
    </div>

    <p class="notice notice-info small mt-2">
      这些是 Unicode 数学字母/装饰符号，可直接粘贴到昵称、签名、群名片。部分平台字体可能缺少个别字符而显示为方框；中文与符号将原样保留。
    </p>
  </div>
</template>

<style scoped>
.in-card {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.list {
  display: grid;
  gap: 8px;
}
.style-row {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  cursor: pointer;
}
.style-row:hover {
  border-color: var(--accent);
}
.style-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.style-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-3);
}
.style-copy {
  color: var(--text-3);
}
.style-out {
  margin-top: 4px;
  font-size: 18px;
  word-break: break-all;
  line-height: 1.5;
}
</style>
