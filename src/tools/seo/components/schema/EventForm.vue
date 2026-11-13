<script setup lang="ts">
import { computed, reactive, watch, watchEffect } from 'vue'
import { clean, S } from './shared'

const event = reactive({
  name: '', startDate: '', endDate: '', venue: '', address: '', city: '', url: '',
  price: '', currency: 'CNY', status: 'EventScheduled', availability: '', validFrom: '',
  attendanceMode: 'OfflineEventAttendanceMode',
})

// rx1 状态联动：状态切到「改为线上」时自动同步参会模式为线上
const linkedNotice = computed(() => event.status === 'EventMovedOnline' && event.attendanceMode === 'OnlineEventAttendanceMode')
watch(
  () => event.status,
  (s) => {
    if (s === 'EventMovedOnline') event.attendanceMode = 'OnlineEventAttendanceMode'
  },
)

const hasPostal = computed(() => !!(event.address.trim() || event.city.trim()))

const json = defineModel<Record<string, unknown> | null>({ required: true })

const buildJson = computed<Record<string, unknown> | null>(() => {
  if (!event.name.trim()) return null
  return {
    '@context': S,
    '@type': 'Event',
    ...clean({ name: event.name, startDate: event.startDate, endDate: event.endDate, url: event.url, eventStatus: S + event.status }),
    // rx1 三态参会模式
    eventAttendanceMode: S + event.attendanceMode,
    // rx3 场地结构化：有街道/城市时输出 PostalAddress；仅场地名退化为 name-only Place
    ...(event.venue
      ? {
          location: {
            '@type': 'Place',
            name: event.venue,
            ...(hasPostal.value
              ? { address: { '@type': 'PostalAddress', ...clean({ streetAddress: event.address, addressLocality: event.city }) } }
              : {}),
          },
        }
      : {}),
    ...(event.price
      ? {
          offers: {
            '@type': 'Offer',
            price: event.price,
            priceCurrency: event.currency,
            ...(event.url ? { url: event.url } : {}),
            ...(event.availability ? { availability: S + event.availability } : {}),
            ...(event.validFrom ? { validFrom: event.validFrom } : {}),
          },
        }
      : {}),
  }
})
watchEffect(() => {
  json.value = buildJson.value
})
</script>

<template>
  <div class="form">
    <div v-if="linkedNotice" class="notice notice-warn">状态已切为「改为线上」，参会模式已自动联动为 OnlineEventAttendanceMode。</div>
    <div class="grid-2">
      <div><label class="field-label">活动名 *</label><input v-model="event.name" class="input" /></div>
      <div>
        <label class="field-label">活动状态</label>
        <select v-model="event.status" class="select">
          <option value="EventScheduled">按计划举行</option><option value="EventPostponed">延期</option>
          <option value="EventCancelled">取消</option><option value="EventMovedOnline">改为线上</option>
        </select>
      </div>
      <div>
        <label class="field-label">参会模式</label>
        <select v-model="event.attendanceMode" class="select">
          <option value="OfflineEventAttendanceMode">线下到场</option>
          <option value="OnlineEventAttendanceMode">线上参与</option>
          <option value="MixedEventAttendanceMode">线上线下混合</option>
        </select>
      </div>
      <div><label class="field-label">开始时间</label><input v-model="event.startDate" type="datetime-local" class="input" /></div>
      <div><label class="field-label">结束时间</label><input v-model="event.endDate" type="datetime-local" class="input" /></div>
      <div><label class="field-label">场地名</label><input v-model="event.venue" class="input" placeholder="如 上海大剧院" /></div>
      <div><label class="field-label">城市</label><input v-model="event.city" class="input" /></div>
      <div><label class="field-label">票价</label><input v-model="event.price" type="number" class="input" placeholder="如 180" /></div>
      <div><label class="field-label">币种</label><input v-model="event.currency" class="input" placeholder="CNY" /></div>
      <div>
        <label class="field-label">票务库存（可选）</label>
        <select v-model="event.availability" class="select">
          <option value="">不指定</option>
          <option value="InStock">有票 InStock</option>
          <option value="SoldOut">售罄 SoldOut</option>
          <option value="PreOrder">预售 PreOrder</option>
        </select>
      </div>
      <div><label class="field-label">开售时间 validFrom（可选）</label><input v-model="event.validFrom" type="date" class="input" /></div>
    </div>
    <div class="mt-1"><label class="field-label">详细地址（与城市至少填一项才有 PostalAddress）</label><input v-model="event.address" class="input" /></div>
    <div class="mt-1"><label class="field-label">活动页 URL</label><input v-model="event.url" class="input" /></div>
  </div>
</template>

<style scoped>
.form { display: grid; gap: 10px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
