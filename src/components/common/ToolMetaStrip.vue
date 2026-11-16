<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    steps?: string[]
  }>(),
  {
    steps: () => [],
  },
)
</script>

<template>
  <!-- 工具面板正下方的紧凑信息横条：信任要点 + 快速指南，一行排布，窄屏自动换行 -->
  <aside class="meta-strip">
    <div class="meta-group">
      <span class="meta-title"><ShieldCheck :size="15" />本地信任盾</span>
      <span class="meta-item"><em class="dot"></em>处理位置 · 本地沙箱浏览器</span>
      <span class="meta-item"><em class="dot"></em>数据传输 · 0 KB 上传</span>
      <span class="meta-item"><em class="dot"></em>离线操作 · 100% 离线可用</span>
    </div>
    <div v-if="steps.length" class="meta-group">
      <span class="meta-title">快速指南</span>
      <span v-for="(s, i) in steps" :key="i" class="meta-item">
        <i class="step-num">{{ i + 1 }}</i>{{ s }}
      </span>
    </div>
  </aside>
</template>

<style scoped>
.meta-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 28px;
  margin-top: 12px;
  padding: 10px 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 12.5px;
  color: var(--text-2);
}
.meta-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  min-width: 0;
}
.meta-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}
.meta-title :deep(svg) {
  color: var(--accent-text);
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  display: inline-block;
  background: var(--ok);
  box-shadow: 0 0 8px var(--ok);
}
.step-num {
  flex: none;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
  font-style: normal;
}
/* 移动端竖排(R5-c):信任要点/快速指南各占一行,避免窄屏无折行规则挤压 */
@media (max-width: 860px) {
  .meta-strip {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
