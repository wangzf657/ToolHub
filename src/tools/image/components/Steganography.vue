<script setup lang="ts">
/**
 * 图片隐写术（UX1.0 五处方）：
 * - 提取复制按钮（rx1）：完整消息（含换行）一键复制。
 * - 成品预览（rx2）：写入后页内展示成品图 + 「差异 ×8」切换（|out−src|×8 灰度）。
 * - 文件载荷（rx3）：支持拖入第二张图片作为载荷，可无损还原。
 * - 口令混淆（rx4）：可选口令参与正文异或，错误口令解出乱码不抛异常。
 * - 容量对称（rx5）：提取 Tab 显示图片尺寸与理论容量（与隐藏 Tab 同口径）。
 */
import { computed, ref, shallowRef } from 'vue'
import { Loader2, Download, Eye, Copy, Image as ImgIcon } from 'lucide-vue-next'
import { decodeToCanvas, canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import FileDrop from '@/components/common/FileDrop.vue'
import {
  MAGIC_TEXT,
  MAGIC_TEXT_X,
  MAGIC_FILE,
  MAGIC_FILE_X,
  capacityOf,
  embedBytes,
  extractBytes,
  keyBytes,
  diffCanvas,
} from './stegCore'

const toast = useToast()
const tab = ref<'hide' | 'extract'>('hide')

/* ---------- 隐藏 ---------- */
const cover = shallowRef<HTMLCanvasElement | null>(null)
const coverName = ref('')
const message = ref('')
const payloadMode = ref<'text' | 'file'>('text')
const payloadFile = shallowRef<File | null>(null)
const payloadCanvas = shallowRef<HTMLCanvasElement | null>(null)
const password = ref('')
const running = ref(false)
/** 成品预览（rx2） */
const outCv = shallowRef<HTMLCanvasElement | null>(null)
const showDiff = ref(false)

const capacity = computed(() => (cover.value ? capacityOf(cover.value.width, cover.value.height) : 0))
const payloadBytes = computed(() => (payloadMode.value === 'text' ? new TextEncoder().encode(message.value).length : payloadFile.value?.size ?? 0))
const payloadDesc = computed(() =>
  payloadMode.value === 'text' ? `${payloadBytes.value} 字节文本` : `${payloadFile.value?.name ?? ''}（${payloadBytes.value} 字节）`,
)

async function loadCover(files: File[]) {
  if (!files.length) {
    cover.value = null
    coverName.value = ''
    return
  }
  try {
    cover.value = await decodeToCanvas(files[0])
    coverName.value = files[0].name
    outCv.value = null
  } catch (e) {
    toast.err((e as Error).message || '图片解码失败')
  }
}

async function loadPayload(files: File[]) {
  const f = files[0]
  if (!f) return
  payloadFile.value = f
  try {
    payloadCanvas.value = await decodeToCanvas(f)
  } catch {
    payloadCanvas.value = null
  }
}

async function hide() {
  const c = cover.value
  if (!c) {
    toast.warn('请先选择一张载体图片')
    return
  }
  let body: Uint8Array
  let magic: number[]
  if (payloadMode.value === 'file') {
    if (!payloadFile.value) {
      toast.warn('请选择作为载荷的图片文件')
      return
    }
    body = new Uint8Array(await payloadFile.value.arrayBuffer())
    magic = password.value.trim() ? MAGIC_FILE_X : MAGIC_FILE
  } else {
    if (!message.value) {
      toast.warn('请输入要隐藏的消息')
      return
    }
    body = new TextEncoder().encode(message.value)
    magic = password.value.trim() ? MAGIC_TEXT_X : MAGIC_TEXT
  }
  if (body.length > capacity.value) {
    toast.err(`载荷太大：需要 ${body.length} 字节，容量只剩 ${capacity.value} 字节`)
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
    const len = body.length
    const header = new Uint8Array(8)
    header.set(magic, 0)
    header[4] = len & 0xff
    header[5] = (len >> 8) & 0xff
    header[6] = (len >> 16) & 0xff
    header[7] = (len >> 24) & 0xff
    const key = keyBytes(password.value)
    embedBytes(id.data, header, 0)
    embedBytes(id.data, body, 64, key)
    ctx.putImageData(id, 0, 0)
    outCv.value = out
    showDiff.value = false
    toast.ok('已写入，请在下方预览并下载 PNG（JPG 会破坏数据）')
  } catch (e) {
    toast.err((e as Error).message || '隐藏失败')
  } finally {
    running.value = false
  }
}

async function downloadStego() {
  if (!outCv.value) return
  const blob = await canvasToBlob(outCv.value, 'image/png')
  saveBlob(blob, `${coverName.value.replace(/\.[^.]+$/, '') || 'stego'}-hidden.png`)
}

function toggleDiff() {
  showDiff.value = !showDiff.value
}
const stegoUrl = computed(() => {
  if (showDiff.value && outCv.value && cover.value) return diffCanvas(cover.value, outCv.value).toDataURL('image/png')
  return outCv.value ? outCv.value.toDataURL('image/png') : ''
})

/* ---------- 提取 ---------- */
const stego = shallowRef<HTMLCanvasElement | null>(null)
const stegoFile = shallowRef<File | null>(null)
const extracted = ref('')
const extractedFile = shallowRef<Blob | null>(null)
const extractCap = computed(() => (stego.value ? capacityOf(stego.value.width, stego.value.height) : 0))
const extractPassword = ref('')

async function loadStego(files: File[]) {
  if (!files.length) {
    stego.value = null
    stegoFile.value = null
    extracted.value = ''
    extractedFile.value = null
    return
  }
  stegoFile.value = files[0]!
  await reExtract()
}

/** 解析提取（口令变更后可重跑） */
async function reExtract() {
  const f = stegoFile.value
  if (!f) return
  try {
    const c = await decodeToCanvas(f)
    stego.value = c
    extracted.value = ''
    extractedFile.value = null
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    const head = extractBytes(d, 0, 8)
    const isText = MAGIC_TEXT.every((v, i) => head[i] === v)
    const isTextX = MAGIC_TEXT_X.every((v, i) => head[i] === v)
    const isFile = MAGIC_FILE.every((v, i) => head[i] === v)
    const isFileX = MAGIC_FILE_X.every((v, i) => head[i] === v)
    if (!isText && !isTextX && !isFile && !isFileX) {
      toast.warn('未检测到隐藏信息（可能不是本工具生成，或已被压缩 / 截图破坏；若写入时设了口令请确认口令无误）')
      return
    }
    const len = head[4]! | (head[5]! << 8) | (head[6]! << 16) | (head[7]! << 24)
    if (len <= 0 || len > capacityOf(c.width, c.height)) {
      toast.warn('消息长度异常，数据可能已损坏')
      return
    }
    const key = isTextX || isFileX ? keyBytes(extractPassword.value) : undefined
    const body = extractBytes(d, 64, len, key)
    if (isFile || isFileX) {
      extractedFile.value = new Blob([body as BlobPart], { type: 'image/png' })
      toast.ok('成功提取隐藏图片载荷')
    } else {
      extracted.value = new TextDecoder().decode(body)
      toast.ok('成功提取隐藏消息')
    }
  } catch (e) {
    toast.err((e as Error).message || '提取失败')
  }
}

async function copyExtracted() {
  if (!extracted.value) return
  if (await copyText(extracted.value)) toast.ok('已复制完整消息')
  else toast.err('复制失败')
}

async function downloadPayload() {
  if (!extractedFile.value) return
  saveBlob(extractedFile.value, 'hidden-payload.png')
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

      <div class="row mt-2" style="gap: 8px">
        <button class="chip" :class="{ active: payloadMode === 'text' }" @click="payloadMode = 'text'">文本载荷</button>
        <button class="chip" :class="{ active: payloadMode === 'file' }" @click="payloadMode = 'file'">图片载荷（rx3）</button>
      </div>

      <div v-if="payloadMode === 'text'" class="mt-2" style="max-width: 640px">
        <span class="field-label">要隐藏的消息</span>
        <textarea v-model="message" class="textarea" style="min-height: 100px" placeholder="输入秘密消息…（按 UTF-8 字节计算）"></textarea>
      </div>
      <div v-else class="mt-2" style="max-width: 640px">
        <FileDrop accept="image/png,image/*" :multiple="false" label="拖入作为载荷的第二张图片（PNG 无损还原）" hint="载荷按原文件字节写入，PNG 载荷可像素级还原" @files="loadPayload" />
        <p v-if="payloadFile" class="muted small mt-1">
          载荷：{{ payloadDesc }}
          <template v-if="payloadCanvas"> · {{ payloadCanvas.width }}×{{ payloadCanvas.height }}</template>
        </p>
      </div>

      <div class="mt-2" style="max-width: 640px">
        <label class="field-label">口令（可选，混淆正文）</label>
        <input v-model="password" type="text" class="input" placeholder="留空 = 不加密；提取时需输入同一口令" />
      </div>

      <div v-if="cover" class="row mt-1" style="gap: 10px">
        <span class="muted small">载荷 {{ payloadBytes }} / {{ capacity }} 字节</span>
        <button class="btn btn-primary btn-sm" :disabled="running" @click="hide">
          <Loader2 v-if="running" :size="14" class="spin" /><Download v-else :size="14" /> 写入并预览
        </button>
      </div>

      <!-- rx2 成品预览 + 差异 ×8 -->
      <div v-if="outCv" class="mt-2">
        <div class="row" style="gap: 10px">
          <button class="chip" :class="{ active: !showDiff }" @click="showDiff = false">成品图</button>
          <button class="chip" :class="{ active: showDiff }" @click="toggleDiff">差异 ×8</button>
          <button class="btn btn-primary btn-sm" style="margin-left: auto" @click="downloadStego"><Download :size="14" /> 下载 PNG</button>
        </div>
        <img :src="stegoUrl" class="stego-pv mt-1" :alt="showDiff ? '差异可视化' : '成品图预览'" />
        <p class="muted small mt-1">
          {{ showDiff ? '差异 ×8 灰度图：低位噪点应均匀分布，非消息区为纯黑。' : '务必以 PNG 保存与传播；JPG / 截图会破坏隐藏数据。' }}
        </p>
      </div>

      <p class="muted small mt-2">
        原理：图片每个像素的 R/G/B 最低位各藏 1 位（magic 头 + 长度 + 正文，口令以重复异或流混淆），约每 8 个像素藏 3 字节。
      </p>
    </div>

    <div v-else class="mt-2">
      <FileDrop
        v-if="!stego"
        accept="image/png,image/*"
        :multiple="false"
        label="拖放隐藏过消息的图片"
        hint="自动校验 STG 魔数头；写入时设了口令的需填同一口令"
        @files="loadStego"
      />
      <div v-else>
        <div class="row row-wrap mt-1" style="gap: 12px">
          <span class="badge"><Eye :size="13" /> 已完成解析</span>
          <span class="badge badge-plain">图片：{{ stego.width }} × {{ stego.height }} · 理论容量 {{ extractCap }} 字节</span>
          <button class="btn btn-ghost btn-sm" @click="((stego = null), (stegoFile = null), (extracted = ''), (extractedFile = null))">换一张</button>
        </div>
        <div v-if="extractedFile" class="notice notice-ok mt-2">
          <div class="row" style="gap: 10px; align-items: center">
            <ImgIcon :size="15" /> 检测到图片载荷（{{ (extractedFile.size / 1024).toFixed(0) }} KB）
            <button class="btn btn-primary btn-sm" @click="downloadPayload"><Download :size="14" /> 下载载荷 PNG</button>
          </div>
        </div>
        <div v-if="extracted" class="notice notice-ok mt-2" style="white-space: pre-wrap; display: block">{{ extracted }}</div>
        <div v-if="extracted" class="row mt-1">
          <button class="btn btn-soft btn-sm" @click="copyExtracted"><Copy :size="14" /> 复制完整消息</button>
        </div>
        <div v-if="!extracted && !extractedFile" class="row mt-2" style="gap: 10px">
          <label class="field-label">口令（写入时设置过才需要）</label>
          <input v-model="extractPassword" type="text" class="input" style="max-width: 260px" placeholder="输入写入时的口令" @change="reExtract" />
        </div>
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
.stego-pv {
  max-width: 100%;
  max-height: 46vh;
  display: block;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  background: repeating-conic-gradient(var(--panel-hover) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
}
</style>
