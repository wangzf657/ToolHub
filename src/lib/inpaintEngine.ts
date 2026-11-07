/**
 * inpaintEngine —— 图片修复（去水印）引擎，参考 inpaint-web 的 MI-GAN 方案。
 *
 * 模型：migan_pipeline_v2.onnx（约 28MB），HuggingFace 主源 + hf-mirror 镜像备源，
 *       下载后存 IndexedDB，浏览器缓存后离线可用。
 * 推理：onnxruntime-web 懒加载（不进首屏），WebGPU 优先、WASM 兜底；
 *       wasm 运行时走 jsDelivr CDN，不打包进本地构建产物。
 * 输入：图像 [1,3,H,W] uint8 + 蒙版 [1,1,H,W] uint8（修复区域 = 255）。
 * 策略：只对蒙版外扩后的裁剪块推理（最大边限制），结果仅贴回蒙版区域，
 *       任意大图都不会 OOM，未涂抹的像素保持原样。
 * 全程浏览器本地完成，图片与蒙版不上传任何服务器。
 */

const MODEL_KEY = 'migan-pipeline-v2'
/** 与 package.json 中 onnxruntime-web 版本保持一致（wasm 运行时从 CDN 拉取） */
const ORT_VERSION = '1.31.1'
const ORT_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
const MODEL_URLS = [
  'https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx',
  'https://hf-mirror.com/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx',
]
/** 蒙版外扩边距：给模型留上下文 */
const PAD = 32
/** 裁剪块最小边：MI-GAN 以 512×512 训练，窗口太窄会生成条纹伪影，短边不足时向外扩展 */
const MIN_CONTEXT = 384
/** 裁剪块最大边，超过则等比缩小推理再放大回贴（防 OOM） */
const MAX_SIDE = 1536
/** 蒙版判定阈值（与画笔半透明叠加兼容，比视觉范围略大） */
const MASK_ALPHA = 20

type OrtModule = typeof import('onnxruntime-web')
type OrtSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>

/** 推理阶段回调：pct 为 0-100 的下载进度；null 表示不确定（推理中） */
export type InpaintStage = (status: string, pct: number | null) => void

/* ---------------- IndexedDB 模型缓存 ---------------- */

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('toolhub-models', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('models')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

function idbGet(key: string): Promise<ArrayBuffer | undefined> {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction('models').objectStore('models').get(key)
        req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined)
        req.onerror = () => reject(req.error)
      })
  )
}

function idbPut(key: string, buf: ArrayBuffer): Promise<void> {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('models', 'readwrite')
        tx.objectStore('models').put(buf, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
  )
}

/* ---------------- 模型获取（缓存 → 主源 → 镜像） ---------------- */

export async function ensureInpaintModel(onProgress?: (pct: number) => void): Promise<Uint8Array> {
  const cached = await idbGet(MODEL_KEY).catch(() => undefined)
  if (cached) {
    onProgress?.(100)
    return new Uint8Array(cached)
  }
  let lastErr: unknown = null
  for (const url of MODEL_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const total = Number(res.headers.get('content-length') || 0)
      const chunks: Uint8Array[] = []
      let loaded = 0
      const reader = res.body?.getReader()
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          loaded += value.length
          if (total) onProgress?.(Math.min(99, Math.round((loaded / total) * 100)))
        }
      } else {
        chunks.push(new Uint8Array(await res.arrayBuffer()))
      }
      const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
      let off = 0
      for (const c of chunks) {
        out.set(c, off)
        off += c.length
      }
      await idbPut(MODEL_KEY, out.buffer)
      onProgress?.(100)
      return out
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(`修复模型下载失败，请检查网络后重试（${(lastErr as Error)?.message ?? lastErr}）`)
}

/* ---------------- ORT 会话（单例 + WebGPU→WASM 兜底） ---------------- */

let ortP: Promise<OrtModule> | null = null
let sessionP: Promise<OrtSession> | null = null
let modelBuf: Uint8Array | null = null
let forceWasm = false

async function loadOrt(): Promise<OrtModule> {
  if (!ortP) {
    ortP = (async () => {
      const ort = await import('onnxruntime-web')
      ort.env.wasm.wasmPaths = ORT_CDN
      return ort
    })()
  }
  return ortP
}

