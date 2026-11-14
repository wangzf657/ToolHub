/** 字幕引擎：SRT / WebVTT / SBV / ASS 互转与时间调整 */

export interface Cue {
  start: number // 秒
  end: number
  text: string
}

export type SubFormat = 'srt' | 'vtt' | 'sbv' | 'txt' | 'ass'

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
  // ASS/SSA 须在 SBV 之前嗅探：Dialogue 行内的时间对同样命中 SBV 的时间正则
  if (/^\s*\[Script Info\]|^Dialogue:/m.test(text)) return { cues: parseAss(text), format: 'ass' }
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

/* ---------- ASS / SSA（V4+）：样式与元数据不保真，Dialogue 文本与时间轴正确往返 ---------- */

/** 秒 → ASS 时间（H:MM:SS.cc，厘秒精度）：先取整到厘秒再分解，避免 59.996 进位出 "60.00" 的非法时间 */
function secToAss(t: number): string {
  const cs = Math.max(0, Math.round(t * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}

/** 最小可用 ASS 头（播放器可识别；统一输出 Default 样式） */
const ASS_HEADER = [
  '[Script Info]',
  'ScriptType: v4.00+',
  'PlayResX: 1920',
  'PlayResY: 1080',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Default,Microsoft YaHei,64,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,60,60,40,1',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
].join('\n')

/** 解析 ASS/SSA：取 Dialogue 行（含逗号安全拼接），剥大括号特效标签，\N/\n 换行、\h 硬空格还原为纯文本 */
export function parseAss(text: string): Cue[] {
  const cues: Cue[] = []
  for (const line of text.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').split('\n')) {
    if (!line.startsWith('Dialogue:')) continue
    const parts = line.slice('Dialogue:'.length).split(',')
    if (parts.length < 10) continue
    const body = parts
      .slice(9)
      .join(',')
      .replace(/\{[^}]*\}/g, '') // 剥离 {\i1} 等特效/绘制标签
      .replace(/\\[Nn]/g, '\n') // \N 硬换行 / \n 软换行
      .trim()
      .replace(/\\h/g, '\u00A0') // \h 硬空格（trim 后再替换：U+00A0 也属 trim 白名单，行首硬空格才不会被误剥）
    if (!body) continue
    cues.push({ start: parseTime(parts[1] ?? ''), end: parseTime(parts[2] ?? ''), text: body })
  }
  return cues
}

/** 序列化为 ASS：换行还原为 \N、硬空格还原为 \h（保证再解析时行首硬空格不被 trim 剥掉）；时间厘秒精度往返一致 */
export function serializeAss(cues: Cue[]): string {
  const lines = cues.map(
    (c) =>
      `Dialogue: 0,${secToAss(c.start)},${secToAss(c.end)},Default,,0,0,0,,${c.text
        .replace(/\n/g, '\\N')
        .replace(/\u00A0/g, '\\h')}`,
  )
  return `${ASS_HEADER}\n${lines.join('\n')}\n`
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
    case 'ass':
      return serializeAss(cues)
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
