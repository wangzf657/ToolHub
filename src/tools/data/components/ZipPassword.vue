<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, FileArchive, Loader2, Lock, Unlock } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import type { FileEntry } from '@zip.js/zip.js'

/**
 * ZIP 加密打包 / 加密压缩包解压：@zip.js/zip.js（AES-256，encryptionStrength 3）。
 * 打包：多文件 + 密码 → 加密 zip（明细 + 体积预警 + 逐文件进度）；
 * 解压：加密 zip + 密码 → 列表 → 逐个/全部下载（密码错误与文件损坏分流提示）。
 */
const toast = useToast()
const mode = ref<'pack' | 'unpack'>('pack')
const packFiles = ref<File[]>([])
const zipFile = ref<File | null>(null)
const pw = ref('')
const pw2 = ref('')
const busy = ref(false)
const loading = ref(false)
const entries = ref<{ name: string; size: number; encrypted: boolean }[]>([])
const zipName = ref('')
/** 打包/解压逐文件进度 */
const progress = ref(0)
const progressLabel = ref('')

const loadZip = async () => {
  const zip = await import('@zip.js/zip.js')
  zip.configure({ useWebWorkers: false })
  return zip
}

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/* 密码强度：4~6 位纯数字=弱；≥12 位且混合字符=强；其余中性 */
const pwStrength = computed(() => {
  const p = pw.value
  if (!p) return ''
  const pureNum = /^\d+$/.test(p)
  const mixed = /[a-zA-Z]/.test(p) && /\d/.test(p) && p.length >= 12
  if (pureNum && p.length >= 4 && p.length <= 6) return 'weak'
  if (mixed) return 'strong'
  return ''
})
const pwHint = computed(() => {
  if (pwStrength.value === 'weak') return '弱密码：建议 ≥8 位并混合字母'
  if (pwStrength.value === 'strong') return '强度良好'
  return ''
})

/* 打包明细：名称 + 大小 + 合计（>25MB 提示可能超邮件附件限制） */
const packTotal = computed(() => packFiles.value.reduce((a, f) => a + f.size, 0))

/* 错误分流：密码错误（可重试） vs 文件损坏/不支持 */
const classifyZipError = (e: unknown): string => {
  const msg = String((e as Error)?.message ?? '')
  if (/password|crc|encrypt/i.test(msg)) return '密码错误，请核对后重试（注意大小写）'
  if (/zip64|corrupt|invalid|format|central/i.test(msg)) return '文件已损坏或加密格式不受支持（仅支持 zip/AES/ZipCrypto）'
  return `解压失败：${msg || '密码错误或文件已损坏'}`
}

/* ---------------- 加密打包 ---------------- */

const pack = async () => {
  if (!packFiles.value.length) {
    toast.warn('请先选择要打包的文件')
    return
  }
  if (!pw.value) {
    toast.warn('请输入密码')
    return
  }
  if (pw.value.length < 4) {
    toast.warn('密码至少 4 位')
    return
  }
  if (pw.value !== pw2.value) {
    toast.warn('两次输入的密码不一致')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const zip = await loadZip()
    const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'))
    for (const [i, f] of packFiles.value.entries()) {
      progressLabel.value = `正在加密 ${f.name}（${i + 1}/${packFiles.value.length}）…`
      await writer.add(f.name, new zip.BlobReader(f), {
        password: pw.value,
        encryptionStrength: 3, // AES-256
      })
      progress.value = (i + 1) / packFiles.value.length
    }
    const blob = await writer.close()
    saveBlob(blob, `${baseName(packFiles.value[0].name)}-加密.zip`)
    toast.ok(`已打包 ${packFiles.value.length} 个文件（AES-256 加密，共 ${fmtSize(packTotal.value)}）`)
    pw.value = ''
    pw2.value = ''
  } catch (e) {
    toast.err(`打包失败：${(e as Error).message}`)
  } finally {
    busy.value = false
    progress.value = 0
    progressLabel.value = ''
  }
}

/* ---------------- 解压 ---------------- */

