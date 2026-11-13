/**
 * EXIF 扩展解析（ExifViewer 专用，UX1.0 处方 1/3/5）：
 * - 全类型解码（BYTE/ASCII/SHORT/LONG/RATIONAL/SRATIONAL/UNDEFINED）
 * - GPS 四分量换算十进制坐标 + 海拔，外链地图
 * - ≥10 项扩展标签（镜头/白平衡/测光/曝光补偿/色彩空间等）
 * - 单项解析失败跳过不影响整表；EXIF 段截断 / APP2 XMP 检出 → 完整性提示
 */
import type { ExifData } from '@/lib/imageEngine'

export interface ExifEntry {
  group: '相机' | '镜头' | '曝光' | 'GPS' | '其他'
  name: string
  value: string
  /** GPS 行附带的十进制坐标（用于地图外链） */
  geo?: { lat: number; lng: number; latRef: string; lngRef: string }
}

export interface ExifResult {
  entries: ExifEntry[]
  /** 完整性提示（EXIF 段超读取范围 / 存在 XMP） */
  truncated?: string
  gpsCount: number
  hasPrivate: boolean
}

const GROUPS: Record<string, ExifEntry['group']> = {
  相机厂商: '相机', 相机型号: '相机', 机身序列号: '相机', 修改时间: '相机', 拍摄时间: '相机',
  数字化时间: '相机', 版权: '相机', 作者: '相机', 图片描述: '相机', 软件: '相机', 方向: '相机',
  镜头厂商: '镜头', 镜头型号: '镜头', 镜头信息: '镜头', 焦距: '镜头', '焦距(35mm)': '镜头', 光圈值: '镜头', 最大光圈: '镜头',
  曝光时间: '曝光', 'ISO 感光度': '曝光', 曝光程序: '曝光', 曝光补偿: '曝光', 测光模式: '曝光', 闪光灯: '曝光',
  白平衡: '曝光', 曝光模式: '曝光', 场景类型: '曝光', 对比度: '曝光', 饱和度: '曝光', 锐度: '曝光',
  色彩空间: '曝光', 数字变焦: '曝光', 感光度模式: '曝光',
  'GPS 纬度': 'GPS', 'GPS 经度': 'GPS', 'GPS 海拔': 'GPS', 'GPS 时间': 'GPS', 'GPS 版本': 'GPS', 定位方式: 'GPS',
}

const TAGS: Record<number, string> = {
  0x010f: '相机厂商', 0x0110: '相机型号', 0x0112: '方向', 0x0132: '修改时间', 0x013b: '作者',
  0x8298: '版权', 0x829a: '曝光时间', 0x829d: '光圈值', 0x8827: 'ISO 感光度', 0x9003: '拍摄时间',
  0x9004: '数字化时间', 0x920a: '焦距', 0xa002: '图像宽度', 0xa003: '图像高度', 0x8822: '曝光程序',
  0x9209: '闪光灯', 0xa405: '焦距(35mm)', 0x010e: '图片描述', 0x0131: '软件', 0x9204: '曝光补偿',
  0x9207: '测光模式', 0xa001: '色彩空间', 0xa402: '曝光模式', 0xa403: '白平衡', 0xa406: '场景类型',
  0xa408: '对比度', 0xa409: '饱和度', 0xa40a: '锐度', 0xa401: '自定义渲染', 0xa434: '镜头型号',
  0xa433: '镜头厂商', 0xa432: '镜头信息', 0xa431: '机身序列号', 0xa435: '镜头序列号', 0x9202: '最大光圈',
  0xa404: '数字变焦', 0x8830: '感光度模式', 0xa300: '文件来源', 0xa301: '场景判定',
}
const GPS_TAGS: Record<number, string> = {
  1: 'GPS 纬度参考', 2: 'GPS 纬度', 3: 'GPS 经度参考', 4: 'GPS 经度', 5: 'GPS 海拔参考',
  6: 'GPS 海拔', 7: 'GPS 时间', 0: 'GPS 版本', 0x1d: '定位方式',
}

