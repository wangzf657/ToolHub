<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Copy, Check, Fingerprint } from 'lucide-vue-next'
import { copyText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface Row { k: string; v: string }
const groups = ref<{ title: string; rows: Row[] }[]>([])

/** FNV-1a 简易哈希，用于 Canvas 指纹展示 */
const fnv1a = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const canvasFingerprint = (): string => {
  try {
    const c = document.createElement('canvas')
    c.width = 240
    c.height = 60
    const ctx = c.getContext('2d')
    if (!ctx) return '（不可用）'
    ctx.textBaseline = 'top'
    ctx.font = "16px 'Arial'"
    ctx.fillStyle = '#f60'
    ctx.fillRect(0, 0, 100, 30)
    ctx.fillStyle = '#069'
    ctx.fillText('ToolHub 指纹探测 \u{1F512}', 2, 12)
    ctx.fillStyle = 'rgba(102,204,0,0.7)'
    ctx.fillText('Browser Fingerprint', 4, 32)
    return fnv1a(c.toDataURL())
  } catch {
    return '（不可用）'
  }
}

const webglInfo = (): { renderer: string; vendor: string } => {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') ?? c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return { renderer: '（不可用）', vendor: '（不可用）' }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR))
    return { renderer, vendor }
  } catch {
    return { renderer: '（不可用）', vendor: '（不可用）' }
  }
}

const tzOffsetMin = -new Date().getTimezoneOffset()
const tzSign = tzOffsetMin >= 0 ? '+' : '-'
const tzOffset = `UTC${tzSign}${String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0')}:${String(Math.abs(tzOffsetMin) % 60).padStart(2, '0')}`

const collect = () => {
  const nav = navigator
  const gl = webglInfo()
  const conn = (nav as Navigator & { connection?: { effectiveType?: string } }).connection
  groups.value = [
    {
      title: '浏览器与环境',
      rows: [
        { k: 'User-Agent', v: nav.userAgent },
        { k: '平台', v: (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? nav.platform },
        { k: '语言', v: nav.languages?.join(', ') ?? nav.language },
        { k: 'Cookie 已启用', v: nav.cookieEnabled ? '是' : '否' },
        { k: 'Do Not Track', v: nav.doNotTrack ?? '（未声明）' },
        { k: '硬件并发（CPU 核心数）', v: String(nav.hardwareConcurrency ?? '未知') },
        { k: '设备内存（约）', v: `${(nav as Navigator & { deviceMemory?: number }).deviceMemory ?? '未知'} GB` },
        { k: '最大触摸点', v: String(nav.maxTouchPoints ?? 0) },
        { k: '网络类型（若暴露）', v: conn?.effectiveType ?? '（不可用）' },
      ],
    },
    {
      title: '屏幕与时区',
      rows: [
        { k: '屏幕分辨率', v: `${screen.width} × ${screen.height}` },
        { k: '可用区域', v: `${screen.availWidth} × ${screen.availHeight}` },
        { k: '色深', v: `${screen.colorDepth} 位` },
        { k: '像素比', v: String(window.devicePixelRatio) },
        { k: '窗口大小', v: `${window.innerWidth} × ${window.innerHeight}` },
        { k: '时区', v: Intl.DateTimeFormat().resolvedOptions().timeZone },
        { k: '时区偏移', v: tzOffset },
      ],
    },
    {
      title: '图形指纹',
      rows: [
        { k: 'Canvas 指纹（FNV-1a 哈希）', v: canvasFingerprint() },
        { k: 'WebGL 渲染器', v: gl.renderer },
        { k: 'WebGL 厂商', v: gl.vendor },
      ],
    },
  ]
}

const report = (): string =>
  ['=== 浏览器指纹报告（本页可见信息） ===',
    ...groups.value.flatMap((g) => [`\n[ ${g.title} ]`, ...g.rows.map((r) => `${r.k}: ${r.v}`)]),
    `\n生成时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n')

onMounted(collect)

const copied = ref(false)
const doCopy = async () => {
  const okFlag = await copyText(report())
  if (okFlag) {
    copied.value = true
    toast.ok('报告已复制')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.err('复制失败')
  }
}
</script>

<template>
  <div>
    <div class="notice notice-info small">
      <Fingerprint :size="16" />
      以下全部信息由当前页面在本地收集，只展示给<strong>你自己</strong>。任何网站都能读到类似数据——了解它们有助于你判断自己的可识别程度。
    </div>

    <div v-for="g in groups" :key="g.title" class="mt-2">
      <h4 class="g-title">{{ g.title }}</h4>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr v-for="r in g.rows" :key="r.k">
              <td class="row-k">{{ r.k }}</td>
              <td class="mono row-v">{{ r.v }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="doCopy">
        <Check v-if="copied" :size="16" />
        <Copy v-else :size="16" /> 复制完整报告
      </button>
      <button class="btn btn-ghost" @click="collect">重新收集</button>
    </div>
  </div>
</template>

<style scoped>
.notice {
  align-items: center;
}
.g-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-2);
  margin: 0 0 6px 2px;
}
.row-k {
  width: 240px;
  color: var(--text-2);
  white-space: normal;
}
.row-v {
  white-space: normal;
  word-break: break-all;
}
</style>
