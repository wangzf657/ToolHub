<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ScanEye, Download, AlertCircle, RefreshCw } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { decodeToCanvas } from '@/lib/imageEngine'
import { useModel } from '@/composables/useModel'
import { useToast } from '@/composables/useToast'

/** 图像分类：transformers.js 端侧 MobileViT（ImageNet 1000 类，首次约 20MB，浏览器缓存后离线） */
const toast = useToast()
const model = useModel('image-classifier')

const results = ref<{ label: string; score: number }[]>([])
const previewUrl = ref('')
const topK = ref(5)
const showZh = ref(true) // rx4 中文标签开关
const lastCanvas = ref<HTMLCanvasElement | null>(null)

interface ClfOut { label: string; score: number }
type Clf = (img: HTMLCanvasElement, opts: { top_k: number }) => Promise<ClfOut[]>

let clf: Clf | null = null

// rx4 ILSVRC 中文对照懒加载（常用类别映射，未收录类回退英文）
const zhMap = ref<Record<string, string> | null>(null)
const zhOf = (label: string) => zhMap.value?.[label] ?? ''
const loadZh = async () => {
  if (zhMap.value) return
  try {
    const m = await import('../data/imagenetZh')
    zhMap.value = m.IMAGENET_ZH
  } catch {
    zhMap.value = {}
  }
}
void loadZh()

// rx5 首次下载前确认（体积与流量提示；取消不发起 fetch）
const DL_FLAG = 'toolhub.imageClassifier.modelOk'
const needConfirm = computed(() => !localStorage.getItem(DL_FLAG))
const confirmOpen = ref(false)
let pendingRun: (() => void) | null = null
const requestModel = (run: () => void) => {
  if (clf) {
    run()
    return
  }
  if (!needConfirm.value) {
    void runLoad(run)
    return
  }
  pendingRun = run
  confirmOpen.value = true
}
const confirmYes = () => {
  confirmOpen.value = false
  void runLoad(() => pendingRun?.())
}
const confirmNo = () => {
  confirmOpen.value = false
  pendingRun = null
  toast.warn('已取消模型下载，识别未开始')
}

const runLoad = async (run: () => void) => {
  try {
    await loadModel()
    localStorage.setItem(DL_FLAG, '1')
    run()
  } catch {
    /* 错误已写入 model.error，界面有错误卡 */
  }
}

const loadModel = async (): Promise<Clf> => {
  if (clf) return clf
  model.begin()
  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    // 国内网络回退镜像
    ;(env as unknown as { remoteHost: string; remotePathTemplate: string }).remoteHost = 'https://hf-mirror.com'
    clf = (await pipeline('image-classification', 'Xenova/mobilevit-small', {
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === 'progress' && typeof p.progress === 'number') model.setProgress({ status: p.status, progress: p.progress ?? 0, file: p.file })
        else if (p.status === 'ready' || p.status === 'done') model.setProgress({ status: 'ready', progress: 100 })
      },
    })) as unknown as Clf
    model.done()
    return clf
  } catch (e) {
    // rx2 失败态清理：不留挂起的图与结果
    clf = null
    model.fail(`模型加载失败：${(e as Error).message}（可尝试切换网络后重试）`)
    previewUrl.value = ''
    lastCanvas.value = null
    results.value = []
    throw e
  }
}

const infer = async (canvas: HTMLCanvasElement) => {
  try {
    const fn = await loadModel()
    const out = await fn(canvas, { top_k: Math.max(1, Math.min(10, topK.value)) })
    results.value = out.map((r) => ({ label: r.label, score: r.score }))
    toast.ok('识别完成')
  } catch (e) {
    if (!model.error.value) toast.err(`识别失败：${(e as Error).message}`)
  }
}

const onFiles = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!f.type.startsWith('image/')) return toast.warn('请拖入图片')
  results.value = []
  try {
    const canvas = await decodeToCanvas(f)
    lastCanvas.value = canvas
    previewUrl.value = canvas.toDataURL('image/jpeg', 0.85)
    requestModel(() => void infer(canvas))
  } catch (e) {
    if (!model.error.value) toast.err(`识别失败：${(e as Error).message}`)
  }
}

// rx1 重试：清掉旧模型实例与错误态后重新加载
const retry = () => {
  clf = null
  model.error.value = ''
  model.state.value = 'idle'
  if (lastCanvas.value) requestModel(() => void infer(lastCanvas.value!))
}

// rx3 Top-K 即时重跑：已有结果且模型就绪时直接用缓存模型重推
watch(topK, () => {
  if (results.value.length && clf && lastCanvas.value) void infer(lastCanvas.value)
})

const exportCsv = () => {
  if (!results.value.length) return
  const csv = ['类别,置信度,中文', ...results.value.map((r) => `"${r.label}",${(r.score * 100).toFixed(2)}%,"${zhOf(r.label)}"`)].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '分类结果.csv'
  a.click()
}
</script>

