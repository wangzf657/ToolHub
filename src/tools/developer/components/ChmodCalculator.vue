<script setup lang="ts">
import { computed, ref } from 'vue'
import { Lock, RotateCcw } from 'lucide-vue-next'
import { chmodToSymbol } from '@/lib/jsEngine'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const GROUPS = ['属主 (User)', '属组 (Group)', '其他 (Other)'] as const
const PERMS = [
  { bit: 4, label: '读 r' },
  { bit: 2, label: '写 w' },
  { bit: 1, label: '执行 x' },
] as const

const state = ref<boolean[][]>([
  [true, true, false],
  [true, false, false],
  [true, false, false],
])

const octal = computed(() => state.value.map((g) => String(g.reduce((acc, on, i) => acc + (on ? PERMS[i]!.bit : 0), 0))).join(''))
const symbol = computed(() => chmodToSymbol(octal.value))
const special = ref<'none' | '4' | '2' | '1'>('none')
const fullOctal = computed(() => (special.value === 'none' ? octal.value : special.value + octal.value))

const octalInput = ref('644')
const applyOctal = () => {
  const digits = octalInput.value.replace(/[^0-7]/g, '')
  if (digits.length < 3) {
    toast.err('请输入至少 3 位八进制数字（0-7）')
    return
  }
  const use = digits.slice(-3)
  state.value = [...use].map((d) => {
    const n = Number(d)
    return [Boolean(n & 4), Boolean(n & 2), Boolean(n & 1)]
  })
  special.value = 'none'
  octalInput.value = use
  toast.ok(`已应用权限 ${use}`)
}

const reset = () => {
  state.value = [
    [true, true, false],
    [true, false, false],
    [true, false, false],
  ]
  special.value = 'none'
}

/** 预设 chips（rx2） */
const PRESETS = ['755', '644', '600', '700', '777']
const applyPreset = (p: string) => {
  octalInput.value = p
  applyOctal()
}

/** 符号式反解（rx1）：粘贴 rwxr-xr-x 应用到九宫格，识别 s/S/t/T 特殊位 */
const symInput = ref('')
const applySymbol = () => {
  const s = symInput.value.trim().replace(/^[-dlbcps]/, '')
  if (!/^[rwxstST-]{9}$/.test(s)) {
    toast.err('请粘贴 9 位符号权限，如 rwxr-xr-x')
    return
  }
  state.value = [0, 1, 2].map((g) => {
    const seg = s.slice(g * 3, g * 3 + 3)
    return [seg[0] === 'r', seg[1] === 'w', seg[2] === 'x' || seg[2] === 's' || seg[2] === 't']
  })
  const flags = [s[2], s[5], s[8]]
  const setuid = flags[0] === 's' || flags[0] === 'S'
  const setgid = flags[1] === 's' || flags[1] === 'S'
  const sticky = flags[2] === 't' || flags[2] === 'T'
  const count = [setuid, setgid, sticky].filter(Boolean).length
  if (count > 1) {
    toast.warn('检测到多个特殊位并存，请改用八进制反向输入设置')
    special.value = 'none'
  } else {
    special.value = setuid ? '4' : setgid ? '2' : sticky ? '1' : 'none'
  }
  symInput.value = s
  toast.ok(`已按符号式 ${s} 反解权限（${fullOctal.value}）`)
}

/** 递归开关（rx3） */
const recursive = ref(false)
const cmdFull = computed(() => `chmod ${recursive.value ? '-R ' : ''}${fullOctal.value} ${recursive.value ? '目录名/' : '文件名'}`)

/** 特殊位中文解释（rx4） */
const specialExplain = computed(
  () =>
    ({
      none: '',
      '4': 'SetUID：执行该文件时以文件属主身份运行（而非执行者本人）。',
      '2': 'SetGID：执行该文件时进程属组变为文件属组；对目录则使新文件继承目录属组。',
      '1': 'Sticky：仅属主（和 root）可删除/改名该目录内的文件（如 /tmp）。',
    })[special.value],
)

const copy = async (v: string) => {
  const okFlag = await copyText(v)
  okFlag ? toast.ok('已复制') : toast.err('复制失败')
}
</script>

