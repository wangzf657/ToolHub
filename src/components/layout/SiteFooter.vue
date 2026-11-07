<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Zap } from 'lucide-vue-next'
import { categories } from '@/data/categories'
import { site } from '@/data/site'
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <div class="brand-row">
          <span class="brand-icon"><Zap :size="16" /></span>
          <strong>{{ site.name }}</strong>
        </div>
        <p class="muted small">
          免费、纯本地的浏览器工具集——图片、PDF、视频、音频与数据，全程在你的设备上处理，文件从不上传。
        </p>
      </div>

      <div class="footer-col">
        <h4>工具目录</h4>
        <RouterLink to="/tools">全部工具</RouterLink>
        <RouterLink to="/image-tools">图片工具</RouterLink>
        <RouterLink to="/pdf-tools">PDF 工具</RouterLink>
        <RouterLink to="/video-tools">视频工具</RouterLink>
        <RouterLink to="/audio-tools">音频工具</RouterLink>
        <RouterLink to="/data-tools">数据工具</RouterLink>
        <RouterLink to="/ai-tools">AI 工具</RouterLink>
      </div>

      <div class="footer-col">
        <h4>分类</h4>
        <RouterLink v-for="c in categories.slice(5, 11)" :key="c.id" :to="c.path">{{ c.name }}</RouterLink>
      </div>

      <div class="footer-col">
        <h4>资源</h4>
        <RouterLink to="/guides">使用指南</RouterLink>
        <RouterLink to="/studio/pdf">PDF 工作台</RouterLink>
        <RouterLink to="/studio/video">视频工作台</RouterLink>
        <RouterLink to="/studio/photo">照片工作台</RouterLink>
        <RouterLink to="/studio/data">数据工作台</RouterLink>
        <RouterLink to="/about">关于我们</RouterLink>
        <RouterLink to="/contact">联系我们</RouterLink>
      </div>

      <div class="footer-col">
        <h4>法律与信任</h4>
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <RouterLink to="/terms">使用条款</RouterLink>
      </div>
    </div>

    <div class="container footer-bottom">
      <p class="muted small">© 2026 {{ site.name }} · 每个工具都完全运行在你的浏览器中，文件永远不会被上传。</p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--border);
  margin-top: 60px;
  padding: 44px 0 28px;
  background: color-mix(in srgb, var(--bg-soft) 60%, transparent);
}
.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  gap: 28px;
}
@media (max-width: 900px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 520px) {
  .footer-grid {
    grid-template-columns: 1fr;
  }
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}
.brand-icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), #8b5cf6);
  color: #fff;
}
.footer-col {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.footer-col h4 {
  font-size: 12.5px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-3);
  margin-bottom: 4px;
}
.footer-col a {
  font-size: 13.5px;
  color: var(--text-2);
  text-decoration: none !important;
}
.footer-col a:hover {
  color: var(--accent-text);
}
.footer-bottom {
  margin-top: 30px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}
</style>
