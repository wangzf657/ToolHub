<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw, Copy, Check } from 'lucide-vue-next'
import { uuidv4 } from '@/lib/textEngine'
import { copyText, saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const count = ref(5)
const upper = ref(false)
const noHyphen = ref(false)

const uuids = ref<string[]>([])
const copiedAll = ref(false)
const copiedIdx = ref(-1)

const formatOne = (u: string) => {
  let s = u
  if (noHyphen.value) s = s.replace(/-/g, '')
  return upper.value ? s.toUpperCase() : s
}

const generate = () => {
  const n = Math.max(1, Math.min(1000, Math.floor(count.value)))
  uuids.value = Array.from({ length: n }, () => formatOne(uuidv4()))
}
generate()

const doCopyAll = async () => {
  const okFlag = await copyText(uuids.value.join('\n'))
  if (okFlag) {
    copiedAll.value = true
    toast.ok(`已复制 ${uuids.value.length} 个 UUID`)
    setTimeout(() => (copiedAll.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}

const doCopyOne = async (u: string, i: number) => {
  const okFlag = await copyText(u)
  if (okFlag) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1200)
  } else {
    toast.err('复制失败')
  }
}

const download = () => saveText(uuids.value.join('\n'), 'uuids.txt')
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row row-wrap">
        <div>
          <span class="field-label">生成数量（1–1000）</span>
          <input v-model.number="count" type="number" class="input count-input" min="1" max="1000" />
        </div>
        <label class="check self-end"><input v-model="upper" type="checkbox" @change="generate" /> <span>大写</span></label>
        <label class="check self-end"><input v-model="noHyphen" type="checkbox" @change="generate" /> <span>去掉连字符</span></label>
        <button class="btn btn-primary self-end" @click="generate">
          <RefreshCw :size="16" /> 生成
        </button>
      </div>
      <p class="muted small mt-1">UUIDv4 基于 crypto.getRandomValues，碰撞概率可忽略，适合数据库主键、请求 ID。</p>
    </div>

    <div class="io-head mt-2">
      <span class="io-title">共 {{ uuids.length }} 个</span>
      <div class="row" style="gap: 8px">
        <button class="btn btn-ghost btn-sm" @click="doCopyAll">
          <Check v-if="copiedAll" :size="14" color="var(--ok)" />
          <Copy v-else :size="14" /> 复制全部
        </button>
        <button class="btn btn-ghost btn-sm" @click="download">⬇ 下载 txt</button>
      </div>
    </div>

    <div class="list mt-1">
      <div v-for="(u, i) in uuids" :key="i" class="u-row" @click="doCopyOne(u, i)" title="点击复制">
        <code class="mono">{{ u }}</code>
        <Check v-if="copiedIdx === i" :size="14" color="var(--ok)" />
        <Copy v-else :size="14" class="u-copy" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.opts-panel {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.count-input {
  width: 110px;
}
.self-end {
  align-self: flex-end;
}
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.list {
  display: grid;
  gap: 6px;
  max-height: 420px;
  overflow: auto;
}
.u-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  cursor: pointer;
  font-size: 13.5px;
}
.u-row:hover {
  border-color: var(--accent);
}
.u-copy {
  color: var(--text-3);
  flex: none;
}
</style>
