<script setup lang="ts">
import { ref } from 'vue'
import { Database, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const sql = ref('select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.created_at >= \'2024-01-01\' and u.status = \'active\' group by u.id, u.name having count(o.id) > 5 order by orders desc limit 20;')
const dialect = ref<'postgresql' | 'mysql' | 'sqlite'>('postgresql')
const keywordCase = ref<'upper' | 'lower' | 'preserve'>('upper')
const output = ref('')
const busy = ref(false)

/** 内置轻量格式化（sql-formatter 加载失败时的兜底）：关键字大写 + 主子句换行缩进 */
function lightFormat(src: string): string {
  const keywords = /^(select|from|where|group by|order by|having|limit|offset|insert into|values|update|set|delete from|on|and|or|union|as|case|when|then|else|end|with|distinct)$/i
  const newlines = new Set(['from', 'where', 'group by', 'order by', 'having', 'limit', 'offset', 'values', 'set', 'union', 'union all', 'left join', 'right join', 'inner join', 'outer join', 'join', 'with'])
  const tokens = src.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').split(' ')
  const lines: string[] = []
  let cur = ''
  let depth = 0
  const push = () => {
    if (cur) lines.push('  '.repeat(depth) + cur)
    cur = ''
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const two = `${t} ${tokens[i + 1] ?? ''}`.toLowerCase()
    if (newlines.has(two)) {
      push()
      lines.push('  '.repeat(depth) + t.toUpperCase() + ' ' + (tokens[++i] ?? '').toUpperCase())
      continue
    }
    if (newlines.has(t.toLowerCase())) {
      push()
      lines.push('  '.repeat(depth) + t.toUpperCase())
      continue
    }
    if (keywords.test(t)) {
      cur += (cur ? ' ' : '') + t.toUpperCase()
      continue
    }
    cur += (cur ? ' ' : '') + t
  }
  push()
  return lines.join('\n')
}

const run = async () => {
  if (!sql.value.trim()) return toast.warn('请先粘贴 SQL')
  busy.value = true
  try {
    const { format } = await import('sql-formatter')
    output.value = format(sql.value, { language: dialect.value, keywordCase: keywordCase.value, tabWidth: 2 })
    toast.ok('SQL 已格式化')
  } catch {
    try {
      output.value = lightFormat(sql.value)
      toast.ok('使用内置轻量格式化完成（未联网加载库）')
    } catch (e) {
      toast.err(`格式化失败：${(e as Error).message}`)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="sql-fmt">
    <div class="row row-wrap mb-2" style="gap: 12px; align-items: center">
      <span class="field-label" style="margin: 0">方言</span>
      <select v-model="dialect" class="select" style="width: 130px">
        <option value="postgresql">PostgreSQL</option>
        <option value="mysql">MySQL</option>
        <option value="sqlite">SQLite</option>
      </select>
      <span class="field-label" style="margin: 0">关键字</span>
      <select v-model="keywordCase" class="select" style="width: 110px">
        <option value="upper">大写</option>
        <option value="lower">小写</option>
        <option value="preserve">保持原样</option>
      </select>
      <span class="grow"></span>
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="15" class="spin" />
        <Database v-else :size="15" /> 格式化 SQL
      </button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">SQL 输入</span>
        <textarea v-model="sql" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="格式化结果" download="sql" min-height="300px" />
    </div>
  </div>
</template>

<style scoped>
.spin {
  animation: sql-spin 0.8s linear infinite;
}
@keyframes sql-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
