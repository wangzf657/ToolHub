<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const file = ref<File | null>(null)
const bytes = ref<Uint8Array | null>(null)
const detected = ref('')
const confidence = ref(0)
const candidates = ref<string[]>([])
const activeEncoding = ref('UTF-8')
const preview = ref('')
const busy = ref(false)
/** 粘贴文本模式（rx1）：无文件也能进入检测管线 */
const pastedText = ref('')
/** 对照模式：选两个候选编码并排对比（rx3） */
const compareWith = ref('')
/** FFFD 跳转游标（rx4） */
const fffdCursor = ref(0)

/** 导出目标：UTF 系走 TextEncoder，GBK 走 gbk.js 纯 JS 编码表；UTF-16BE 为手写大端编码 */
const EXPORT_TARGETS = ['UTF-8', 'UTF-8（带 BOM）', 'UTF-16LE', 'UTF-16BE', 'GBK']

const isTextFile = (f: File) => !/\.(png|jpe?g|gif|webp|avif|ico|mp4|mp3|zip|rar|7z|pdf|docx?|xlsx?|pptx?|exe)$/i.test(f.name)

/** 用 jschardet 检测（GBK/GB2312/Big5/UTF-8/Shift-JIS/UTF-16 等） */
const detect = async (data: Uint8Array) => {
  const mod = await import('jschardet')
  const jschardet = (mod as unknown as { default: typeof mod }).default ?? mod
  const head = data.subarray(0, 65536)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < head.length; i += CH) bin += String.fromCharCode(...head.subarray(i, i + CH))
  const r = jschardet.detect(bin) as { encoding: string; confidence: number }
  return { encoding: normalize(r.encoding), confidence: r.confidence }
}

const normalize = (enc: string): string => {
  const e = enc.toUpperCase()
  if (e === 'ASCII') return 'UTF-8' // ASCII 是 UTF-8 子集
  if (e === 'GB2312' || e === 'GB18030') return 'GB18030'
  return e
}

