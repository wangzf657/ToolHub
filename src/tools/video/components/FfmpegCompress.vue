<script setup lang="ts">
/**
 * 压缩视频：质量档位（CRF 连续滑条）或目标体积（估算码率）。
 * 压后结果区内嵌预览播放器 + 体积对比徽章 + 下载/「目标再小一档」快捷再压。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Download, RefreshCw } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import { getFf, mimeFor } from '@/lib/ffmpeg'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'quality' | 'size'>('quality')
const quality = ref(28)
const targetMB = ref(10)

/** 首用编解码核心下载进度（约 30MB，读完即入队压缩流程） */
const dlLoaded = ref(0)
const dlTotal = ref(0)
const downloading = ref(false)

const resultUrl = ref('')
const resultSize = ref(0)
const resultName = ref('')
const lastRun = ref<{ mode: 'quality' | 'size'; crf: number; target: number } | null>(null)

const QUICK = [
  { v: 23, t: '高画质' },
  { v: 28, t: '中等画质' },
  { v: 33, t: '低体积' },
]

/** 目标体积模式：与压缩命令同源的码率估算（时长未知时为 null） */
const estKbps = computed(() => {
  if (mode.value !== 'size') return null
  const dur = base.value?.meta?.duration
  if (!dur || dur <= 0) return null
  return Math.max(64, Math.floor((((targetMB.value * 1024 * 1024 * 8) / dur) * 0.94 - 128_000) / 1000))
})
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/* ---------- 首用核心下载进度（lib getFf 不吐字节进度，这里先按体积预取一遍，命中浏览器缓存后 getFf 秒开） ---------- */
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'

async function preloadCore(): Promise<boolean> {
  if (base.value?.ffReady) return true
  downloading.value = true
  dlLoaded.value = 0
  dlTotal.value = 0
  try {
    const res = await fetch(`${CORE_BASE}/ffmpeg-core.wasm`)
    if (!res.ok) throw new Error(String(res.status))
    const total = Number(res.headers.get('content-length')) || 0
    dlTotal.value = total
    if (res.body && total > 0) {
      const reader = res.body.getReader()
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += value?.length ?? 0
        dlLoaded.value = received
      }
    } else {
      await res.arrayBuffer()
    }
  } catch {
    // 预取失败不拦流程：getFf 自己仍会下载，仅失去进度显示
  } finally {
    downloading.value = false
  }
  try {
    await getFf()
    return true
  } catch {
    toast.err('编解码核心加载失败，请检查网络后重试')
    return false
  }
}

/* ---------- 处理中离开确认（runWithFf 期间置位） ---------- */
const runningNow = ref(false)
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (runningNow.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
window.addEventListener('beforeunload', onBeforeUnload)
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})

/* ---------- 执行 ---------- */
const run = async () => {
  const b = base.value
  if (!b) return
  if (!b.files.length) return
  if (mode.value === 'size' && (!b.meta || !(b.meta.duration > 0))) {
    toast.warn('无法读取该视频时长，无法按目标体积换算码率，请改用「按质量档位」模式')
    return
  }
  if (!(await preloadCore())) return
  runningNow.value = true
  lastRun.value = { mode: mode.value, crf: quality.value, target: targetMB.value }
  const onDone = (results: Map<string, Uint8Array>) => {
    const [name, data] = results.entries().next().value as [string, Uint8Array]
    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    const blob = new Blob([data as BlobPart], { type: mimeFor('mp4') })
    resultUrl.value = URL.createObjectURL(blob)
    resultSize.value = blob.size
    resultName.value = name
    const src = b.files[0]?.size ?? 0
    const saved = src > 0 ? Math.max(0, Math.round((1 - blob.size / src) * 100)) : 0
    toast.ok(`压缩完成：${fmtSize(src)} → ${fmtSize(blob.size)}${saved > 0 ? `（省 ${saved}%）` : ''}，请在结果区预览并下载`)
  }
  if (mode.value === 'size') {
    const kbps = estKbps.value ?? 64
    try {
      await b.runWithFf(
        [
          '-y', '-i', 'input',
          '-c:v', 'libx264', '-preset', 'veryfast',
          '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.45)}k`, '-bufsize', `${kbps * 2}k`,
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
          b.outputName,
        ],
        { status: '正在压缩（按目标体积）…', onDone },
      )
    } finally {
      runningNow.value = false
    }
  } else {
    try {
      await b.runWithFf(
        [
          '-y', '-i', 'input',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(quality.value),
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
          b.outputName,
        ],
        { status: '正在压缩…', onDone },
      )
    } finally {
      runningNow.value = false
    }
  }
}

