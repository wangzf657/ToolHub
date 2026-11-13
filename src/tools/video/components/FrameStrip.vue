<script setup lang="ts">
/** 截帧候选条：载入视频后自动生成时长均布 8 帧缩略条，点击回填时刻 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { seekTo, captureFrame, type VideoMeta } from '@/lib/videoEngine'

const props = defineProps<{ meta: VideoMeta }>()
const emit = defineEmits<{ pick: [t: number] }>()

interface Cand {
  t: number
  url: string
}
const cands = ref<Cand[]>([])
const busy = ref(false)
let seq = 0

const build = async () => {
  const my = ++seq
  cands.value = []
  busy.value = true
  const meta = props.meta
  const n = 8
  const out: Cand[] = []
  for (let i = 0; i < n; i++) {
    if (my !== seq) return
    const t = Math.min(meta.duration - 0.05, Math.max(0, (meta.duration * i) / n + 0.01))
    try {
      await seekTo(meta, t)
      const c = captureFrame(meta, t)
      // 缩略图降采样，8 张小图避免内存/带宽压力
      const w = 128
      const h = Math.max(1, Math.round((c.height / c.width) * w))
      const small = document.createElement('canvas')
      small.width = w
      small.height = h
      small.getContext('2d')!.drawImage(c, 0, 0, w, h)
      out.push({ t, url: small.toDataURL('image/jpeg', 0.7) })
      cands.value = [...out]
    } catch {
      /* 单帧失败跳过 */
    }
  }
  busy.value = false
}

watch(() => props.meta, () => void build(), { immediate: true })
onBeforeUnmount(() => {
  seq++
})
</script>

<template>
  <div class="strip">
    <span class="strip-title">候选帧（点击选用）：</span>
    <div class="strip-row">
      <button v-for="c in cands" :key="c.t" class="cand" :title="`选中 ${c.t.toFixed(2)}s`" @click="emit('pick', c.t)">
        <img :src="c.url" alt="" />
        <i>{{ c.t.toFixed(1) }}s</i>
      </button>
      <span v-if="busy" class="strip-tip">正在生成候选帧…</span>
    </div>
  </div>
</template>

<style scoped>
.strip { margin-top: 10px; }
.strip-title { font-size: 12px; color: var(--text-3); }
.strip-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.cand { position: relative; padding: 0; border: 2px solid var(--border); border-radius: 8px; overflow: hidden; cursor: pointer; background: none; }
.cand:hover, .cand:focus-visible { border-color: var(--accent); }
.cand img { width: 128px; height: 72px; object-fit: cover; display: block; }
.cand i { position: absolute; left: 4px; bottom: 2px; font-style: normal; font-size: 10px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.9); font-variant-numeric: tabular-nums; }
.strip-tip { font-size: 12px; color: var(--text-3); align-self: center; }
</style>