/** 检测管线入口：文件与粘贴文本共用（rx1） */
const runPipeline = async (buf: Uint8Array, label: string) => {
  bytes.value = buf
  preview.value = ''
  detected.value = ''
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    detected.value = 'UTF-8（带 BOM）'
    confidence.value = 1
    activeEncoding.value = 'UTF-8'
    candidates.value = ['UTF-8', 'GB18030', 'GBK', 'Big5']
  } else if (buf[0] === 0xff && buf[1] === 0xfe) {
    detected.value = 'UTF-16LE'
    confidence.value = 1
    activeEncoding.value = 'UTF-16LE'
    candidates.value = ['UTF-16LE', 'UTF-8', 'GB18030']
  } else {
    const d = await detect(buf)
    detected.value = d.encoding
    confidence.value = d.confidence
    candidates.value = [...new Set([d.encoding, 'UTF-8', 'GB18030', 'GBK', 'Big5'])]
    // 用「替换字符最少」自动选最佳解码
    const best = candidates.value
      .map((enc) => {
        try {
          const text = new TextDecoder(enc, { fatal: false }).decode(buf)
          return { enc, bad: (text.match(/\uFFFD/g) ?? []).length }
        } catch {
          return { enc, bad: 99999 }
        }
      })
      .sort((a, b) => a.bad - b.bad)[0]
    activeEncoding.value = best?.enc ?? 'UTF-8'
  }
  applyEncoding()
  toast.ok(`${label}检测为 ${detected.value}（置信度 ${(confidence.value * 100).toFixed(0)}%）`)
}

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!isTextFile(f)) return toast.warn('请拖入文本类文件（txt/csv/代码/配置等）')
  file.value = f
  pastedText.value = ''
  busy.value = true
  try {
    const buf = new Uint8Array(await f.arrayBuffer())
    await runPipeline(buf, '')
  } catch (e) {
    toast.err(`读取失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

/** 粘贴文本检测（rx1）：按 latin-1 还原被误读的字节流后走同一检测管线 */
const detectPasted = async () => {
  const t = pastedText.value
  if (!t.trim()) return toast.warn('请先粘贴被误读的乱码文本')
  busy.value = true
  try {
    const buf = new Uint8Array(t.length)
    for (let i = 0; i < t.length; i++) buf[i] = t.charCodeAt(i) & 0xff
    file.value = null
    await runPipeline(buf, '粘贴文本')
  } finally {
    busy.value = false
  }
}

const applyEncoding = () => {
  if (!bytes.value) return
  try {
    const text = new TextDecoder(activeEncoding.value === 'UTF-8（带 BOM）' ? 'utf-8' : activeEncoding.value || 'utf-8', { fatal: false }).decode(bytes.value)
    preview.value = text.slice(0, 200000)
    const bad = (text.match(/\uFFFD/g) ?? []).length
    if (bad > 0) toast.warn(`该编码下有 ${bad} 处无法解析（红色标出），试试其他候选编码`)
  } catch (e) {
    toast.err(`解码失败：${(e as Error).message}`)
  }
}

const switchTo = (enc: string) => {
  activeEncoding.value = enc
  detected.value = enc + '（手动选择）'
  applyEncoding()
}

const compareText = computed(() => {
  if (!compareWith.value || !bytes.value) return ''
  try {
    return new TextDecoder(compareWith.value, { fatal: false }).decode(bytes.value).slice(0, 200000)
  } catch {
    return '该编码无法解码'
  }
})

/** 预览按 FFFD 分段渲染，坏字符红色标注（rx4） */
const previewSegs = computed(() => {
  const head = preview.value.slice(0, 20000)
  const parts: { text: string; bad: boolean }[] = []
  let buf = ''
  for (const ch of head) {
    if (ch === '\uFFFD') {
      if (buf) parts.push({ text: buf, bad: false })
      parts.push({ text: '\uFFFD', bad: true })
      buf = ''
    } else buf += ch
  }
  if (buf) parts.push({ text: buf, bad: false })
  return parts
})
const fffdCount = computed(() => (preview.value.match(/\uFFFD/g) ?? []).length)

/** 点击跳转下一处 FFFD（rx4） */
const previewEl = ref<HTMLElement | null>(null)
const jumpNextFffd = () => {
  const box = previewEl.value
  if (!box) return
  const nodes = Array.from(box.querySelectorAll<HTMLElement>('.fffd'))
  if (!nodes.length) return
  const el = nodes[fffdCursor.value % nodes.length]
  el.scrollIntoView({ block: 'center' })
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), 1200)
  fffdCursor.value++
}

/** 对照行高亮：两份解码逐行比较，相异行标记（rx3） */
const compareRows = computed(() => {
  if (!compareText.value) return []
  const a = preview.value.split('\n').slice(0, 500)
  const b = compareText.value.split('\n').slice(0, 500)
  const n = Math.max(a.length, b.length)
  return Array.from({ length: n }, (_, i) => ({ i, a: a[i] ?? '', b: b[i] ?? '', diff: (a[i] ?? '') !== (b[i] ?? '') }))
})

const decodeCurrent = (): string | null => {
  if (!bytes.value) return null
  const enc = activeEncoding.value.replace('（带 BOM）', '')
  try {
    return new TextDecoder(enc || 'utf-8', { fatal: false }).decode(bytes.value)
  } catch {
    return null
  }
}

const exportAs = async (target: string) => {
  if (!bytes.value) return
  const text = decodeCurrent()
  if (text === null) return toast.err('无法按当前编码解码，请先切换解码')
  const name = file.value?.name ?? 'pasted.txt'
  busy.value = true
  try {
    if (target === 'UTF-8') {
      saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), name)
    } else if (target === 'UTF-8（带 BOM）') {
      // Windows 记事本/Excel 识别 UTF-8 CSV 常需要 BOM
      const bom = new Uint8Array([0xef, 0xbb, 0xbf])
      const body = new TextEncoder().encode(text)
      saveBlob(new Blob([bom, body], { type: 'text/plain;charset=utf-8' }), name)
    } else if (target === 'UTF-16LE') {
      const out = new Uint8Array(text.length * 2 + 2)
      out[0] = 0xff
      out[1] = 0xfe
      const dv = new DataView(out.buffer)
      for (let i = 0; i < text.length; i++) dv.setUint16(2 + i * 2, text.charCodeAt(i), true)
      saveBlob(new Blob([out]), name)
    } else if (target === 'UTF-16BE') {
      // 大端 + fe ff BOM（rx5）
      const out = new Uint8Array(text.length * 2 + 2)
      out[0] = 0xfe
      out[1] = 0xff
      const dv = new DataView(out.buffer)
      for (let i = 0; i < text.length; i++) dv.setUint16(2 + i * 2, text.charCodeAt(i), false)
      saveBlob(new Blob([out]), name)
    } else if (target === 'GBK') {
      const gbk = await import('gbk.js')
      const enc = (gbk as unknown as { encode: (s: string) => number[] }).encode(text)
      saveBlob(new Blob([new Uint8Array(enc)]), name)
    }
    toast.ok(`已按 ${target} 导出`)
  } catch (e) {
    toast.err(`导出失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept=".txt,.csv,.tsv,.srt,.json,.xml,.html,.htm,.js,.ts,.css,.md,.log,.sql,.yaml,.yml,.ini,.bat,.sh,text/*" label="拖入 txt / CSV / 代码 / 配置文件" @files="onFiles" />

    <div class="mt-2">
      <span class="field-label">粘贴文本检测（对付「UTF-8 被当成 Latin-1 打开」的乱码）</span>
      <div class="row row-wrap" style="gap: 8px; align-items: end">
        <textarea v-model="pastedText" class="textarea mono grow" style="min-height: 64px" placeholder="粘贴乱码文本，如 æµ‹è¯• / 娴嬭瘯…" spellcheck="false"></textarea>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="detectPasted"><Loader2 v-if="busy" :size="14" class="spin" /> 检测乱码文本</button>
      </div>
    </div>

    <div v-if="bytes" class="mt-2">
      <div class="row wrap gap meta">
        <span class="field-label">{{ file ? file.name : '粘贴文本' }}</span>
        <span class="chip">{{ (bytes.length / 1024).toFixed(1) }} KB</span>
        <span class="chip accent">检测：{{ detected }}</span>
        <span v-if="confidence" class="chip">置信度 {{ (confidence * 100).toFixed(0) }}%</span>
        <Loader2 v-if="busy" :size="15" class="spin" />
      </div>

      <div v-if="confidence > 0 && confidence < 0.6" class="notice notice-warn mt-2 small">
        置信度不足 60%，检测结果可能不准：建议依次点击下方候选编码对比预览效果，选可读性最好的一个。
      </div>

      <div class="row wrap gap mt-2">
        <span class="field-label">切换解码</span>
        <button v-for="c in candidates" :key="c" class="chip-btn" :class="{ active: activeEncoding === c }" @click="switchTo(c)">{{ c }}</button>
        <template v-if="candidates.length >= 2">
          <span class="field-label" style="margin-left: 10px">并排对照</span>
          <select v-model="compareWith" class="select" style="width: 150px">
            <option value="">关闭</option>
            <option v-for="c in candidates.filter((x) => x !== activeEncoding)" :key="c" :value="c">{{ c }}</option>
          </select>
        </template>
      </div>

      <div v-if="compareWith" class="mt-2 compare-grid">
        <div>
          <p class="muted small">{{ activeEncoding }}</p>
          <div class="preview-box mono compare">{{ preview.slice(0, 10000) }}</div>
        </div>
        <div>
          <p class="muted small">{{ compareWith }}</p>
          <div class="preview-box mono compare">
            <div v-for="r in compareRows" :key="r.i" class="cmp-row" :class="{ diff: r.diff }">{{ r.b || ' ' }}</div>
          </div>
        </div>
      </div>

      <div v-else-if="preview" class="preview-box mt-2 mono" ref="previewEl" @click="jumpNextFffd">
        <template v-for="(s, i) in previewSegs" :key="i">
          <span v-if="s.bad" class="fffd">{{ s.text }}</span><template v-else>{{ s.text }}</template>
        </template>
        <span v-if="preview.length > 20000" class="muted">…（预览渲染前 2 万字符，完整内容随导出保留）</span>
      </div>

      <div v-if="fffdCount" class="row row-wrap mt-2" style="align-items: center; gap: 10px">
        <span class="chip warn-chip">共 {{ fffdCount }} 处无法解析</span>
        <button class="btn btn-ghost btn-sm" @click="jumpNextFffd">跳到下一处 →</button>
      </div>

      <div class="row wrap gap mt-2">
        <span class="field-label">转码导出</span>
        <button v-for="t in EXPORT_TARGETS" :key="t" class="btn btn-sm" :disabled="busy" @click="exportAs(t)"><Download :size="14" /> {{ t }}</button>
      </div>
      <p class="hint mt-1">解码 GB18030/Big5/Shift_JIS 由浏览器 TextDecoder 原生支持；GBK 导出用内置编码表（约 200KB，首次加载）；UTF-16BE 为大端序（fe ff BOM）。CSV 转出给 Excel 建议选「UTF-8（带 BOM）」。大文件（>50MB）建议先拆分。</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 8px; }
.meta { align-items: center; }
.chip { padding: 3px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
.chip.accent { color: var(--accent-text); font-weight: 600; }
.warn-chip { background: rgba(251, 191, 36, 0.16); color: #fbbf24; }
.chip-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn.active { border-color: var(--accent); color: var(--accent-text); }
.chip-btn.vs { border-style: dashed; border-color: var(--accent); }
/* 预览弹性高度（rx2）：随视口伸展 */
.preview-box { padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; height: calc(100vh - 430px); min-height: 260px; max-height: 720px; overflow: auto; white-space: pre-wrap; word-break: break-all; font-size: 13px; cursor: pointer; }
.preview-box.compare { height: calc(100vh - 500px); min-height: 220px; cursor: default; }
.fffd { background: rgba(248, 113, 113, 0.35); color: #fecaca; border-radius: 3px; padding: 0 2px; }
.fffd.flash { outline: 2px solid #f87171; }
.cmp-row { padding: 0 2px; }
.cmp-row.diff { background: rgba(251, 191, 36, 0.18); }
.compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 760px) { .compare-grid { grid-template-columns: 1fr; } }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
