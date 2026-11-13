<script setup lang="ts">
/** 视频分段：按时长或等分切成多段，流复制循环截取后打包 ZIP（容器跟随源、全局进度、大段数确认） */
import { computed, ref } from 'vue'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import { saveMany, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'dur' | 'count'>('dur')
const segSec = ref(60)
const segCount = ref(3)
const toast = useToast()
const needConfirm = ref(false)
const globalPct = ref(0)
const segLabel = ref('')

const stem = computed(() => baseName(base.value?.outputName || 'video').replace(/\.\w+$/, ''))
/** 容器跟随源：FfBase 已把 outputName 扩展名取为源扩展名 */
const srcExt = computed(() => {
  const m = /\.(\w+)$/.exec(base.value?.outputName || '')
  return m?.[1]?.toLowerCase() || 'mp4'
})

const confirmText = computed(() => {
  const dur = base.value?.meta?.duration ?? 0
  const n = Math.ceil(dur / Math.max(0.5, segSec.value))
  const coverMin = (n * Math.max(0.5, segSec.value)) / 60
  return `将切 ${n} 段（约覆盖 ${coverMin.toFixed(0)} 分钟），段数较多、耗时较长且 ZIP 体积大。建议「等分成 60 段」或调大每段时长。`
})

/** 大段数确认：≥60 段先展示确认行，用户点头才执行 */
const precheck = () => {
  const dur = base.value?.meta?.duration ?? 0
  if (!Number.isFinite(dur) || dur <= 0) return true
  const segLen = mode.value === 'dur' ? Math.max(0.5, segSec.value) : dur / Math.max(2, Math.floor(segCount.value))
  const n = Math.ceil(dur / segLen)
  if (n >= 60 && !needConfirm.value) {
    needConfirm.value = true
    return false
  }
  return true
}

const useEven60 = () => {
  const dur = base.value?.meta?.duration ?? 0
  needConfirm.value = false
  if (dur > 0) {
    mode.value = 'count'
    segCount.value = 60
  }
}

const run = async () => {
  const b = base.value
  if (!b || !b.meta) return
  if (!precheck()) return
  const dur = b.meta.duration
  // UX1-003：时长缺失（损坏文件/录屏原始流）时给明确终态，杜绝「进度走完却无产物无报错」
  if (!Number.isFinite(dur) || dur <= 0) {
    toast.err('无法读取视频时长（文件可能损坏或是录屏原始数据），请先用「视频格式转换」重编码后再切分')
    return
  }
  const segLen =
    mode.value === 'dur'
      ? Math.max(0.5, segSec.value)
      : dur / Math.max(2, Math.floor(segCount.value))
  // 不设段数上限：Math.ceil 保证最后不足一段的尾段也被切出，避免长视频后半被静默丢弃
  const n = Math.ceil(dur / segLen)
  if (n < 1) {
    toast.err('按当前设置切不出任何分段，请调整每段时长或段数')
    return
  }
  const ext = srcExt.value
  const parts: { name: string; blob: Blob }[] = []
  for (let i = 0; i < n; i++) {
    const s = i * segLen
    const e = Math.min(dur, (i + 1) * segLen)
    const name = `${stem}-part${String(i + 1).padStart(2, '0')}.${ext}`
    segLabel.value = `第 ${i + 1}/${n} 段`
    globalPct.value = Math.round((i / n) * 100)
    b.setBusy(true, `正在切分第 ${i + 1}/${n} 段…`)
    const res = await b.runWithFf(
      ['-y', '-ss', String(s), '-to', String(e - s), '-i', 'input', '-c', 'copy', name],
      { status: `正在切分第 ${i + 1}/${n} 段…` },
    )
    globalPct.value = Math.round(((i + 1) / n) * 100)
    if (!res) {
      segLabel.value = ''
      return
    }
    const data = res.get(name)
    if (!data) continue
    parts.push({ name, blob: new Blob([data as BlobPart], { type: 'video/mp4' }) })
  }
  segLabel.value = ''
  if (parts.length) {
    await saveMany(parts, `${stem}-parts.zip`)
    toast.ok(`已切分为 ${parts.length} 段并打包下载`)
  } else {
    // UX1-003：零产出也要有终态——引导用户先转 MP4（webm 流复制进 mp4 容器不被允许）
    toast.err('切分未产出任何分段（当前编码流复制受限），请先用「视频格式转换」转成 MP4 后再切分')
  }
}
</script>

<template>
  <FfBase ref="base" button-text="开始切分" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">切分方式</span>
        <select v-model="mode" class="select" style="width: 150px" @change="needConfirm = false">
          <option value="dur">按每段时长</option>
          <option value="count">等分成 N 段</option>
        </select>
      </div>
      <div class="opt">
        <template v-if="mode === 'dur'">
          <span class="field-label">每段时长（秒）</span>
          <input v-model.number="segSec" type="number" min="1" step="1" class="input" style="width: 120px" @input="needConfirm = false" />
          <div class="chips">
            <button v-for="p in [60, 30, 600]" :key="p" class="chip-btn" @click="segSec = p; needConfirm = false">
              {{ p === 600 ? '10 分钟' : `${p}s` }}
            </button>
          </div>
        </template>
        <template v-else>
          <span class="field-label">段数 N</span>
          <input v-model.number="segCount" type="number" min="2" class="input" style="width: 120px" @input="needConfirm = false" />
        </template>
      </div>
    </div>
    <div v-if="needConfirm" class="confirm-card mt-2">
      <p>{{ confirmText }}</p>
      <div class="row">
        <button class="btn btn-primary btn-sm" @click="run">仍要切分</button>
        <button class="btn btn-sm" @click="useEven60">改用等分 60 段</button>
        <button class="btn btn-ghost btn-sm" @click="needConfirm = false">取消</button>
      </div>
    </div>
    <div v-if="segLabel" class="gprog mt-2">
      <div class="gp-head"><span>总进度 · {{ segLabel }}</span><span>{{ globalPct }}%</span></div>
      <div class="gp-track"><div class="gp-fill" :style="{ width: `${Math.max(2, globalPct)}%` }"></div></div>
    </div>
    <p class="split-note">
      使用流复制切分，速度快不损画质，切点按关键帧对齐；最后不足一段的尾部也会完整保留；分段容器与源文件一致。
      微信朋友圈等平台建议每段 ≤ 60 秒，段数越多耗时越长。
    </p>
    <FfExpectHint text="逐段切分总耗时与段数成正比（重编码档每段约为该段时长的 1/2~1/5），请保持页面打开勿刷新。" />
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
.chips { display: flex; gap: 6px; margin-top: 4px; }
.chip-btn { padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; font-size: 12px; color: var(--text); }
.chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.confirm-card { max-width: 560px; padding: 12px 14px; border: 1px solid rgba(217, 119, 6, 0.35); background: rgba(217, 119, 6, 0.07); border-radius: 12px; font-size: 13px; color: var(--text-2); display: grid; gap: 8px; }
.confirm-card p { margin: 0; }
.gprog { display: grid; gap: 6px; max-width: 560px; }
.gp-head { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--text-2); }
.gp-track { height: 8px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--panel-solid) 70%, transparent); overflow: hidden; }
.gp-fill { height: 100%; background: linear-gradient(90deg, #34d399, var(--accent)); border-radius: 999px; transition: width 0.25s ease; }
.split-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
