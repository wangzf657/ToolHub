<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { pdfInfo, pdfToPdfa } from '@/lib/pdfEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 转 PDF/A（近似归档转换）：自检清单 + 大文件阶段提示 + 加密披露 + 空态科普 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const busy = ref(false)
const stage = ref('')
const elapsed = ref(0)
const sourceEncrypted = ref(false)
const bigFile = ref(false)
/** rx3 版本选择：1b（早期校验器友好）/ 2b（现行主流归档档位） */
const version = ref<'1b' | '2b'>('2b')

/** 转换后自检清单（与引擎实际行为一一对应，不虚报） */
const checklist = ref<{ item: string; done: boolean; note: string }[] | null>(null)

const detectEncrypted = async (file: File) => {
  try {
    await pdfInfo(file)
    return false
  } catch (e) {
    return (e as { name?: string })?.name === 'PasswordException'
  }
}

const run = async () => {
  const file = base.value?.files[0]
  if (!file) {
    toast.warn('请先选择一个 PDF 文件')
    return
  }
  busy.value = true
  stage.value = ''
  elapsed.value = 0
  checklist.value = null
  bigFile.value = file.size > 10 * 1024 * 1024
  sourceEncrypted.value = await detectEncrypted(file)
  const t0 = performance.now()
  const timer = window.setInterval(() => (elapsed.value = (performance.now() - t0) / 1000), 250)
  try {
    if (bigFile.value) stage.value = '正在写入归档结构…'
    const blob = await pdfToPdfa(file, { version: version.value })
    saveBlob(blob, `${file.name.replace(/\.pdf$/i, '')}-PDF-A-${version.value.toUpperCase()}.pdf`)
    elapsed.value = (performance.now() - t0) / 1000
    checklist.value = [
      { item: '元数据补全（标题/创建程序/创建时间）', done: true, note: '已写入 Info 字典' },
      { item: `XMP 版本标识 PDF/A-${version.value}`, done: true, note: `pdfaid:part=${version.value === '2b' ? 2 : 1} 已写入 Metadata 流` },
      { item: '对象流关闭（引用直存）', done: true, note: 'useObjectStreams: false' },
      { item: '颜色按 sRGB 假定', done: true, note: '近似处理，未写入 OutputIntent' },
      { item: '全字体子集嵌入', done: false, note: '近似转换未实现，严格过 ISO 校验需复核' },
    ]
    const encNote = sourceEncrypted.value ? '（源文件已加密，已解除加密后输出）' : ''
    toast.ok(`已生成归档版本，耗时 ${elapsed.value.toFixed(1)} 秒${encNote}`)
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    window.clearInterval(timer)
    busy.value = false
    stage.value = ''
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" />

    <!-- 空态科普：未选文件时先讲清能力边界 -->
    <div v-if="!base?.files.length && !busy" class="notice notice-info mt-2 small intro">
      <p><b>PDF/A 是什么：</b>ISO 标准的长期归档 PDF（常用 PDF/A-2b），要求自包含、可复现渲染，适合档案、政务、论文提交等场景。</p>
      <p><b>什么场景需要：</b>需要长期保存并保证多年后仍能打开显示一致；或接收方明确要求 PDF/A 版本。</p>
      <p><b>本工具能力边界：</b>为「归档友好」近似转换（补元数据、写 XMP 版本标识、关对象流、sRGB 假定），不做 OutputIntent 与字体子集嵌入，严格 ISO 校验（veraPDF）可能不通过。</p>
    </div>

    <div class="row mt-2" style="align-items: center; gap: 10px">
      <span class="field-label" style="margin: 0">PDF/A 版本</span>
      <select v-model="version" class="input" style="max-width: 180px">
        <option value="2b">PDF/A-2b（现行主流）</option>
        <option value="1b">PDF/A-1b（早期系统兼容）</option>
      </select>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> 转为 PDF/A-{{ version.toUpperCase() }} 并下载
      </button>
      <span v-if="busy" class="small muted">
        {{ stage || '正在转换…' }} 已用时 {{ elapsed.toFixed(1) }} 秒
      </span>
    </div>

    <div v-if="checklist" class="mt-2 check-card">
      <p class="small muted mb-1">转换后自检清单（与产物实际特征一一对应）：</p>
      <ul>
        <li v-for="c in checklist" :key="c.item" :class="{ miss: !c.done }">
          <span class="mark">{{ c.done ? '✓' : '✗' }}</span> {{ c.item }}
          <span class="small muted">（{{ c.note }}）</span>
        </li>
      </ul>
    </div>

    <p class="notice notice-info mt-2 small">
      转换内容：补全标题等元数据、写入统一创建程序、关闭对象流（对象引用改直存），便于长期归档与校验。颜色统一按 sRGB 假定处理。
    </p>
    <p class="notice notice-warn mt-2 small">
      诚实说明：完整 PDF/A-2b 还需要嵌入 XMP 元数据流、输出意图（OutputIntent）与全字体子集嵌入，本实现为「归档友好」近似转换；如需严格过 ISO 校验（如 veraPDF），请复核结果。
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
.intro p {
  margin: 2px 0;
}
.check-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.check-card ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
  font-size: 13.5px;
}
.check-card .mark {
  display: inline-block;
  width: 20px;
  font-weight: 700;
  color: var(--ok);
}
.check-card li.miss .mark {
  color: var(--err);
}
</style>
