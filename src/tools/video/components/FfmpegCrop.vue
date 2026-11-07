<script setup lang="ts">
/** 裁切视频画面：像素坐标裁切或按比例预设（居中） */
import { ref, watch } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)
const w = ref(0)
const h = ref(0)
const x = ref(0)
const y = ref(0)
const ratio = ref('')

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

watch(
  () => base.value?.meta,
  (m) => {
    if (m && w.value === 0) {
      w.value = m.width
      h.value = m.height
    }
  },
)

/** 按比例居中裁切（依据当前视频尺寸计算） */
const applyRatio = (r: string) => {
  const m = base.value?.meta
  if (!m) return
  ratio.value = r
  const [rw, rh] = r.split(':').map(Number)
  let cw = m.width
  let ch = (cw * rh) / rw
  if (ch > m.height) {
    ch = m.height
    cw = (ch * rw) / rh
  }
  w.value = even(cw)
  h.value = even(ch)
  x.value = Math.round((m.width - w.value) / 2)
  y.value = Math.round((m.height - h.value) / 2)
}

const run = async () => {
  const b = base.value
  if (!b || !b.meta) return
  const cw = Math.min(b.meta.width, even(w.value))
  const ch = Math.min(b.meta.height, even(h.value))
  if (cw < 2 || ch < 2) return
  const vf = `crop=${cw}:${ch}:${Math.max(0, x.value)}:${Math.max(0, y.value)}`
  await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', b.outputName,
    ],
    { status: '正在裁切画面…' },
  )
}
</script>

<template>
  <FfBase ref="base" button-text="开始裁切" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">比例预设（居中）</span>
        <select :value="ratio" class="select" style="width: 140px" @change="applyRatio(($event.target as HTMLSelectElement).value)">
          <option value="">手动输入</option>
          <option value="1:1">1:1 方形</option>
          <option value="4:5">4:5 竖版</option>
          <option value="9:16">9:16 竖屏</option>
          <option value="16:9">16:9 横屏</option>
        </select>
      </div>
      <div class="opt row" style="gap: 8px">
        <span>
          <span class="field-label">宽</span>
          <input v-model.number="w" type="number" min="2" class="input" style="width: 84px" />
        </span>
        <span>
          <span class="field-label">高</span>
          <input v-model.number="h" type="number" min="2" class="input" style="width: 84px" />
        </span>
        <span>
          <span class="field-label">X 偏移</span>
          <input v-model.number="x" type="number" min="0" class="input" style="width: 84px" />
        </span>
        <span>
          <span class="field-label">Y 偏移</span>
          <input v-model.number="y" type="number" min="0" class="input" style="width: 84px" />
        </span>
      </div>
    </div>
    <p class="crop-note">
      坐标为源视频的像素坐标，左上角为原点。导入视频后尺寸已自动填入；
      手动模式请自行保证宽高不超过画面（偏移 + 尺寸 ≤ 边界），超界部分自动收缩。
    </p>
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
.crop-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
