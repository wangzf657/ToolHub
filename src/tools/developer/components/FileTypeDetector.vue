<script setup lang="ts">
import { ref } from 'vue'
import { FileSearch, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)

interface Row {
  name: string
  size: number
  nameExt: string
  detectedExt: string
  detectedMime: string
  match: 'ok' | 'mismatch' | 'unknown'
  hex: string
}
const rows = ref<Row[]>([])

const extOf = (name: string) => {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : '（无扩展名）'
}

const toHex = (bytes: Uint8Array, n = 16) =>
  Array.from(bytes.slice(0, n)).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')

const analyze = async (file: File): Promise<Row> => {
  // file-type 按魔数识别，一般读前 4100 字节足够（覆盖 zip/mp4 等容器头的 box 定位）
  const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer())
  const { fileTypeFromBuffer } = await import('file-type')
  const t = await fileTypeFromBuffer(head)
  const nameExt = extOf(file.name)
  const detectedExt = t?.ext ?? ''
  return {
    name: file.name,
    size: file.size,
    nameExt,
    detectedExt: detectedExt || '未收录',
    detectedMime: t?.mime ?? '未收录',
    match: !t ? 'unknown' : detectedExt === nameExt ? 'ok' : 'mismatch',
    hex: toHex(head),
  }
}

const onFiles = async (files: File[]) => {
  if (!files.length) return
  if (files.length > 20) return toast.warn('单次最多识别 20 个文件')
  busy.value = true
  try {
    rows.value = []
    const out: Row[] = []
    for (const f of files) out.push(await analyze(f))
    rows.value = out
    toast.ok(`已识别 ${out.length} 个文件的真实类型`)
  } catch (e) {
    toast.err(`识别失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ftd">
    <FileDrop label="拖入文件，识别真实文件类型（本地读取前几 KB，不上传）" hint="通过魔数（magic bytes）判断，不依赖扩展名" @files="onFiles" />

    <p v-if="busy" class="muted small mt-2"><Loader2 :size="13" class="spin" style="vertical-align: -2px" /> 正在读取并识别…</p>

    <div v-if="rows.length" class="mt-3">
      <div v-for="(r, i) in rows" :key="r.name + i" class="row-card">
        <div class="row row-wrap" style="gap: 12px; align-items: baseline">
          <FileSearch :size="15" style="color: var(--accent-text)" />
          <b class="name mono">{{ r.name }}</b>
          <span class="muted small">{{ r.size < 1024 ? `${r.size} B` : `${(r.size / 1024).toFixed(1)} KB` }}</span>
          <span class="verdict ok" v-if="r.match === 'ok'">✓ 扩展名与真实类型一致</span>
          <span class="verdict bad" v-else-if="r.match === 'mismatch'">✗ 扩展名不符</span>
          <span class="verdict muted" v-else>未收录（不在常见格式库中）</span>
        </div>
        <div class="grid-3 mt-2" style="gap: 10px">
          <div class="cell"><span class="k">扩展名声明</span><span class="v mono">.{{ r.nameExt }}</span></div>
          <div class="cell"><span class="k">真实类型</span><span class="v mono">{{ r.detectedExt }}</span></div>
          <div class="cell"><span class="k">真实 MIME</span><span class="v mono">{{ r.detectedMime }}</span></div>
        </div>
        <div class="hexline mt-1">
          <span class="k">文件头魔数（前 16 字节）</span>
          <code class="mono">{{ r.hex }}</code>
        </div>
      </div>
    </div>

    <div class="notice notice-info mt-3 small">
      <p>原理：每种文件格式在头部都有固定的「魔数」字节（如 PNG 为 <code>89 50 4E 47</code>、JPEG 为 <code>FF D8 FF</code>、ZIP 容器为 <code>50 4B</code>）。本工具读取文件头部比对魔数得出真实类型，可用来排查「改了扩展名的文件」「伪装后缀」。</p>
      <p class="mt-1">文本类格式（.txt/.csv/.js 等）没有统一魔数，不在识别范围内，会显示「未收录」。</p>
    </div>
  </div>
</template>

<style scoped>
.row-card {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  margin-bottom: 10px;
}
.name { overflow-wrap: anywhere; }
.verdict { font-size: 12.5px; font-weight: 700; }
.verdict.ok { color: var(--ok); }
.verdict.bad { color: var(--err); }
.cell { padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; gap: 2px; }
.cell .k { font-size: 12px; color: var(--muted); }
.cell .v { font-size: 13px; color: var(--text-2); }
.hexline { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }
.hexline .k { font-size: 12px; color: var(--muted); }
.hexline code { font-size: 12px; color: var(--text-2); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
