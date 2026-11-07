<script setup lang="ts">
/** 合并视频：concat demuxer 流复制拼接，支持拖拽排序 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)

const run = async () => {
  const b = base.value
  if (!b) return
  const list = b.files
  if (list.length < 2) return
  // 写入 concat 清单，文件按原名写入虚拟 FS
  const txt = list.map((f) => `file '${f.name.replace(/'/g, "\\'")}'`).join('\n')
  await b.runWithFf(['-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', b.outputName], {
    files: list.map((f) => ({ name: f.name, data: f })),
    extraFiles: [{ name: 'list.txt', data: txt }],
    status: '正在合并视频…',
  })
}
</script>

<template>
  <FfBase ref="base" multiple :max-files="30" button-text="开始合并" @run="run">
    <div class="merge-tips">
      <div class="notice notice-info">
        按列表顺序首尾拼接。文件较多时可用每行右侧的 ↑↓ 按钮调整顺序。
      </div>
      <div class="notice notice-warn">
        各段视频的编码参数（分辨率/帧率/编码器）需要一致才能流复制合并；若失败或花屏，
        请先用「视频格式转换」把各段统一成相同参数（如 720p MP4）后再合并。
      </div>
    </div>
  </FfBase>
</template>

<style scoped>
.merge-tips {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
</style>
