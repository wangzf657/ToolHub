<script setup lang="ts">
/** 裁剪视频：双把手区间拖杆 + 起止秒输入 + 预览定位 + 选区试播 + 快速（关键帧）/精确两种模式 */
import { computed, ref } from 'vue'
import { Pause, Play } from 'lucide-vue-next'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const start = ref(0)
const end = ref(0)
const fast = ref(true)
const cur = ref(0)
const previewLoop = ref(false)

const onTime = (t: number) => {
  cur.value = t
  // 选区试播：到终点自动跳回起点循环，手动停止
  if (previewLoop.value && selDur.value > 0.2 && t >= selEnd.value - 0.05) {
    seekTo(selStart.value)
  }
}

const dur = computed(() => base.value?.meta?.duration ?? 0)
const durFinite = computed(() => Number.isFinite(dur.value) && dur.value > 0)
const selEnd = computed(() => (end.value > 0 ? Math.min(end.value, dur.value || end.value) : dur.value))
const selStart = computed(() => Math.min(start.value, selEnd.value - 0.1))
const selDur = computed(() => Math.max(0, selEnd.value - selStart.value))

const seekTo = (t: number) => {
  const v = base.value?.videoEl
  if (v && Number.isFinite(t)) v.currentTime = t
}

const setStart = () => (start.value = Number(cur.value.toFixed(2)))
const setEnd = () => (end.value = Number(cur.value.toFixed(2)))
/** 点击「预览当前时间」文本：把当前时刻填入开始框 */
const fillStartFromCur = () => {
  setStart()
  seekTo(start.value)
}

const dragStart = (e: Event) => {
  const v = Number((e.target as HTMLInputElement).value)
  start.value = Math.min(v, selEnd.value - 0.1)
  seekTo(start.value)
}
const dragEnd = (e: Event) => {
  const v = Number((e.target as HTMLInputElement).value)
  end.value = Math.max(v, start.value + 0.1)
  seekTo(end.value)
}

const toggleLoop = () => {
  if (previewLoop.value) {
    previewLoop.value = false
    base.value?.videoEl?.pause()
    return
  }
  if (selDur.value < 0.2) return
  seekTo(selStart.value)
  previewLoop.value = true
  void base.value?.videoEl?.play()
}

const run = async () => {
  const b = base.value
  if (!b || !b.meta) return
  previewLoop.value = false
  const s = Math.max(0, selStart.value)
  const e = Math.max(s + 0.1, end.value > 0 ? Math.min(end.value, dur.value) : dur.value)
  if (e - s < 0.2) return
  const name = b.outputName
  if (fast.value) {
    // -ss 在 -i 前：-to 相对定位点计时
    await b.runWithFf(
      ['-y', '-ss', String(s), '-to', String(e - s), '-i', 'input', '-c', 'copy', name],
      { status: '正在快速裁剪（流复制）…' },
    )
  } else {
    await b.runWithFf(
      [
        '-y', '-i', 'input', '-ss', String(s), '-to', String(e),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', name,
      ],
      { status: '正在精确裁剪（重编码）…' },
    )
  }
}
</script>

<template>
  <FfBase ref="base" button-text="开始裁剪" @run="run" @time="onTime">
    <div class="opts">
      <div class="opt">
        <span class="field-label">开始（秒）</span>
        <input v-model.number="start" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        <button class="btn btn-soft btn-sm" @click="setStart">设为当前</button>
      </div>
      <div class="opt">
        <span class="field-label">结束（秒，0 = 视频末尾）</span>
        <input v-model.number="end" type="number" min="0" step="0.1" class="input" style="width: 110px" />
        <button class="btn btn-soft btn-sm" @click="setEnd">设为当前</button>
      </div>
      <label class="check" style="margin-bottom: 4px">
        <input v-model="fast" type="checkbox" />
        快速模式（流复制，秒级完成）
      </label>
      <button class="btn btn-soft btn-sm" :class="{ active: previewLoop }" style="margin-bottom: 4px" @click="toggleLoop">
        <Play v-if="!previewLoop" :size="14" /><Pause v-else :size="14" />
        {{ previewLoop ? '停止试播' : '试播选中段' }}
      </button>
      <button class="cur-time" type="button" title="点击把当前时刻填入「开始」" @click="fillStartFromCur">
        预览当前时间：{{ cur.toFixed(2) }}s（点击填入开始）
      </button>
    </div>

    <div v-if="durFinite" class="range-wrap mt-2">
      <div class="range-track"></div>
      <div class="range-sel" :style="{ left: `${(selStart / dur) * 100}%`, width: `${(selDur / dur) * 100}%` }"></div>
      <input class="range-input" type="range" min="0" :max="dur" step="0.1" :value="selStart" @input="dragStart" />
      <input class="range-input" type="range" min="0" :max="dur" step="0.1" :value="selEnd" @input="dragEnd" />
    </div>
    <p class="trim-note">选中时长 <b>{{ selDur.toFixed(1) }}</b> 秒<template v-if="durFinite"> · 全片 {{ dur.toFixed(1) }} 秒</template>。拖动上方双把手可粗选，数字框精确微调。</p>
    <p class="trim-note">
      快速模式直接复制视频流，速度极快，但切点会对齐到最近的关键帧（前后可能偏差 1–2 秒）；
      需要精确到帧请关闭快速模式（将重新编码，耗时较长）。
    </p>
    <FfExpectHint text="快速档（关键帧裁剪）通常秒级；精确档需重编码（约为所选片段时长的 1/2~1/5）。首次使用需加载约 25MB 编解码核心，处理期间请保持页面打开。" />
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
.opt {
  display: grid;
  gap: 4px;
}
.btn.active {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.cur-time {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--accent-text);
  margin-bottom: 6px;
  padding: 0;
}
.range-wrap { position: relative; height: 34px; max-width: 560px; }
.range-track { position: absolute; top: 13px; left: 0; right: 0; height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--panel-solid) 75%, transparent); border: 1px solid var(--border); }
.range-sel { position: absolute; top: 13px; height: 8px; border-radius: 999px; background: var(--accent); opacity: 0.55; pointer-events: none; }
.range-input { position: absolute; top: 6px; left: 0; width: 100%; height: 22px; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; }
.range-input::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: grab; }
.range-input::-moz-range-thumb { pointer-events: auto; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 2px solid #fff; cursor: grab; }
.trim-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
