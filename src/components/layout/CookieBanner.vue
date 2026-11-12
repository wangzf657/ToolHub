<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck, X } from 'lucide-vue-next'

const visible = ref(!localStorage.getItem('wt-cookie'))
const close = (v: string) => {
  localStorage.setItem('wt-cookie', v)
  visible.value = false
}
</script>

<template>
  <!-- UX1-001：不用 <transition> 包裹——离场动画的完成依赖 rAF，无渲染帧环境（后台标签页/
       被遮挡的 webview）下 transition 永不结束，横幅会滞留到刷新。改为纯 CSS 入场动画 +
       v-if 即时移除，点击后立即消失。 -->
  <div v-if="visible" class="cookie-banner">
    <div class="cookie-inner">
      <div class="cookie-icon"><ShieldCheck :size="20" /></div>
      <div class="cookie-text">
        <strong>我们重视你的隐私</strong>
        <p>
          你的文件永远留在你的设备上。本站不在本地存储任何文件内容，仅使用浏览器缓存保存可选设置。
        </p>
      </div>
      <div class="cookie-actions">
        <button class="btn btn-ghost btn-sm" @click="close('rejected')">仅必要</button>
        <button class="btn btn-primary btn-sm" @click="close('accepted')">接受</button>
        <button class="icon-close" aria-label="关闭提示" @click="close('dismissed')"><X :size="15" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cookie-banner {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 16px;
  z-index: 90;
  width: min(920px, calc(100% - 28px));
  border-radius: 16px;
  border: 1px solid var(--border-strong);
  background: var(--panel-solid);
  box-shadow: var(--shadow);
  animation: slide-up-in 0.25s ease;
}
.cookie-inner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
}
.cookie-icon {
  color: var(--accent-text);
  margin-top: 2px;
}
.cookie-text {
  flex: 1;
}
.cookie-text strong {
  font-size: 14.5px;
}
.cookie-text p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;
}
.cookie-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-close {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 4px;
}
@keyframes slide-up-in {
  from {
    opacity: 0;
    transform: translate(-50%, 16px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%);
  }
}
</style>
