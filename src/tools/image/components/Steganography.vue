<script setup lang="ts">
/** 图片隐写术：把消息写进 PNG 像素最低有效位（LSB），或从图中提取 */
import { ref, shallowRef, computed } from 'vue'
import { Loader2, Download, Eye } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'

const MAGIC = [0x53, 0x54, 0x47, 0x31] // "STG1"

const toast = useToast()
const tab = ref<'hide' | 'extract'>('hide')

/* ---------- 隐藏 ---------- */
const cover = shallowRef<HTMLCanvasElement | null>(null)
const coverName = ref('')
const message = ref('')
const running = ref(false)

const capacity = computed(() => (cover.value ? Math.floor((cover.value.width * cover.value.height * 3) / 8) - 8 : 0))
const msgBytes = computed(() => new TextEncoder().encode(message.value).length)

async function loadCover(files: File[]) {
  if (!files.length) {
    cover.value = null
    coverName.value = ''
    return
  }
  try {
    cover.value = await decodeToCanvas(files[0])
    coverName.value = files[0].name
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

/** 逐位写入 R/G/B 通道的最低位 */
function embedBytes(d: Uint8ClampedArray, bytes: Uint8Array) {
  let bit = 0
  for (let k = 0; k < bytes.length; k++) {
    for (let b = 7; b >= 0; b--) {
      const i = ((bit / 3) | 0) * 4 + (bit % 3)
      d[i] = (d[i] & 0xfe) | ((bytes[k] >> b) & 1)
      bit++
    }
  }
}

async function hide() {
  const c = cover.value
  if (!c) {
    toast.warn('请先选择一张载体图片')
    return
  }
  if (!message.value) {
    toast.warn('请输入要隐藏的消息')
    return
  }
  if (msgBytes.value > capacity.value) {
    toast.err(`消息太长：需要 ${msgBytes.value} 字节，容量只剩 ${capacity.value} 字节`)
    return
  }
  running.value = true
  try {
    const out = document.createElement('canvas')
    out.width = c.width
    out.height = c.height
    const ctx = out.getContext('2d')!
    ctx.drawImage(c, 0, 0)
    const id = ctx.getImageData(0, 0, out.width, out.height)
    const len = msgBytes.value
    const header = new Uint8Array(8)
    header.set(MAGIC, 0)
    header[4] = len & 0xff
    header[5] = (len >> 8) & 0xff
    header[6] = (len >> 16) & 0xff
    header[7] = (len >> 24) & 0xff
    const body = new TextEncoder().encode(message.value)
    embedBytes(id.data, header)
    // 从第 64 位（header 之后）继续写正文
    const d = id.data
    let bit = 64
    for (let k = 0; k < body.length; k++) {
      for (let b = 7; b >= 0; b--) {
        const i = ((bit / 3) | 0) * 4 + (bit % 3)
        d[i] = (d[i] & 0xfe) | ((body[k] >> b) & 1)
        bit++
      }
    }
    ctx.putImageData(id, 0, 0)
    const blob = await canvasToBlob(out, 'image/png')
    saveBlob(blob, `${coverName.value.replace(/\.[^.]+$/, '') || 'stego'}-hidden.png`)
    toast.ok('已生成隐藏消息的 PNG（务必保存为 PNG，JPG 会破坏数据）')
  } catch (e) {
    toast.err((e as Error).message || '隐藏失败')
  } finally {
    running.value = false
  }
}

/* ---------- 提取 ---------- */
const stego = shallowRef<HTMLCanvasElement | null>(null)
const extracted = ref('')

function extractBytes(d: Uint8ClampedArray, startBit: number, count: number): Uint8Array {
  const out = new Uint8Array(count)
  let bit = startBit
  for (let k = 0; k < count; k++) {
    let byte = 0
    for (let b = 0; b < 8; b++) {
      const i = ((bit / 3) | 0) * 4 + (bit % 3)
      byte = (byte << 1) | (d[i] & 1)
      bit++
    }
    out[k] = byte
  }
  return out
}

async function loadStego(files: File[]) {
  if (!files.length) {
    stego.value = null
    extracted.value = ''
    return
  }
  try {
    const c = await decodeToCanvas(files[0])
    stego.value = c
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    const head = extractBytes(d, 0, 8)
    const magicOk = MAGIC.every((v, i) => head[i] === v)
    if (!magicOk) {
      extracted.value = ''
      toast.warn('未检测到隐藏信息（可能不是本工具生成，或已被压缩 / 截图破坏）')
      return
    }
    const len = head[4] | (head[5] << 8) | (head[6] << 16) | (head[7] << 24)
    if (len <= 0 || len > Math.floor((c.width * c.height * 3) / 8)) {
      toast.warn('消息长度异常，数据可能已损坏')
      return
    }
    extracted.value = new TextDecoder().decode(extractBytes(d, 64, len))
    toast.ok('成功提取隐藏消息')
  } catch (e) {
    toast.err((e as Error).message || '提取失败')
  }
}
</script>

<template>
  <div>
    <div class="chips mt-1">
      <button class="chip" :class="{ active: tab === 'hide' }" @click="tab = 'hide'">隐藏消息</button>
      <button class="chip" :class="{ active: tab === 'extract' }" @click="tab = 'extract'">提取消息</button>
    </div>

    <div v-if="tab === 'hide'" class="mt-2">
      <FileDrop
        v-if="!cover"
        accept="image/png,image/*"
        :multiple="false"
        label="拖放一张载体图片（PNG 最佳）"
        hint="消息藏在像素最低位，肉眼完全看不出差别"
        @files="loadCover"
      />
      <div v-else class="row row-wrap mt-1" style="gap: 12px">
        <span class="badge badge-plain">载体：{{ coverName }}（{{ cover.width }} × {{ cover.height }}）</span>
        <span class="badge">可藏 {{ capacity }} 字节</span>
        <button class="btn btn-ghost btn-sm" @click="((cover = null), (coverName = ''))">换一张</button>
      </div>

      <div class="mt-2" style="max-width: 640px">
        <span class="field-label">要隐藏的消息</span>
        <textarea v-model="message" class="textarea" style="min-height: 100px" placeholder="输入秘密消息…（按 UTF-8 字节计算）"></textarea>
        <div v-if="cover" class="row mt-1" style="gap: 10px">
          <span class="muted small">消息 {{ msgBytes }} / {{ capacity }} 字节</span>
          <button class="btn btn-primary btn-sm" :disabled="running" @click="hide">
            <Loader2 v-if="running" :size="14" class="spin" /><Download v-else :size="14" /> 写入并下载 PNG
          </button>
        </div>
      </div>
      <p class="muted small mt-2">
        原理：图片每个像素的 R/G/B 最低位各藏 1 位（magic 头 STG1 + 长度 + UTF-8 正文），约每 8 个像素藏 3 字节。
        载体必须以 PNG 无损保存传播。
      </p>
    </div>

    <div v-else class="mt-2">
      <FileDrop
        v-if="!stego"
        accept="image/png,image/*"
        :multiple="false"
        label="拖放隐藏过消息的图片"
        hint="会自动校验 STG1 魔数头"
        @files="loadStego"
      />
      <div v-else>
        <div class="row mt-1" style="gap: 12px">
          <span class="badge"><Eye :size="13" /> 已完成解析</span>
          <button class="btn btn-ghost btn-sm" @click="((stego = null), (extracted = ''))">换一张</button>
        </div>
        <div v-if="extracted" class="notice notice-ok mt-2" style="white-space: pre-wrap; display: block">{{ extracted }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
