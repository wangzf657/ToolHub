<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2, PackageOpen } from 'lucide-vue-next'
import PdfToolBase from './PdfToolBase.vue'
import { compressPdf, pdfToPdfa, protectPdf, setMetadata } from '@/lib/pdfEngine'
import { batchGrayscale, batchHeaderFooter, batchRotate, batchWatermark, type WmPos } from './batchActions'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/** PDF 批量处理：加密/清元数据/水印/PDF/A/压缩/旋转/灰度/页眉页脚，失败隔离 + 逐文件清单 */
const toast = useToast()
const base = ref<InstanceType<typeof PdfToolBase> | null>(null)
const action = ref<'encrypt' | 'clean' | 'watermark' | 'pdfa' | 'compress' | 'rotate' | 'grayscale' | 'hf'>('clean')
const password = ref('')
const password2 = ref('')
const wmText = ref('机密')
const wmColor = ref('#9aa2b1')
const wmOpacity = ref(0.25)
const wmRotate = ref(false)
const wmPos = ref<WmPos>('center')
const hfHeader = ref('')
const hfFooter = ref('')
const busy = ref(false)
const progress = ref(0)

const ACTION_LABEL: Record<typeof action.value, string> = {
  encrypt: '加密',
  clean: '清理元数据',
  watermark: '加水印',
  pdfa: '转 PDF/A',
  compress: '压缩',
  rotate: '旋转 90°',
  grayscale: '灰度化',
  hf: '页眉页脚',
}

interface Row {
  name: string
  status: 'ok' | 'fail'
  size: string
  err: string
}
const rows = ref<Row[]>([])
const zipReady = ref(false)

/** 密码确认：不一致时禁用提交 */
const pwMismatch = computed(() => action.value === 'encrypt' && password.value.length >= 4 && password.value !== password2.value)

const fmtKB = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

