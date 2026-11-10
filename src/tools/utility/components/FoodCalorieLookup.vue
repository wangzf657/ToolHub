<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search, Plus, Trash2, ShoppingBasket } from 'lucide-vue-next'
import { fetchDataset } from '@/lib/utilExt'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Food { n: string; kcal: number; p: number; f: number; cb: number }
const all = ref<Food[]>([])
const query = ref('')
const grams = ref(100)
const cart = ref<{ food: Food; g: number }[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    all.value = await fetchDataset<Food[]>('food')
  } catch (e) {
    toast.err(`食物数据加载失败：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
})

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return all.value.slice(0, 40)
  return all.value.filter((f) => f.n.toLowerCase().includes(q)).slice(0, 40)
})

const add = (f: Food) => {
  cart.value.push({ food: f, g: grams.value || 100 })
}

const remove = (i: number) => cart.value.splice(i, 1)

const totals = computed(() => {
  let kcal = 0, p = 0, f = 0, cb = 0
  for (const { food, g } of cart.value) {
    const k = g / 100
    kcal += food.kcal * k
    p += food.p * k
    f += food.f * k
    cb += food.cb * k
  }
  return { kcal: Math.round(kcal), p: +p.toFixed(1), f: +f.toFixed(1), cb: +cb.toFixed(1) }
})

const kcalPct = computed(() => Math.min(100, Math.round((totals.value.kcal / 2000) * 100)))
</script>

<template>
  <div>
    <div class="opts-panel">
      <div class="row gap">
        <Search :size="16" />
        <input v-model="query" class="input grow" placeholder="搜索食物，如：米饭 / 鸡胸肉 / 苹果…" />
        <span class="field-label">分量</span>
        <input v-model.number="grams" type="number" class="input slim" min="1" step="10" />
        <span class="hint">g</span>
      </div>
      <p class="hint mt-1">{{ loading ? '数据加载中…' : `内置 ${all.length} 种食物（每 100g 可食部，《中国食物成分表》第 6 版口径）· 点击结果加入下方「一餐」累计` }}</p>
    </div>

    <div class="two mt-2">
      <div>
        <h4 class="h4">搜索结果</h4>
        <div class="list">
          <div v-for="f in results" :key="f.n" class="row food-row">
            <span class="fn">{{ f.n }}</span>
            <span class="fk">{{ f.kcal }} 千卡</span>
            <button class="mini-btn" title="加入一餐" @click="add(f)"><Plus :size="14" /></button>
          </div>
        </div>
      </div>
      <div>
        <h4 class="h4"><ShoppingBasket :size="14" style="vertical-align: -2px" /> 我的一餐</h4>
        <div v-if="!cart.length" class="hint">还没有加入食物，点结果右侧 + 号。</div>
        <div v-else class="list">
          <div v-for="(c, i) in cart" :key="c.food.n + i" class="row food-row">
            <span class="fn">{{ c.food.n }}</span>
            <span class="fk">{{ c.g }}g · {{ Math.round((c.food.kcal * c.g) / 100) }} 千卡</span>
            <button class="mini-btn" title="移除" @click="remove(i)"><Trash2 :size="14" /></button>
          </div>
        </div>
        <div v-if="cart.length" class="total mt-2">
          <div class="t-big">{{ totals.kcal }} 千卡</div>
          <div class="bar"><div class="fill" :style="{ width: kcalPct + '%' }"></div></div>
          <p class="hint">约占成人每日参考摄入（2000 千卡）的 {{ kcalPct }}%</p>
          <p class="hint mono">蛋白质 {{ totals.p }}g · 脂肪 {{ totals.f }}g · 碳水 {{ totals.cb }}g</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gap { gap: 10px; align-items: center; }
.grow { flex: 1; }
.slim { width: 84px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.h4 { margin-bottom: 8px; font-size: 14px; }
.list { border: 1px solid var(--border); border-radius: 10px; max-height: 340px; overflow: auto; }
.food-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
.food-row:last-child { border-bottom: none; }
.fn { flex: 1; }
.fk { color: var(--muted); font-size: 12px; }
.mini-btn { border: 1px solid var(--border); background: none; color: var(--text-2); border-radius: 7px; width: 26px; height: 26px; display: grid; place-items: center; cursor: pointer; }
.mini-btn:hover { border-color: var(--accent); }
.total { padding: 12px 14px; border: 1px solid var(--accent); border-radius: 10px; }
.t-big { font-size: 26px; font-weight: 800; color: var(--accent-text); }
.bar { height: 6px; border-radius: 3px; background: var(--surface-2, rgba(127,127,127,.15)); margin: 8px 0; }
.fill { height: 100%; border-radius: 3px; background: var(--accent); }
.hint { font-size: 12px; color: var(--muted); }
@media (max-width: 720px) { .two { grid-template-columns: 1fr; } }
</style>
