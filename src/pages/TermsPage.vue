<script setup lang="ts">
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
</script>

<template>
  <div class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '使用条款' }]" />
    <h1>使用条款</h1>
    <div class="prose" style="max-width: 760px">
      <p class="muted">最后更新：2026 年 11 月</p>
      <h2>1. 服务性质</h2>
      <p>
        百宝工具箱提供在浏览器本地运行的工具集合。使用本站即表示你同意本条款。
      </p>
      <h2>2. 恰当使用</h2>
      <ul>
        <li>请勿利用本站工具处理违反你所在地法律的内容；</li>
        <li>你须对所处理内容拥有合法权利；</li>
        <li>请勿尝试以自动化方式滥用站点资源。</li>
      </ul>
      <h2>3. 免责声明</h2>
      <p>
        工具按「现状」提供。虽然我们尽力保证转换与计算的正确性，但对于重要文件（法律文件、财务数据、证件照等），请务必在下载后自行核对结果。计算器类工具仅作估算参考，不构成专业建议。
      </p>
      <h2>4. 知识产权</h2>
      <p>
        本站的代码与界面为独立开发。你保留自己上传与生成内容的全部权利，本站不会接触这些内容。
      </p>
      <h2>5. 条款变更</h2>
      <p>条款如有重大变更，将在本页面更新日期并公告。</p>
    </div>
  </div>
</template>
