<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeftRight, Download, FileDown, Loader2 } from 'lucide-vue-next'
import FileDrop from '@/components/common/FileDrop.vue'
import { sfntToWoff, woffToSfnt, readFontInfo } from '@/lib/fileExt'
import type { FontInfo } from '@/lib/fileExt'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

/**
 * 字体格式转换：TTF/OTF ↔ WOFF（WOFF 1.0 容器自研实现，pako zlib 单表压缩）。
 * 附带字体信息查看（表列表 / 字形数 / unitsPerEm / name 表主要记录）。
 * WOFF2 需要独立 wasm 解码器，明确提示不支持。
 */
const toast = useToast()
const file = ref<File | null>(null)
const busy = ref(false)
const direction = ref<'' | 'toWoff' | 'toTtf'>('')
const info = ref<FontInfo | null>(null)
const converted = ref<{ blob: Blob; ext: string } | null>(null)

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/** 按签名识别字体容器类型 */
const detect = (bytes: Uint8Array): 'sfnt' | 'woff' | 'woff2' | 'unknown' => {
  const sig = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]
  if (sig === 0x00010000 || sig === 0x4f54544f /* 'OTTO' */ || sig === 0x74727565 /* 'true' */) return 'sfnt'
  if (sig === 0x774f4646 /* 'wOFF' */) return 'woff'
  if (sig === 0x774f4632 /* 'wOF2' */) return 'woff2'
  return 'unknown'
}

const open = async (files: File[]) => {
  const f = files[0]
  if (!f) return
  if (!/\.(ttf|otf|woff|woff2|ttc)$/i.test(f.name)) {
    toast.err('请选择 .ttf / .otf / .woff 字体文件')
    return
  }
  file.value = f
  busy.value = true
  direction.value = ''
  info.value = null
  converted.value = null
  try {
    const bytes = new Uint8Array(await f.arrayBuffer())
    const kind = detect(bytes)
    if (kind === 'woff2') {
      toast.err('WOFF2 需要专门的 brotli/wasm 解码器，本工具暂不支持；请先转为 TTF/WOFF')
      return
    }
    if (kind === 'unknown') {
      toast.err('无法识别的字体格式（请提供 TTF/OTF/WOFF）')
      return
    }
    direction.value = kind === 'sfnt' ? 'toWoff' : 'toTtf'
    // 信息查看：woff 先解包为 sfnt
    const sfntBytes = kind === 'sfnt' ? bytes : await woffToSfnt(bytes)
    try {
      info.value = readFontInfo(sfntBytes)
    } catch {
      info.value = null
    }
    toast.ok(kind === 'sfnt' ? '已识别为 TTF/OTF 字体' : '已识别为 WOFF 字体')
  } catch (e) {
    toast.err((e as Error).message || '字体解析失败')
  } finally {
    busy.value = false
  }
}

const convert = async () => {
  if (!file.value || !direction.value) return
  busy.value = true
  try {
    const bytes = new Uint8Array(await file.value.arrayBuffer())
    if (direction.value === 'toWoff') {
      const woff = await sfntToWoff(bytes)
      const blob = new Blob([woff as BlobPart], { type: 'font/woff' })
      converted.value = { blob, ext: 'woff' }
      toast.ok(`已转换为 WOFF：${fmtSize(bytes.length)} → ${fmtSize(woff.length)}`)
    } else {
      const sfnt = await woffToSfnt(bytes)
      const blob = new Blob([sfnt as BlobPart], { type: 'font/ttf' })
      converted.value = { blob, ext: file.value.name.toLowerCase().endsWith('.otf') ? 'otf' : 'ttf' }
      toast.ok(`已解包为 TTF/OTF：${fmtSize(bytes.length)} → ${fmtSize(sfnt.length)}`)
    }
  } catch (e) {
    toast.err((e as Error).message || '转换失败')
  } finally {
    busy.value = false
  }
}

const download = () => {
  if (!converted.value || !file.value) return
  saveBlob(converted.value.blob, `${baseName(file.value.name)}.${converted.value.ext}`)
}
</script>

<template>
  <div>
    <FileDrop accept=".ttf,.otf,.woff,.woff2" :multiple="false" label="拖入 TTF / OTF / WOFF 字体文件" hint="自动识别方向：TTF/OTF → WOFF 压缩，WOFF → TTF 解包；本地处理" @files="open" />

    <div v-if="busy" class="row mt-2 small muted"><Loader2 :size="14" class="spin" /> 正在处理字体…</div>

    <div v-if="direction" class="mt-2">
      <div class="row row-wrap" style="gap: 10px">
        <span class="chip">{{ direction === 'toWoff' ? 'TTF/OTF → WOFF' : 'WOFF → TTF/OTF' }}</span>
        <span class="grow"></span>
        <button class="btn btn-primary" :disabled="busy" @click="convert">
          <Loader2 v-if="busy" :size="15" class="spin" />
          <ArrowLeftRight v-else :size="15" /> 转换
        </button>
        <button v-if="converted" class="btn btn-soft" @click="download"><FileDown :size="15" /> 下载 .{{ converted.ext }}</button>
      </div>
    </div>

    <div v-if="info" class="mt-2">
      <div class="stats">
        <div class="stat"><span class="k">容器格式</span><span class="v">{{ info.sfntVersion }}</span></div>
        <div class="stat"><span class="k">字形数量</span><span class="v">{{ info.numGlyphs }}</span></div>
        <div class="stat"><span class="k">unitsPerEm</span><span class="v">{{ info.unitsPerEm }}</span></div>
        <div class="stat"><span class="k">表数量</span><span class="v">{{ info.numTables }}</span></div>
      </div>

      <p v-if="info.names.length" class="small muted mt-2">name 表主要记录</p>
      <div v-if="info.names.length" class="list mt-1">
        <div v-for="n in info.names" :key="`${n.id}-${n.value}`" class="entry">
          <span class="k">{{ n.label }}</span>
          <span class="v2">{{ n.value }}</span>
        </div>
      </div>

      <p class="small muted mt-2">包含的数据表</p>
      <div class="tags mt-1">
        <span v-for="t in info.tables" :key="t.tag" class="tag">{{ t.tag }}</span>
      </div>
    </div>

    <p class="notice notice-warn mt-2 small">
      转换说明：WOFF = 原字体按表拆分后逐表 zlib 压缩再加目录（压缩无收益的表保持原样），
      解包则逐表 inflate 并按 sfnt 规范重排、重算校验和。WOFF2（brotli 压缩）暂不支持。
      .ttc 字体集合仅取首个字体处理。
    </p>
  </div>
</template>

<style scoped>
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.grow {
  flex: 1;
}
.chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12.5px;
}
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 110px;
}
.k {
  font-size: 12px;
  color: var(--text-3);
}
.v {
  font-size: 15px;
  font-weight: 700;
}
.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 240px;
  overflow: auto;
}
.entry {
  display: flex;
  gap: 14px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.entry:last-child {
  border-bottom: none;
}
.entry .k {
  flex: none;
  width: 110px;
  color: var(--text-3);
}
.v2 {
  min-width: 0;
  overflow-wrap: anywhere;
}
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
}
</style>
