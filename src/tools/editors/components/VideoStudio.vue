<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Clapperboard, Loader2, Trash2, ArrowUp, ArrowDown, Scissors, Download, Film, Undo2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { loadVideo } from '@/lib/videoEngine'
import { getFf } from '@/lib/ffmpeg'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 视频工作台：素材列表 + 时间线 + 逐段裁剪/静音/音量 + ffmpeg concat 导出。
 * 说明：静音与音量仅在涉及音频处理（重编码音频）时生效；正常段走流复制（快）。
 */
interface Clip {
  id: number
  name: string
  file: File
  duration: number
  trimStart: number
  trimEnd: number
  muted: boolean
  volume: number
  url: string
}

const toast = useToast()
const clips = ref<Clip[]>([])
const activeId = ref<number | null>(null)
const loading = ref(false)
const exporting = ref(false)
const status = ref('')
let seq = 1

const steps = ['导入素材', '时间线裁剪排序', '导出成片']

const active = computed(() => clips.value.find((c) => c.id === activeId.value) ?? null)
const totalDuration = computed(() =>
  clips.value.reduce((a, c) => a + Math.max(0.1, (c.trimEnd || c.duration) - c.trimStart), 0),
)

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** 已导入素材指纹，防止 FileDrop 重复累加 */
const loadedKeys = new Set<string>()

const onFiles = async (files: File[]) => {
  const fresh = files.filter((f) => !loadedKeys.has(`${f.name}:${f.size}`))
  if (!fresh.length) return
  loading.value = true
  try {
    for (const f of fresh) {
      loadedKeys.add(`${f.name}:${f.size}`)
      try {
        const meta = await loadVideo(f)
        clips.value.push({
          id: seq++,
          name: f.name,
          file: f,
          duration: meta.duration,
          trimStart: 0,
          trimEnd: meta.duration,
          muted: false,
          volume: 1,
          url: meta.url,
        })
        if (activeId.value === null) activeId.value = clips.value[0].id
      } catch (e) {
        toast.err(`${f.name}：${(e as Error).message}`)
      }
    }
  } finally {
    loading.value = false
  }
}

const select = (id: number) => {
  activeId.value = id
}

const remove = (id: number) => {
  const i = clips.value.findIndex((c) => c.id === id)
  if (i >= 0) {
    const c = clips.value[i]
    loadedKeys.delete(`${c.name}:${c.file.size}`)
    clips.value.splice(i, 1)
    // rx4 撤销删除：5 秒内可恢复，超时才释放对象 URL
    if (pendingDelete.value) clearTimeout(pendingDelete.value.timer)
    pendingDelete.value = {
      clip: c,
      index: i,
      timer: window.setTimeout(() => {
        URL.revokeObjectURL(c.url)
        pendingDelete.value = null
      }, 5000),
    }
  }
  if (activeId.value === id) activeId.value = clips.value[0]?.id ?? null
}

/** rx4 删除撤销（5 秒窗口） */
const pendingDelete = ref<{ clip: Clip; index: number; timer: number } | null>(null)
const undoDelete = () => {
  const p = pendingDelete.value
  if (!p) return
  clearTimeout(p.timer)
  loadedKeys.add(`${p.clip.name}:${p.clip.file.size}`)
  clips.value.splice(Math.min(p.index, clips.value.length), 0, p.clip)
  activeId.value = p.clip.id
  pendingDelete.value = null
  toast.ok('已恢复被删除的素材')
}

const move = (id: number, dir: -1 | 1) => {
  const i = clips.value.findIndex((c) => c.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= clips.value.length) return
  reorderTo(i, j)
}

// rx4 拖拽换位：素材列表 / 时间线通用
const dragId = ref<number>(-1)
const onClipDragStart = (id: number) => (dragId.value = id)
const onClipDrop = (id: number) => {
  const from = clips.value.findIndex((c) => c.id === dragId.value)
  const to = clips.value.findIndex((c) => c.id === id)
  dragId.value = -1
  if (from < 0 || to < 0 || from === to) return
  reorderTo(from, to)
}
const reorderTo = (from: number, to: number) => {
  const arr = [...clips.value]
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
  clips.value = arr
}

const activeClip = computed(() => clips.value.find((c) => c.id === activeId.value))

