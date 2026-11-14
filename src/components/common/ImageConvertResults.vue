<script setup lang="ts">
/**
 * imgcvt 家族结果列表（从 ImageConvertTool 拆出，保持主组件 ≤300 行）：
 * 体积膨胀黄色警示条 + 整批节省汇总 + 双目标分组 + 逐张下载/调质量重转。
 * 处方来源：png-to-jpg.md 处方 1/5/8、jpg-to-png.md 处方 1、png-to-webp.md 处方 2、jpg-to-webp.md 处方 2。
 */
import { computed, ref } from 'vue'
import { Download, FileImage, Package, RotateCcw } from 'lucide-vue-next'
import { saveBlob, saveMany } from '@/lib/download'
import type { ResultItem } from './imageConvertDiag'

const props = defineProps<{
  results: ResultItem[]
  /** 主目标格式标签（如 JPG），双目标分组标题用 */
  mainLabel: string
  /** 是否提供单张调质量重转（仅主目标卡片） */
  withQuality: boolean
  /** 源文件含照片类格式时输出 EXIF 说明 */
  srcHasMeta: boolean
  /** 体积膨胀警示（null 表示无） */
  growth: { pct: number; name: string; text: string; link?: string } | null
}>()
const emit = defineEmits<{ reconvert: [item: ResultItem, quality: number] }>()

const fmtKB = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

const okItems = computed(() => props.results.filter((r) => r.ok))

/** 双目标输出按格式分组（保持插入顺序：主目标在前，WebP 副本在后） */
const groups = computed(() => {
  const map = new Map<string, ResultItem[]>()
  for (const r of props.results) {
    const key = r.main ? props.mainLabel : r.fmt
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return [...map.entries()].map(([fmt, items]) => ({ fmt, items }))
})

/** 整批节省汇总（输出小于输入时展示，jpg-to-webp/png-to-webp 压缩率报告） */
const saved = computed(() => {
  const ok = okItems.value
  if (!ok.length) return null
  const inSum = ok.reduce((n, r) => n + r.srcSize, 0)
  const outSum = ok.reduce((n, r) => n + r.blob.size, 0)
  if (inSum <= 0 || outSum >= inSum) return null
  const savedBytes = inSum - outSum
  return { text: fmtKB(savedBytes), pct: Math.round((savedBytes / inSum) * 100) }
})

const zipAll = async () => {
  const ok = okItems.value
  if (!ok.length) return
  await saveMany(ok.map((r) => ({ name: r.name, blob: r.blob })), `已转换-${ok.length}张.zip`)
}
const dlOne = (r: ResultItem) => {
  if (r.ok) saveBlob(r.blob, r.name)
}

/* 单张调质量重转：卡片内展开独立质量滑条（png-to-jpg 处方 5） */
const openId = ref<number | null>(null)
const reQ = ref(0.7)
const toggleRe = (r: ResultItem) => {
  if (openId.value === r.id) {
    openId.value = null
    return
  }
  openId.value = r.id
  reQ.value = 0.7
}
const applyRe = (r: ResultItem) => {
  openId.value = null
  emit('reconvert', r, reQ.value)
}
</script>

<template>
  <div class="cvt-results">
    <!-- 体积膨胀黄色警示条（b：输出比输入大时给出改用建议） -->
    <div v-if="growth" class="notice notice-warn growth-bar">
      输出比原文件大 {{ growth.pct }}%（最大一张：{{ growth.name }}）。{{ growth.text }}
      <RouterLink v-if="growth.link" :to="growth.link" class="growth-link">立即前往 →</RouterLink>
    </div>

    <div class="results-head">
      <span class="field-label">
        转换结果（{{ okItems.length }}/{{ results.length }}）
        <em v-if="saved" class="saved">本批共节省 {{ saved.text }}（{{ saved.pct }}%）</em>
      </span>
      <button class="btn btn-soft btn-sm" @click="zipAll"><Package :size="14" /> 全部打包下载</button>
    </div>

    <div v-for="g in groups" :key="g.fmt" class="grp">
      <p v-if="groups.length > 1" class="grp-title">{{ g.fmt }}（{{ g.items.filter((r) => r.ok).length }} 张）</p>
      <div class="cards">
        <div v-for="r in g.items" :key="r.id" class="card" :class="{ fail: !r.ok }">
          <div class="thumb">
            <img v-if="r.ok" :src="r.url" :alt="r.name" loading="lazy" />
            <FileImage v-else :size="22" />
          </div>
          <div class="meta">
            <span class="name" :title="r.name">{{ r.name }}</span>
            <span v-if="r.ok" class="size">{{ fmtKB(r.srcSize) }} → <strong>{{ fmtKB(r.blob.size) }}</strong>
              <em v-if="r.blob.size < r.srcSize" class="down">（−{{ Math.round((1 - r.blob.size / r.srcSize) * 100) }}%）</em>
              <em v-else class="up">（+{{ Math.round((r.blob.size / r.srcSize - 1) * 100) }}%）</em>
            </span>
            <span v-else class="err-text">{{ r.err }}</span>
            <!-- 单张调质量重转面板（仅主目标 + 有质量参数的工具） -->
            <div v-if="openId === r.id" class="re-row" @click.stop>
              <input v-model.number="reQ" type="range" min="0.3" max="1" step="0.05" />
              <span class="re-q">{{ Math.round(reQ * 100) }}%</span>
              <button class="btn btn-primary btn-sm" @click="applyRe(r)">重转</button>
            </div>
          </div>
          <div class="acts">
            <button v-if="r.ok" class="btn btn-ghost btn-sm" @click="dlOne(r)"><Download :size="14" /> 下载</button>
            <button
              v-if="r.ok && r.main && withQuality && r.srcFile"
              class="btn btn-ghost btn-sm"
              title="对该张单独调质量重转，其余结果不变"
              @click="toggleRe(r)"
            ><RotateCcw :size="14" /> 调质量重转</button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="srcHasMeta && okItems.length" class="small muted exif-note">说明：转换经画布重编码，输出不保留 EXIF 拍摄信息（时间 / 地点 / 机型）；转发场景更安全，存档请留意。</p>
  </div>
</template>

<style scoped>
.growth-bar {
  margin-bottom: 10px;
}
.growth-link {
  margin-left: 6px;
  color: var(--accent-text);
  white-space: nowrap;
}
.results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.saved {
  font-style: normal;
  margin-left: 8px;
  color: #34d399;
  font-weight: 600;
}
.grp-title {
  margin: 8px 0 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
}
.card {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
}
.card.fail {
  border-color: color-mix(in srgb, var(--warn) 55%, transparent);
}
.thumb {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background:
    repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px,
    color-mix(in srgb, var(--panel-solid) 60%, transparent);
  color: var(--warn);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.meta {
  min-width: 0;
  display: grid;
  gap: 3px;
  font-size: 12.5px;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.size {
  color: var(--text-3);
}
.size strong {
  color: var(--accent-text);
}
.size em {
  font-style: normal;
}
.size em.down {
  color: #34d399;
}
.size em.up {
  color: var(--warn);
}
.err-text {
  color: var(--warn);
}
.acts {
  display: grid;
  gap: 6px;
  justify-items: end;
}
.re-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.re-row input[type='range'] {
  width: 110px;
}
.re-q {
  font-size: 12px;
  color: var(--text-2);
  min-width: 34px;
}
.exif-note {
  margin-top: 10px;
}
</style>
