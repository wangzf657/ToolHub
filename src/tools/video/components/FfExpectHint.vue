<script setup lang="ts">
/**
 * ffmpeg 视频家族耗时预期提示（compress-video.md 家族处方 1-2 变体）：
 * 各工具以一行文案统一交代「本地处理速度预期 + 30MB 首用核心 + 勿刷新」，
 * 处理期间用户对等待有预期，避免「卡死感」误判。
 */
withDefaults(defineProps<{ text?: string; warn?: boolean }>(), {
  text: '浏览器本地处理速度约为视频时长的 1/2~1/5（重编码类；流复制类通常秒级完成），首次使用需加载约 30MB 编解码核心。处理期间请保持页面打开，勿刷新或关闭标签页。',
  warn: false,
})
</script>

<template>
  <p class="ff-expect" :class="{ warn }">{{ text }}</p>
</template>

<style scoped>
.ff-expect {
  margin: 10px 2px 0;
  font-size: 12.5px;
  color: var(--text-3);
}
.ff-expect.warn {
  color: #d97706;
  font-weight: 600;
}
</style>
