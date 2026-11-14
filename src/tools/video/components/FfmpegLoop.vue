<script setup lang="ts">
/**
 * 视频循环拼接：重复 N 次（流复制秒级）/ 无缝循环（xfade 交叉淡化 1s）/ 回弹（正放+倒放）；
 * 支持区间循环；输出名后缀透明可改；内存预估与拦截。
 */
import { computed, ref, watch } from 'vue'
import FfBase from './FfBase.vue'
import FfExpectHint from './FfExpectHint.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const base = ref<InstanceType<typeof FfBase> | null>(null)
const mode = ref<'repeat' | 'seamless' | 'boomerang'>('repeat')
const times = ref(3)
const rangeOn = ref(false)
const rs = ref(0)
const re = ref(0)

const dur = computed(() => base.value?.meta?.duration ?? 0)
const srcSize = computed(() => base.value?.files[0]?.size ?? 0)

/** 输出名后缀透明：切到回弹档立即在输出名框体现，用户可改 */
watch(mode, (m) => {
  const name = base.value?.outputName ?? ''
  if (!name) return
  const stem = name.replace(/\.\w+$/, '').replace(/-boomerang$/, '')
  if (m === 'boomerang' && !/-boomerang$/.test(name)) base.value!.outputName = `${stem}-boomerang.mp4`
  else if (m !== 'boomerang') base.value!.outputName = `${stem}.mp4`
})

/** 乘法预估：预计输出时长/体积；≥1.5GB 拦截 */
const estMB = computed(() => {
  const n = mode.value === 'repeat' ? Math.max(2, Math.min(50, Math.floor(times.value))) : mode.value === 'seamless' ? Math.max(2, Math.min(6, Math.floor(times.value))) : 2
  return (srcSize.value * n) / 1024 / 1024
})
const estMin = computed(() => {
  const n = mode.value === 'repeat' ? Math.max(2, Math.min(50, Math.floor(times.value))) : mode.value === 'seamless' ? Math.max(2, Math.min(6, Math.floor(times.value))) : 2
  const total = (dur.value || 0) * n
  return total / 60
})
const overMemory = computed(() => estMB.value >= 1536)

const guard = (): boolean => {
  const b = base.value
  if (!b || !b.files.length) return false
  if (overMemory.value) {
    toast.warn(`预计输出 ≈ ${estMB.value.toFixed(0)} MB（${estMin.value.toFixed(1)} 分钟），超出浏览器内存处理能力（1.5GB）。请降低次数或先用「压缩视频」压小源文件`)
    return false
  }
  if (mode.value === 'seamless' && times.value > 6) {
    toast.warn('无缝循环（交叉淡化）最多支持 6 次：次数越多内存占用越大')
    return false
  }
  return true
}

