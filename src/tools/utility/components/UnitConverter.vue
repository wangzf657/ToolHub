<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftRight } from 'lucide-vue-next'

interface Unit {
  id: string
  label: string
  /** 相对于基准单位的系数（乘法） */
  factor: number
}
interface Category {
  id: string
  name: string
  units: Unit[]
  /** 温度等非线性换算时提供函数 */
  toBase?: (v: number, unitId: string) => number
  fromBase?: (v: number, unitId: string) => number
}

const u = (id: string, label: string, factor: number): Unit => ({ id, label, factor })

const categories: Category[] = [
  {
    id: 'length', name: '长度',
    units: [u('m', '米 m', 1), u('km', '千米 km', 1000), u('cm', '厘米 cm', 0.01), u('mm', '毫米 mm', 0.001),
      u('mi', '英里 mi', 1609.344), u('ft', '英尺 ft', 0.3048), u('in', '英寸 in', 0.0254), u('nmi', '海里 nmi', 1852)],
  },
  {
    id: 'weight', name: '重量',
    units: [u('kg', '千克 kg', 1), u('g', '克 g', 0.001), u('t', '吨 t', 1000), u('lb', '磅 lb', 0.45359237),
      u('oz', '盎司 oz', 0.028349523), u('jin', '市斤', 0.5), u('liang', '市两', 0.05)],
  },
  {
    id: 'temp', name: '温度',
    units: [u('c', '摄氏度 ℃', 1), u('f', '华氏度 ℉', 1), u('k', '开尔文 K', 1)],
    toBase: (v, id) => (id === 'c' ? v : id === 'f' ? ((v - 32) * 5) / 9 : v - 273.15),
    fromBase: (v, id) => (id === 'c' ? v : id === 'f' ? (v * 9) / 5 + 32 : v + 273.15),
  },
  {
    id: 'area', name: '面积',
    units: [u('m2', '平方米 m²', 1), u('km2', '平方千米 km²', 1e6), u('ha', '公顷 ha', 1e4),
      u('mu', '亩', 2000 / 3), u('ft2', '平方英尺 ft²', 0.09290304), u('acre', '英亩 acre', 4046.8564224)],
  },
  {
    id: 'volume', name: '体积',
    units: [u('l', '升 L', 1), u('ml', '毫升 mL', 0.001), u('m3', '立方米 m³', 1000),
      u('gal_us', '美制加仑', 3.785411784), u('gal_uk', '英制加仑', 4.54609), u('cup', '杯 cup（240mL）', 0.24)],
  },
  {
    id: 'speed', name: '速度',
    units: [u('kmh', '千米/小时 km/h', 1), u('ms', '米/秒 m/s', 3.6), u('mph', '英里/小时 mph', 1.609344),
      u('kn', '节 kn', 1.852)],
  },
  {
    id: 'data', name: '数据容量',
    units: [u('b', '字节 B', 1), u('kb', 'KB（1000）', 1e3), u('mb', 'MB', 1e6), u('gb', 'GB', 1e9), u('tb', 'TB', 1e12),
      u('kib', 'KiB（1024）', 1024), u('mib', 'MiB', 1024 ** 2), u('gib', 'GiB', 1024 ** 3)],
  },
  {
    id: 'time', name: '时间',
    units: [u('s', '秒 s', 1), u('ms', '毫秒 ms', 0.001), u('min', '分钟 min', 60), u('h', '小时 h', 3600),
      u('d', '天 d', 86400), u('wk', '周 wk', 604800), u('y', '年（365天）', 31536000)],
  },
]

const activeId = ref('length')
const active = computed(() => categories.find((c) => c.id === activeId.value)!)
const leftUnit = ref('m')
const rightUnit = ref('ft')
const leftVal = ref<string>('1')
const rightVal = ref<string>('')

const switchCat = (c: Category) => {
  activeId.value = c.id
  leftUnit.value = c.units[0].id
  rightUnit.value = c.units[1]?.id ?? c.units[0].id
  leftVal.value = '1'
  rightVal.value = ''
  convertLeft()
}