const run = async () => {
  const files = base.value?.files ?? []
  if (!files.length) {
    toast.warn('请先添加要处理的 PDF 文件')
    return
  }
  if (action.value === 'encrypt' && password.value.length < 4) {
    toast.warn('请设置至少 4 位的密码')
    return
  }
  if (action.value === 'watermark' && !wmText.value.trim()) {
    toast.warn('请输入水印文字')
    return
  }
  if (action.value === 'hf' && !hfHeader.value.trim() && !hfFooter.value.trim()) {
    toast.warn('请至少填写页眉或页脚')
    return
  }
  busy.value = true
  progress.value = 0
  rows.value = []
  zipReady.value = false
  const out: { name: string; blob: Blob }[] = []
  let failed = 0
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]!
      const name = f.name.replace(/\.pdf$/i, '')
      // 失败隔离：单文件失败不中断批次
      try {
        let blob: Blob
        if (action.value === 'encrypt') blob = await protectPdf(f, password.value)
        else if (action.value === 'clean') blob = await setMetadata(f, { title: '', author: '', subject: '', keywords: '', creator: '' })
        else if (action.value === 'watermark')
          blob = await batchWatermark(f, { text: wmText.value, color: wmColor.value, opacity: wmOpacity.value, rotate: wmRotate.value, position: wmPos.value, fontSize: 48 })
        else if (action.value === 'pdfa') blob = await pdfToPdfa(f)
        else if (action.value === 'compress') blob = (await compressPdf(f, { preset: 'medium' })).blob
        else if (action.value === 'rotate') blob = await batchRotate(f, 90)
        else if (action.value === 'grayscale') blob = await batchGrayscale(f)
        else blob = await batchHeaderFooter(f, { header: hfHeader.value.trim() || undefined, footer: hfFooter.value.trim() || undefined, fontSize: 10, withPageNumber: true })
        const outName = `${name}-${ACTION_LABEL[action.value]}.pdf`
        out.push({ name: outName, blob })
        rows.value.push({ name: f.name, status: 'ok', size: fmtKB(blob.size), err: '' })
      } catch (err) {
        failed++
        rows.value.push({ name: f.name, status: 'fail', size: '—', err: (err as Error).message || '处理失败' })
      }
      progress.value = (i + 1) / files.length
    }
    if (out.length) {
      await saveMany(out, '批量处理结果.zip')
      zipReady.value = true
    }
    if (failed) toast.warn(`已处理 ${out.length} 个文件，${failed} 个失败（见清单）`)
    else toast.ok(`已处理 ${out.length} 个文件`)
  } catch (e) {
    toast.err((e as Error).message || '批量处理失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PdfToolBase ref="base" :multiple="true" label="拖入一批 PDF 文件" @files="() => ((rows = []), (zipReady = false))" />

    <div class="grid-3 mt-2">
      <div>
        <span class="field-label">批处理动作</span>
        <select v-model="action" class="select">
          <option value="clean">清理元数据</option>
          <option value="encrypt">加密（统一密码）</option>
          <option value="watermark">加水印</option>
          <option value="pdfa">转 PDF/A</option>
          <option value="compress">压缩（标准档）</option>
          <option value="rotate">旋转 90°</option>
          <option value="grayscale">灰度化（≤100 页/文件）</option>
          <option value="hf">页眉页脚</option>
        </select>
      </div>
      <template v-if="action === 'encrypt'">
        <div>
          <span class="field-label">统一密码</span>
          <input v-model="password" type="password" class="input" placeholder="至少 4 位" />
        </div>
        <div>
          <span class="field-label">确认密码</span>
          <input v-model="password2" type="password" class="input" :class="{ 'pw-bad': pwMismatch }" placeholder="再次输入" />
          <span v-if="pwMismatch" class="small err-text">两次输入不一致，无法提交</span>
        </div>
      </template>
      <template v-if="action === 'watermark'">
        <div>
          <span class="field-label">水印文字（支持中文）</span>
          <input v-model="wmText" class="input" />
        </div>
        <div>
          <span class="field-label">位置 / 斜排</span>
          <select v-model="wmPos" class="select">
            <option value="center">居中</option>
            <option value="top-left">左上</option>
            <option value="top-right">右上</option>
            <option value="bottom-left">左下</option>
            <option value="bottom-right">右下</option>
          </select>
          <label class="check mt-1"><input v-model="wmRotate" type="checkbox" /> 45° 斜排</label>
        </div>
        <div>
          <span class="field-label">不透明度：{{ Math.round(wmOpacity * 100) }}%</span>
          <input v-model.number="wmOpacity" type="range" class="range" min="0.05" max="0.6" step="0.05" />
        </div>
      </template>
      <template v-if="action === 'hf'">
        <div>
          <span class="field-label">页眉文字（留空不加）</span>
          <input v-model="hfHeader" class="input" />
        </div>
        <div>
          <span class="field-label">页脚文字（自动追加页码）</span>
          <input v-model="hfFooter" class="input" />
        </div>
      </template>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" :disabled="busy || !base?.files.length || pwMismatch" @click="run">
        <Loader2 v-if="busy" :size="16" class="spinner" /> <PackageOpen v-else :size="16" /> 批量处理并打包
      </button>
    </div>

    <div v-if="busy" class="progress mt-2">
      <div class="bar"><div class="fill" :style="{ width: Math.round(progress * 100) + '%' }" /></div>
    </div>

    <div v-if="rows.length" class="mt-2 result-list">
      <table class="data-table">
        <thead>
          <tr><th>文件名</th><th>动作</th><th>状态</th><th>输出大小</th><th>失败原因</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i" :class="{ 'row-fail': r.status === 'fail' }">
            <td class="ellipsis2" :title="r.name">{{ r.name }}</td>
            <td>{{ ACTION_LABEL[action] }}</td>
            <td :class="r.status === 'ok' ? 'ok-text' : 'err-text'">{{ r.status === 'ok' ? '✓ 成功' : '✗ 失败' }}</td>
            <td>{{ r.size }}</td>
            <td class="ellipsis2" :title="r.err">{{ r.err || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="zipReady" class="small muted mt-1">以上成功文件已打包为「批量处理结果.zip」。</p>
    </div>

    <p class="notice notice-info mt-2 small">
      动作说明：清理元数据会清空标题/作者/主题/关键词/创建程序；加密对全部文件使用同一密码；水印支持中文与位置/斜排；压缩为标准档（栅格化重编码）；灰度化逐页重建（单文件 ≤100 页）；页眉页脚居中并附页码。单文件失败不影响其余文件。
    </p>
  </div>
</template>

<style scoped>
.range {
  width: 100%;
}
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
.result-list {
  max-height: max(360px, calc(100dvh - 480px));
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
}
.row-fail {
  background: color-mix(in srgb, var(--err) 8%, transparent);
}
.ok-text {
  color: var(--ok);
}
.err-text {
  color: var(--err);
}
.pw-bad {
  border-color: var(--err);
}
.ellipsis2 {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
