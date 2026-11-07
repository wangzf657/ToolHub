<script setup lang="ts">
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import { site } from '@/data/site'
</script>

<template>
  <div class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '隐私政策' }]" />
    <h1>隐私政策</h1>
    <div class="prose" style="max-width: 760px">
      <p class="muted">最后更新：2026 年 11 月</p>
      <h2>一句话版本</h2>
      <p>
        你的文件与文本永远留在你的设备上。{{ site.name }} 的工具在你的浏览器中处理数据，不会上传到我们的服务器——因为我们根本没有处理服务器。
      </p>
      <h2>我们收集什么</h2>
      <ul>
        <li><strong>不收集</strong>：文件内容、文本输入、处理结果。这些数据只存在于你的浏览器标签页内存中，关闭页面即消失。</li>
        <li><strong>浏览器本地存储</strong>：你的收藏列表、主题偏好与 Cookie 选择保存在 localStorage 中，仅用于恢复界面设置，不会发送到任何地方。</li>
        <li><strong>可选模型下载</strong>：OCR、抠图、语音转写等工具首次使用时会从公共 CDN 下载模型/编解码器并缓存。模型下载不含你的任何数据；推理全程本地完成。</li>
      </ul>
      <h2>我们不看什么</h2>
      <p>
        我们无法查看你的文件，也无法知道你用某个工具处理了什么。这不是承诺，而是架构——数据从未到达我们这里。
      </p>
      <h2>第三方服务</h2>
      <p>
        站点本身为纯静态资源。若你部署时接入统计分析或广告服务，请在此处列明并遵守当地法规；默认构建不包含任何第三方追踪脚本。
      </p>
      <h2>数据删除</h2>
      <p>
        清除浏览器站点数据即可删除全部本地偏好（收藏、主题、缓存模型）。
      </p>
      <h2>联系</h2>
      <p>对隐私政策有疑问？请通过<a href="/contact">联系页面</a>告知。</p>
    </div>
  </div>
</template>