<template>
  <div class="chmod-calc">
    <div class="row row-wrap mb-2" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0">常用预设</span>
      <button v-for="p in PRESETS" :key="p" class="btn btn-soft btn-sm mono" @click="applyPreset(p)">{{ p }}</button>
    </div>

    <div class="grid-3" style="gap: 12px">
      <div v-for="(group, gi) in GROUPS" :key="group" class="perm-card">
        <b class="pc-title">{{ group }}</b>
        <label v-for="(p, pi) in PERMS" :key="p.bit" class="check pc-check">
          <input v-model="state[gi]![pi]" type="checkbox" />
          {{ p.label }}
        </label>
        <code class="pc-digit mono">{{ octal[gi] }}</code>
      </div>
    </div>

    <div class="row row-wrap mt-3" style="gap: 14px; align-items: center">
      <span class="field-label" style="margin: 0">特殊位</span>
      <select v-model="special" class="select" style="width: 150px">
        <option value="none">无</option>
        <option value="4">SetUID (4)</option>
        <option value="2">SetGID (2)</option>
        <option value="1">Sticky (1)</option>
      </select>
      <button class="btn btn-ghost btn-sm" @click="reset"><RotateCcw :size="14" /> 重置为 644</button>
      <span class="grow"></span>
      <span class="field-label" style="margin: 0">八进制反向输入</span>
      <input v-model="octalInput" type="text" class="input mono" style="width: 110px" placeholder="755" @keyup.enter="applyOctal" />
      <button class="btn btn-soft btn-sm" @click="applyOctal">应用到勾选</button>
    </div>

    <div class="row row-wrap mt-2" style="gap: 8px; align-items: center">
      <span class="field-label" style="margin: 0">符号式反解</span>
      <input v-model="symInput" type="text" class="input mono" style="width: 170px" placeholder="rwxr-xr-x" @keyup.enter="applySymbol" />
      <button class="btn btn-soft btn-sm" @click="applySymbol">反解到九宫格</button>
      <span class="muted small">识别 s/S/t/T 特殊位</span>
    </div>

    <div v-if="specialExplain" class="notice notice-info mt-2 small">{{ specialExplain }}</div>

    <div class="mt-3 out-list">
      <div class="out-row">
        <span>八进制权限</span>
        <b class="mono accent">{{ fullOctal }}</b>
        <button class="mini-btn" aria-label="复制八进制权限" @click="copy(fullOctal)"><Lock :size="13" /></button>
      </div>
      <div class="out-row">
        <span>符号表示</span>
        <b class="mono">{{ symbol }}</b>
        <button class="mini-btn" aria-label="复制符号权限" @click="copy(symbol)"><Lock :size="13" /></button>
      </div>
      <div class="out-row">
        <span>chmod 命令</span>
        <b class="mono">{{ cmdFull }}</b>
        <button class="mini-btn" aria-label="复制 chmod 命令" @click="copy(cmdFull)"><Lock :size="13" /></button>
      </div>
      <label class="check" style="margin-top: 4px">
        <input v-model="recursive" type="checkbox" />
        加 -R 递归（<span class="muted">递归会改变全部子项权限，目录树大时影响面广，请确认</span>）
      </label>
    </div>

    <p class="notice notice-info mt-3 small">
      口径说明：r=4、w=2、x=1，每组三位数字相加；符号式按「属主 / 属组 / 其他」顺序展示。含特殊位时命令为 4 位（如 4755）。
    </p>
  </div>
</template>

<style scoped>
.perm-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  display: grid;
  gap: 8px;
  justify-items: start;
}
.pc-title {
  font-size: 13.5px;
  color: var(--accent-text);
}
.pc-check {
  font-size: 14px;
}
.pc-digit {
  justify-self: end;
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-text);
}
.out-list {
  display: grid;
  gap: 8px;
}
.out-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 14px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.out-row span:first-child {
  flex: none;
  width: 90px;
  color: var(--text-3);
  font-size: 13px;
}
.out-row b {
  flex: 1;
  overflow-wrap: anywhere;
}
.accent {
  color: var(--accent-text);
}
.mini-btn {
  flex: none;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
}
</style>
