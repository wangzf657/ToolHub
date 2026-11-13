<script setup lang="ts">
import { ref } from 'vue'
import { FileSearch, Loader2, Download } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveText } from '@/lib/download'
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
  // 文本启发式兜底（rx4）：file-type 未命中时猜 UTF-8 BOM / shebang / <!DOCTYPE / JSON
  let guess = ''
  if (!t) {
    const sig = (b: number[]) => b.every((v, i) => head[i] === v)
    if (sig([0xef, 0xbb, 0xbf])) guess = '检测到 UTF-8 BOM，疑似文本文件'
    else {
      const headText = new TextDecoder('utf-8', { fatal: false }).decode(head.slice(0, 200))
      if (headText.startsWith('#!')) guess = '检测到 shebang，疑似脚本文件'
      else if (/^\s*<\?xml|<!DOCTYPE html/i.test(headText)) guess = '检测到 XML/HTML 声明，疑似标记语言文件'
      else if (/^\s*[[{]/.test(headText) && /[\]}]\s*$/.test(headText)) guess = '疑似 JSON 文本'
    }
  }
  return {
    name: file.name,
    size: file.size,
    nameExt,
    detectedExt: detectedExt || guess || '未收录',
    detectedMime: t?.mime ?? '未收录',
    match: !t ? 'unknown' : detectedExt === nameExt ? 'ok' : 'mismatch',
    hex: toHex(head),
  }
}

/* ---- 结果导出 CSV（rx1） ---- */
const downloadCsv = () => {
  if (!rows.value.length) return
  const esc = (s: string) => (/["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const head = '文件名,大小(字节),声明扩展名,真实类型,MIME,判定'
  const verdictOf = (m: Row['match']) => (m === 'ok' ? '一致' : m === 'mismatch' ? '不符' : '未收录')
  const body = rows.value
    .map((r) => [r.name, String(r.size), r.nameExt, r.detectedExt, r.detectedMime, verdictOf(r.match)])
    .map((cells) => cells.map(esc).join(','))
  saveText('\ufeff' + head + '\n' + body.join('\n') + '\n', 'file-type-report.csv', 'text/csv;charset=utf-8')
  toast.ok('已下载检测报告 CSV（UTF-8 BOM）')
}

/* ---- 魔数高亮（rx2）：已知签名段着色 + 尾注 ---- */
const SIGS: { sig: number[]; label: string }[] = [
  { sig: [0x89, 0x50, 0x4e, 0x47], label: 'PNG 签名' },
  { sig: [0xff, 0xd8, 0xff], label: 'JPEG 签名' },
  { sig: [0x47, 0x49, 0x46, 0x38], label: 'GIF 签名' },
  { sig: [0x25, 0x50, 0x44, 0x46], label: 'PDF 签名' },
  { sig: [0x50, 0x4b, 0x03, 0x04], label: 'ZIP 容器签名（docx/xlsx/jar 等）' },
  { sig: [0x7f, 0x45, 0x4c, 0x46], label: 'ELF 可执行签名' },
  { sig: [0x4d, 0x5a], label: 'Windows PE 签名' },
]
const hexHighlight = (r: Row): { html: string; note: string } => {
  const bytes = r.hex.split(' ')
  let hit = SIGS.find((s) => s.sig.every((v, i) => parseInt(bytes[i] ?? 'ff', 16) === v))
  const n = hit?.sig.length ?? 0
  const html = bytes
    .map((b, i) => (i < n ? `<mark class="sig">${b}</mark>` : b))
    .join(' ')
  return { html, note: hit ? `← ${hit.label}` : '' }
}

const onFiles = async (files: File[]) => {
  if (!files.length) return
  if (files.length > 20) return toast.warn('单次最多识别 20 个文件')
  busy.value = true
  try {
    const out: Row[] = []
    for (const f of files) out.push(await analyze(f))
    // 追加而非覆盖（rx5）：页尾可继续拖入
    rows.value = [...rows.value, ...out]
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
      <div class="row row-wrap" style="margin-bottom: 10px; gap: 10px; align-items: center">
        <button class="btn btn-ghost btn-sm" @click="downloadCsv"><Download :size="13" /> 下载检测报告 CSV</button>
        <span class="muted small">含文件名/大小/声明扩展名/真实类型/MIME/判定六列</span>
      </div>
      <div v-for="(r, i) in rows" :key="r.name + i" class="row-card">
        <div class="row row-wrap" style="gap: 12px; align-items: baseline">
          <FileSearch :size="15" style="color: var(--accent-text)" />
          <b class="name mono">{{ r.name }}</b>
          <span class="muted small">{{ r.size < 1024 ? `${r.size} B` : `${(r.size / 1024).toFixed(1)} KB` }}</span>
          <span class="verdict ok" v-if="r.match === 'ok'">✓ 扩展名与真实类型一致</span>
          <span class="verdict bad" v-else-if="r.match === 'mismatch'">✗ 扩展名不符</span>
          <span class="verdict muted" v-else>未收录（不在常见格式库中）</span>
        </div>
        <!-- mismatch 风险卡（rx3） -->
        <div v-if="r.match === 'mismatch'" class="notice mt-2 small risk-card">
          ⚠ 扩展名与真实类型不符：该文件可能被改名或伪装（如 .jpg 的可执行文件），请勿直接打开，建议先转存隔离并用杀毒工具复核。
        </div>
        <div class="grid-3 mt-2" style="gap: 10px">
          <div class="cell"><span class="k">扩展名声明</span><span class="v mono">.{{ r.nameExt }}</span></div>
          <div class="cell"><span class="k">真实类型</span><span class="v mono">{{ r.detectedExt }}</span></div>
          <div class="cell"><span class="k">真实 MIME</span><span class="v mono">{{ r.detectedMime }}</span></div>
        </div>
        <div class="hexline mt-1">
          <span class="k">文件头魔数（前 16 字节）</span>
          <code class="mono" v-html="hexHighlight(r).html"></code>
          <span v-if="hexHighlight(r).note" class="sig-note">{{ hexHighlight(r).note }}</span>
        </div>
      </div>
      <!-- 继续添加（rx5）：页尾迷你拖放条 -->
      <div class="mini-drop mt-2" @dragover.prevent @drop.prevent="onFiles(Array.from($event.dataTransfer?.files ?? []))">
        还有文件？拖到这里继续添加（结果往下追加）
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
.risk-card { background: rgba(251, 146, 60, 0.14); border: 1px solid rgba(251, 146, 60, 0.5); border-radius: 9px; padding: 8px 12px; color: var(--text-2); }
.sig-note { font-size: 12px; color: var(--accent-text); font-weight: 600; }
.hexline code :deep(mark.sig) { background: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent-text); border-radius: 3px; padding: 0 1px; font-weight: 700; }
.mini-drop { border: 1px dashed var(--border); border-radius: 10px; padding: 14px; text-align: center; color: var(--muted); font-size: 13px; cursor: copy; }
.mini-drop:hover { border-color: var(--accent); color: var(--accent-text); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