const openZip = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.(zip)$/i.test(f.name) && f.type !== 'application/zip') {
    toast.err('请选择 .zip 压缩包（rar/7z 请用「压缩包解压」工具）')
    return
  }
  zipFile.value = f
  zipName.value = f.name
  entries.value = []
  loading.value = true
  try {
    const zip = await loadZip()
    const reader = new zip.ZipReader(new zip.BlobReader(f))
    const list = await reader.getEntries()
    entries.value = list.filter((e): e is FileEntry => !e.directory).map((e) => ({
      name: e.filename,
      size: e.uncompressedSize ?? 0,
      encrypted: e.encrypted,
    }))
    await reader.close()
    if (!entries.value.length) toast.warn('压缩包里没有文件')
    else if (entries.value.some((e) => e.encrypted)) toast.warn('压缩包已加密，输入密码后可解压下载')
  } catch (e) {
    toast.err(`无法读取压缩包：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
}

const extractOne = async (name: string) => {
  if (!zipFile.value) return
  if (!pw.value) {
    toast.warn('请先输入密码')
    return
  }
  busy.value = true
  try {
    const zip = await loadZip()
    const reader = new zip.ZipReader(new zip.BlobReader(zipFile.value))
    const list = await reader.getEntries()
    const entry = list.find((e): e is FileEntry => !e.directory && e.filename === name)
    if (!entry) throw new Error('找不到该文件')
    const blob = await entry.getData(new zip.BlobWriter(), { password: pw.value })
    await reader.close()
    saveBlob(blob, name.split('/').pop() || name)
    toast.ok(`${name} 解压成功`)
  } catch (e) {
    toast.err(classifyZipError(e))
  } finally {
    busy.value = false
  }
}

const extractAll = async () => {
  if (!zipFile.value) return
  if (!pw.value) {
    toast.warn('请先输入密码')
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const zip = await loadZip()
    const reader = new zip.ZipReader(new zip.BlobReader(zipFile.value))
    const list = (await reader.getEntries()).filter((e): e is FileEntry => !e.directory)
    const out: { name: string; blob: Blob }[] = []
    for (const [i, entry] of list.entries()) {
      progressLabel.value = `正在解密 ${entry.filename}（${i + 1}/${list.length}）…`
      const blob = await entry.getData(new zip.BlobWriter(), { password: pw.value })
      out.push({ name: entry.filename, blob })
      progress.value = (i + 1) / list.length
    }
    await reader.close()
    if (out.length === 1) saveBlob(out[0].blob, out[0].name)
    else saveMany(out, `${baseName(zipName.value)}-解压.zip`)
    toast.ok(`已解压 ${out.length} 个文件`)
  } catch (e) {
    toast.err(classifyZipError(e))
  } finally {
    busy.value = false
    progress.value = 0
    progressLabel.value = ''
  }
}
</script>

<template>
  <div>
    <div class="grid-2">
      <div>
        <span class="field-label">模式</span>
        <select v-model="mode" class="select">
          <option value="pack">加密打包（文件 → 加密 zip）</option>
          <option value="unpack">解压加密包（zip + 密码 → 文件）</option>
        </select>
      </div>
      <div>
        <span class="field-label">密码</span>
        <input v-model="pw" type="password" class="input" :placeholder="mode === 'pack' ? '至少 4 位' : '压缩包密码'" autocomplete="new-password" @keyup.enter="mode === 'pack' ? pack() : extractAll()" />
        <p v-if="pwHint" class="small mt-1" :class="pwStrength === 'weak' ? 'pw-weak' : 'pw-strong'">{{ pwHint }}</p>
      </div>
    </div>

    <div v-if="mode === 'pack'" class="mt-2">
      <div class="grid-2 mb-2">
        <div>
          <span class="field-label">确认密码</span>
          <input v-model="pw2" type="password" class="input" placeholder="再次输入" autocomplete="new-password" />
        </div>
      </div>
      <FileDrop label="拖入要打包的文件（可多个）" hint="AES-256 加密（WinRAR/7-Zip 等主流工具均可解压）" @files="(fs: File[]) => (packFiles = fs)" />
      <div v-if="packFiles.length" class="pack-detail mt-2">
        <div class="pd-row" v-for="f in packFiles" :key="f.name + f.size">
          <span class="pd-name" :title="f.name">{{ f.name }}</span>
          <span class="muted small">{{ fmtSize(f.size) }}</span>
        </div>
        <p class="pd-total small">
          合计 {{ packFiles.length }} 个文件 · {{ fmtSize(packTotal) }}
          <span v-if="packTotal > 25 * 1048576" class="pw-weak">（超过 25MB，可能超过邮件附件限制，建议分卷或网盘传输）</span>
        </p>
      </div>
      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy || !packFiles.length" @click="pack">
          <Loader2 v-if="busy" :size="16" class="spin" /> <Lock v-else :size="16" /> 加密打包并下载
        </button>
        <span v-if="packFiles.length" class="chip">{{ packFiles.length }} 个文件</span>
      </div>
    </div>

    <div v-else class="mt-2">
      <FileDrop accept=".zip,application/zip" :multiple="false" label="拖入加密 zip 压缩包" hint="输入上方密码后解压；仅支持 zip（含 AES 加密）" @files="openZip" />
      <p class="muted small mt-1">
        无密码的压缩包？试试
        <RouterLink to="/t/archive-extractor">在线解压</RouterLink>
        。
      </p>

      <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在读取压缩包…</div>

      <div v-if="busy && progress > 0" class="mt-2">
        <div class="zprogress"><div class="zfill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
        <p class="muted small mt-1">{{ progressLabel }}</p>
      </div>

      <div v-if="entries.length" class="mt-2">
        <div class="row row-wrap" style="gap: 10px">
          <span class="field-label"><FileArchive :size="14" style="vertical-align: -2px" /> {{ zipName }}</span>
          <span class="chip">{{ entries.length }} 个文件</span>
          <span class="grow"></span>
          <button class="btn btn-primary btn-sm" :disabled="busy" @click="extractAll"><Loader2 v-if="busy" :size="14" class="spin" /><Unlock v-else :size="14" /> 全部解压</button>
        </div>
        <div class="list mt-1">
          <div v-for="e in entries" :key="e.name" class="entry">
            <span class="name" :title="e.name">{{ e.name }}</span>
            <span v-if="e.encrypted" class="enc"><Lock :size="11" /> 加密</span>
            <span class="size">{{ fmtSize(e.size) }}</span>
            <button class="mini-btn" title="解压下载" @click="extractOne(e.name)"><Download :size="14" /></button>
          </div>
        </div>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      打包采用 AES-256（WinZip AES 标准）；解压同时支持 AES 加密包与传统 ZipCrypto 密码包。
      密码不经过网络，忘记密码将无法解出文件。
    </p>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.grow {
  flex: 1;
}
.chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-2, rgba(127, 127, 127, 0.12));
  font-size: 12px;
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 320px;
  overflow: auto;
}
.entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.entry:last-child {
  border-bottom: none;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.enc {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--accent-text);
}
.size {
  flex: none;
  color: var(--text-3);
  font-size: 12px;
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
}
.pw-weak {
  color: var(--err);
}
.pw-strong {
  color: var(--ok);
}
.pack-detail {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  max-width: 560px;
}
.pd-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 12.5px;
  border-bottom: 1px dashed var(--border);
}
.pd-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pd-total {
  margin: 6px 0 0;
}
.zprogress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
  max-width: 420px;
}
.zfill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
</style>
