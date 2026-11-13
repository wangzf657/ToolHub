<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Hash, Copy, Check, FileText, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { digestText, digestFile, type HashAlgo } from '@/lib/hashEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const BASE_ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'CRC32', 'SM3'] as const
type Algo = (typeof BASE_ALGOS)[number]
const toast = useToast()
const router = useRouter()
const text = ref('')
const file = ref<File | null>(null)
/** 原始哈希缓存：大写/紧凑开关只重排版，不重算（rx1） */
const rawResults = ref<{ algo: Algo; value: string }[]>([])
const busy = ref(false)
const upper = ref(false)
const compact = ref(false)
const copiedIdx = ref(-1)
const expected = ref('')
/** 拖入即算（rx4，默认开） */
const autoRun = ref(true)
/** 进度与耗时（rx2） */
const progress = ref(0)
const progressLabel = ref('')
const elapsed = ref('')
let cancelled = false
let startTime = 0

const onFiles = (files: File[]) => {
  if (files.length) {
    file.value = files[0]
    text.value = ''
    rawResults.value = []
    if (autoRun.value) run()
  }
}

/** CRC32（下载站/压缩包常用校验），分块流式累计，带进度回调 */
const crc32Of = async (data: File | string, onProgress?: (done: number, total: number) => void): Promise<string> => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  const feed = (chunk: Uint8Array) => {
    for (let i = 0; i < chunk.length; i++) crc = table[(crc ^ chunk[i]!) & 0xff]! ^ (crc >>> 8)
  }
  if (typeof data === 'string') {
    feed(new TextEncoder().encode(data))
  } else {
    const CH = 4 * 1024 * 1024
    let pos = 0
    while (pos < data.size) {
      if (cancelled) throw new Error('已取消')
      const buf = new Uint8Array(await data.slice(pos, pos + CH).arrayBuffer())
      feed(buf)
      pos += CH
      onProgress?.(pos, data.size)
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

/* ---- SM3（GB/T 32905-2016 国密哈希，rx3）：纯 JS 实现，已按标准测试向量校验 ---- */
const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0
const sm3Of = (data: Uint8Array): string => {
  const len = data.length
  const bitLen = len * 8
  const padded = new Uint8Array((((len + 8) >> 6) + 1) * 64)
  padded.set(data)
  padded[len] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32), false)
  dv.setUint32(padded.length - 4, bitLen >>> 0, false)
  let V = new Uint32Array([0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e])
  const T = (j: number) => (j < 16 ? 0x79cc4519 : 0x7a879d8a)
  for (let off = 0; off < padded.length; off += 64) {
    const W = new Uint32Array(68)
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false)
    for (let j = 16; j < 68; j++) {
      const x = (W[j - 16]! ^ W[j - 9]! ^ rotl(W[j - 3]!, 15)) >>> 0
      W[j] = ((x ^ rotl(x, 15) ^ rotl(x, 23)) ^ rotl(W[j - 13]!, 7) ^ W[j - 6]!) >>> 0
    }
    let [A, B, C, D, E, F, G, H] = V
    for (let j = 0; j < 64; j++) {
      const Wj = (W[j]! ^ W[j + 4]!) >>> 0
      const FF = j < 16 ? A ^ B ^ C : (A & B) | (A & C) | (B & C)
      const GG = j < 16 ? E ^ F ^ G : (E & F) | (~E & G)
      const SS1 = rotl((rotl(A, 12) + E + rotl(T(j), j % 32)) >>> 0, 7)
      const SS2 = (SS1 ^ rotl(A, 12)) >>> 0
      const TT1 = (FF + D + SS2 + Wj) >>> 0
      const TT2 = (GG + H + SS1 + W[j]!) >>> 0
      D = C
      C = rotl(B, 9)
      B = A
      A = TT1
      H = G
      G = rotl(F, 19)
      F = E
      E = (TT2 ^ rotl(TT2, 9) ^ rotl(TT2, 17)) >>> 0
    }
    const fin = [A, B, C, D, E, F, G, H]
    const NV = new Uint32Array(8)
    for (let i = 0; i < 8; i++) NV[i] = (V[i]! ^ fin[i]!) >>> 0
    V = NV
  }
  return [...V].map((x) => x.toString(16).padStart(8, '0')).join('')
}