/** 左 → 右 */
const convertLeft = () => {
  const v = parseFloat(leftVal.value)
  if (Number.isNaN(v)) {
    rightVal.value = ''
    return
  }
  rightVal.value = formatNum(convert(v, leftUnit.value, rightUnit.value))
}

/** 右 → 左 */
const convertRight = () => {
  const v = parseFloat(rightVal.value)
  if (Number.isNaN(v)) {
    leftVal.value = ''
    return
  }
  leftVal.value = formatNum(convert(v, rightUnit.value, leftUnit.value))
}

const convert = (v: number, from: string, to: string): number => {
  const cat = active.value
  const fu = cat.units.find((x) => x.id === from)!
  const tu = cat.units.find((x) => x.id === to)!
  if (cat.toBase && cat.fromBase) return cat.fromBase(cat.toBase(v, from), to)
  return (v * fu.factor) / tu.factor
}

const formatNum = (n: number): string => {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-9) return n.toExponential(6)
  const s = n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
  return s
}

const unitLabel = (id: string) => active.value.units.find((x) => x.id === id)?.label ?? id

/** 常用换算表（按当前分类展示每两个常用单位） */
const commonTable = computed(() => {
  const cat = active.value
  const ids = cat.units.slice(0, 4).map((x) => x.id)
  const rows: { text: string }[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue
      const a = cat.units.find((x) => x.id === ids[i])!
      const b = cat.units.find((x) => x.id === ids[j])!
      rows.push({ text: `1 ${a.label} = ${formatNum(convert(1, a.id, b.id))} ${b.label}` })
    }
  }
  return rows
})

switchCat(categories[0])
</script>

<template>
  <div>
    <div class="tabs row row-wrap">
      <button
        v-for="c in categories"
        :key="c.id"
        class="chip"
        :class="{ active: c.id === activeId }"
        @click="switchCat(c)"
      >{{ c.name }}</button>
    </div>

    <div class="conv-card mt-2">
      <div class="conv-grid">
        <div>
          <span class="field-label">从</span>
          <input v-model="leftVal" class="input mono" @input="convertLeft" />
          <select v-model="leftUnit" class="select mt-1" @change="convertLeft">
            <option v-for="x in active.units" :key="x.id" :value="x.id">{{ x.label }}</option>
          </select>
        </div>
        <button class="swap-btn" title="交换方向" aria-label="交换方向" @click="convertRight(); [leftVal, rightVal] = [rightVal, leftVal]; convertLeft()">
          <ArrowLeftRight :size="18" />
        </button>
        <div>
          <span class="field-label">到</span>
          <input v-model="rightVal" class="input mono" @input="convertRight" />
          <select v-model="rightUnit" class="select mt-1" @change="convertLeft">
            <option v-for="x in active.units" :key="x.id" :value="x.id">{{ x.label }}</option>
          </select>
        </div>
      </div>

      <div class="mt-2">
        <h4 class="muted small">常用换算（{{ active.name }}）</h4>
        <div class="table-wrap">
          <table class="data-table">
            <tbody>
              <tr v-for="(r, i) in commonTable" :key="i">
                <td class="mono">{{ r.text }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="notice notice-info small mt-2">
        计算口径：单位间按固定系数换算（长度/重量/面积/体积/速度/数据/时间）；数据容量同时提供十进制（KB=1000B）与二进制（KiB=1024B）两套；温度按 ℃→℉=(℃×9/5)+32、K=℃+273.15 函数换算。
      </p>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  gap: 8px;
}
.conv-card {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 50%, transparent);
}
.conv-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: start;
}
@media (max-width: 640px) {
  .conv-grid {
    grid-template-columns: 1fr;
  }
  .swap-btn {
    justify-self: center;
  }
}
.swap-btn {
  margin-top: 26px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: var(--accent-soft);
  color: var(--accent-text);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.swap-btn:hover {
  border-color: var(--accent);
}
</style>
