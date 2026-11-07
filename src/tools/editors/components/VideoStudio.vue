<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Clapperboard, Loader2, Trash2, ArrowUp, ArrowDown, Scissors, Download, Film } from 'lucide-vue-next'
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
    URL.revokeObjectURL(c.url)
    clips.value.splice(i, 1)
  }
  if (activeId.value === id) activeId.value = clips.value[0]?.id ?? null
}

const move = (id: number, dir: -1 | 1) => {
  const i = clips.value.findIndex((c) => c.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= clips.value.length) return
  const arr = [...clips.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  clips.value = arr
}

const activeClip = computed(() => clips.value.find((c) => c.id === activeId.value))

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

const doExport = async () => {
  if (!clips.value.length) {
    toast.warn('请先导入视频素材')
    return
  }
  exporting.value = true
  status.value = '正在加载 ffmpeg 核心（首次约 25MB，之后走浏览器缓存）…'
  let segNames: string[] = []
  try {
    const ff = await getFf((m) => {
      if (m.includes('frame=') || m.includes('time=')) return
      status.value = m.slice(0, 120)
    })
    // 逐段处理
    for (const [i, clip] of clips.value.entries()) {
      status.value = `处理第 ${i + 1}/${clips.value.length} 段：${clip.name}`
      const ext = clip.name.toLowerCase().endsWith('.webm') ? '.webm' : '.mp4'
      const inName = `in_${i}${ext}`
      const outName = `seg_${i}.mp4`
      await ff.writeFile(inName, new Uint8Array(await clip.file.arrayBuffer()))
      const ts = Math.max(0, clip.trimStart)
      const te = Math.min(clip.duration, Math.max(ts + 0.1, clip.trimEnd || clip.duration))
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
    }
    // 拼接
    status.value = '拼接全部片段…'
    await ff.writeFile(
      'list.txt',
      new TextEncoder().encode(segNames.map((n) => `file '${n}'`).join('\n')),
    )
    await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-y', 'output.mp4'])
    const data = (await ff.readFile('output.mp4')) as Uint8Array
    saveBlob(new Blob([data.slice().buffer as ArrayBuffer], { type: 'video/mp4' }), '成片.mp4')
    toast.ok('导出完成')
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
    status.value = ''
  }
}

onBeforeUnmount(() => {
  for (const c of clips.value) URL.revokeObjectURL(c.url)
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

        <div v-if="clips.length" class="clip-list mt-2">
          <div
            v-for="(c, i) in clips"
            :key="c.id"
            class="clip-item"
            :class="{ active: c.id === activeId }"
            @click="select(c.id)"
          >
            <Film :size="14" class="muted" />
            <span class="clip-name" :title="c.name">{{ c.name }}</span>
            <span class="muted small">{{ fmt(c.duration) }}</span>
            <span class="row" style="gap: 2px">
              <button class="mini" title="上移" @click.stop="move(c.id, -1)"><ArrowUp :size="12" /></button>
              <button class="mini" title="下移" @click.stop="move(c.id, 1)"><ArrowDown :size="12" /></button>
              <button class="mini danger" title="移除" @click.stop="remove(c.id)"><Trash2 :size="12" /></button>
            </span>
          </div>
        </div>
      </aside>

      <main class="main">
        <template v-if="activeClip">
          <video :src="activeClip.url" controls class="player"></video>

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

        <!-- 时间线 -->
        <div v-if="clips.length" class="timeline mt-3">
          <div class="tl-title">时间线（按顺序拼接，总时长约 {{ fmt(totalDuration) }}）</div>
          <div class="tl-track">
            <div
              v-for="c in clips"
              :key="c.id"
              class="tl-block"
              :class="{ active: c.id === activeId }"
              :style="{ flexGrow: Math.max(0.5, (c.trimEnd || c.duration) - c.trimStart) }"
              @click="select(c.id)"
            >
              <span class="tl-name">{{ c.name }}</span>
              <span class="tl-dur">{{ fmt((c.trimEnd || c.duration) - c.trimStart) }}<template v-if="c.muted"> · 静音</template></span>
            </div>
          </div>
        </div>

        <div class="row row-wrap mt-3">
          <button class="btn btn-primary" :disabled="exporting || !clips.length" @click="doExport">
            <Loader2 v-if="exporting" :size="16" class="spin" />
            <Download v-else :size="16" />
            导出成片（MP4）
          </button>
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
</style>
