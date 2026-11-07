/** 字幕引擎：SRT / WebVTT / SBV 互转与时间调整 */

export interface Cue {
  start: number // 秒
  end: number
  text: string
}

export type SubFormat = 'srt' | 'vtt' | 'sbv' | 'txt'

function secToSrt(t: number): string {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  const ms = Math.round((t - Math.floor(t)) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function secToVtt(t: number): string {
  return secToSrt(t).replace(',', '.')
}

function secToSbv(t: number): string {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  const d = Math.round((t - Math.floor(t)) * 1000) / 1000
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(Math.round(d * 1000)).padStart(3, '0')}`
}

function parseTime(s: string): number {
  const m = s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/)
  if (!m) return 0
  const h = Number(m[1] ?? 0)
  const min = Number(m[2])
  const sec = Number(m[3])
  const ms = Number(m[4].padEnd(3, '0'))
  return h * 3600 + min * 60 + sec + ms / 1000
}

/** 自动识别并解析字幕 */
export function parseSubs(input: string): { cues: Cue[]; format: SubFormat } {
  const text = input.replace(/\r\n?/g, '\n').trim()
  if (/^WEBVTT/m.test(text)) return { cues: parseVtt(text), format: 'vtt' }
  if (/^\d+\n\d{1,2}:\d{2}:\d{2}[,.]\d{3} --> /m.test(text) || /--> /.test(text)) {
    return { cues: parseSrt(text), format: 'srt' }
  }
  if (/\d{1,2}:\d{2}:\d{2}[.,]\d{1,3},\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}/.test(text)) {
    return { cues: parseSbv(text), format: 'sbv' }
  }
  return { cues: parseSrt(text), format: 'srt' }
}

export function parseSrt(text: string): Cue[] {
  const cues: Cue[] = []
  const blocks = text.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim().split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n')
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'))
    if (timeLineIdx === -1) continue
    const [a, b] = lines[timeLineIdx].split('-->')
    const body = lines.slice(timeLineIdx + 1).join('\n').trim()
    if (!body) continue
    cues.push({ start: parseTime(a), end: parseTime(b), text: body })
  }
  return cues
}

function parseVtt(text: string): Cue[] {
  return parseSrt(text.replace(/^WEBVTT[^\n]*\n/, ''))
}

function parseSbv(text: string): Cue[] {
  const cues: Cue[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    const m = lines[i].match(/^([\d:.,]+),([\d:.,]+)$/)
    if (!m) continue
    const body: string[] = []
    i++
    while (i < lines.length && lines[i].trim() !== '') {
      body.push(lines[i])
      i++
    }
    if (body.length) cues.push({ start: parseTime(m[1]), end: parseTime(m[2]), text: body.join('\n') })
  }
  return cues
}

export function serializeSubs(cues: Cue[], format: SubFormat): string {
  switch (format) {
    case 'srt':
      return (
        cues
          .map((c, i) => `${i + 1}\n${secToSrt(c.start)} --> ${secToSrt(c.end)}\n${c.text}`)
          .join('\n\n') + '\n'
      )
    case 'vtt':
      return (
        'WEBVTT\n\n' +
        cues.map((c, i) => `${i + 1}\n${secToVtt(c.start)} --> ${secToVtt(c.end)}\n${c.text}`).join('\n\n') +
        '\n'
      )
    case 'sbv':
      return cues.map((c) => `${secToSbv(c.start)},${secToSbv(c.end)}\n${c.text}`).join('\n') + '\n'
    case 'txt':
      return cues.map((c) => c.text).join('\n\n') + '\n'
  }
}

/** 平移时间（秒，可为负） */
export function shiftCues(cues: Cue[], sec: number): Cue[] {
  return cues.map((c) => ({
    ...c,
    start: Math.max(0, c.start + sec),
    end: Math.max(0.1, c.end + sec),
  }))
}

/** 帧率换算（如 25fps 字幕放到 30fps 视频上） */
export function rescaleCues(cues: Cue[], fromFps: number, toFps: number): Cue[] {
  if (fromFps === toFps) return cues
  const r = fromFps / toFps
  return cues.map((c) => ({ ...c, start: c.start * r, end: c.end * r }))
}

/** 去除样式标签与行内标记 */
export function stripCueStyling(cues: Cue[]): Cue[] {
  return cues.map((c) => ({
    ...c,
    text: c.text
      .replace(/<\/?[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .trim(),
  }))
}

/** 合并短句为可读行（按最大时长/字符） */
export function mergeCues(cues: Cue[], maxChars = 42): Cue[] {
  const out: Cue[] = []
  let cur: Cue | null = null
  for (const c of cues) {
    if (cur && (cur.text + c.text).length <= maxChars && c.start - cur.end < 0.6) {
      cur.text = `${cur.text}${cur.text.endsWith('，') || cur.text.endsWith(',') ? '' : ' '}${c.text}`
      cur.end = c.end
    } else {
      if (cur) out.push(cur)
      cur = { ...c }
    }
  }
  if (cur) out.push(cur)
  return out
}

/** 拆分长句（按字符上限均分时间） */
export function splitCues(cues: Cue[], maxChars = 42): Cue[] {
  const out: Cue[] = []
  for (const c of cues) {
    const plain = c.text
    if (plain.length <= maxChars) {
      out.push(c)
      continue
    }
    const n = Math.ceil(plain.length / maxChars)
    const dur = (c.end - c.start) / n
    const size = Math.ceil(plain.length / n)
    for (let i = 0; i < n; i++) {
      out.push({
        start: c.start + i * dur,
        end: c.start + (i + 1) * dur,
        text: plain.slice(i * size, (i + 1) * size),
      })
    }
  }
  return out
}
