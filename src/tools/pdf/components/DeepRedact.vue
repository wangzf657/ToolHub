<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { blackenRegions, compressPdf } from '@/lib/pdfEngine'
import { locateHits, type TextHit } from './pdfHits'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 深度脱敏：正则定位敏感信息 → 黑条遮盖 → 可选栅格化销毁文字层 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const pattern = ref<'email' | 'phone' | 'idcard' | 'custom'>('email')
const custom = ref('')
const rasterize = ref(true)
const busy = ref(false)
const hits = ref<TextHit[]>([])
const scanning = ref(false)

const PRESETS: Record<Exclude<typeof pattern.value, 'custom'>, { label: string; re: RegExp }> = {
  email: { label: '邮箱地址', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  phone: { label: '手机号', re: /(?:\+?86[- ]?)?1[3-9]\d{9}/g },
  idcard: { label: '身份证号', re: /\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])\d{3}[\dXx]/g },
}

const activeRegex = computed<RegExp | null>(() => {
  if (pattern.value === 'custom') {
    if (!custom.value) return null
    try {
      return new RegExp(custom.value, 'g')
    } catch {
      return null
    }
  }
  return PRESETS[pattern.value].re
})

const byPage = computed(() => {
  const m = new Map<number, number>()
  for (const h of hits.value) m.set(h.page, (m.get(h.page) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([p, c]) => ({ page: p + 1, count: c }))
})

const scan = async () => {
  const file = base.value?.files[0]
  const re = activeRegex.value
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!re) {
    toast.err(pattern.value === 'custom' ? '请输入有效的自定义正则' : '请选择匹配模式')
    return
  }
  scanning.value = true
  hits.value = []
  try {
    hits.value = await locateHits(file, re)
    toast.ok(hits.value.length ? `定位到 ${hits.value.length} 处敏感信息` : '未找到匹配内容')
  } catch (e) {
    toast.err((e as Error).message || '定位失败')
  } finally {
    scanning.value = false
  }
}

const run = async () => {
  const file = base.value?.files[0]
  const re = activeRegex.value
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  if (!re) {
    toast.err('请先配置有效的匹配模式')
    return
  }
  busy.value = true
  try {
    let list = hits.value
    if (!list.length) list = await locateHits(file, re)
    if (!list.length) {
      toast.warn('未找到匹配内容，未生成文件')
      return
    }
    let blob = await blackenRegions(
      file,
      list.map((h) => ({ page: h.page, x: h.x, y: h.y, w: h.w, h: h.h })),
    )
    if (rasterize.value) {
      toast.ok('已生成遮盖版本，正在栅格化销毁文字层…')
      const r = await compressPdf(blob, { preset: 'medium' })
      blob = r.blob
    }
    const report = [
      'PDF 深度脱敏命中报告',
      `生成时间：${new Date().toLocaleString('zh-CN')}`,
      `匹配模式：${pattern.value === 'custom' ? `自定义正则 ${custom.value}` : PRESETS[pattern.value].label}`,
      `命中总数：${list.length}`,
      '',
      ...byPage.value.map((g) => `第 ${g.page} 页：${g.count} 处`),
      '',
      ...list.map((h, i) => `${i + 1}. 第 ${h.page + 1} 页 (${(h.x * 100).toFixed(1)}%, ${(h.y * 100).toFixed(1)}%) 内容：「${h.text}」`),
    ].join('\n')
    await saveMany(
      [
        { name: '已遮盖.pdf', blob },
        { name: '命中报告.txt', blob: new Blob([report], { type: 'text/plain;charset=utf-8' }) },
      ],
      '深度脱敏结果.zip',
    )
    toast.ok('脱敏完成')
  } catch (e) {
    toast.err((e as Error).message || '脱敏失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" @files="() => (hits = [])" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">匹配模式</span>
        <select v-model="pattern" class="select">
          <option value="email">邮箱地址</option>
          <option value="phone">手机号</option>
          <option value="idcard">身份证号</option>
          <option value="custom">自定义正则</option>
        </select>
      </div>
      <div v-if="pattern === 'custom'">
        <span class="field-label">自定义正则</span>
        <input v-model="custom" class="input mono" placeholder="如 合同编号[：:]\S+" />
      </div>
      <div>
        <span class="field-label">彻底销毁</span>
        <label class="check mt-1"><input v-model="rasterize" type="checkbox" /> 遮盖后自动栅格化（推荐）</label>
      </div>
    </div>

    <div class="row row-wrap mt-2">
      <button class="btn btn-ghost" :disabled="scanning || !base?.files.length" @click="scan">
        <Loader2 v-if="scanning" :size="16" class="spinner" /> 先扫描看命中
      </button>
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 执行脱敏并下载
      </button>
      <span v-if="hits.length" class="small muted">命中 {{ hits.length }} 处，分布在 {{ byPage.length }} 页</span>
    </div>

    <div v-if="hits.length" class="report mt-2">
      <div v-for="g in byPage" :key="g.page" class="row-item">
        <b>第 {{ g.page }} 页</b><span class="small muted">{{ g.count }} 处</span>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      重要提醒：单纯黑条<b>不会删除底层文字</b>——复制粘贴或搜索仍能看到被遮住的内容。本工具提供「遮盖后自动栅格化」：把每页重编码为图片，文字层被真正销毁，这是浏览器端能做到的最彻底方案（等效打印重扫）。栅格化后 PDF 不可再选中文字。命中报告会列出每处位置与内容，请自行核对后妥善保管。
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
.report {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  max-height: 180px;
  overflow: auto;
}
.row-item {
  display: flex;
  gap: 8px;
  padding: 3px 0;
}
</style>
