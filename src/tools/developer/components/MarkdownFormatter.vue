<script setup lang="ts">
/** Markdown 格式化：Prettier standalone（markdown 解析插件）——表格对齐、列表符号统一、换行策略 */
import { ref } from 'vue'
import { Wand2, Loader2 } from 'lucide-vue-next'
import ResultBox from '@/components/common/ResultBox.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const input = ref('# 标题\n\n|名称|数量|\n|---|---|\n|苹果|3|\n*项目一*\n+  混乱的列表\n\n很长的   段落   里有   多余空格。')
const output = ref('')
const busy = ref(false)
const proseWrap = ref('preserve')
const bullet = ref('-')
const useTabs = ref(false)

const run = async () => {
  if (!input.value.trim()) return toast.warn('请输入 Markdown 内容')
  busy.value = true
  try {
    const prettier = await import('prettier/standalone')
    const markdown = await import('prettier/plugins/markdown')
    output.value = await prettier.format(input.value, {
      parser: 'markdown',
      plugins: [markdown],
      proseWrap: proseWrap.value as 'preserve' | 'always' | 'never',
      useTabs: useTabs.value,
    } as never)
    // 列表符号统一由 prettier bullet 选项不完全覆盖，这里做轻量规范化
    if (bullet.value !== '*') {
      output.value = output.value.replace(/^(\s*)\*\s/gm, `$1${bullet.value} `)
    }
    toast.ok('格式化完成')
  } catch (e) {
    toast.err(`格式化失败：${(e as Error).message.slice(0, 120)}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 14px; align-items: flex-end">
      <label class="opt">
        <span class="field-label">自动换行</span>
        <select v-model="proseWrap" class="select" style="width: 170px">
          <option value="preserve">保持原样</option>
          <option value="always">按列宽换行</option>
          <option value="never">尽量不换行</option>
        </select>
      </label>
      <label class="opt">
        <span class="field-label">列表符号</span>
        <select v-model="bullet" class="select" style="width: 110px">
          <option value="-">-（短横）</option>
          <option value="*">*（星号）</option>
        </select>
      </label>
      <label class="opt check"><input v-model="useTabs" type="checkbox" /><span>用 Tab 缩进</span></label>
      <button class="btn btn-primary" :disabled="busy" @click="run">
        <Loader2 v-if="busy" :size="16" class="spin" />
        <Wand2 v-else :size="16" /> 格式化
      </button>
    </div>

    <div class="grid-2" style="gap: 12px">
      <div>
        <span class="field-label">输入</span>
        <textarea v-model="input" class="textarea mono" style="min-height: 300px" spellcheck="false"></textarea>
      </div>
      <ResultBox v-model="output" title="规范输出" download="md" min-height="300px" />
    </div>

    <p class="notice notice-info mt-2 small">使用 Prettier 浏览器版（markdown 解析插件，首次加载解析器）；表格列自动对齐、标题前后空行规范化——入库前跑一遍，仓库 diff 更干净。</p>
  </div>
</template>

<style scoped>
.opt {
  display: grid;
  gap: 4px;
}
.opt.check {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
