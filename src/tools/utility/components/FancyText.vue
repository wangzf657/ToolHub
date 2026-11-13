<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, ClipboardList } from 'lucide-vue-next'
import { FANCY_STYLES, fancyText } from '@/lib/textEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const text = ref('Hello ToolHub')
const copiedIdx = ref(-1)

/** 兼容徽标：各风格在 IG / 微博的实测兼容度（数学字母类字符部分平台字体缺字） */
const COMPAT: Record<string, { ig: boolean; wb: boolean; note: string }> = {
  bold: { ig: true, wb: true, note: '数学粗体：主流平台可显示' },
  italic: { ig: true, wb: true, note: '数学斜体：主流平台可显示' },
  script: { ig: true, wb: false, note: '花体：微博部分客户端显示为方框' },
  fraktur: { ig: false, wb: false, note: '哥特体：字符生僻，IG/微博兼容一般' },
  mono: { ig: true, wb: false, note: '等宽：微博部分客户端缺字' },
  circled: { ig: true, wb: true, note: '圆圈字：兼容好，但仅覆盖字母数字' },
  double: { ig: true, wb: false, note: '双线体：微博部分客户端缺字' },
  smallcaps: { ig: true, wb: true, note: '小型大写：兼容好' },
}

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

/** 复制全部风格：8 行「风格名：变换结果」 */
const copyAll = async () => {
  if (!text.value.trim()) return
  const lines = FANCY_STYLES.map((s) => `${s.label.split(' ')[0]}：${fancyText(text.value, s.key as never)}`)
  const okFlag = await copyText(lines.join('\n'))
  okFlag ? toast.ok('已复制全部风格') : toast.err('复制失败')
}

/* 输入历史：最近 5 条，chips 回填并实时重算 */
const HIST_KEY = 'toolhub.fancy-history'
const hist = ref<string[]>([])
try {
  hist.value = JSON.parse(localStorage.getItem(HIST_KEY) || '[]') as string[]
} catch {
  hist.value = []
}
watch(text, (v) => {
  const t = v.trim()
  if (!t) return
  if (hist.value[0] === t) return
  hist.value = [t, ...hist.value.filter((x) => x !== t)].slice(0, 5)
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(hist.value))
  } catch {
    /* 忽略 */
  }
})
const applyHist = (h: string) => {
  text.value = h
}
</script>

<template>
  <div>
    <div class="in-card">
      <span class="field-label">输入一次，下方 8 种风格实时预览</span>
      <input v-model="text" class="input" placeholder="输入要变换的文字，例如你的昵称" />
      <div v-if="hist.length" class="row row-wrap mt-1" style="gap: 6px; align-items: center">
        <span class="hint-text">历史：</span>
        <button v-for="h in hist" :key="h" class="chip" @click="applyHist(h)">{{ h }}</button>
      </div>
    </div>

    <div class="row mt-2" style="justify-content: flex-end">
      <button class="btn btn-ghost btn-sm" :disabled="!text.trim()" @click="copyAll"><ClipboardList :size="14" /> 复制全部风格</button>
    </div>

    <div class="list mt-1">
      <div v-for="(s, i) in FANCY_STYLES" :key="s.key" class="style-row" @click="doCopy(fancyText(text, s.key as never), i)">
        <div class="style-head">
          <span class="style-label">
            {{ s.label }}
            <span class="compat" :title="COMPAT[s.key]?.note">{{ COMPAT[s.key]?.ig ? 'IG ✓' : 'IG ⚠' }} / {{ COMPAT[s.key]?.wb ? '微博 ✓' : '微博 ⚠' }}</span>
          </span>
          <Check v-if="copiedIdx === i" :size="15" color="var(--ok)" />
          <span v-else class="style-copy">复制</span>
        </div>
        <div class="style-out">{{ text ? fancyText(text, s.key as never) : '（输入后预览）' }}</div>
      </div>
    </div>

    <p class="notice notice-info small mt-2">
      这些是 Unicode 数学字母/装饰符号，可直接粘贴到昵称、签名、群名片。徽标为兼容度提示（悬停查看说明）：部分平台字体缺少个别字符会显示为方框；中文与符号将原样保留。
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
.hint-text {
  font-size: 12px;
  color: var(--text-3);
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
.compat {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 8px;
  margin-left: 6px;
  cursor: help;
}
.style-copy {
  color: var(--text-3);
  font-size: 12.5px;
}
.style-out {
  margin-top: 4px;
  font-size: 18px;
  word-break: break-all;
  line-height: 1.5;
}
</style>
