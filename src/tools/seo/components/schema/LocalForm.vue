<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { HelpCircle } from 'lucide-vue-next'
import { clean, S } from './shared'

/** rx4 常见子类型 */
const TYPES = ['LocalBusiness', 'Restaurant', 'CafeOrCoffeeShop', 'BarOrPub', 'Store', 'ClothingStore', 'Supermarket', 'Hotel', 'Bank', 'Pharmacy', 'Hospital', 'AutoRepair', 'ProfessionalService']

const local = reactive({ name: '', type: 'LocalBusiness', image: '', phone: '', street: '', city: '', region: '', postal: '', country: '', lat: '', lng: '', hours: '', priceRange: '', url: '' })

// rx2 营业时间构建器：七日勾选 + 起止时间（支持每日第二时段）
interface DayHours {
  on: boolean
  opens: string
  closes: string
  opens2: string
  closes2: string
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const builderOn = ref(false)
const dayHours = ref<DayHours[]>(DAYS.map(() => ({ on: false, opens: '09:00', closes: '18:00', opens2: '', closes2: '' })))
const specOf = (d: DayHours, day: string) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: S + day, opens: d.opens, closes: d.closes })
const hoursSpec = computed(() => {
  const out: Record<string, unknown>[] = []
  dayHours.value.forEach((d, i) => {
    if (!d.on || !d.opens || !d.closes) return
    out.push(specOf(d, DAYS[i]))
    if (d.opens2 && d.closes2) out.push(specOf(d, DAYS[i]))
  })
  return out
})
const hoursSpecCount = computed(() => hoursSpec.value.length)

// rx3 手写模式格式兜底：不含英文星期缩写时警告
const hoursFormatWarn = computed(() => builderOn.value ? false : !!local.hours.trim() && !/(Mo|Tu|We|Th|Fr|Sa|Su)/.test(local.hours))

const hasAddress = computed(() => !!(local.street || local.city || local.region || local.postal || local.country))

const json = defineModel<Record<string, unknown> | null>({ required: true })

const buildJson = computed<Record<string, unknown> | null>(() => {
  if (!local.name.trim()) return null
  return {
    '@context': S,
    '@type': local.type,
    ...clean({ name: local.name, image: local.image, telephone: local.phone, priceRange: local.priceRange, url: local.url }),
    // rx2 构建器开启时输出 OpeningHoursSpecification；手写模式输出 openingHours 字符串
    ...(builderOn.value && hoursSpecCount.value ? { openingHoursSpecification: hoursSpec.value } : {}),
    ...(!builderOn.value && local.hours ? { openingHours: local.hours } : {}),
    // rx1 空壳修复：地址五项全空时不输出 address 节点
    ...(hasAddress.value
      ? { address: { '@type': 'PostalAddress', ...clean({ streetAddress: local.street, addressLocality: local.city, addressRegion: local.region, postalCode: local.postal, addressCountry: local.country }) } }
      : {}),
    ...(local.lat && local.lng ? { geo: { '@type': 'GeoCoordinates', latitude: local.lat, longitude: local.lng } } : {}),
  }
})
watchEffect(() => {
  json.value = buildJson.value
})
</script>

<template>
  <div class="form">
    <div class="grid-2">
      <div><label class="field-label">商家名 *</label><input v-model="local.name" class="input" /></div>
      <div>
        <label class="field-label">类型 @type</label>
        <select v-model="local.type" class="select">
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div><label class="field-label">电话</label><input v-model="local.phone" class="input" placeholder="021-12345678" /></div>
      <div><label class="field-label">价位</label><input v-model="local.priceRange" class="input" placeholder="如 ¥¥" /></div>
      <div><label class="field-label">街道地址</label><input v-model="local.street" class="input" placeholder="中山路 100 号" /></div>
      <div><label class="field-label">城市</label><input v-model="local.city" class="input" placeholder="上海" /></div>
      <div><label class="field-label">省/州</label><input v-model="local.region" class="input" placeholder="上海市" /></div>
      <div><label class="field-label">邮编</label><input v-model="local.postal" class="input" /></div>
      <div><label class="field-label">国家代码</label><input v-model="local.country" class="input" placeholder="CN" /></div>
      <div><label class="field-label">官网</label><input v-model="local.url" class="input" /></div>
      <div>
        <label class="field-label">
          纬度
          <a class="geo-help" href="https://api.map.baidu.com/lbsapi/getpoint/index.html" target="_blank" rel="noopener noreferrer" title="百度坐标拾取器：拾取后复制坐标填到经纬度">
            <HelpCircle :size="13" /> 如何获取坐标
          </a>
        </label>
        <input v-model="local.lat" class="input" placeholder="31.23" />
      </div>
      <div>
        <label class="field-label">经度</label>
        <input v-model="local.lng" class="input" placeholder="121.47" />
      </div>
    </div>

    <div class="hours-box">
      <label class="check">
        <input v-model="builderOn" type="checkbox" />
        使用营业时间构建器（输出 OpeningHoursSpecification，逐日精确）
      </label>
      <template v-if="builderOn">
        <div v-for="(d, i) in dayHours" :key="i" class="day-row" :class="{ off: !d.on }">
          <label class="check day-check"><input v-model="d.on" type="checkbox" />{{ DAY_LABELS[i] }}</label>
          <input v-model="d.opens" type="time" class="input w-time" :disabled="!d.on" />
          <span class="sep">至</span>
          <input v-model="d.closes" type="time" class="input w-time" :disabled="!d.on" />
          <input v-model="d.opens2" type="time" class="input w-time" :disabled="!d.on" placeholder="第二时段起（可选）" />
          <span class="sep">至</span>
          <input v-model="d.closes2" type="time" class="input w-time" :disabled="!d.on" placeholder="第二时段止" />
        </div>
        <p class="mini-hint">已配置 {{ hoursSpecCount }} 组时段；勾选营业日并填起止时间，同一日填第二时段将输出两组 Specification。</p>
      </template>
      <template v-else>
        <div class="mt-1"><label class="field-label">营业时间（schema 格式手写）</label><input v-model="local.hours" class="input" placeholder="Mo-Sa 09:00-19:00" /></div>
        <div v-if="hoursFormatWarn" class="notice notice-warn mt-1">
          营业时间需用 schema.org 格式：英文星期缩写（Mo/Tu/We/Th/Fr/Sa/Su）+ 24 小时制，如「Mo-Sa 09:00-19:00」。当前写法校验器无法识别。
        </div>
      </template>
    </div>

    <div class="mt-1"><label class="field-label">图片 URL</label><input v-model="local.image" class="input" /></div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 10px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
.hours-box { border: 1px dashed var(--border); border-radius: 10px; padding: 10px 12px; }
.day-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.day-row.off { opacity: 0.55; }
.day-check { min-width: 56px; }
.w-time { width: 110px; }
.sep { font-size: 12px; color: var(--text-3); }
.check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.mini-hint { margin: 6px 0 0; font-size: 11.5px; color: var(--text-3); }
.geo-help { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; color: var(--accent); margin-left: 6px; }
.geo-help:hover { text-decoration: underline; }
</style>
