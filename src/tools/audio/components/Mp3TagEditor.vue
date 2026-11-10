<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { FileMusic, ImagePlus, Loader2, Save } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { baseName, saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { u8ToBlob } from './shared'

const toast = useToast()
const busy = ref(false)
const saving = ref(false)
const file = ref<File | null>(null)
const title = ref('')
const artist = ref('')
const album = ref('')
const year = ref('')
const coverUrl = ref('')
const coverName = ref('')

/** 原文件内嵌封面（用户未替换时原样写回） */
let origCover: { data: Uint8Array; format: string } | null = null
/** 用户选择的新封面 */
let newCover: ArrayBuffer | null = null
const coverInput = ref<HTMLInputElement | null>(null)

const revokeCover = () => {
  if (coverUrl.value) {
    URL.revokeObjectURL(coverUrl.value)
    coverUrl.value = ''
  }
}

const onFiles = async (fs: File[]) => {
  const f = fs[0] ?? null
  file.value = f
  revokeCover()
  origCover = null
  newCover = null
  coverName.value = ''
  if (!f) return
  busy.value = true
  try {
    const mm = await import('music-metadata')
    const meta = await mm.parseBlob(f)
    const c = meta.common
    title.value = c.title ?? ''
    artist.value = c.artist ?? ''
    album.value = c.album ?? ''
    year.value = c.year ? String(c.year) : ''
    const pic = c.picture?.[0]
    if (pic) {
      origCover = { data: pic.data, format: pic.format || 'image/jpeg' }
      coverUrl.value = URL.createObjectURL(u8ToBlob(pic.data, origCover.format))
    }
    toast.ok('标签读取成功，可编辑后写回')
  } catch (e) {
    title.value = ''
    artist.value = ''
    album.value = ''
    year.value = ''
    toast.err(`无法解析该音频的标签：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

const onCoverPick = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (!f.type.startsWith('image/')) {
    toast.warn('请选择 JPG/PNG 图片文件')
    return
  }
  newCover = await f.arrayBuffer()
  coverName.value = f.name
  revokeCover()
  coverUrl.value = URL.createObjectURL(f)
}

/** Uint8Array → 独立 ArrayBuffer（满足 browser-id3-writer 的 APIC data 类型） */
const toArrayBuffer = (u8: Uint8Array): ArrayBuffer => {
  const out = new ArrayBuffer(u8.byteLength)
  new Uint8Array(out).set(u8)
  return out
}

const save = async () => {
  const f = file.value
  if (!f) return
  if (!/\.mp3$/i.test(f.name) && f.type !== 'audio/mpeg') {
    toast.warn('写回标签仅支持 MP3 文件（其他格式可先用「音频格式转换」转为 MP3）')
    return
  }
  if (!title.value && !artist.value && !album.value && !year.value && !newCover && !origCover) {
    toast.warn('没有可写入的内容，请至少填写一项标签信息')
    return
  }
  saving.value = true
  try {
    const { ID3Writer } = await import('browser-id3-writer')
    const w = new ID3Writer(await f.arrayBuffer())
    if (title.value) w.setFrame('TIT2', title.value)
    if (artist.value) w.setFrame('TPE1', [artist.value])
    if (album.value) w.setFrame('TALB', album.value)
    if (year.value) w.setFrame('TYER', Number(year.value))
    const cover = newCover ?? (origCover ? toArrayBuffer(origCover.data) : null)
    if (cover) w.setFrame('APIC', { type: 3, data: cover, description: '', useUnicodeEncoding: true })
    const out = w.addTag()
    saveBlob(new Blob([out], { type: 'audio/mpeg' }), `${baseName(f.name)}-tagged.mp3`)
    toast.ok('已生成带新标签的 MP3，原文件未被修改')
  } catch (e) {
    toast.err(`标签写入失败：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(revokeCover)
</script>

<template>
  <div>
    <FileDrop
      :multiple="false"
      accept="audio/*,.mp3,.m4a,.flac,.ogg"
      label="拖入音频文件读取标签"
      hint="标签解析在你的设备上完成 —— 从不上传"
      @files="onFiles"
    />

    <div v-if="file" class="opts-panel mt-2">
      <div v-if="busy" class="loading"><Loader2 :size="16" class="spin" /> 正在读取标签…</div>
      <template v-else>
        <div class="tag-grid">
          <label class="field"><span class="field-label">标题</span><input v-model="title" class="input" placeholder="歌曲标题" /></label>
          <label class="field"><span class="field-label">艺术家</span><input v-model="artist" class="input" placeholder="艺术家名" /></label>
          <label class="field"><span class="field-label">专辑</span><input v-model="album" class="input" placeholder="专辑名" /></label>
          <label class="field"><span class="field-label">年份</span><input v-model="year" type="number" min="1000" max="3000" class="input" placeholder="如 2024" /></label>
        </div>
        <div class="cover-row mt-2">
          <div class="cover-box">
            <img v-if="coverUrl" :src="coverUrl" alt="封面预览" class="cover-img" />
            <div v-else class="cover-empty"><FileMusic :size="26" /><span>无封面</span></div>
          </div>
          <div class="cover-side">
            <span class="field-label">封面 {{ coverName ? `· 已替换为 ${coverName}` : origCover ? '· 已内嵌，可替换' : '· 未内嵌' }}</span>
            <button class="btn btn-sm mt-1" @click="coverInput?.click()"><ImagePlus :size="14" /> 选择封面图片</button>
            <input ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden-input" @change="onCoverPick" />
            <p class="hint mt-1">支持 JPG/PNG/WebP；未选择新图时，原封面会原样写回。</p>
          </div>
        </div>
        <div class="row wrap gap mt-2">
          <button class="btn btn-primary" :disabled="saving" @click="save">
            <Loader2 v-if="saving" :size="15" class="spin" /><Save v-else :size="15" /> {{ saving ? '写入中…' : '写入并保存新文件' }}
          </button>
          <span class="hint">写回为「原名-tagged.mp3」，原文件不会被修改。</span>
        </div>
        <p class="hint warn mt-1">⚠ 写回以 ID3v2.3 整标签重建：除标题/艺术家/专辑/年份/封面外，其他原有标签帧（流派、音轨号等）会被清除。</p>
      </template>
    </div>

    <p class="hint mt-2">口径：标签读取支持 MP3/M4A/FLAC/OGG 等常见格式；写回仅支持 MP3（ID3v2.3 帧，封面走 APIC）。音乐平台的在线封面不受影响，仅改本地文件。</p>
  </div>
</template>

<style scoped>
.loading { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; padding: 6px 0; }
.tag-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.cover-row { display: flex; gap: 14px; align-items: flex-start; }
.cover-box { width: 104px; height: 104px; flex: none; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; display: grid; place-items: center; background: var(--surface-2, rgba(127,127,127,.08)); }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text-3); font-size: 11px; }
.cover-side { display: flex; flex-direction: column; gap: 2px; }
.hidden-input { display: none; }
.gap { gap: 10px; align-items: center; }
.hint { font-size: 12px; color: var(--muted); }
.hint.warn { color: var(--warn); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
