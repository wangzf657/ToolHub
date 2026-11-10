<script setup lang="ts">
import { ref } from 'vue'
import { Download, FileArchive, Loader2, Lock, Unlock } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob, saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import type { FileEntry } from '@zip.js/zip.js'

/**
 * ZIP 加密打包 / 加密压缩包解压：@zip.js/zip.js（AES-256，encryptionStrength 3）。
 * 打包：多文件 + 密码 → 加密 zip；解压：加密 zip + 密码 → 列表 → 逐个/全部下载。
 * useWebWorkers:false 主线程运行，避免 worker 路径配置问题。
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

/** 加载 zip.js 并关闭 web worker（页面内运行） */
const loadZip = async () => {
  const zip = await import('@zip.js/zip.js')
  zip.configure({ useWebWorkers: false })
  return zip
}

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

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
  try {
    const zip = await loadZip()
    const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'))
    for (const f of packFiles.value) {
      await writer.add(f.name, new zip.BlobReader(f), {
        password: pw.value,
        encryptionStrength: 3, // AES-256
      })
    }
    const blob = await writer.close()
    saveBlob(blob, `${baseName(packFiles.value[0].name)}-加密.zip`)
    toast.ok(`已打包 ${packFiles.value.length} 个文件（AES-256 加密）`)
    pw.value = ''
    pw2.value = ''
  } catch (e) {
    toast.err(`打包失败：${(e as Error).message}`)
  } finally {
    busy.value = false
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
    toast.err('解压失败：密码错误或文件已损坏')
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
  try {
    const zip = await loadZip()
    const reader = new zip.ZipReader(new zip.BlobReader(zipFile.value))
    const list = (await reader.getEntries()).filter((e): e is FileEntry => !e.directory)
    const out: { name: string; blob: Blob }[] = []
    for (const entry of list) {
      const blob = await entry.getData(new zip.BlobWriter(), { password: pw.value })
      out.push({ name: entry.filename, blob })
    }
    await reader.close()
    if (out.length === 1) saveBlob(out[0].blob, out[0].name)
    else saveMany(out, `${baseName(zipName.value)}-解压.zip`)
    toast.ok(`已解压 ${out.length} 个文件`)
  } catch {
    toast.err('解压失败：密码错误或压缩包已损坏')
  } finally {
    busy.value = false
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
      <div class="row mt-2">
        <button class="btn btn-primary" :disabled="busy || !packFiles.length" @click="pack">
          <Loader2 v-if="busy" :size="16" class="spin" /> <Lock v-else :size="16" /> 加密打包并下载
        </button>
        <span v-if="packFiles.length" class="chip">{{ packFiles.length }} 个文件</span>
      </div>
    </div>

    <div v-else class="mt-2">
      <FileDrop accept=".zip,application/zip" :multiple="false" label="拖入加密 zip 压缩包" hint="输入上方密码后解压；仅支持 zip（含 AES 加密）" @files="openZip" />

      <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在读取压缩包…</div>

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
</style>