/** 每次创建会话传入拷贝：proxy 模式会 transfer buffer，避免缓存被 detach */
async function getSession(ort: OrtModule, modelData: Uint8Array): Promise<OrtSession> {
  if (!sessionP) {
    sessionP = (async () => {
      if (!forceWasm && 'gpu' in navigator) {
        try {
          return await ort.InferenceSession.create(modelData.slice(), { executionProviders: ['webgpu'] })
        } catch {
          /* WebGPU 初始化失败（驱动/黑名单等），退 WASM */
        }
      }
      // WASM：推理放进 ORT 内置 worker（proxy），不阻塞 UI；无跨域隔离时 ORT 自动单线程
      ort.env.wasm.proxy = true
      return await ort.InferenceSession.create(modelData.slice(), { executionProviders: ['wasm'] })
    })()
  }
  return sessionP
}

/* ---------------- 蒙版分析与裁剪块 ---------------- */

interface Block {
  img: HTMLCanvasElement
  mask: HTMLCanvasElement // 白色硬边蒙版（用于仅回贴涂抹区）
  bin: Uint8Array // 修复区二值（cw×ch）
  /** 推理画布尺寸（8 的倍数，含边缘补齐） */
  cw: number
  ch: number
  /** 场景窗口（原图坐标） */
  x0: number
  y0: number
  sx: number
  sy: number
}

function analyzeMask(maskEl: HTMLCanvasElement) {
  const W = maskEl.width
  const H = maskEl.height
  const d = maskEl.getContext('2d')!.getImageData(0, 0, W, H).data
  let x0 = W
  let y0 = H
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > MASK_ALPHA) {
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x > x1) x1 = x
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { x0, y0, x1, y1 }
}

/** 从蒙版画布裁剪块生成二值蒙版：读 alpha → 阈值化 → 3×3 膨胀一轮盖住半透明边缘 */
function buildBin(mctxBlock: HTMLCanvasElement): Uint8Array {
  const W = mctxBlock.width
  const H = mctxBlock.height
  const d = mctxBlock.getContext('2d')!.getImageData(0, 0, W, H).data
  let bin = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) bin[i] = d[i * 4 + 3] > MASK_ALPHA ? 1 : 0
  const nb = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (
        bin[i] ||
        (x > 0 && bin[i - 1]) ||
        (x < W - 1 && bin[i + 1]) ||
        (y > 0 && bin[i - W]) ||
        (y < H - 1 && bin[i + W])
      ) {
        nb[i] = 1
      }
    }
  }
  return nb
}

function cropBlock(src: HTMLCanvasElement, maskEl: HTMLCanvasElement, bbox: { x0: number; y0: number; x1: number; y1: number }): Block {
  const W = src.width
  const H = src.height
  // 场景窗口：蒙版外扩 PAD，再把短边扩展到 MIN_CONTEXT（模型对窄条输入会生成伪影）
  let x0 = Math.max(0, bbox.x0 - PAD)
  let y0 = Math.max(0, bbox.y0 - PAD)
  let x1 = Math.min(W, bbox.x1 + 1 + PAD)
  let y1 = Math.min(H, bbox.y1 + 1 + PAD)
  const ex = Math.max(0, (MIN_CONTEXT - (x1 - x0)) / 2)
  const ey = Math.max(0, (MIN_CONTEXT - (y1 - y0)) / 2)
  x0 = Math.max(0, x0 - ex)
  x1 = Math.min(W, x1 + ex)
  y0 = Math.max(0, y0 - ey)
  y1 = Math.min(H, y1 + ey)
  const sx = x1 - x0
  const sy = y1 - y0
  // 等比缩小到限制内；画布尺寸对齐 8 的倍数（GAN stride 对齐），比场景大出的部分用边缘补齐
  const scale = Math.min(1, MAX_SIDE / Math.max(sx, sy))
  const cw = Math.max(8, Math.round((sx * scale) / 8) * 8)
  const ch = Math.max(8, Math.round((sy * scale) / 8) * 8)
  const dw = sx * scale
  const dh = sy * scale

  const img = document.createElement('canvas')
  img.width = cw
  img.height = ch
  const ictx = img.getContext('2d')!
  ictx.drawImage(src, x0, y0, sx, sy, 0, 0, dw, dh)
  // 边缘补齐（补边区域仅在蒙版贴到图像边缘时给模型上下文，结果不会贴回）
  if (cw > dw) ictx.drawImage(img, dw - 1, 0, 1, dh, dw, 0, cw - dw, dh)
  if (ch > dh) ictx.drawImage(img, 0, dh - 1, cw, 1, 0, dh, cw, ch - dh)

  const mkCv = document.createElement('canvas')
  mkCv.width = cw
  mkCv.height = ch
  mkCv.getContext('2d')!.drawImage(maskEl, x0, y0, sx, sy, 0, 0, dw, dh)
  const bin = buildBin(mkCv)

  // 白色硬边蒙版：仅用于把推理结果限定在涂抹区贴回
  const mask = document.createElement('canvas')
  mask.width = cw
  mask.height = ch
  const mctx = mask.getContext('2d')!
  const shape = mctx.createImageData(cw, ch)
  for (let i = 0; i < cw * ch; i++) {
    if (bin[i]) {
      shape.data[i * 4] = 255
      shape.data[i * 4 + 1] = 255
      shape.data[i * 4 + 2] = 255
      shape.data[i * 4 + 3] = 255
    }
  }
  mctx.putImageData(shape, 0, 0)
  return { img, mask, bin, cw, ch, x0, y0, sx, sy }
}

