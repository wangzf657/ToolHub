<script setup lang="ts">
import { ref } from 'vue'
import { BookText, Download, FileUp, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { splitChapters, buildEpub } from '@/lib/fileExt'
import { saveText, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * EPUB 双向转换：
 * - EPUB → 文本/Markdown：解包 zip，按 OPF spine 顺序抽取各章节正文段落
 * - TXT/Markdown → EPUB：按「第X章 / # 标题」切分章节，手工 OCF 打包（mimetype 首条不压缩）
 */
type Mode = 'toText' | 'toEpub'
const toast = useToast()
const mode = ref<Mode>('toText')
const format = ref<'txt' | 'md'>('txt')
const bookTitle = ref('')
const file = ref<File | null>(null)
const busy = ref(false)
const progress = ref(0)
const outText = ref('')
const outBlob = ref<Blob | null>(null)
const chapterCount = ref(0)

const pick = (files: File[]) => {
  file.value = files[0] ?? null
  outText.value = ''
  outBlob.value = null
  if (files[0] && !bookTitle.value) bookTitle.value = baseName(files[0].name)
}

const resolvePath = (base: string, rel: string) => {
  const stack = base.split('/')
  stack.pop()
  for (const seg of rel.split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') stack.pop()
    else stack.push(seg)
  }
  return stack.join('/')
}

/** EPUB → 文本/Markdown：JSZip 解包 + OPF spine 顺序抽取 */
const epubToText = async (f: File) => {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await f.arrayBuffer())
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('不是有效的 EPUB（缺少 container.xml）')
  const containerDoc = new DOMParser().parseFromString(await containerFile.async('string'), 'application/xml')
  const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error('无法定位 OPF 包文档')
  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error('OPF 包文档不存在')
  const opf = new DOMParser().parseFromString(await opfFile.async('string'), 'application/xml')
  // manifest：id → href
  const manifest = new Map<string, string>()
  opf.querySelectorAll('manifest > item').forEach((it) => {
    const id = it.getAttribute('id')
    const href = it.getAttribute('href')
    if (id && href) manifest.set(id, href)
  })
  const spineRefs = [...opf.querySelectorAll('spine > itemref')].map((r) => r.getAttribute('idref') ?? '')
  const sections: { title: string; paragraphs: string[] }[] = []
  for (let i = 0; i < spineRefs.length; i++) {
    progress.value = ((i + 1) / spineRefs.length) * 0.9
    const href = manifest.get(spineRefs[i])
    if (!href) continue
    const entry = zip.file(resolvePath(opfPath, href))
    if (!entry) continue
    const html = await entry.async('string')
    let doc = new DOMParser().parseFromString(html, 'application/xhtml+xml')
    if (doc.querySelector('parsererror')) doc = new DOMParser().parseFromString(html, 'text/html')
    const heading = doc.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim()
    const paras = [...doc.querySelectorAll('body p, body div')]
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 1)
    // div 段落可能重复包含 p，按出现顺序去重相邻项
    const dedup = paras.filter((t, k) => !(k > 0 && t === paras[k - 1]))
    sections.push({ title: heading || `第 ${i + 1} 节`, paragraphs: dedup })
  }
  if (!sections.length) throw new Error('未提取到任何正文（可能是纯图片型 EPUB）')
  chapterCount.value = sections.length
  return sections
}

const run = async () => {
  if (!file.value) {
    toast.warn('请先选择文件')
    return
  }
  busy.value = true
  progress.value = 0
  outText.value = ''
  outBlob.value = null
  try {
    if (mode.value === 'toText') {
      if (!/\.epub$/i.test(file.value.name) && file.value.type !== 'application/epub+zip') {
        throw new Error('该模式需要 .epub 文件；若要把 TXT/MD 转为 EPUB，请切换方向')
      }
      const sections = await epubToText(file.value)
      const name = bookTitle.value || baseName(file.value.name)
      if (format.value === 'md') {
        outText.value = `# ${name}\n\n` + sections.map((s) => `## ${s.title}\n\n${s.paragraphs.join('\n\n')}`).join('\n\n')
      } else {
        outText.value = sections.map((s) => `${s.title}\n\n${s.paragraphs.join('\n\n')}`).join('\n\n\n')
      }
      progress.value = 1
      toast.ok(`已提取 ${sections.length} 个章节的正文`)
    } else {
      const text = await file.value.text()
      const chapters = splitChapters(text)
      chapterCount.value = chapters.length
      outBlob.value = await buildEpub(chapters, bookTitle.value || baseName(file.value.name))
      progress.value = 1
      toast.ok(`已按 ${chapters.length} 个章节打包 EPUB`)
    }
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (!file.value) return
  const name = bookTitle.value || baseName(file.value.name)
  if (mode.value === 'toText') {
    if (!outText.value) return
    saveText(outText.value, `${name}.${format.value}`, 'text/plain;charset=utf-8')
  }
}

const downloadEpub = () => {
  if (!outBlob.value) return
  const url = URL.createObjectURL(outBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = `${bookTitle.value || '电子书'}.epub`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
</script>

<template>
  <div>
    <div class="grid-2">
      <div>
        <span class="field-label">转换方向</span>
        <select v-model="mode" class="select">
          <option value="toText">EPUB → 文本 / Markdown</option>
          <option value="toEpub">TXT / Markdown → EPUB</option>
        </select>
      </div>
      <div v-if="mode === 'toText'">
        <span class="field-label">输出格式</span>
        <select v-model="format" class="select">
          <option value="txt">纯文本 .txt</option>
          <option value="md">Markdown .md</option>
        </select>
      </div>
      <div v-else>
        <span class="field-label">书名（写入 EPUB 元数据）</span>
        <input v-model="bookTitle" type="text" class="input" placeholder="默认取文件名" />
      </div>
    </div>

    <div class="mt-2">
      <FileDrop
        :key="mode"
        :multiple="false"
        :accept="mode === 'toText' ? '.epub,application/epub+zip' : '.txt,.md,.markdown,text/plain'"
        :label="mode === 'toText' ? '拖入 .epub 电子书' : '拖入 TXT / Markdown 文档'"
        hint="全部本地解析，不上传"
        @files="pick"
      />
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !file" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" />
        <component :is="mode === 'toText' ? BookText : FileUp" v-else :size="16" />
        {{ mode === 'toText' ? '提取正文' : '打包 EPUB' }}
      </button>
      <button v-if="outText" class="btn btn-soft" @click="download"><Download :size="15" /> 下载 .{{ format }}</button>
      <button v-if="outBlob" class="btn btn-soft" @click="downloadEpub"><Download :size="15" /> 下载 .epub</button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <p v-if="chapterCount" class="small muted mt-1">共 {{ chapterCount }} 个章节</p>

    <textarea v-if="outText" v-model="outText" class="input mt-2" rows="10" readonly />

    <p class="notice notice-warn mt-2 small">
      EPUB 提取按包文档 spine 顺序遍历 XHTML 章节，抽取段落文本（图片、样式与脚注会丢弃）；
      反向打包为 EPUB 2/3 双兼容结构（含 nav.xhtml 与 toc.ncx），章节按「第X章 / # 标题」识别，
      没有章节标记时会作为单一正文章节。
    </p>
  </div>
</template>

<style scoped>
.spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
</style>
