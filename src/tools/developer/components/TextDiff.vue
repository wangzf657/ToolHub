<script setup lang="ts">
import { ref } from 'vue'
import { GitCompare } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const left = ref('第一行：欢迎\n第二行：这里有一段旧文案\n第三行：保持不变\n第四行：待删除')
const right = ref('第一行：欢迎\n第二行：这里有一段新文案\n第三行：保持不变\n新增的第五行')
const ignoreWs = ref(false)
const busy = ref(false)

interface DiffRow {
  type: 'same' | 'add' | 'del'
  text: string
}

const rows = ref<DiffRow[]>([])
const stats = ref({ add: 0, del: 0, same: 0 })

const run = async () => {
  if (!left.value && !right.value) return toast.warn('请输入要对比的文本')
  busy.value = true
  try {
    const { diffLines } = await import('diff')
    const parts = diffLines(left.value, right.value, ignoreWs.value ? { ignoreWhitespace: true } : undefined)
    const out: DiffRow[] = []
    let add = 0
    let del = 0
    let same = 0
    for (const part of parts) {
      const kind: DiffRow['type'] = part.added ? 'add' : part.removed ? 'del' : 'same'
      const lines = (part.value ?? '').replace(/\n$/, '').split('\n')
      for (const line of lines) {
        if (kind === 'add') add++
        else if (kind === 'del') del++
        else same++
        out.push({ type: kind, text: line })
      }
    }
    rows.value = out
    stats.value = { add, del, same }
    toast.ok(`对比完成：新增 ${add} 行，删除 ${del} 行`)
  } catch (e) {
    toast.err(`对比失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="text-diff">
    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">原始文本（A）</span>
        <textarea v-model="left" class="textarea mono" style="min-height: 170px"></textarea>
      </div>
      <div>
        <span class="field-label">修改后文本（B）</span>
        <textarea v-model="right" class="textarea mono" style="min-height: 170px"></textarea>
      </div>
    </div>

    <div class="row row-wrap mt-2" style="gap: 12px; align-items: center">
      <label class="check"><input v-model="ignoreWs" type="checkbox" /> 忽略行内空白差异</label>
      <span class="grow"></span>
      <button class="btn btn-primary" :disabled="busy" @click="run"><GitCompare :size="16" /> 开始对比</button>
    </div>

    <div v-if="rows.length" class="mt-3">
      <div class="row row-wrap small" style="gap: 14px; margin-bottom: 8px">
        <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399">新增 {{ stats.add }} 行</span>
        <span class="badge" style="background: rgba(248, 113, 113, 0.15); color: #f87171">删除 {{ stats.del }} 行</span>
        <span class="badge badge-plain">相同 {{ stats.same }} 行</span>
      </div>
      <div class="diff-view mono">
        <div v-for="(r, i) in rows" :key="i" class="diff-row" :class="r.type">
          <span class="mark-col">{{ r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' ' }}</span>
          <span class="line-text">{{ r.text || ' ' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diff-view {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  font-size: 13px;
  max-height: 420px;
  overflow-y: auto;
}
.diff-row {
  display: flex;
  line-height: 1.65;
}
.mark-col {
  flex: none;
  width: 30px;
  text-align: center;
  user-select: none;
  font-weight: 700;
}
.line-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  flex: 1;
  padding-right: 10px;
}
.diff-row.add {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}
.diff-row.del {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
}
.diff-row.same {
  background: transparent;
  color: var(--text-3);
}
</style>
