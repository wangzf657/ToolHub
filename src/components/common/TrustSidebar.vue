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
  <aside class="tool-side">
    <div class="side-card trust-card">
      <div class="trust-head">
        <ShieldCheck :size="20" class="trust-icon" />
        <strong>本地信任盾</strong>
      </div>
      <p class="trust-desc">这个工具完全在你的浏览器标签页内运行，文件不会经过任何远程服务器。</p>
      <ul class="trust-list">
        <li><em class="dot ok"></em><span>处理位置</span><strong>本地沙箱浏览器</strong></li>
        <li><em class="dot ok"></em><span>数据传输</span><strong>0 KB 上传（已阻断）</strong></li>
        <li><em class="dot ok"></em><span>离线操作</span><strong>100% 离线可用</strong></li>
      </ul>
    </div>

    <div v-if="steps.length" class="side-card">
      <h3 class="side-title">快速指南</h3>
      <ol class="guide-list">
        <li v-for="(s, i) in steps" :key="i">
          <span class="step-num">{{ i + 1 }}</span>
          <span>{{ s }}</span>
        </li>
      </ol>
    </div>

    <slot />
  </aside>
</template>

<style scoped>
.tool-side {
  display: grid;
  gap: 16px;
  align-content: start;
}
.side-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px;
}
.trust-card {
  border-top: 2px solid var(--accent);
}
.trust-head {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
}
.trust-icon {
  color: var(--accent-text);
}
.trust-desc {
  margin: 10px 0 12px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}
.trust-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.trust-list li {
  display: grid;
  grid-template-columns: 14px 76px 1fr;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.trust-list span {
  color: var(--text-3);
}
.trust-list strong {
  font-size: 12.5px;
  color: var(--text-2);
  font-weight: 600;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  display: inline-block;
}
.dot.ok {
  background: var(--ok);
  box-shadow: 0 0 8px var(--ok);
}
.side-title {
  font-size: 15px;
  margin-bottom: 12px;
}
.guide-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 11px;
}
.guide-list li {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;
}
.step-num {
  flex: none;
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11.5px;
  font-weight: 700;
}
</style>
