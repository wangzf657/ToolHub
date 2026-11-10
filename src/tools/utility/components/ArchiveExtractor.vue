<script setup lang="ts">
import { ref } from 'vue'
import { FolderOpen, Download, FileArchive, Loader2, Lock } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { saveBlob, saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const busy = ref(false)
const loading = ref(false)
const archiveName = ref('')
const entries = ref<Entry[]>([])
const password = ref('')
const needPw = ref(false)
const loaded = ref(false)

interface CompressedFile {
  extract: () => Promise<File>
  name: string
  size: number
}
interface Entry {
  path: string
  size: number
  file: File | CompressedFile
}
interface Reader {
  close: () => Promise<void>
  getFilesArray: () => Promise<{ path: string; file: File | CompressedFile | null }[]>
  hasEncryptedData: () => Promise<boolean | null>
  usePassword: (pw: string) => Promise<void>
  extractFiles: () => Promise<unknown>
}

const SUPPORTED = '.zip .7z .rar .tar .gz .bz2 .xz .tgz .tar.gz'

let reader: Reader | null = null

const isFile = (f: File | CompressedFile | null): f is File => f instanceof File

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.(zip|7z|rar|tar|gz|bz2|xz|tgz)$/i.test(f.name)) return toast.warn(`支持 ${SUPPORTED} 格式`)
  archiveName.value = f.name
  entries.value = []
  needPw.value = false
  loaded.value = false
  loading.value = true
  try {
    const { Archive } = await import('libarchive.js')
    // worker 与 wasm 由 public/libarchive 提供（首次加载约 1MB，浏览器缓存）
    Archive.init({ workerUrl: new URL('/libarchive/worker-bundle.js', location.origin).href })
    const r = await Archive.open(f) as unknown as Reader
    reader = r
    await (r as unknown as { open: () => Promise<unknown> }).open()
    const enc = await r.hasEncryptedData()
    if (enc === true) {
      needPw.value = true
      toast.warn('该压缩包已加密，输入密码后点「解密」')
      return
    }
    await listEntries(r)
  } catch (e) {
    toast.err(`无法读取压缩包：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
}

const listEntries = async (r: Reader) => {
  const list = await r.getFilesArray()
  entries.value = list
    .filter((x) => x.path && !x.path.endsWith('/') && x.file)
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 2000)
    .map((x) => ({ path: x.path, size: (x.file as File | CompressedFile).size ?? 0, file: x.file as File | CompressedFile }))
  loaded.value = entries.value.length > 0
  if (!loaded.value) toast.warn('压缩包为空')
}

const unlock = async () => {
  if (!reader) return
  loading.value = true
  try {
    await reader.usePassword(password.value)
    await listEntries(reader)
    needPw.value = false
    toast.ok('密码正确，已解密')
  } catch {
    toast.err('密码错误或解密失败')
  } finally {
    loading.value = false
  }
}

const extractAll = async () => {
  if (!reader) return
  busy.value = true
  try {
    await reader.extractFiles()
    await listEntries(reader)
    toast.ok('解压完成，可逐个下载')
  } catch (e) {
    toast.err(`解压失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const saveOne = async (e: Entry) => {
  try {
    if (isFile(e.file)) saveBlob(e.file, e.path.split('/').pop() || e.path)
    else {
      const f = await e.file.extract()
      saveBlob(f, e.path.split('/').pop() || e.path)
    }
  } catch (err) {
    toast.err(`下载失败：${(err as Error).message}`)
  }
}

const saveAll = async () => {
  busy.value = true
  try {
    const ready: { name: string; blob: Blob }[] = []
    for (const e of entries.value) {
      const f = isFile(e.file) ? e.file : await e.file.extract()
      ready.push({ name: e.path.split('/').pop() || e.path, blob: f })
    }
    saveMany(ready, `${archiveName.value}-解压.zip`)
    toast.ok('已打包下载')
  } catch (e) {
    toast.err(`打包失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <FileDrop :multiple="false" :accept="SUPPORTED" label="拖入压缩包（zip / 7z / rar / tar.gz 等）" hint="本地解压，文件不上传；首次使用需加载约 1MB 解压引擎" @files="onFiles" />

    <div v-if="needPw" class="pw-row mt-2">
      <Lock :size="15" />
      <input v-model="password" type="password" class="input grow" placeholder="压缩包密码" @keyup.enter="unlock" />
      <button class="btn btn-primary btn-sm" :disabled="loading" @click="unlock">解密</button>
    </div>

    <div v-if="loaded" class="mt-2">
      <div class="row wrap gap">
        <span class="field-label"><FileArchive :size="14" style="vertical-align: -2px" /> {{ archiveName }}</span>
        <span class="chip">{{ entries.length }} 个文件</span>
        <span class="spacer"></span>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="extractAll"><Loader2 v-if="busy" :size="14" class="spin" /><FolderOpen v-else :size="14" /> 解压全部</button>
        <button class="btn btn-sm" :disabled="busy" @click="saveAll"><Download :size="14" /> 全部下载（zip）</button>
      </div>

      <div class="list mt-2">
        <div v-for="e in entries" :key="e.path" class="entry">
          <span class="path" :title="e.path">{{ e.path }}</span>
          <span class="size">{{ fmtSize(e.size) }}</span>
          <button class="mini-btn" title="下载" @click="saveOne(e)">
            <Download :size="14" />
          </button>
        </div>
      </div>
      <p class="hint mt-1">说明：点击单个文件即本地解压并下载；「全部下载」会打成一个 zip。加密包输入密码即可解压。</p>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.pw-row { display: flex; gap: 10px; align-items: center; }
.grow { flex: 1; }
.spacer { flex: 1; }
.chip { padding: 3px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); font-size: 12px; }
.list { border: 1px solid var(--border); border-radius: 10px; max-height: 360px; overflow: auto; }
.entry { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
.entry:last-child { border-bottom: none; }
.path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.size { flex: none; color: var(--muted); font-size: 12px; }
.mini-btn { flex: none; border: 1px solid var(--border); background: none; color: var(--text-2); border-radius: 7px; width: 26px; height: 26px; display: grid; place-items: center; cursor: pointer; }
.mini-btn:hover { border-color: var(--accent); }
.hint { font-size: 12px; color: var(--muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
