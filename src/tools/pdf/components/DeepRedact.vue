<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { blackenRegions, compressPdf, renderPageToCanvas } from '@/lib/pdfEngine'
import { locateHits, type TextHit } from './pdfHits'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * PDF 深度脱敏：多模式合并扫描 → 复核视图（红框勾选剔除）→ 外扩烧录 → 可选栅格化销毁。
 * zip 内仅成品 PDF；命中报告单独下载。
 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const patterns = ref<{ email: boolean; phone: boolean; idcard: boolean }>({ email: true, phone: false, idcard: false })
const custom = ref('')
const rasterize = ref(true)
const expand = ref(true) // 外扩防泄漏
const busy = ref(false)
const hits = ref<(TextHit & { excluded: boolean })[]>([])
const scanning = ref(false)
const scanLabel = ref('')
const reviewUrl = ref('')

const PRESETS = {
  email: { label: '邮箱地址', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  phone: { label: '手机号', re: /(?:\+?86[- ]?)?1[3-9]\d{9}/g },
  idcard: { label: '身份证号', re: /\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])\d{3}[\dXx]/g },
} as const

const activePatternList = computed(() => {
  const list: { label: string; re: RegExp }[] = []
  for (const k of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
    if (patterns.value[k]) list.push(PRESETS[k])
  }
  if (custom.value.trim()) {
    try {
      list.push({ label: `自定义 ${custom.value}`, re: new RegExp(custom.value, 'g') })
    } catch {
      /* 无效正则忽略 */
    }
  }
  return list
})

const kept = computed(() => hits.value.filter((h) => !h.excluded))

const byPage = computed(() => {
  const m = new Map<number, number>()
  for (const h of kept.value) m.set(h.page, (m.get(h.page) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([p, c]) => ({ page: p + 1, count: c }))
})

const scan = async () => {
  const file = base.value?.files[0]
  const list = activePatternList.value
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!list.length) {
    toast.err('请至少选择一个匹配模式（或填写自定义正则）')
    return
  }
  scanning.value = true
  hits.value = []
  try {
    const all: (TextHit & { excluded: boolean })[] = []
    for (const p of list) {
      const found = await locateHits(file, p.re, (d, t) => (scanLabel.value = `「${p.label}」扫描第 ${d} / ${t} 页`), { joinLines: true })
      all.push(...found.map((h) => ({ ...h, excluded: false })))
    }
    hits.value = all
    if (!all.length) toast.warn('未找到匹配内容（扫描图片型 PDF 没有文本层）')
    else toast.ok(`定位到 ${all.length} 处敏感信息（跨项拼接匹配），请复核后执行`)
  } catch (e) {
    toast.err((e as Error).message || '定位失败')
  } finally {
    scanning.value = false
    scanLabel.value = ''
  }
}

/** 复核视图：首个命中页预览 + 红框叠加 */
const reviewPage = computed(() => (kept.value.length ? kept.value[0]!.page : 0))
const buildReview = async () => {
  const file = base.value?.files[0]
  if (!file || !kept.value.length) {
    reviewUrl.value = ''
    return
  }
  try {
    const canvas = await renderPageToCanvas(file, reviewPage.value, 1.2)
    reviewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    reviewUrl.value = ''
  }
}
watch(hits, () => void buildReview(), { deep: false })

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!kept.value.length) {
    toast.warn('没有保留的命中（全部剔除或未扫描）')
    return
  }
  busy.value = true
  try {
    // 外扩防泄漏：默认四周外扩 2%（夹在页面内）
    const boxes = kept.value.map((h) => {
      const ex = expand.value ? 0.02 : 0
      const ey = expand.value ? 0.012 : 0
      return {
        page: h.page,
        x: Math.max(0, h.x - ex),
        y: Math.max(0, h.y - ey),
        w: Math.min(1 - Math.max(0, h.x - ex), h.w + ex * 2),
        h: Math.min(1 - Math.max(0, h.y - ey), h.h + ey * 2),
      }
    })
    let blob = await blackenRegions(file, boxes)
    if (rasterize.value) {
      toast.ok('已生成遮盖版本，正在栅格化销毁文字层…')
      const r = await compressPdf(blob, { preset: 'medium' })
      blob = r.blob
    }
    saveBlob(blob, '已遮盖.pdf')
    toast.ok(`脱敏完成：烧录 ${boxes.length} 处（含外扩）${rasterize.value ? '，文字层已销毁' : ''}`)
  } catch (e) {
    toast.err((e as Error).message || '脱敏失败')
  } finally {
    busy.value = false
  }
}

