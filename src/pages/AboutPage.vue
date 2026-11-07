<script setup lang="ts">
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
</script>

<template>
  <div class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '关于' }]" />
    <h1>关于百宝工具箱</h1>
    <div class="prose" style="max-width: 760px">
      <p>
        <strong>百宝工具箱（ToolHub）</strong>是一个纯浏览器端的工具聚合平台：图片处理、PDF、视频、音频、数据分析、开发工具与端侧 AI，370+ 个工具全部运行在你自己的设备上。
      </p>
      <h2>为什么一切都在本地运行</h2>
      <p>
        大多数「免费在线工具」的实际流程是：把你的文件上传到别人的服务器，处理完再传回来。合同、身份证照片、财务报表因此流经你无法审计的基础设施。
      </p>
      <p>
        我们换了一种做法：现代浏览器已经足够强大——Canvas、WebAssembly、Web Crypto、Web Audio 让压缩、转换、加密与推理都可以在本地完成。文件从未离开你的设备，速度反而更快，还顺带获得了离线能力。
      </p>
      <h2>它如何保持免费</h2>
      <p>
        没有账号体系、没有按次计费、没有水印。静态站点本身几乎没有服务器成本，这也是「本地优先」架构的另一个好处。
      </p>
      <h2>技术栈</h2>
      <p>
        Vue 3 + TypeScript + Vite 构建；PDF 处理基于 pdf-lib 与 pdf.js；音视频编解码使用 Web Audio 与 ffmpeg.wasm（按需加载）；表格处理基于 SheetJS 与 papaparse；端侧 AI 采用规则引擎 + 可选的浏览器推理模型。
      </p>
      <h2>反馈</h2>
      <p>
        发现问题或想要新工具？欢迎通过<a href="/contact">联系页面</a>告诉我们。
      </p>
    </div>
  </div>
</template>