const ENUMS: Record<string, Record<number, string>> = {
  白平衡: { 0: '自动', 1: '手动' },
  测光模式: { 0: '未知', 1: '平均测光', 2: '中央加权平均', 3: '点测光', 4: '多点测光', 5: '评价测光', 6: '局部测光' },
  曝光程序: { 0: '未定义', 1: '手动', 2: '程序自动', 3: '光圈优先', 4: '快门优先', 5: '创意(慢门)', 6: '动作(高速)', 7: '人像', 8: '风景', 9: 'B 门' },
  曝光模式: { 0: '自动', 1: '手动', 2: '自动包围' },
  场景类型: { 0: '标准', 1: '人像', 2: '风景', 3: '夜景', 4: '其他' },
  对比度: { 0: '正常', 1: '低', 2: '高' },
  饱和度: { 0: '正常', 1: '低', 2: '高' },
  锐度: { 0: '正常', 1: '低', 2: '高' },
  色彩空间: { 1: 'sRGB', 0xffff: '未校准' },
  方向: { 1: '正常', 2: '水平翻转', 3: '旋转 180°', 4: '垂直翻转', 5: '转置', 6: '顺时针 90°', 7: '横向翻转', 8: '逆时针 90°' },
  感光度模式: { 0: '未知', 1: '手动', 2: '自动' },
  自定义渲染: { 0: '正常', 1: '自定义' },
}

function dms(parts: number[], ref: string): { dec: number; text: string } {
  const [d = 0, m = 0, s = 0] = parts
  const dec = (d + m / 60 + s / 3600) * (ref === 'S' || ref === 'W' ? -1 : 1)
  return { dec, text: `${Math.abs(dec).toFixed(4)}°${ref || ''}` }
}

function fmtRatio(n: number, d: number, signed = false): string {
  if (!d) return String(n)
  const v = n / d
  if (Math.abs(v) >= 100) return String(Math.round(v))
  return `${signed && v > 0 ? '+' : ''}${Number.isInteger(v) ? v : v.toFixed(v >= 10 ? 1 : 2)}`
}

/** 主入口：解析 JPEG EXIF（TIFF 结构段），失败单项跳过 */
export async function parseExifExtended(file: File | Blob): Promise<ExifResult> {
  const out: ExifResult = { entries: [], gpsCount: 0, hasPrivate: false }
  let buf: Uint8Array
  try {
    buf = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer())
  } catch {
    return out
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return out
  let i = 2
  let app2Xmp = false
  let exifSegSize = 0
  try {
    while (i < buf.length - 4) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]!
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      if (marker === 0xda) break // SOS：正文开始
      const len = (buf[i + 2]! << 8) | buf[i + 3]!
      if (marker === 0xe1 && !exifSegSize) {
        const sig = 'Exif\0\0'
        let ok = true
        for (let k = 0; k < sig.length; k++) if (buf[i + 4 + k] !== sig.charCodeAt(k)) ok = false
        if (ok) {
          exifSegSize = len
          parseTiffBody(buf, i + 10, out)
        }
      }
      if (marker === 0xe2) {
        // APP2 可能承载 XMP（http://ns.adobe.com/xap/1.0/）
        const sig = 'http://ns.adobe.com/xap/1.0/'
        let ok = true
        for (let k = 0; k < sig.length; k++) if (buf[i + 4 + k] !== sig.charCodeAt(k)) ok = false
        if (ok) app2Xmp = true
      }
      i += 2 + len
    }
  } catch { /* 逐段容错，已解析部分保留 */ }
  if (exifSegSize > buf.length - (i - exifSegSize) || exifSegSize >= 65000) {
    out.truncated = 'EXIF 段较大，仅解析了前 1MB 内的元数据'
  }
  if (app2Xmp) {
    out.truncated = out.truncated ? `${out.truncated}；检测到 XMP 元数据段（未读取）` : '检测到 XMP 元数据段（未读取）'
  }
  out.hasPrivate = out.entries.some(
    (e) => e.name.includes('GPS') || e.name === '机身序列号' || e.name === '镜头序列号' || e.name === '作者',
  )
  return out
}