const downloadReport = () => {
  const report = [
    'PDF 深度脱敏命中报告',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `匹配模式：${activePatternList.value.map((p) => p.label).join(' + ') || '—'}`,
    `保留命中：${kept.value.length}（剔除 ${hits.value.length - kept.value.length}）`,
    '',
    ...byPage.value.map((g) => `第 ${g.page} 页：${g.count} 处`),
    '',
    ...kept.value.map((h, i) => `${i + 1}. 第 ${h.page + 1} 页 (${(h.x * 100).toFixed(1)}%, ${(h.y * 100).toFixed(1)}%) 内容：「${h.text}」`),
  ].join('\n')
  saveBlob(new Blob([report], { type: 'text/plain;charset=utf-8' }), '命中报告.txt')
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (hits = [])" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">匹配模式（可多选，一次执行）</span>
        <label class="check"><input v-model="patterns.email" type="checkbox" /> 邮箱地址</label>
        <label class="check"><input v-model="patterns.phone" type="checkbox" /> 手机号</label>
        <label class="check"><input v-model="patterns.idcard" type="checkbox" /> 身份证号</label>
      </div>
      <div>
        <span class="field-label">自定义正则（追加）</span>
        <input v-model="custom" class="input mono" placeholder="如 合同编号[：:]\S+" />
        <label class="check mt-1"><input v-model="expand" type="checkbox" /> 匹配框四周外扩 2%（防斜体/衬线残字）</label>
        <label class="check"><input v-model="rasterize" type="checkbox" /> 遮盖后自动栅格化（推荐）</label>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost" :disabled="scanning || !base?.files.length" @click="scan">
        <Loader2 v-if="scanning" :size="16" class="spinner" /> 先扫描看命中
      </button>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length || !kept.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 执行脱敏并下载（仅成品 PDF）
      </button>
      <button class="btn btn-ghost" :disabled="!hits.length" @click="downloadReport">下载命中报告</button>
      <span v-if="scanLabel" class="small muted">{{ scanLabel }}</span>
      <span v-else-if="hits.length" class="small muted">命中 {{ hits.length }} 处 · 保留 {{ kept.length }} · 分布 {{ byPage.length }} 页</span>
    </div>

    <div v-if="hits.length" class="review mt-2">
      <img v-if="reviewUrl" :src="reviewUrl" alt="复核预览" class="review-img" />
      <div
        v-for="(h, i) in kept.filter((x) => x.page === reviewPage)"
        :key="i"
        class="review-box"
        :style="{ left: h.x * 100 + '%', top: h.y * 100 + '%', width: h.w * 100 + '%', height: h.h * 100 + '%' }"
      ></div>
      <p class="small muted">复核预览：第 {{ reviewPage + 1 }} 页的红框将被烧录（在列表中剔除对应项后不再遮盖）</p>
      <div class="hit-list">
        <label v-for="(h, i) in hits" :key="i" class="hit-row" :class="{ off: h.excluded }">
          <input v-model="h.excluded" type="checkbox" /> 第 {{ h.page + 1 }} 页 ·「{{ h.text }}」
        </label>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      重要提醒：单纯黑条<b>不会删除底层文字</b>——复制粘贴或搜索仍能看到被遮住的内容。本工具提供「遮盖后自动栅格化」：把每页重编码为图片，文字层被真正销毁，这是浏览器端能做到的最彻底方案（等效打印重扫）。栅格化后 PDF 不可再选中文字。
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
.review {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.review-img {
  max-width: min(100%, 520px);
  max-height: 60vh;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  display: block;
}
.review-box {
  position: absolute;
  border: 1.5px solid var(--err);
  background: rgba(239, 68, 68, 0.2);
  pointer-events: none;
}
.hit-list {
  max-height: 220px;
  overflow: auto;
  display: grid;
  gap: 4px;
  margin-top: 8px;
}
.hit-row {
  font-size: 12.5px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.hit-row.off {
  opacity: 0.5;
  text-decoration: line-through;
}
</style>
