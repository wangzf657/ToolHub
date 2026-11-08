/**
 * 中文文本引擎：拼音标注、简繁转换
 * 词典/词库为 MB 级重依赖，首次调用时动态加载并做模块级缓存，后续调用零开销。
 */

/* ------------------------------------------------------------------ */
/* 拼音（pinyin-pro，多音字自动词典）                                    */
/* ------------------------------------------------------------------ */

export type ToneType = 'symbol' | 'num' | 'none'

let pinyinMod: typeof import('pinyin-pro') | null = null

async function ensurePinyin() {
  pinyinMod ??= await import('pinyin-pro')
  return pinyinMod
}

/** 文字转拼音：tone 声调样式；spaced 是否用空格分隔（多音字由内置词典自动处理） */
export async function pinyinOf(
  text: string,
  opts: { tone: ToneType; spaced: boolean } = { tone: 'symbol', spaced: true },
): Promise<string> {
  const { pinyin } = await ensurePinyin()
  return pinyin(text, {
    toneType: opts.tone,
    type: 'string',
    separator: opts.spaced ? ' ' : '',
    // 非中文内容连续保留（英文单词、数字不被拆散），与中文拼音之间自然留空
    nonZh: 'consecutive',
  })
}

/* ------------------------------------------------------------------ */
/* 简繁转换（opencc-js，OpenCC 词表支持词汇级转换）                       */
/* ------------------------------------------------------------------ */

export type VariantMode =
  | 's2t' // 简 → 繁（通用字形）
  | 't2s' // 繁 → 简
  | 's2tw' // 简 → 台湾正体（字形）
  | 's2twp' // 简 → 台湾正体（字形 + 词汇，如 内存→記憶體）
  | 's2hk' // 简 → 香港繁体
  | 't2tw' // 繁 → 台湾正体
  | 't2hk' // 繁 → 香港繁体

let openccMod: typeof import('opencc-js') | null = null
/** 转换器实例缓存：同一模式只构建一次 */
const converterCache = new Map<VariantMode, (s: string) => string>()

/** 模式 → opencc 区域对 */
function localeOf(mode: VariantMode): { from: string; to: string } {
  switch (mode) {
    case 's2t':
      return { from: 'cn', to: 't' }
    case 't2s':
      return { from: 't', to: 'cn' }
    case 's2tw':
      return { from: 'cn', to: 'tw' }
    case 's2twp':
      return { from: 'cn', to: 'twp' }
    case 's2hk':
      return { from: 'cn', to: 'hk' }
    case 't2tw':
      return { from: 't', to: 'tw' }
    case 't2hk':
      return { from: 't', to: 'hk' }
  }
}

async function ensureConverter(mode: VariantMode) {
  let c = converterCache.get(mode)
  if (!c) {
    openccMod ??= await import('opencc-js')
    const { from, to } = localeOf(mode)
    c = openccMod.Converter({ from, to }) as (s: string) => string
    converterCache.set(mode, c)
  }
  return c
}

/** 简繁转换：词汇级词表（s2twp 等），首次调用加载词库 */
export async function variantConvert(text: string, mode: VariantMode): Promise<string> {
  const conv = await ensureConverter(mode)
  return conv(text)
}