function parseTiffBody(buf: Uint8Array, base: number, out: ExifResult): void {
  const le = buf[base] === 0x49
  const u16 = (o: number) => (le ? buf[base + o]! | (buf[base + o + 1]! << 8) : (buf[base + o]! << 8) | buf[base + o + 1]!)
  const u32 = (o: number) =>
    le
      ? buf[base + o]! | (buf[base + o + 1]! << 8) | (buf[base + o + 2]! << 16) | (buf[base + o + 3]! << 24)
      : (buf[base + o]! << 24) | (buf[base + o + 1]! << 16) | (buf[base + o + 2]! << 8) | buf[base + o + 3]!
  const SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }
  const ifd0 = u32(4)

  const readIfd = (off: number, tags: Record<number, string>, gps: boolean) => {
    const n = u16(off)
    if (n <= 0 || n > 512) return
    const raw: Record<string, string> = {}
    for (let k = 0; k < n; k++) {
      try {
        const e = off + 2 + k * 12
        const tag = u16(e)
        const type = u16(e + 2)
        const cnt = u32(e + 4)
        const name = tags[tag]
        if (!name || !SIZES[type]) continue
        const unit = SIZES[type]!
        const inline = cnt * unit <= 4
        const valOff = inline ? e + 8 : base + u32(e + 8)
        const rd = (idx: number): number => {
          const o = valOff + idx * unit
          if (type === 3) return u16(o - base)
          if (type === 4) return u32(o - base)
          if (type === 5) return u32(o - base) / (u32(o - base + 4) || 1)
          if (type === 10) {
            const den = u32(o - base + 4) || 1
            return (u32(o - base) | 0) / den
          }
          return buf[o]!
        }
        if (gps) {
          raw[name] = ''
          if (tag === 2 || tag === 4) {
            const parts = [rd(0), rd(1), rd(2)]
            const ref = tag === 2 ? raw['GPS 纬度参考'] || 'N' : raw['GPS 经度参考'] || 'E'
            const { dec, text } = dms(parts, ref)
            raw[name] = text
            if (tag === 2) raw.__lat = String(dec)
            else raw.__lng = String(dec)
          } else if (tag === 1 || tag === 3) {
            raw[name] = String.fromCharCode(rd(0))
          } else if (tag === 6) {
            const alt = rd(0)
            raw[name] = `${Math.round(alt)} 米${raw['GPS 海拔参考'] === '1' ? '（海平面下）' : ''}`
          } else if (tag === 7) {
            const h = Math.floor(rd(0)), m = Math.floor(rd(1)), s = Math.round(rd(2))
            raw[name] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`
          } else if (tag === 0x1d) {
            raw[name] = 'GPS（卫星定位）'
          } else if (tag === 0) {
            raw[name] = `GPS ${rd(0)}.${rd(1)}.${rd(2)}`
          }
          continue
        }
        let value = ''
        if (type === 2) {
          let s = ''
          for (let c = 0; c < cnt - 1 && valOff + c < buf.length; c++) s += String.fromCharCode(buf[valOff + c]!)
          value = s.trim()
        } else if (ENUMS[name] !== undefined) {
          value = ENUMS[name]![rd(0)] ?? String(rd(0))
        } else if (type === 5 || type === 10) {
          if (name === '曝光时间') {
            const d = rd(0) / (rd(1) || 1)
            value = d >= 1 ? `${d.toFixed(1)}s` : `1/${Math.round(1 / d)}s`
          } else if (name === '曝光补偿') {
            value = `${fmtRatio(rd(0), rd(1) || 1, true)} EV`
          } else if (name === '焦距' || name === '焦距(35mm)') {
            value = `${fmtRatio(rd(0), rd(1) || 1)} mm`
          } else if (name === '光圈值' || name === '最大光圈') {
            value = `f/${(rd(0) / (rd(1) || 1)).toFixed(1)}`
          } else if (name === '镜头信息') {
            value = `${fmtRatio(rd(0), rd(1) || 1)}-${fmtRatio(rd(2), rd(3) || 1)}mm f/${(rd(4) / (rd(5) || 1)).toFixed(1)}-${(rd(6) / (rd(7) || 1)).toFixed(1)}`
          } else {
            value = fmtRatio(rd(0), rd(1) || 1)
          }
        } else {
          value = String(rd(0))
        }
        if (value) raw[name] = value
      } catch { /* 单项失败跳过 */ }
    }
    for (const [name, value] of Object.entries(raw)) {
      if (name.startsWith('__')) continue
      out.entries.push({ group: GROUPS[name] ?? '其他', name, value })
    }
    // GPS 汇总行：十进制坐标 + 地图外链
    const lat = raw.__lat
    const lng = raw.__lng
    if (lat !== undefined && lng !== undefined) {
      out.gpsCount++
      out.entries.push({
        group: 'GPS',
        name: 'GPS 坐标',
        value: `${raw['GPS 纬度'] ?? lat}, ${raw['GPS 经度'] ?? lng}（${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}）`,
        geo: { lat: Number(lat), lng: Number(lng), latRef: raw['GPS 纬度参考'] || 'N', lngRef: raw['GPS 经度参考'] || 'E' },
      })
    }
  }

  readIfd(ifd0, TAGS, false)
  const n0 = u16(ifd0)
  for (let k = 0; k < n0; k++) {
    const e = ifd0 + 2 + k * 12
    if (u16(e) === 0x8825) {
      readIfd(base + u32(e + 8), GPS_TAGS, true)
      break
    }
  }
}
