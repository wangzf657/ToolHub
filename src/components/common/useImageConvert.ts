/**
 * imgcvt 家族转换编排 composable（从 ImageConvertTool 拆出，保持主组件 ≤300 行）：
 * 拖入预检 / 运行循环 / 解码器加载提示 / 体积膨胀警示 / 双目标输出 /
 * 单张调质量重转 / 耗时预估 / 输出文件名去重。
 * 处方来源：docs/优化文档/图片工具/png-to-jpg.md 等家族档案。
 */
import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { convertImage, extFor, type TargetMime } from '@/lib/imageConvert'
import { saveMany } from '@/lib/download'
import { useToast } from '@/composables/useToast'
import { analyzePicked, decoderOf, extOf, extOfMime, growthSuggest, type PickNotice, type ResultItem } from './imageConvertDiag'

export interface ConvertCtx {
  /** 主目标格式 */
  target: TargetMime
  /** 是否暴露质量参数（决定重转入口与质量透传） */
  withQuality: boolean
  picked: Ref<File[]>
  qualityVal: Ref<number>
  widthVal: Ref<number | ''>
  heightVal: Ref<number | ''>
  /** JPG 底色（透明区域填充） */
  bgColor: Ref<string>
  /** WebP 无损档 */
  lossless: Ref<boolean>
  /** 双目标：同时输出一份 WebP 副本 */
  alsoWebp: Ref<boolean>
  /** 完成后自动打包下载 */
  autoZip: Ref<boolean>
}

