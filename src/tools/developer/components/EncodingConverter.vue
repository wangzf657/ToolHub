<script setup lang="ts">
import { ref } from 'vue'
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

/** 导出目标：UTF 系走 TextEncoder，GBK 走 gbk.js 纯 JS 编码表 */
const EXPORT_TARGETS = ['UTF-8', 'UTF-8（带 BOM）', 'UTF-16LE', 'GBK']

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

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!isTextFile(f)) return toast.warn('请拖入文本类文件（txt/csv/代码/配置等）')
  file.value = f
  preview.value = ''
  detected.value = ''
  busy.value = true
  try {
    const buf = new Uint8Array(await f.arrayBuffer())
    bytes.value = buf
    // BOM 优先判定
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
    toast.ok(`检测为 ${detected.value}（置信度 ${(confidence.value * 100).toFixed(0)}%）`)
  } catch (e) {
    toast.err(`读取失败：${(e as Error).message}`)
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
    if (bad > 0) toast.warn(`该编码下有 ${bad} 处无法解析（显示为 �），试试其他候选编码`)
  } catch (e) {
    toast.err(`解码失败：${(e as Error).message}`)
  }
}

const switchTo = (enc: string) => {
  activeEncoding.value = enc
  detected.value = enc + '（手动选择）'
  applyEncoding()
}

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
  if (!bytes.value || !file.value) return
  const text = decodeCurrent()
  if (text === null) return toast.err('无法按当前编码解码，请先切换解码')
  busy.value = true
  try {
    const name = file.value.name
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

    <div v-if="file" class="mt-2">
      <div class="row wrap gap meta">
        <span class="field-label">{{ file.name }}</span>
        <span class="chip">{{ (file.size / 1024).toFixed(1) }} KB</span>
        <span class="chip accent">检测：{{ detected }}</span>
        <span v-if="confidence" class="chip">置信度 {{ (confidence * 100).toFixed(0) }}%</span>
        <Loader2 v-if="busy" :size="15" class="spin" />
      </div>

      <div class="row wrap gap mt-2">
        <span class="field-label">切换解码</span>
        <button v-for="c in candidates" :key="c" class="chip-btn" :class="{ active: activeEncoding === c }" @click="switchTo(c)">{{ c }}</button>
      </div>

      <div v-if="preview" class="preview-box mt-2 mono">{{ preview.slice(0, 20000) }}{{ preview.length > 20000 ? '\n…（仅预览前 2 万字符）' : '' }}</div>

      <div class="row wrap gap mt-2">
        <span class="field-label">转码导出</span>
        <button v-for="t in EXPORT_TARGETS" :key="t" class="btn btn-sm" :disabled="busy" @click="exportAs(t)"><Download :size="14" /> {{ t }}</button>
      </div>
      <p class="hint mt-1">解码 GB18030/Big5/Shift_JIS 由浏览器 TextDecoder 原生支持；GBK 导出用内置编码表（约 200KB，首次加载）。CSV 转出给 Excel 建议选「UTF-8（带 BOM）」。大文件（>50MB）建议先拆分。</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 8px; }
.meta { align-items: center; }
.chip { padding: 3px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
.chip.accent { color: var(--accent-text); font-weight: 600; }
.chip-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn.active { border-color: var(--accent); color: var(--accent-text); }
.preview-box { padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; max-height: 260px; overflow: auto; white-space: pre-wrap; word-break: break-all; font-size: 13px; }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
