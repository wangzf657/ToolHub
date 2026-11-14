<script setup lang="ts">
/**
 * FfBase 家族进度反馈子组件（三态互斥展示）：
 * ① 核心下载进度条（首用约 30MB，父组件下载期间传 dl，完成置 null 自动隐藏）；
 * ② 首用加载提示（父组件延迟 200ms 置 loading，避免秒加载闪烁）；
 * ③ 处理中状态文案 + 百分比进度条。
 */
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  /** 核心下载进度（字节，total=0 表示总大小未知）；null = 不在下载 */
  dl?: { loaded: number; total: number } | null
  /** 核心加载中（首用提示态） */
  loading?: boolean
  /** 处理中状态与进度（0~1） */
  busy?: boolean
  status?: string
  progress?: number
}>()

const pct = computed(() =>
  props.dl && props.dl.total > 0 ? Math.min(100, Math.round((props.dl.loaded / props.dl.total) * 100)) : 0,
)
const fmtMb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
</script>

<template>
  <div class="ff-prog">
    <div v-if="dl" class="prog-wrap">
      <div class="prog-head">
        <span>正在加载处理引擎（约 30MB）：{{ dl.total > 0 ? `${pct}%` : `已下载 ${fmtMb(dl.loaded)}` }}</span>
        <span v-if="dl.total > 0">{{ fmtMb(dl.loaded) }} / {{ fmtMb(dl.total) }}</span>
      </div>
      <div class="prog-track">
        <div class="prog-fill" :class="{ indet: dl.total === 0 }" :style="{ width: dl.total > 0 ? `${Math.max(2, pct)}%` : '100%' }"></div>
      </div>
    </div>
    <div v-else-if="loading" class="notice notice-info">
      <Loader2 :size="16" class="spin" />
      首次使用需加载编解码核心（约 30MB），完成后可离线使用…
    </div>
    <div v-else-if="busy" class="prog-wrap">
      <div class="prog-head">
        <span>{{ status }}</span>
        <span>{{ Math.round((progress ?? 0) * 100) }}%</span>
      </div>
      <div class="prog-track">
        <div class="prog-fill" :style="{ width: `${Math.max(2, Math.round((progress ?? 0) * 100))}%` }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ff-prog {
  max-width: 560px;
}
.prog-wrap {
  display: grid;
  gap: 6px;
}
.prog-head {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--text-2);
}
.prog-track {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  overflow: hidden;
  border: 1px solid var(--border);
}
.prog-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #7c74f2);
  border-radius: 999px;
  transition: width 0.2s ease;
}
/* 总大小未知时的呼吸态（有进展但算不出百分比） */
.prog-fill.indet {
  animation: indet 1.2s ease-in-out infinite;
}
@keyframes indet {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.9;
  }
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
