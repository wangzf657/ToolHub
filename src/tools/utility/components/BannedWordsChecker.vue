<script setup lang="ts">
import { computed, ref } from 'vue'
import { ShieldAlert, Copy } from 'lucide-vue-next'
import { PLATFORM_SETS, scanBannedWords, BAN_CATS, type BanHit } from '@/data/bannedWords'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const text = ref('')
const platform = ref<'generic' | 'ecommerce' | 'social'>('generic')

const hits = computed<BanHit[]>(() => (text.value.trim() ? scanBannedWords(text.value, PLATFORM_SETS[platform.value]) : []))

const byCat = computed(() => {
  const m = new Map<string, BanHit[]>()
  for (const h of hits.value) {
    const arr = m.get(h.cat) ?? []
    arr.push(h)
    m.set(h.cat, arr)
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
})

const rendered = computed(() => {
  // 按命中位置切成「安全文本 / 命中」交替片段
  if (!hits.value.length) return [{ safe: text.value, hit: null as BanHit | null }]
  const out: { safe: string; hit: BanHit | null }[] = []
  let pos = 0
  for (const h of hits.value) {
    if (h.index > pos) out.push({ safe: text.value.slice(pos, h.index), hit: null })
    out.push({ safe: '', hit: h })
    pos = h.index + h.word.length
  }
  if (pos < text.value.length) out.push({ safe: text.value.slice(pos), hit: null })
  return out
})

const sample = '全网最低价！国家级品质，绝对安全无副作用，第一品牌美白祛斑，稳赚不赔，最后一天抢购！'

const fixedText = computed(() => {
  let s = text.value
  for (const h of [...hits.value].reverse()) {
    if (h.fix) s = s.slice(0, h.index) + h.fix + s.slice(h.index + h.word.length)
  }
  return s
})

const doCopyFixed = async () => {
  const ok = await copyText(fixedText.value)
  ok ? toast.ok('已复制替换后的文案') : toast.err('复制失败')
}
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row wrap gap">
        <span class="field-label">适用平台</span>
        <label class="seg" :class="{ active: platform === 'generic' }"><input v-model="platform" type="radio" value="generic" class="sr" /> 通用广告法</label>
        <label class="seg" :class="{ active: platform === 'ecommerce' }"><input v-model="platform" type="radio" value="ecommerce" class="sr" /> 电商/直播</label>
        <label class="seg" :class="{ active: platform === 'social' }"><input v-model="platform" type="radio" value="social" class="sr" /> 小红书/抖音</label>
        <span class="spacer"></span>
        <button class="btn btn-sm" @click="text = sample">填入示例</button>
      </div>
      <textarea v-model="text" class="input area mt-2" rows="6" placeholder="粘贴商品标题、详情页、笔记文案…实时检测"></textarea>
      <p class="hint mt-1">词库内置 {{ PLATFORM_SETS[platform].length }} 条（{{ platform === 'generic' ? '广告法核心' : platform === 'ecommerce' ? '含营销平台词' : '含社媒易限流词' }}），仅供参考，以最新法规与平台规则为准。</p>
    </div>

    <div v-if="text.trim()" class="mt-2">
      <div class="row gap summary" :class="{ ok: !hits.length }">
        <ShieldAlert :size="16" />
        <b>{{ hits.length ? `发现 ${hits.length} 处风险词` : '未发现风险词，文案很干净' }}</b>
        <span v-for="[cat, arr] in byCat" :key="cat" class="cat-chip">{{ BAN_CATS[cat as keyof typeof BAN_CATS] }} ×{{ arr.length }}</span>
      </div>

      <div v-if="hits.length" class="preview mt-2">
        <span v-for="(seg, i) in rendered" :key="i">
          <span v-if="seg.safe">{{ seg.safe }}</span>
          <mark v-else-if="seg.hit" :class="seg.hit.cat" :title="`${seg.hit.catLabel}${seg.hit.fix ? ' · 建议：' + seg.hit.fix : ''}`">{{ seg.hit.word }}</mark>
        </span>
      </div>

      <div v-if="hits.length" class="mt-2">
        <h4 class="h4">命中明细</h4>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>风险词</th><th>类别</th><th>建议替换</th><th>上下文</th></tr></thead>
            <tbody>
              <tr v-for="(h, i) in hits" :key="`${h.word}-${h.index}-${i}`">
                <td class="w">{{ h.word }}</td>
                <td>{{ h.catLabel }}</td>
                <td>{{ h.fix ?? '—' }}</td>
                <td class="ctx mono">{{ h.context }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="btn btn-primary btn-sm mt-2" @click="doCopyFixed"><Copy :size="14" /> 复制按建议替换后的文案</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 8px; }
.spacer { flex: 1; }
.seg { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.seg.active { background: var(--accent-soft, var(--accent)); color: var(--accent-text); border-color: var(--accent); }
.sr { position: absolute; opacity: 0; width: 0; }
.area { width: 100%; resize: vertical; }
.hint { font-size: 12px; color: var(--muted); }
.summary { align-items: center; }
.summary.ok { color: var(--ok); }
.cat-chip { font-size: 12px; padding: 2px 10px; border-radius: 999px; background: var(--surface-2, rgba(127,127,127,.12)); }
.preview { padding: 14px 16px; border: 1px solid var(--border); border-radius: 10px; line-height: 1.9; font-size: 15px; }
mark { border-radius: 4px; padding: 1px 4px; font-weight: 700; }
mark.extreme { background: rgba(239, 68, 68, .25); color: #ef4444; }
mark.authority { background: rgba(245, 158, 11, .25); color: #b45309; }
mark.medical { background: rgba(168, 85, 247, .25); color: #a855f7; }
mark.finance { background: rgba(14, 165, 233, .25); color: #0ea5e9; }
mark.platform { background: rgba(16, 185, 129, .22); color: #10b981; }
.h4 { margin-bottom: 8px; font-size: 14px; }
.tbl-wrap { max-height: 240px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th, .tbl td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border); }
.tbl thead th { position: sticky; top: 0; background: var(--surface-2, inherit); }
.ctx { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w { font-weight: 700; color: #ef4444; }
</style>