/** 结果区「目标再小一档」：质量模式 CRF+5 / 体积模式目标 ×0.7，直接复跑 */
const rerunSmaller = () => {
  if (mode.value === 'quality') {
    quality.value = Math.min(40, quality.value + 5)
  } else {
    targetMB.value = Math.max(1, Math.round(targetMB.value * 0.7 * 10) / 10)
  }
  void run()
}
</script>

<template>
  <FfBase ref="base" output-ext="mp4" button-text="开始压缩" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">压缩方式</span>
        <select v-model="mode" class="select" style="width: 160px">
          <option value="quality">按质量档位</option>
          <option value="size">按目标体积</option>
        </select>
      </div>
      <div v-if="mode === 'quality'" class="opt grow">
        <span class="field-label">画质（CRF {{ quality }}，数值越大体积越小）</span>
        <div class="crf-line">
          <input v-model.number="quality" type="range" min="10" max="40" step="1" class="crf-range" />
          <button v-for="q in QUICK" :key="q.v" class="chip-btn" :class="{ active: quality === q.v }" @click="quality = q.v">
            {{ q.t }}
          </button>
        </div>
      </div>
      <template v-else>
        <div class="opt">
          <span class="field-label">目标大小（MB）</span>
          <input v-model.number="targetMB" type="number" min="1" max="4096" class="input" style="width: 130px" />
        </div>
        <div class="opt">
          <span class="field-label">估算</span>
          <span v-if="estKbps" class="est">预计码率 {{ estKbps }} kbps · 预计输出 ≈{{ targetMB }} MB</span>
          <span v-else class="est muted">载入视频后可预估码率</span>
        </div>
      </template>
    </div>
    <p class="muted small expect-note">
      浏览器本地压缩速度约为视频时长的 1/2~1/5（首次还需加载 30MB 编解码核心），处理期间请保持页面打开，勿刷新。
    </p>
    <p v-if="runningNow" class="expect-note strong">正在压缩中：约为视频时长的 1/2~1/5，请耐心等待，勿刷新或关闭页面。</p>

    <div v-if="downloading" class="dl-card mt-1">
      <span>正在加载编解码核心（约 30MB）…</span>
      <div class="dl-track">
        <div class="dl-fill" :style="{ width: dlTotal ? `${Math.max(2, Math.round((dlLoaded / dlTotal) * 100))}%` : '40%' }"></div>
      </div>
      <span class="muted small">
        {{ dlTotal ? `已下载 ${fmtSize(dlLoaded)} / ${fmtSize(dlTotal)}` : '准备下载…' }}
      </span>
    </div>

    <div v-if="resultUrl" class="result-card mt-2">
      <p class="result-title">压缩结果</p>
      <video :src="resultUrl" controls class="result-video"></video>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">
          源 {{ fmtSize(base?.files[0]?.size ?? 0) }} → 输出 {{ fmtSize(resultSize) }}
          <template v-if="(base?.files[0]?.size ?? 0) > resultSize">
            （省 {{ Math.round((1 - resultSize / (base?.files[0]?.size ?? 1)) * 100) }}%）
          </template>
        </span>
        <button class="btn btn-primary btn-sm" @click="rerunSmaller">
          <RefreshCw :size="14" /> {{ mode === 'quality' ? `目标再小一档（CRF ${quality}）` : `目标再小一档（≈${targetMB} MB）` }}
        </button>
        <a class="btn btn-soft btn-sm" :href="resultUrl" :download="resultName">
          <Download :size="14" /> 下载输出文件
        </a>
      </div>
    </div>
  </FfBase>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
  margin-top: 14px;
}
.opt { display: grid; gap: 4px; }
.opt.grow { flex: 1; min-width: 260px; }
.crf-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.crf-range { flex: 1; min-width: 160px; }
.chip-btn { padding: 3px 12px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12.5px; color: var(--text); }
.chip-btn.active { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }
.est { font-size: 13px; color: var(--accent-text); font-variant-numeric: tabular-nums; }
.expect-note { font-size: 12.5px; color: var(--text-3); margin: 8px 2px 0; }
.expect-note.strong { color: #d97706; font-weight: 600; }
.dl-card { display: grid; gap: 6px; max-width: 560px; font-size: 13px; color: var(--text-2); }
.dl-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.dl-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c74f2); border-radius: 999px; transition: width 0.2s ease; animation: pulse 1.2s ease-in-out infinite alternate; }
@keyframes pulse { from { opacity: 0.75; } to { opacity: 1; } }
.result-card { max-width: 560px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.result-title { margin: 0 0 8px; font-weight: 600; font-size: 14px; }
.result-video { width: 100%; max-height: 280px; border-radius: 10px; background: #000; display: block; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
</style>