// rx1 裁剪区间预览：播放越过 trimEnd 自动停并回跳；静音/音量联动预览
const playerEl = ref<HTMLVideoElement | null>(null)
const onTimeUpdate = () => {
  const c = activeClip.value
  const v = playerEl.value
  if (!c || !v) return
  const te = c.trimEnd || c.duration
  if (v.currentTime > te) {
    v.pause()
    v.currentTime = c.trimStart
  } else if (v.currentTime < c.trimStart - 0.05) {
    v.currentTime = c.trimStart
  }
}
watch(
  () => activeClip.value && { muted: activeClip.value.muted, vol: activeClip.value.volume, url: activeClip.value.url },
  (nv) => {
    const v = playerEl.value
    if (!v || !nv) return
    v.muted = nv.muted
    v.volume = Math.min(1, nv.vol)
  },
  { immediate: true },
)

const setTrim = (key: 'trimStart' | 'trimEnd', v: number) => {
  const c = activeClip.value
  if (!c) return
  const nv = Math.min(Math.max(0, v), c.duration)
  c[key] = nv
  if (c.trimEnd <= c.trimStart) c.trimEnd = Math.min(c.duration, c.trimStart + 0.5)
}

/* ---------- 导出（ffmpeg concat 方案） ---------- */
const cleanupFf = async (ff: Awaited<ReturnType<typeof getFf>>, names: string[]) => {
  for (const n of names) {
    try {
      await ff.deleteFile(n)
    } catch {
      /* 忽略 */
    }
  }
}

/** rx2 导出进度：解析 ffmpeg time= 相对段时长折算整体百分比（单调递增） */
const parseFfTime = (m: string): number => {
  const t = m.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!t) return -1
  return Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3])
}
const exportPct = ref(0)

/** rx5 成片快预览：导出完成后页内播放，确认再保存 */
const resultUrl = ref('')
const resultSize = ref(0)

const doExport = async () => {
  if (!clips.value.length) {
    toast.warn('请先导入视频素材')
    return
  }
  exporting.value = true
  exportPct.value = 0
  status.value = '正在加载 ffmpeg 核心（首次约 25MB，之后走浏览器缓存）…'
  let segNames: string[] = []
  const N = clips.value.length
  let curSeg = -1
  let curSegDur = 1
  try {
    const ff = await getFf((m) => {
      // rx2 解析 time= 行内进度（原实现直接过滤掉了）：相对段时长折算整体百分比
      const t = parseFfTime(m)
      if (t >= 0 && curSeg >= 0) {
        const segPct = Math.min(100, (t / curSegDur) * 100)
        exportPct.value = Math.min(100, Math.round(((curSeg + segPct / 100) / N) * 100))
        status.value = `第 ${curSeg + 1}/${N} 段 · ${Math.round(segPct)}%`
      }
    })
    // 逐段处理
    for (const [i, clip] of clips.value.entries()) {
      curSeg = i
      status.value = `第 ${i + 1}/${N} 段 · 0%`
      const ext = clip.name.toLowerCase().endsWith('.webm') ? '.webm' : '.mp4'
      const inName = `in_${i}${ext}`
      const outName = `seg_${i}.mp4`
      await ff.writeFile(inName, new Uint8Array(await clip.file.arrayBuffer()))
      const ts = Math.max(0, clip.trimStart)
      const te = Math.min(clip.duration, Math.max(ts + 0.1, clip.trimEnd || clip.duration))
      curSegDur = Math.max(0.1, te - ts)
      const args: (string | number)[] = []
      if (ts > 0) args.push('-ss', ts.toFixed(3))
      args.push('-i', inName)
      if (te < clip.duration - 0.05) args.push('-t', (te - ts).toFixed(3))
      if (clip.muted) {
        args.push('-an')
      } else if (Math.abs(clip.volume - 1) > 0.01) {
        // 音量调整：视频流复制，音频重编码
        args.push('-c:v', 'copy', '-af', `volume=${clip.volume}`, '-c:a', 'aac', '-b:a', '160k')
      } else {
        args.push('-c', 'copy')
      }
      args.push('-y', outName)
      await ff.exec(args.map(String))
      segNames.push(outName)
      await ff.deleteFile(inName)
      // 该段完成：进度推进到 (i+1)/N
      exportPct.value = Math.round(((i + 1) / N) * 100)
      status.value = `第 ${i + 1}/${N} 段 · 100%`
    }
    // 拼接
    status.value = '拼接全部片段…'
    await ff.writeFile(
      'list.txt',
      new TextEncoder().encode(segNames.map((n) => `file '${n}'`).join('\n')),
    )
    await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-y', 'output.mp4'])
    const data = (await ff.readFile('output.mp4')) as Uint8Array
    // rx5 成片快预览：先页内播放，用户确认后再保存
    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    const blob = new Blob([data.slice().buffer as ArrayBuffer], { type: 'video/mp4' })
    resultSize.value = blob.size
    resultUrl.value = URL.createObjectURL(blob)
    exportPct.value = 100
    status.value = '拼接完成，可试看后保存'
    toast.ok('导出完成：请试看成片，确认后点击保存')
  } catch (e) {
    toast.err((e as Error).message || '导出失败（ffmpeg 核心可能加载失败，请检查网络后重试）')
  } finally {
    void (async () => {
      try {
        const ff = await getFf()
        await cleanupFf(ff, [...segNames, 'list.txt', 'output.mp4'])
      } catch {
        /* 忽略 */
      }
    })()
    exporting.value = false
  }
}

