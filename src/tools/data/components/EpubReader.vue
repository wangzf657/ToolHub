<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Type } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { useToast } from '@/composables/useToast'
import type { Book, NavItem, Rendition } from 'epubjs'

/** EPUB 阅读器：epubjs 本地渲染（iframe），目录跳转 + 翻页 + 字号调节，文件不上传 */
const toast = useToast()
const stageEl = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const title = ref('')
const toc = ref<{ href: string; label: string; depth: number }[]>([])
const current = ref(-1)
const fontSize = ref(16)
const ready = ref(false)

const book = shallowRef<Book | null>(null)
const rendition = shallowRef<Rendition | null>(null)

/** 展开目录树为平铺列表（带层级） */
const flattenToc = (items: NavItem[] | undefined, depth = 0): { href: string; label: string; depth: number }[] => {
  const out: { href: string; label: string; depth: number }[] = []
  for (const it of items ?? []) {
    out.push({ href: it.href, label: it.label?.trim() || '未命名章节', depth })
    if (it.subitems?.length) out.push(...flattenToc(it.subitems, depth + 1))
  }
  return out
}

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.epub$/i.test(f.name) && f.type !== 'application/epub+zip') {
    toast.err('请选择 .epub 电子书文件')
    return
  }
  close()
  loading.value = true
  ready.value = false
  toc.value = []
  try {
    const ePub = (await import('epubjs')).default
    const buf = await f.arrayBuffer()
    const b = ePub(buf)
    book.value = b
    const meta = await b.loaded.metadata
    title.value = meta.title || f.name
    const nav = await b.loaded.navigation
    toc.value = flattenToc(nav.toc)
    await new Promise((r) => setTimeout(r, 50)) // 等待容器挂载
    if (!stageEl.value) throw new Error('渲染容器未就绪')
    const rend = b.renderTo(stageEl.value, { width: '100%', height: 600, flow: 'paginated', spread: 'none' })
    rendition.value = rend
    rend.themes.fontSize(`${fontSize.value}px`)
    rend.themes.default({ body: { padding: '0 8px' } })
    await rend.display()
    ready.value = true
    toast.ok(`已打开：${title.value}（${toc.value.length} 个目录项）`)
  } catch (e) {
    toast.err((e as Error).message || 'EPUB 打开失败：请确认文件为有效的 .epub')
    close()
  } finally {
    loading.value = false
  }
}

const jump = async (item: { href: string; label: string }, i: number) => {
  if (!rendition.value) return
  try {
    await rendition.value.display(item.href)
    current.value = i
  } catch {
    toast.err('章节跳转失败')
  }
}

const flip = async (dir: 'prev' | 'next') => {
  if (!rendition.value) return
  if (dir === 'prev') await rendition.value.prev()
  else await rendition.value.next()
}

const setFontSize = async (delta: number) => {
  fontSize.value = Math.max(12, Math.min(28, fontSize.value + delta))
  rendition.value?.themes.fontSize(`${fontSize.value}px`)
}

const close = () => {
  try {
    rendition.value?.destroy()
    book.value?.destroy()
  } catch {
    /* 忽略销毁异常 */
  }
  rendition.value = null
  book.value = null
  ready.value = false
  title.value = ''
}

onBeforeUnmount(close)
</script>

<template>
  <div>
    <FileDrop
      accept=".epub,application/epub+zip"
      :multiple="false"
      label="拖入 .epub 电子书"
      hint="电子书本地渲染，不上传；首次加载约 0.3MB 渲染引擎"
      @files="open"
    />

    <div v-if="loading" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在解析电子书…</div>

    <!-- book 一旦设置就渲染容器（renderTo 需要元素已在 DOM 中） -->
    <div v-if="book" class="reader mt-2">
      <div class="side">
        <p class="side-title"><BookOpen :size="14" /> {{ title }}</p>
        <div class="toc">
          <button
            v-for="(item, i) in toc"
            :key="item.href"
            class="toc-item"
            :class="{ active: current === i }"
            :style="{ paddingLeft: 10 + item.depth * 14 + 'px' }"
            :title="item.label"
            @click="jump(item, i)"
          >
            {{ item.label }}
          </button>
          <p v-if="!toc.length" class="muted small" style="padding: 8px">该电子书没有目录</p>
        </div>
        <div class="font-ctl">
          <Type :size="14" />
          <button class="mini-btn" title="缩小字号" @click="setFontSize(-2)">A-</button>
          <span class="small muted">{{ fontSize }}px</span>
          <button class="mini-btn" title="放大字号" @click="setFontSize(2)">A+</button>
        </div>
      </div>

      <div class="main">
        <div ref="stageEl" class="stage"></div>
        <div class="bar">
          <button class="btn btn-sm" @click="flip('prev')"><ChevronLeft :size="15" /> 上一页</button>
          <button class="btn btn-sm" @click="flip('next')">下一页 <ChevronRight :size="15" /></button>
        </div>
      </div>
    </div>
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
.reader {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
.side {
  flex: none;
  width: 250px;
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.side-title {
  margin: 0;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toc {
  flex: 1;
  overflow: auto;
  max-height: 430px;
}
.toc-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--text-2);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toc-item:hover,
.toc-item.active {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.font-ctl {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
}
.main {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.stage {
  flex: 1;
  min-height: 600px;
  background: #fff;
}
.bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}
@media (max-width: 760px) {
  .reader {
    flex-direction: column;
  }
  .side {
    width: 100%;
  }
}
</style>