export function useImageConvert(ctx: ConvertCtx) {
  const toast = useToast()
  const running = ref(false)
  const progressPct = ref(0)
  const doneCount = ref(0)
  /** 批量耗时预估文案（heic-to-jpg 处方 4：已用 Xs · 预计还需约 Ys） */
  const etaText = ref('')
  /** 拖入预检提示（解码器预告 / 动图首帧 / TIFF 多页 / 32 位 BMP / AVIF 能力） */
  const pickNotices = ref<PickNotice[]>([])
  /** 转换中的解码器加载文案（壳级能力 a：首次动态加载解码器期间展示，不许无反馈） */
  const decoderMsg = ref('')
  /** 已加载过的解码器（会话级去重，第二次转换不再提示） */
  const decoderLoaded = new Set<string>()
  let analyzeToken = 0

  const results = ref<ResultItem[]>([])
  let itemId = 0

  const isJpeg = computed(() => ctx.target === 'image/jpeg')
  const isWebp = computed(() => ctx.target === 'image/webp')
  const srcExts = computed(() => ctx.picked.value.map((f) => extOf(f.name)))
  const srcHasMeta = computed(() => srcExts.value.some((e) => ['jpg', 'jpeg', 'heic', 'heif', 'tif', 'tiff', 'avif', 'webp'].includes(e)))

  /** 体积膨胀警示（壳级能力 b：任一输出 ≥ 输入 1.2 倍时取最差一张给出改用建议） */
  const growth = computed(() => {
    const ok = results.value.filter((r) => r.ok)
    let worst: ResultItem | null = null
    for (const r of ok) {
      if (r.srcSize > 0 && r.blob.size >= r.srcSize * 1.2 && (!worst || r.blob.size / r.srcSize > worst.blob.size / worst.srcSize)) worst = r
    }
    if (!worst) return null
    return { pct: Math.round((worst.blob.size / worst.srcSize - 1) * 100), name: worst.name, ...growthSuggest(ctx.target, srcExts.value) }
  })

  /** 拖入预检（壳级能力 c 等）：动图 / 多页 / 解码器 / 能力说明 */
  const onFiles = async (list: File[]) => {
    ctx.picked.value = list
    const token = ++analyzeToken
    if (!list.length) {
      pickNotices.value = []
      return
    }
    const notices = await analyzePicked(list)
    if (token === analyzeToken) pickNotices.value = notices
  }

  const clearResults = () => {
    for (const r of results.value) if (r.url) URL.revokeObjectURL(r.url)
    results.value = []
  }

  /** 输出文件名去重（同基名多源文件时追加序号，避免 ZIP 内相互覆盖） */
  const dedupeName = (name: string): string => {
    const used = new Set(results.value.map((r) => r.name))
    if (!used.has(name)) return name
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    for (let i = 2; ; i++) {
      const cand = `${stem}-${i}${ext}`
      if (!used.has(cand)) return cand
    }
  }

  /** 单张转换：解码器加载文案 + WebP 编码 MIME 校验（浏览器不支持时 toBlob 静默回退 PNG） */
  const runOne = async (f: File, target: TargetMime, main: boolean, quality?: number): Promise<ResultItem> => {
    const dec = main ? decoderOf(extOf(f.name)) : null
    if (dec && !decoderLoaded.has(dec.key)) decoderMsg.value = `正在加载 ${dec.label} 解码器（${dec.size}），首次使用需等待…`
    const base = { id: ++itemId, srcSize: f.size, main, srcFile: f }
    try {
      const blob = await convertImage(f, {
        target,
        quality,
        width: ctx.widthVal.value === '' ? undefined : Number(ctx.widthVal.value),
        height: ctx.heightVal.value === '' ? undefined : Number(ctx.heightVal.value),
        background: target === 'image/jpeg' ? ctx.bgColor.value : undefined,
      })
      if (dec) {
        decoderLoaded.add(dec.key)
        decoderMsg.value = ''
      }
      let ext = extFor(target)
      if (target === 'image/webp' && blob.type && blob.type !== target) {
        // 假 WebP 修正（jpg-to-webp/png-to-webp 处方 1）：按真实类型命名并提示
        toast.warn('当前浏览器不支持 WebP 编码，已改输出 PNG')
        ext = extOfMime(blob.type)
      }
      const name = dedupeName(`${f.name.replace(/\.[^.]+$/, '')}.${ext}`)
      return { ...base, name, blob, url: URL.createObjectURL(blob), ok: true, fmt: ext.toUpperCase() }
    } catch (e) {
      decoderMsg.value = ''
      return { ...base, name: f.name, blob: new Blob(), url: '', ok: false, fmt: extFor(target), err: (e as Error).message || '转换失败' }
    }
  }

  const run = async () => {
    if (!ctx.picked.value.length) {
      toast.warn('请先选择要转换的图片')
      return
    }
    running.value = true
    progressPct.value = 0
    doneCount.value = 0
    etaText.value = ''
    clearResults()
    const started = performance.now()
    const total = ctx.picked.value.length
    // WebP 无损档：不传 quality 即浏览器无损编码（png-to-webp/jpg-to-webp 处方 3）
    const q = isWebp.value && ctx.lossless.value ? undefined : ctx.qualityVal.value
    try {
      for (let i = 0; i < total; i++) {
        const f = ctx.picked.value[i]!
        results.value.push(await runOne(f, ctx.target, true, ctx.withQuality ? q : undefined))
        if (ctx.alsoWebp.value && !isWebp.value) results.value.push(await runOne(f, 'image/webp', false, ctx.withQuality ? ctx.qualityVal.value : 0.9))
        doneCount.value = i + 1
        progressPct.value = ((i + 1) / total) * 100
        // 耗时预估（heic-to-jpg 处方 4）：完成首张后按均耗估计剩余
        if (total > 1) {
          const elapsed = performance.now() - started
          const avg = elapsed / doneCount.value
          etaText.value = `已用 ${Math.round(elapsed / 1000)}s · 预计还需约 ${Math.max(0, Math.round((avg * (total - doneCount.value)) / 1000))}s`
        }
      }
      const okCount = results.value.filter((r) => r.ok).length
      if (okCount < results.value.length) toast.warn(`${okCount}/${results.value.length} 张成功，失败卡片已标注原因`)
      else toast.ok(`成功转换 ${okCount} 张`)
      if (ctx.autoZip.value && okCount) {
        await saveMany(
          results.value.filter((r) => r.ok).map((r) => ({ name: r.name, blob: r.blob })),
          `已转换-${okCount}张.zip`,
        )
      }
    } finally {
      running.value = false
      decoderMsg.value = ''
    }
  }

  /** 单张调质量重转（png-to-jpg 处方 5）：仅重跑该张主目标，其余结果不动 */
  const reconvert = async (item: ResultItem, quality: number) => {
    if (!item.srcFile || running.value) return
    running.value = true
    try {
      const blob = await convertImage(item.srcFile, {
        target: ctx.target,
        quality,
        width: ctx.widthVal.value === '' ? undefined : Number(ctx.widthVal.value),
        height: ctx.heightVal.value === '' ? undefined : Number(ctx.heightVal.value),
        background: isJpeg.value ? ctx.bgColor.value : undefined,
      })
      if (isWebp.value && blob.type && blob.type !== ctx.target) toast.warn('当前浏览器不支持 WebP 编码，已改输出 PNG')
      if (item.url) URL.revokeObjectURL(item.url)
      item.blob = blob
      item.url = URL.createObjectURL(blob)
      toast.ok(`「${item.name}」已按 ${Math.round(quality * 100)}% 质量重转`)
    } catch (e) {
      toast.err(`重转失败：${(e as Error).message || '请重试'}`)
    } finally {
      running.value = false
    }
  }

  onBeforeUnmount(clearResults)

  return { running, progressPct, doneCount, etaText, pickNotices, decoderMsg, results, growth, srcHasMeta, onFiles, run, reconvert, clearResults }
}
