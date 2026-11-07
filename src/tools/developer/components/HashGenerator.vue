<script setup lang="ts">
import { ref } from 'vue'
import { Hash, Copy, Check, FileText } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { digestText, digestFile } from '@/lib/hashEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
const toast = useToast()
const text = ref('')
const file = ref<File | null>(null)
const results = ref<{ algo: string; value: string }[]>([])
const busy = ref(false)
const upper = ref(false)
const compact = ref(false)
const copiedIdx = ref(-1)

const onFiles = (files: File[]) => {
  if (files.length) {
    file.value = files[0]
    text.value = ''
    results.value = []
  }
}

const run = async () => {
  if (!text.value && !file.value) return toast.warn('请输入文本或拖入文件')
  busy.value = true
  results.value = []
  try {
    for (const algo of ALGOS) {
      const value = file.value ? await digestFile(algo, file.value) : await digestText(algo, text.value)
      results.value.push({ algo, value: formatOne(value) })
    }
    toast.ok(`已计算 ${ALGOS.length} 种${file.value ? '文件' : '文本'}哈希`)
  } catch (e) {
    toast.err(`哈希计算失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const formatOne = (v: string) => {
  let out = compact.value ? v.replace(/-/g, '') : v
  return upper.value ? out.toUpperCase() : out
}

const reformat = () => {
  if (results.value.length) run()
}

const copy = async (i: number) => {
  const okFlag = await copyText(results.value[i]!.value)
  if (okFlag) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else toast.err('复制失败')
}
</script>

<template>
  <div class="hash-gen">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: center">
      <label class="check"><input v-model="upper" type="checkbox" @change="reformat" /> 大写输出</label>
      <label class="check"><input v-model="compact" type="checkbox" @change="reformat" /> 无连字符</label>
      <span class="grow"></span>
      <button class="btn btn-primary" :disabled="busy" @click="run"><Hash :size="16" /> 计算全部哈希</button>
    </div>

    <span class="field-label">文本输入</span>
    <textarea v-model="text" class="textarea mono" style="min-height: 110px" placeholder="输入要计算哈希的文本…" @input="file = null"></textarea>

    <div class="mt-2">
      <FileDrop label="或拖入文件计算哈希（本地计算，不上传）" :multiple="false" @files="onFiles" />
    </div>

    <div v-if="file" class="notice notice-info mt-2 small">
      <FileText :size="14" style="vertical-align: -2px" /> 将计算文件：{{ file.name }}（{{ Math.ceil(file.size / 1024) }} KB）
    </div>

    <div v-if="results.length" class="mt-3 hash-list">
      <div v-for="(r, i) in results" :key="r.algo" class="hash-row">
        <span class="algo">{{ r.algo }}</span>
        <code class="value mono">{{ r.value }}</code>
        <button class="mini-btn" title="复制" aria-label="复制" @click="copy(i)">
          <Check v-if="copiedIdx === i" :size="13" color="#34d399" />
          <Copy v-else :size="13" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hash-list {
  display: grid;
  gap: 8px;
}
.hash-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.algo {
  flex: none;
  width: 76px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 7px;
  padding: 3px 0;
  text-align: center;
}
.value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 12.5px;
  color: var(--text-2);
}
.mini-btn {
  flex: none;
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
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
</style>