const sm3Text = async (t: string) => sm3Of(new TextEncoder().encode(t))
const sm3File = async (f: File) => {
  if (f.size > 64 * 1024 * 1024) throw new Error('SM3 文件计算建议小于 64MB（整文件读入内存）')
  return sm3Of(new Uint8Array(await f.arrayBuffer()))
}

const run = async () => {
  if (!text.value && !file.value) return toast.warn('请输入文本或拖入文件')
  if (file.value && file.value.size > 200 * 1024 * 1024) return toast.err('文件超过 200MB，请先拆分再计算')
  busy.value = true
  cancelled = false
  startTime = Date.now()
  rawResults.value = []
  progress.value = 0
  elapsed.value = ''
  const total = BASE_ALGOS.length
  try {
    let done = 0
    for (const algo of BASE_ALGOS) {
      if (cancelled) throw new Error('已取消')
      progressLabel.value = `${algo} 计算中…`
      let value: string
      if (algo === 'CRC32') {
        value = await crc32Of(file.value ?? text.value, (d, t2) => {
          progress.value = Math.round(((done + d / t2) / total) * 100)
        })
      } else if (algo === 'SM3') {
        value = file.value ? await sm3File(file.value) : await sm3Text(text.value)
      } else {
        value = file.value ? await digestFile(algo as HashAlgo, file.value) : await digestText(algo as HashAlgo, text.value)
      }
      rawResults.value.push({ algo, value })
      done++
      progress.value = Math.round((done / total) * 100)
    }
    progressLabel.value = ''
    elapsed.value = `总耗时 ${((Date.now() - startTime) / 1000).toFixed(1)} s`
    toast.ok(`已计算 ${BASE_ALGOS.length} 种${file.value ? '文件' : '文本'}校验值`)
  } catch (e) {
    if (cancelled || (e as Error).message === '已取消') toast.warn('计算已中止')
    else toast.err(`哈希计算失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

/** 大写/紧凑只做排版，不触发重算（rx1） */
const formatOne = (v: string) => {
  let out = compact.value ? v.replace(/-/g, '') : v
  return upper.value ? out.toUpperCase() : out
}

const matchOf = (r: { algo: string; value: string }): boolean | null => {
  const exp = expected.value.trim().toLowerCase()
  if (!exp) return null
  // 期望值里带算法前缀时只比对对应算法（如 md5:xxx）
  const m = /^(md5|sha-?1|sha-?256|sha-?384|sha-?512|crc32|sm3)\s*[:=]\s*/i.exec(exp)
  if (m) {
    const wantAlgo = m[1]!.toUpperCase().replace('SHA', 'SHA-').replace('SHA--', 'SHA-')
    if (!wantAlgo.startsWith(r.algo) && !r.algo.startsWith(wantAlgo)) return null
  } else if (exp.length !== formatOne(r.value).length) return null
  const clean = (m ? exp.slice(m[0].length) : exp).replace(/[\s-]/g, '')
  return clean === formatOne(r.value).replace(/[\s-]/g, '').toLowerCase()
}

const copy = async (i: number) => {
  const okFlag = await copyText(formatOne(rawResults.value[i]!.value))
  if (okFlag) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  } else toast.err('复制失败')
}

/** HMAC 互跳（rx5）：文本转料给 HMAC 签名生成 */
const goHmac = () => {
  if (text.value) sessionStorage.setItem('toolhub.transfer.hmac-generator', JSON.stringify({ message: text.value }))
  router.push('/t/hmac-generator')
}
</script>

<template>
  <div class="hash-gen">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: center">
      <label class="check"><input v-model="upper" type="checkbox" /> 大写输出</label>
      <label class="check"><input v-model="compact" type="checkbox" /> 无连字符</label>
      <span class="muted small">切换格式不重算（结果已缓存）</span>
      <span class="grow"></span>
      <button class="btn btn-primary" :disabled="busy" @click="run"><Hash :size="16" /> {{ busy ? '计算中…' : '计算全部哈希' }}</button>
      <button v-if="busy" class="btn btn-ghost" @click="cancelled = true">取消</button>
    </div>

    <span class="field-label">文本输入</span>
    <textarea v-model="text" class="textarea mono" style="min-height: 110px" placeholder="输入要计算哈希的文本…" @input="file = null"></textarea>

    <div class="mt-2">
      <FileDrop label="或拖入文件计算哈希（拖入后自动开始，本地计算不上传）" :multiple="false" @files="onFiles" />
      <label class="check mt-1" style="display: inline-flex; gap: 6px; font-size: 12.5px">
        <input v-model="autoRun" type="checkbox" /> 拖入后自动计算
      </label>
    </div>

    <div v-if="file" class="notice notice-info mt-2 small">
      <FileText :size="14" style="vertical-align: -2px" /> 将计算文件：{{ file.name }}（{{ Math.ceil(file.size / 1024) }} KB）
    </div>

    <div v-if="busy" class="mt-2">
      <div class="progress-track"><div class="progress-bar" :style="{ width: progress + '%' }"></div></div>
      <div class="row mt-1" style="justify-content: space-between">
        <span class="muted small">{{ progressLabel }} {{ progress }}%</span>
        <span class="muted small">{{ ((Date.now() - startTime) / 1000).toFixed(1) }} s</span>
      </div>
    </div>
    <div v-if="elapsed && !busy" class="muted small mt-1"><Loader2 v-if="false" :size="12" /> {{ elapsed }}</div>

    <div v-if="rawResults.length" class="mt-2">
      <div class="row row-wrap mb-2" style="gap: 10px; align-items: center">
        <span class="field-label" style="margin: 0">与发布方校验值比对（可选）</span>
        <input v-model="expected" class="input mono grow" style="min-width: 220px" placeholder="粘贴官网给的 MD5/SHA256/CRC32/SM3，自动判定" />
        <button class="btn btn-ghost btn-sm" @click="goHmac">需要签名？生成 HMAC →</button>
      </div>
      <div class="hash-list">
        <div v-for="(r, i) in rawResults" :key="r.algo" class="hash-row" :class="matchOf(r) === true ? 'ok' : matchOf(r) === false ? 'bad' : ''">
          <span class="algo">{{ r.algo }}</span>
          <code class="value mono">{{ formatOne(r.value) }}</code>
          <span v-if="matchOf(r) === true" class="verdict ok-c">✓ 一致</span>
          <span v-else-if="matchOf(r) === false" class="verdict bad-c">✗ 不一致</span>
          <button class="mini-btn" title="复制" aria-label="复制" @click="copy(i)">
            <Check v-if="copiedIdx === i" :size="13" color="#34d399" />
            <Copy v-else :size="13" />
          </button>
        </div>
      </div>
    </div>

    <p class="muted small mt-2">SM3 为国密算法（GB/T 32905-2016），纯前端实现已按标准测试向量校验；文件模式建议 <64MB。</p>
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
.hash-row.ok {
  border-color: var(--ok);
}
.hash-row.bad {
  border-color: var(--err);
}
.verdict {
  flex: none;
  font-size: 12px;
  font-weight: 700;
}
.ok-c {
  color: var(--ok);
}
.bad-c {
  color: var(--err);
}
.grow {
  flex: 1;
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
.progress-track {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border) 60%, transparent);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.2s ease;
}
</style>
