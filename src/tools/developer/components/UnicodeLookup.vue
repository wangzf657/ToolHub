<script setup lang="ts">
import { computed, ref } from 'vue'
import { Binary, ArrowLeftRight } from 'lucide-vue-next'
import { unicodeInfo } from '@/lib/jsEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const text = ref('中A')
const reverseInput = ref('')

const MAX = 200

interface CharRow {
  char: string
  codePoint: string
  decimal: number
  block: string
  entity: string
}

const rows = computed<CharRow[]>(() => {
  const t = text.value.slice(0, MAX)
  return [...t].map((ch) => unicodeInfo(ch))
})

const reversed = computed(() => {
  const raw = reverseInput.value.trim()
  if (!raw) return null
  // 支持 U+4E2D / u4e2d / 19968 / 0x4E2D
  let cp: number | null = null
  const mHexU = raw.match(/^[uU]\+?([0-9a-fA-F]{1,6})$/)
  const mHex0x = raw.match(/^0[xX]([0-9a-fA-F]{1,6})$/)
  const mDec = raw.match(/^\d{1,7}$/)
  if (mHexU) cp = Number.parseInt(mHexU[1]!, 16)
  else if (mHex0x) cp = Number.parseInt(mHex0x[1]!, 16)
  else if (mDec) cp = Number(raw)
  if (cp === null || Number.isNaN(cp) || cp < 0 || cp > 0x10ffff) {
    return { ok: false as const, error: '请输入 U+4E2D、4E2D、0x4E2D 或十进制 19968 形式（0 ~ 0x10FFFF）' }
  }
  try {
    return { ok: true as const, char: String.fromCodePoint(cp), info: unicodeInfo(String.fromCodePoint(cp)) }
  } catch {
    return { ok: false as const, error: '该码点不是有效的 Unicode 标量值' }
  }
})

const copyAll = async () => {
  const t = rows.value.map((r) => `${r.char}\t${r.codePoint}\t${r.decimal}\t${r.block}\t${r.entity}`).join('\n')
  const okFlag = await copyText(t)
  okFlag ? toast.ok('已复制全部查询结果') : toast.err('复制失败')
}
</script>

<template>
  <div class="uni-lookup">
    <div class="grid-2" style="gap: 14px; align-items: start">
      <section>
        <span class="field-label">输入字符或一段文本（最多 {{ MAX }} 字符，逐字列出）</span>
        <textarea v-model="text" class="textarea mono" style="min-height: 90px" maxlength="400"></textarea>
        <p class="small muted" style="margin: 4px 2px 0">{{ [...text].length }} / {{ MAX }} 字符</p>

        <div v-if="rows.length" class="mt-2 char-list">
          <div v-for="(r, i) in rows" :key="i" class="char-row">
            <span class="big-char">{{ r.char }}</span>
            <code class="cp mono">{{ r.codePoint }}</code>
            <span class="dec mono">{{ r.decimal }}</span>
            <span class="block">{{ r.block }}</span>
            <code class="entity mono">{{ r.entity }}</code>
          </div>
        </div>
        <button v-if="rows.length" class="btn btn-ghost btn-sm mt-1" @click="copyAll">复制全部结果</button>
      </section>

      <section>
        <span class="field-label"><ArrowLeftRight :size="14" style="vertical-align: -2px" /> 码点反查字符</span>
        <input v-model="reverseInput" type="text" class="input mono" placeholder="U+4E2D 或 19968" spellcheck="false" />

        <div v-if="reversed && reversed.ok" class="rev-card mt-2">
          <span class="rev-char">{{ reversed.char }}</span>
          <div class="rev-meta">
            <div><span>码点</span><b class="mono">{{ reversed.info.codePoint }}</b></div>
            <div><span>十进制</span><b class="mono">{{ reversed.info.decimal }}</b></div>
            <div><span>区块</span><b>{{ reversed.info.block }}</b></div>
            <div><span>HTML 实体</span><b class="mono">{{ reversed.info.entity }}</b></div>
          </div>
        </div>
        <div v-else-if="reversed && !reversed.ok" class="notice notice-err mt-2">{{ reversed.error }}</div>
        <div v-else class="notice notice-info mt-2">输入码点实时显示对应字符。</div>

        <div class="notice notice-info mt-3 small">
          <Binary :size="13" style="vertical-align: -2px" /> 说明：本工具提供码点与区块查询，不支持汉字转拼音；URL slug 场景中中文会原样保留。
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.char-list {
  display: grid;
  gap: 6px;
  max-height: 420px;
  overflow: auto;
}
.char-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font-size: 13px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.big-char {
  flex: none;
  width: 36px;
  font-size: 22px;
  text-align: center;
  color: var(--accent-text);
  font-weight: 600;
}
.cp {
  flex: none;
  width: 84px;
  color: var(--text-2);
}
.dec {
  flex: none;
  width: 64px;
  color: var(--text-3);
}
.block {
  flex: 1;
  color: var(--text-2);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entity {
  flex: none;
  color: var(--text-3);
}
.rev-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 18px;
  align-items: center;
}
.rev-char {
  font-size: 64px;
  color: var(--accent-text);
  line-height: 1;
}
.rev-meta {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.rev-meta div {
  display: flex;
  gap: 12px;
}
.rev-meta span {
  flex: none;
  width: 64px;
  color: var(--text-3);
}
</style>