const run = async () => {
  const b = base.value
  if (!b || !guard()) return
  if (mode.value === 'repeat' || mode.value === 'seamless') {
    const n = Math.max(2, Math.min(mode.value === 'repeat' ? 50 : 6, Math.floor(times.value)))
    let seg = { s: 0, e: dur.value }
    let segData: Uint8Array | null = null
    let inputName = 'input'
    if (rangeOn.value) {
      // 区间循环：先流复制截出区间段，再对段做循环
      const s = Math.max(0, Math.min(rs.value, re.value))
      const e = Math.max(rs.value, re.value)
      if (e - s < 0.2) {
        toast.warn('循环区间太短（<0.2s），请调整起止时间')
        return
      }
      seg = { s, e }
      const r1 = await b.runWithFf(['-y', '-ss', String(s), '-to', String(e - s), '-i', 'input', '-c', 'copy', 'seg.mp4'], {
        status: '正在截取循环区间…',
        onDone: (results) => {
          segData = results.get('seg.mp4') ?? null
        },
      })
      if (!r1 || !segData) return
      inputName = 'seg.mp4'
    }
    if (mode.value === 'repeat') {
      await b.runWithFf(
        ['-y', '-stream_loop', String(n - 1), '-i', inputName, '-c', 'copy', b.outputName],
        { status: `正在循环拼接 ${n} 次…`, files: segData ? [{ name: inputName, data: segData }] : undefined },
      )
      return
    }
    // 无缝循环：N 份输入 + xfade 交叉淡化 1s（视频）/ acrossfade（音频）
    const d = seg.e - seg.s
    const segBytes = segData ?? new Uint8Array(await (b.files[0] as File).arrayBuffer())
    const inputs = Array.from({ length: n }, (_, k) => `in${k}.mp4`)
    const files = inputs.map((name) => ({ name, data: segBytes }))
    const fcParts: string[] = []
    for (let k = 0; k < n - 1; k++) {
      const a = k === 0 ? '[0:v]' : `[vx${k}]`
      fcParts.push(`${a}[${k + 1}:v]xfade=transition=fade:duration=1:offset=${((k + 1) * (d - 1)).toFixed(3)}[vx${k + 1}]`)
    }
    for (let k = 0; k < n - 1; k++) {
      const a = k === 0 ? '[0:a]' : `[ax${k}]`
      fcParts.push(`${a}[${k + 1}:a]acrossfade=d=1[ax${k + 1}]`)
    }
    await b.runWithFf(
      [
        '-y',
        ...inputs.flatMap((nm) => ['-i', nm]),
        '-filter_complex', fcParts.join(';'),
        '-map', `[vx${n - 1}]`, '-map', `[ax${n - 1}]`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', b.outputName,
      ],
      {
        status: `正在生成无缝循环（${n} 次 × 交叉淡化 1s）…`,
        files: files as { name: string; data: File | Blob | Uint8Array | string }[],
      },
    )
    return
  }
  // 回弹：先生成倒放片段，再 concat
  let rev: Uint8Array | undefined
  const r1 = await b.runWithFf(
    [
      '-y', '-i', 'input', '-vf', 'reverse', '-af', 'areverse',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', 'rev.mp4',
    ],
    {
      status: '正在生成倒放片段…',
      onDone: (results) => {
        rev = results.get('rev.mp4')
      },
    },
  )
  if (!r1 || !rev) return
  await b.runWithFf(['-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', b.outputName], {
    extraFiles: [
      { name: 'rev.mp4', data: rev },
      { name: 'list.txt', data: "file 'input'\nfile 'rev.mp4'" },
    ],
    status: '正在拼接回弹视频…',
  })
  toast.ok('回弹视频已生成')
}
</script>

<template>
  <FfBase ref="base" button-text="开始处理" @run="run">
    <div class="opts">
      <div class="opt">
        <span class="field-label">循环方式</span>
        <select v-model="mode" class="select" style="width: 210px">
          <option value="repeat">重复播放 N 次（流复制）</option>
          <option value="seamless">无缝循环（交叉淡化 1s）</option>
          <option value="boomerang">回弹（正放 + 倒放）</option>
        </select>
      </div>
      <div v-if="mode !== 'boomerang'" class="opt">
        <span class="field-label">{{ mode === 'seamless' ? '次数（≤6）' : '重复次数' }}</span>
        <input v-model.number="times" type="number" :min="2" :max="mode === 'seamless' ? 6 : 50" class="input" style="width: 100px" />
      </div>
      <label v-if="mode !== 'boomerang'" class="check" style="margin-bottom: 6px">
        <input v-model="rangeOn" type="checkbox" /> 只循环所选区间
      </label>
      <template v-if="mode !== 'boomerang' && rangeOn">
        <div class="opt">
          <span class="field-label">开始（秒）</span>
          <input v-model.number="rs" type="number" min="0" step="0.1" class="input" style="width: 100px" />
        </div>
        <div class="opt">
          <span class="field-label">结束（秒）</span>
          <input v-model.number="re" type="number" min="0" step="0.1" class="input" style="width: 100px" />
        </div>
      </template>
    </div>
    <p v-if="srcSize > 0 && mode !== 'boomerang'" class="est-line" :class="{ over: overMemory }">
      预计输出 ≈ {{ estMin.toFixed(1) }} 分钟 / ≈ {{ estMB < 1024 ? `${estMB.toFixed(0)} MB` : `${(estMB / 1024).toFixed(2)} GB` }}
      <template v-if="overMemory"> · 超出浏览器内存处理能力（1.5GB），请降低次数或先压缩源视频</template>
    </p>
    <p class="loop-note">
      重复模式使用流复制，瞬间完成；无缝循环用 xfade 交叉淡化首尾过渡（需重编码，最多 6 次）；回弹模式需先生成倒放片段（会重编码），耗时与视频长度成正比。
    </p>
    <FfExpectHint text="流复制循环通常秒级完成；无缝/回弹档需重编码（约为视频时长的 1/2~1/5）。首次使用需加载约 30MB 编解码核心，处理期间请保持页面打开。" />
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
.est-line { font-size: 12.5px; color: var(--accent-text); margin-top: 8px; font-variant-numeric: tabular-nums; }
.est-line.over { color: #d97706; font-weight: 700; }
.loop-note {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