/* ---------------- 张量前后处理 ---------------- */

function canvasToChw(cv: HTMLCanvasElement): Uint8Array {
  const W = cv.width
  const H = cv.height
  const d = cv.getContext('2d')!.getImageData(0, 0, W, H).data
  const N = W * H
  const out = new Uint8Array(N * 3)
  for (let i = 0; i < N; i++) {
    out[i] = d[i * 4]
    out[N + i] = d[i * 4 + 1]
    out[2 * N + i] = d[i * 4 + 2]
  }
  return out
}

function chwToCanvas(data: Float32Array | Uint8Array, W: number, H: number): HTMLCanvasElement {
  if (!(W > 0 && H > 0)) throw new Error(`模型输出尺寸异常：${W}×${H}`)
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const px = img.data
  const N = W * H
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
  for (let i = 0; i < N; i++) {
    px[i * 4] = clamp(data[i])
    px[i * 4 + 1] = clamp(data[N + i])
    px[i * 4 + 2] = clamp(data[2 * N + i])
    px[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return cv
}

/* ---------------- 主入口 ---------------- */

/**
 * 对画布执行 AI 修复：maskCanvas 中 alpha > 阈值的区域被模型重绘，其余像素保持不变。
 * 会直接修改 canvas（work 画布），撤销由调用方自行快照。
 */
export async function inpaintCanvas(
  canvas: HTMLCanvasElement,
  maskEl: HTMLCanvasElement,
  onStage?: InpaintStage
): Promise<void> {
  const bbox = analyzeMask(maskEl)
  if (!bbox) throw new Error('未检测到涂抹区域，请先用画笔涂抹要去除的部分')
  modelBuf = await ensureInpaintModel((p) => onStage?.('下载修复模型', p))
  onStage?.('正在推理，取决于区域大小可能需要几秒到几十秒', null)

  const ort = await loadOrt()
  const block = cropBlock(canvas, maskEl, bbox)
  const N = block.cw * block.ch
  // MI-GAN pipeline 语义（实测确认）：mask=0 为修复区（重绘），255 为保留区（原样输出）
  const maskChw = new Uint8Array(N).fill(255)
  for (let i = 0; i < N; i++) if (block.bin[i]) maskChw[i] = 0

  const run = async (session: OrtSession) => {
    // ONNX 张量为 NCHW：第 2/3 维是高/宽（ch=高、cw=宽），顺序不可颠倒
    const feeds = {
      [session.inputNames[0]]: new ort.Tensor('uint8', canvasToChw(block.img), [1, 3, block.ch, block.cw]),
      [session.inputNames[1]]: new ort.Tensor('uint8', maskChw, [1, 1, block.ch, block.cw]),
    }
    const out = await session.run(feeds)
    const o = out[session.outputNames[0]]
    return chwToCanvas(o.data as Float32Array | Uint8Array, o.dims[3], o.dims[2])
  }

  let result: HTMLCanvasElement
  try {
    result = await run(await getSession(ort, modelBuf))
  } catch (e) {
    if (forceWasm) throw e
    // WebGPU 运行期失败（算子不支持等）：销毁会话，退 WASM 重跑一次
    forceWasm = true
    sessionP = null
    result = await run(await getSession(ort, modelBuf))
  }
  if (!result.width || !result.height) throw new Error(`推理结果画布为空：${result.width}×${result.height}`)

  // 仅把涂抹区域的结果贴回：结果 × 蒙版形状 → 场景部分缩放回原坐标（补边区域丢弃）
  const cut = document.createElement('canvas')
  cut.width = block.cw
  cut.height = block.ch
  const cctx = cut.getContext('2d')!
  cctx.drawImage(result, 0, 0)
  cctx.globalCompositeOperation = 'destination-in'
  cctx.drawImage(block.mask, 0, 0)
  cctx.globalCompositeOperation = 'source-over'
  canvas.getContext('2d')!.drawImage(cut, 0, 0, block.cw, block.ch, block.x0, block.y0, block.sx, block.sy)
}
