<script setup lang="ts">
/**
 * 视频消音：删除音轨 / 替换静音轨 / 区间消音三模式；画面流复制秒级完成。
 * 结果区内嵌预览播放器，点下载才落盘；首用显示核心下载进度。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import { getFf, mimeFor } from '@/lib/ffmpeg'
import { baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'remove' | 'silent' | 'range'>('remove')
const rs = ref(0)
const re = ref(0)

const srcExt = computed(() => {
  const n = base.value?.files[0]?.name ?? ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : ''
})

/* ---------- 首用核心下载进度（约 30MB） ---------- */
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'
const dlLoaded = ref(0)
const dlTotal = ref(0)
const preloading = ref(false)
async function preloadCore() {
  if (preloading.value) return
  preloading.value = true
  dlLoaded.value = 0
  dlTotal.value = 0
  try {
    const res = await fetch(`${CORE_BASE}/ffmpeg-core.wasm`)
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
    } else await res.arrayBuffer()
  } catch {
    /* 预取失败不拦流程 */
  } finally {
    preloading.value = false
  }
  await getFf()
}

/* ---------- 结果预览 ---------- */
const resultUrl = ref('')
const resultSize = ref(0)
const resultName = ref('')
onBeforeUnmount(() => {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

const run = async () => {
  const b = base.value
  if (!b || !b.files.length) return
  if (mode.value === 'range') {
    const dur = b.meta?.duration ?? 0
    if (!dur) {
      toast.warn('无法读取视频时长，区间消音不可用；请改用「删除音轨」或先转换格式')
      return
    }
    if (re.value <= rs.value) {
      toast.warn('结束时间需大于开始时间，请调整区间')
      return
    }
  }
  await preloadCore()
  const ext = srcExt.value || 'mp4'
  const suffix = mode.value === 'remove' ? '-muted' : mode.value === 'silent' ? '-silent' : '-partial-mute'
  const name = `${baseName(b.outputName || 'video')}${suffix}.${ext}`
  const args: string[] = ['-y', '-i', 'input']
  if (mode.value === 'remove') {
    args.push('-an', '-c:v', 'copy')
  } else if (mode.value === 'silent') {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-shortest', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k')
  } else {
    args.push('-c:v', 'copy',
      '-af', `volume=enable='between(t,${rs.value},${re.value})':volume=0`,
      '-c:a', 'aac', '-b:a', '128k')
  }
  if (['mp4', 'mov'].includes(ext)) args.push('-movflags', '+faststart')
  await b.runWithFf([...args, name], {
    status: mode.value === 'remove' ? '正在移除音轨…' : mode.value === 'silent' ? '正在替换静音轨…' : '正在区间消音…',
    onDone: (results) => {
      const [n, data] = results.entries().next().value as [string, Uint8Array]
      if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
      const blob = new Blob([data as BlobPart], { type: mimeFor(ext) })
      resultUrl.value = URL.createObjectURL(blob)
      resultSize.value = blob.size
      resultName.value = n
      toast.ok('处理完成，请在结果区预览（应已无声/区间无声）')
    },
  })
}
</script>

<template>
  <FfBase ref="base" button-text="开始消音" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">消音方式</span>
        <select v-model="mode" class="select" style="width: 220px">
          <option value="remove">删除音轨（推荐，最小体积）</option>
          <option value="silent">替换为静音轨（保留音轨结构）</option>
          <option value="range">区间消音（仅指定时间段）</option>
        </select>
      </div>
      <template v-if="mode === 'range'">
        <div class="opt">
          <span class="field-label">开始（秒）</span>
          <input v-model.number="rs" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        </div>
        <div class="opt">
          <span class="field-label">结束（秒）</span>
          <input v-model.number="re" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        </div>
      </template>
    </div>
    <div class="notice notice-info mt-2">
      「删除音轨 / 替换静音轨」只动音频、画面原样流复制，通常几秒完成；「区间消音」需重编码音轨（画面仍复制）。
      MP4/MOV 输出已加 faststart（在线播放秒开）。
    </div>

    <div v-if="preloading" class="dl-card mt-1">
      <span>正在加载编解码核心（约 30MB）…</span>
      <div class="prog-track"><div class="prog-fill" :style="{ width: dlTotal ? `${Math.max(2, Math.round((dlLoaded / dlTotal) * 100))}%` : '40%' }"></div></div>
      <span class="muted small">{{ dlTotal ? `已下载 ${fmtSize(dlLoaded)} / ${fmtSize(dlTotal)}` : '准备下载…' }}</span>
    </div>

    <FfExpectHint text="删除/替换音轨通常秒级完成（流复制）；区间消音需重编码音轨（约数秒到数十秒）。首次使用需加载约 30MB 编解码核心，处理期间请保持页面打开。" />

    <div v-if="resultUrl" class="result-card mt-2">
      <video :src="resultUrl" controls class="result-video"></video>
      <div class="row row-wrap" style="align-items: center; margin-top: 8px">
        <span class="badge">输出 {{ fmtSize(resultSize) }}</span>
        <a class="btn btn-primary btn-sm" :href="resultUrl" :download="resultName"><Download :size="14" /> 下载输出文件</a>
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
.dl-card { display: grid; gap: 6px; max-width: 560px; font-size: 13px; color: var(--text-2); }
.prog-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c74f2); border-radius: 999px; transition: width 0.2s ease; }
.result-card { max-width: 560px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--panel-solid) 50%, transparent); }
.result-video { width: 100%; max-height: 320px; border-radius: 10px; background: #000; display: block; }
.badge { font-size: 13px; color: var(--accent-text); background: var(--accent-soft); border-radius: 8px; padding: 4px 10px; font-variant-numeric: tabular-nums; }
</style>
