<script setup lang="ts">
/** 视频消音：删除音轨，视频流复制，秒级完成 */
import { ref } from 'vue'
import FfBase from './FfBase.vue'

const base = ref<InstanceType<typeof FfBase> | null>(null)

const run = async () => {
  const b = base.value
  if (!b) return
  await b.runWithFf(['-y', '-i', 'input', '-an', '-c:v', 'copy', b.outputName], {
    status: '正在移除音轨…',
  })
}
</script>

<template>
  <FfBase ref="base" button-text="开始消音" @run="run">
    <div class="notice notice-info mt-2">
      只删除音轨、画面原样复制，不重编码 —— 通常几秒即可完成。输出容器跟随源文件。
    </div>
  </FfBase>
</template>
