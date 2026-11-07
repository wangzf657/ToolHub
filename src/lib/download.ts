/** 统一下载能力：单文件、多文件打包 ZIP */

async function zipLib() {
  return import('jszip')
}

/** 保存一个 Blob 为文件下载 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

/** 保存文本为文件 */
export function saveText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  saveBlob(new Blob([text], { type: mime }), filename)
}

/** 批量保存：单文件直接下，多文件打 ZIP */
export async function saveMany(files: { name: string; blob: Blob }[], zipName: string): Promise<void> {
  if (files.length === 0) return
  if (files.length === 1) {
    saveBlob(files[0].blob, files[0].name)
    return
  }
  const { default: JSZip } = await zipLib()
  const zip = new JSZip()
  const used = new Set<string>()
  for (const f of files) {
    let name = f.name
    let i = 2
    while (used.has(name)) {
      const dot = f.name.lastIndexOf('.')
      name = dot > 0 ? `${f.name.slice(0, dot)}-${i}${f.name.slice(dot)}` : `${f.name}-${i}`
      i++
    }
    used.add(name)
    zip.file(name, f.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveBlob(blob, zipName)
}

/** 复制文本到剪贴板，失败时返回 false */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      return true
    } catch {
      return false
    }
  }
}

/** 从文件名截取不含扩展名的部分 */
export function baseName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

/** 换扩展名 */
export function withExt(name: string, ext: string): string {
  return `${baseName(name)}.${ext}`
}