<template>
  <div>
    <FileDrop :multiple="false" accept="image/*" label="拖入一张图片（JPG/PNG/WebP）" hint="端侧模型本地推理，图片不上传；首次使用需下载约 20MB 模型" @files="onFiles" />

    <div v-if="model.state.value === 'loading'" class="mt-2">
      <div class="progress"><div class="fill" :style="{ width: (model.progress.value.progress ?? 0) + '%' }"></div></div>
      <p class="hint mt-1">
        {{ model.progress.value.status }} {{ model.progress.value.file ?? '' }}（{{ (model.progress.value.progress ?? 0).toFixed(0) }}%）
        —— 约 20MB，视网速预计 1~3 分钟；下载完成后浏览器会缓存，下次直接离线推理。
      </p>
    </div>

    <!-- rx1 错误卡：可见 + 可恢复 -->
    <div v-if="model.error" class="err-card mt-2">
      <div class="row"><AlertCircle :size="16" /> <b>{{ model.error }}</b></div>
      <button class="btn btn-primary btn-sm mt-1" @click="retry"><RefreshCw :size="14" /> 重试加载模型</button>
    </div>

    <!-- rx5 首次下载确认框 -->
    <div v-if="confirmOpen" class="dl-confirm mt-2">
      <b>首次使用需下载识别模型（MobileViT-Small，约 20MB）</b>
      <p class="hint mt-1">将产生约 20MB 流量，视网速预计 1~3 分钟；下载后浏览器缓存，之后离线可用。图片始终不上传。</p>
      <div class="row mt-1">
        <button class="btn btn-primary btn-sm" @click="confirmYes">同意下载</button>
        <button class="btn btn-ghost btn-sm" @click="confirmNo">取消</button>
      </div>
    </div>

    <div v-if="previewUrl" class="two mt-2">
      <div class="left">
        <img :src="previewUrl" class="prev" alt="待识别图片" />
      </div>
      <div>
        <div class="row">
          <h4 class="h4">识别结果（ImageNet 1000 类）</h4>
          <label class="zh-toggle ml-auto"><input v-model="showZh" type="checkbox" /> 显示中文对照</label>
        </div>
        <div v-for="(r, i) in results" :key="r.label" class="row mt-1">
          <span class="rk">{{ i + 1 }}</span>
          <span class="lb">{{ r.label }}<span v-if="showZh && zhOf(r.label)" class="zh"> / {{ zhOf(r.label) }}</span></span>
          <div class="bar"><div class="bf" :style="{ width: r.score * 100 + '%' }"></div></div>
          <span class="sc">{{ (r.score * 100).toFixed(1) }}%</span>
        </div>
        <p v-if="!results.length && !model.error" class="hint">模型推理中…</p>
        <div v-if="results.length" class="row gap mt-2">
          <button class="btn btn-sm" @click="exportCsv"><Download :size="14" /> 导出 CSV</button>
          <span class="field-label">Top-K</span>
          <select v-model.number="topK" class="input slim" style="width: 70px">
            <option :value="3">3</option><option :value="5">5</option><option :value="10">10</option>
          </select>
          <span class="hint">调整后即时重跑（模型已缓存）</span>
        </div>
        <p class="hint mt-2">口径：MobileViT-Small 在 ImageNet-1k 上训练；标签为英文类别名（部分带中文对照，未收录类以英文为准），置信度仅代表与训练分布的匹配度，非真实世界准确率。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress { height: 6px; border-radius: 3px; background: var(--surface-2, rgba(127,127,127,.15)); overflow: hidden; }
.fill { height: 100%; background: var(--accent); }
.err-card { border: 1px solid var(--err); background: rgba(248, 113, 113, 0.08); border-radius: 12px; padding: 12px 14px; }
.err-card .row { display: flex; align-items: center; gap: 8px; color: var(--err); }
.row { display: flex; align-items: center; gap: 8px; }
.row-wrap { flex-wrap: wrap; }
.dl-confirm { border: 1px solid var(--warn); background: rgba(251, 191, 36, 0.07); border-radius: 12px; padding: 12px 14px; }
.zh-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.ml-auto { margin-left: auto; }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.two { display: grid; grid-template-columns: 1fr 1.2fr; gap: 16px; }
.prev { width: 100%; border-radius: 10px; border: 1px solid var(--border); }
.h4 { margin-bottom: 8px; font-size: 14px; }
.row .lb { flex: 1; font-size: 13.5px; min-width: 0; }
.zh { color: var(--text-3); }
.hint { font-size: 12px; color: var(--muted); }
.bar { flex: 1.2; height: 8px; border-radius: 4px; background: var(--surface-2, rgba(127,127,127,.15)); }
.bf { height: 100%; border-radius: 4px; background: var(--accent); }
.sc { width: 52px; text-align: right; font-size: 12.5px; color: var(--accent-text); }
.gap { gap: 10px; align-items: center; }
.rk { width: 18px; color: var(--muted); font-size: 12px; }
@media (max-width: 680px) { .two { grid-template-columns: 1fr; } }
</style>
