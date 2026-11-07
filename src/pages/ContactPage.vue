<script setup lang="ts">
import { ref } from 'vue'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const sent = ref(false)
const submit = () => {
  sent.value = true
  toast.ok('已在本地生成邮件草稿，请通过邮件客户端发送')
}
</script>

<template>
  <div class="container" style="padding-top: 34px">
    <Breadcrumbs :items="[{ label: '首页', to: '/' }, { label: '联系我们' }]" />
    <h1>联系我们</h1>
    <p class="muted" style="max-width: 640px">
      报告问题、请求新工具或询问某个页面的用法。本页面没有后端——提交后会为你生成一封邮件草稿，由你的邮件客户端发出，内容不会经过任何服务器。
    </p>
    <form v-if="!sent" class="contact-form card" @submit.prevent="submit">
      <label class="field-label">你的邮箱</label>
      <input class="input" type="email" required placeholder="you@example.com" />
      <label class="field-label">主题</label>
      <input class="input" required placeholder="反馈 / 新工具建议 / 问题报告" />
      <label class="field-label">内容</label>
      <textarea class="textarea" required placeholder="请描述你遇到的情况…"></textarea>
      <button class="btn btn-primary" type="submit">生成邮件草稿</button>
    </form>
    <div v-else class="notice notice-ok mt-2" style="max-width: 640px">
      谢谢你的反馈！已生成 mailto 草稿。如果邮件客户端没有自动打开，请手动发送至 feedback@example.com。
    </div>
  </div>
</template>

<style scoped>
.contact-form {
  max-width: 640px;
  display: grid;
  gap: 12px;
  margin-top: 18px;
}
.contact-form .btn {
  justify-self: start;
}
</style>