const saveResult = () => {
  const a = document.createElement('a')
  a.href = resultUrl.value
  a.download = '成片.mp4'
  a.click()
  toast.ok('成片.mp4 已开始下载')
}

onBeforeUnmount(() => {
  for (const c of clips.value) URL.revokeObjectURL(c.url)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  if (pendingDelete.value) {
    clearTimeout(pendingDelete.value.timer)
    URL.revokeObjectURL(pendingDelete.value.clip.url)
  }
})
</script>

<template>
  <div class="studio">
    <div class="steps row row-wrap">
      <span v-for="(s, i) in steps" :key="i" class="step"><b class="step-n">{{ i + 1 }}</b> {{ s }}<span v-if="i < steps.length - 1" class="step-arrow">→</span></span>
    </div>

    <div class="layout">
      <aside class="media-col">
        <FileDrop accept="video/*" label="拖放视频素材（可多选）" hint="MP4 / WebM / MOV" @files="onFiles" />
        <div v-if="loading" class="row mt-1 muted small"><Loader2 :size="14" class="spin" /> 正在读取视频信息…</div>

        <!-- rx4 删除撤销条（5 秒窗口） -->
        <div v-if="pendingDelete" class="undo-bar mt-1">
          已删除「{{ pendingDelete.clip.name }}」
          <button class="btn btn-ghost btn-sm" @click="undoDelete"><Undo2 :size="13" /> 撤销</button>
        </div>

        <div v-if="clips.length" class="clip-list mt-2">
          <div
            v-for="(c, i) in clips"
            :key="c.id"
            class="clip-item"
            :class="{ active: c.id === activeId, dragging: dragId === c.id }"
            draggable="true"
            @click="select(c.id)"
            @dragstart="onClipDragStart(c.id)"
            @dragover.prevent
            @drop.prevent="onClipDrop(c.id)"
          >
            <Film :size="14" class="muted" />
            <span class="clip-name" :title="c.name">{{ i + 1 }}. {{ c.name }}</span>
            <span class="muted small">{{ fmt(c.duration) }}</span>
            <span class="row" style="gap: 2px">
              <button class="mini" title="上移" aria-label="上移" @click.stop="move(c.id, -1)"><ArrowUp :size="12" /></button>
              <button class="mini" title="下移" aria-label="下移" @click.stop="move(c.id, 1)"><ArrowDown :size="12" /></button>
              <button class="mini danger" title="移除" aria-label="移除" @click.stop="remove(c.id)"><Trash2 :size="12" /></button>
            </span>
          </div>
        </div>
      </aside>

      <main class="main">
        <template v-if="activeClip">
          <!-- rx1 裁剪区间预览：越过 trimEnd 自动停并回跳；预览静音/音量随参数 -->
          <video ref="playerEl" :src="activeClip.url" controls class="player" @timeupdate="onTimeUpdate"></video>

          <div class="settings mt-2">
            <div class="row row-wrap">
              <label class="check">
                起点（秒）
                <input
                  type="number"
                  class="input"
                  style="width: 92px"
                  :min="0"
                  :max="activeClip.duration"
                  :step="0.1"
                  :value="activeClip.trimStart"
                  @input="setTrim('trimStart', Number(($event.target as HTMLInputElement).value))"
                />
              </label>
              <label class="check">
                终点（秒）
                <input
                  type="number"
                  class="input"
                  style="width: 92px"
                  :min="0"
                  :max="activeClip.duration"
                  :step="0.1"
                  :value="activeClip.trimEnd"
                  @input="setTrim('trimEnd', Number(($event.target as HTMLInputElement).value))"
                />
              </label>
              <label class="check"><input v-model="activeClip.muted" type="checkbox" /> 静音</label>
              <label class="check">
                音量
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  style="width: 120px"
                  :value="activeClip.volume"
                  @input="activeClip.volume = Number(($event.target as HTMLInputElement).value)"
                />
                <span class="small muted">{{ activeClip.volume.toFixed(1) }}x</span>
              </label>
            </div>
            <p class="muted small mt-1">
              <Scissors :size="12" style="vertical-align: -2px" />
              裁剪与静音对所有片段生效；音量调整会重编码该段音频（画面仍为快速复制）。
            </p>
          </div>
        </template>
        <div v-else class="empty">
          <Clapperboard :size="40" class="empty-icon" />
          <p>导入素材后，在此预览并设置裁剪。</p>
        </div>

        <!-- 时间线（rx4 支持拖拽换位） -->
        <div v-if="clips.length" class="timeline mt-3">
          <div class="tl-title">分段编排（拖拽换位，按顺序拼接，总时长约 {{ fmt(totalDuration) }}）</div>
          <div class="tl-track">
            <div
              v-for="c in clips"
              :key="c.id"
              class="tl-block"
              :class="{ active: c.id === activeId, dragging: dragId === c.id }"
              :style="{ flexGrow: Math.max(0.5, (c.trimEnd || c.duration) - c.trimStart) }"
              draggable="true"
              @click="select(c.id)"
              @dragstart="onClipDragStart(c.id)"
              @dragover.prevent
              @drop.prevent="onClipDrop(c.id)"
            >
              <span class="tl-name">{{ c.name }}</span>
              <span class="tl-dur">{{ fmt((c.trimEnd || c.duration) - c.trimStart) }}<template v-if="c.muted"> · 静音</template></span>
            </div>
          </div>
        </div>

        <!-- rx5 成片快预览：先试看再保存 -->
        <div v-if="resultUrl" class="result-card mt-3">
          <div class="tl-title">成片试看（{{ (resultSize / 1024 / 1024).toFixed(1) }} MB）</div>
          <video :src="resultUrl" controls class="player"></video>
          <div class="row mt-1">
            <button class="btn btn-primary" @click="saveResult"><Download :size="15" /> 保存成片.mp4</button>
            <span class="muted small">确认内容无误后再保存；关闭/刷新页面后预览失效。</span>
          </div>
        </div>

        <!-- rx6 导出行 sticky 于主栏底部，不随时间线增高被推出首屏 -->
        <div class="export-row row row-wrap mt-3">
          <button class="btn btn-primary" :disabled="exporting || !clips.length" @click="doExport">
            <Loader2 v-if="exporting" :size="16" class="spin" />
            <Download v-else :size="16" />
            导出成片（MP4）
          </button>
          <span v-if="exporting" class="muted small">总进度 {{ exportPct }}%</span>
          <span v-if="status" class="muted small">{{ status }}</span>
        </div>
      </main>
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
.steps {
  gap: 14px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-2);
}
.step-n {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
}
.step-arrow {
  color: var(--text-3);
  margin-left: 8px;
}
.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.clip-list {
  display: grid;
  gap: 6px;
}
.clip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
}
.clip-item:hover {
  border-color: var(--accent);
}
.clip-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.clip-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  width: 24px;
  height: 22px;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
}
.mini:hover {
  border-color: var(--accent);
}
.mini.danger:hover {
  border-color: var(--err);
  color: var(--err);
}
.player {
  width: 100%;
  max-height: 52vh;
  border-radius: 12px;
  background: #000;
}
.timeline {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}
.tl-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 8px;
}
.tl-track {
  display: flex;
  gap: 4px;
}
.tl-block {
  min-width: 60px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--accent-soft);
  cursor: pointer;
  overflow: hidden;
  display: grid;
  gap: 2px;
}
.tl-block.active {
  border-color: var(--accent);
}
.tl-name {
  font-size: 11.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tl-dur {
  font-size: 10.5px;
  color: var(--text-3);
}
.empty {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 60px 20px;
  color: var(--text-3);
  border: 1px dashed var(--border-strong);
  border-radius: 14px;
}
.empty-icon {
  opacity: 0.5;
}
.undo-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(251, 191, 36, 0.4);
  background: rgba(251, 191, 36, 0.07);
  border-radius: 10px;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--text-2);
}
.undo-bar .btn { margin-left: auto; }
.clip-item.dragging,
.tl-block.dragging {
  opacity: 0.55;
  outline: 1.5px dashed var(--accent);
}
.result-card {
  border: 1px solid var(--accent);
  border-radius: 12px;
  padding: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.export-row {
  position: sticky;
  bottom: 0;
  z-index: 5;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(4px);
  padding: 10px 4px;
  border-top: 1px solid var(--border);
}
</style>
