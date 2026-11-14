/**
 * 代码压缩核心（组件与测试同源，可测性提取）：语言自动识别 + terser/csso 压缩。
 * 组件薄壳只做输入交互；QA 金标准直接调用本模块（断言与 UI 两个实现不漂移）。
 */

export type MinifyLang = 'auto' | 'js' | 'css'

/** 语言自动识别：CSS 特征（属性声明/at 规则）与 JS 关键字得分对比 */
export function detectLang(t: string): 'css' | 'js' {
  const cssHits = (t.match(/[{;]\s*[-\w]+\s*:\s*[^;{}]+;/g) ?? []).length + (t.match(/@(media|import|charset|font-face|keyframes|supports)\b/g) ?? []).length
  const jsHits = (t.match(/\b(function|const|let|var|return|import|export|class)\b|=>/g) ?? []).length
  return cssHits > jsHits ? 'css' : 'js'
}

/** 压缩：CSS 走 csso，JS 走 terser（mangleTop 激进档 toplevel 重命名，模块代码用） */
export async function minifyCode(t: string, lang: MinifyLang, mangleTop = false): Promise<{ out: string; engine: 'JS/terser' | 'CSS/csso' }> {
  const isCss = lang === 'css' || (lang === 'auto' && detectLang(t) === 'css')
  try {
    if (isCss) {
      const csso = await import('csso')
      return { out: csso.minify(t).css, engine: 'CSS/csso' }
    }
    const { minify } = await import('terser')
    const r = await minify(t, {
      module: mangleTop, // 激进档：toplevel mangle 重命名顶层变量
      compress: true,
      mangle: mangleTop ? { toplevel: true } : true,
      format: { comments: false },
    })
    return { out: r.code ?? '', engine: 'JS/terser' }
  } catch (e) {
    // 中文守卫提示（与组件 toast 同文案）：语法错误是最高频失败原因
    throw new Error(`压缩失败：${(e as Error).message}（请确认代码语法正确，或手动指定语言）`)
  }
}
