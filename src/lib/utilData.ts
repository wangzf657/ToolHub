/** 教育文化/生活类静态数据：元素周期表布局、历史朝代、服装尺码 */

/* ---------- 元素周期表 18 列布局 ---------- */

export interface PeriodicPos { row: number; col: number }

/** 由原子序数推 (row,col)：主表 1-7 行（镧系锕系放第 9/10 行） */
export function periodicPos(z: number): PeriodicPos {
  if (z === 1) return { row: 1, col: 1 }
  if (z === 2) return { row: 1, col: 18 }
  if (z <= 10) return { row: 2, col: z <= 4 ? z - 2 : z + 8 }
  if (z <= 18) return { row: 3, col: z <= 12 ? z - 10 : z }
  if (z <= 36) return { row: 4, col: z - 18 }
  if (z <= 54) return { row: 5, col: z - 36 }
  if (z <= 56) return { row: 6, col: z - 54 }
  if (z <= 71) return { row: 9, col: z - 54 } // 镧系 La-Lu
  if (z <= 86) return { row: 6, col: z - 68 }
  if (z <= 88) return { row: 7, col: z - 86 }
  if (z <= 103) return { row: 10, col: z - 86 } // 锕系 Ac-Lr
  return { row: 7, col: z - 100 }
}

/** 类别配色（浅底色，适配明暗主题） */
export const PERIODIC_CAT_COLORS: Record<string, string> = {
  非金属: '#86efac',
  稀有气体: '#c4b5fd',
  碱金属: '#fca5a5',
  碱土金属: '#fdba74',
  类金属: '#6ee7b7',
  卤素: '#fde68a',
  贫金属: '#93c5fd',
  过渡金属: '#a5b4fc',
  镧系: '#f0abfc',
  锕系: '#f9a8d4',
  未知: '#d1d5db',
}

export interface PeriodicEl {
  z: number; sym: string; name: string; mass: string; cat: string
  shells: number[]; melt: number | null; boil: number | null; year: string
}

/* ---------- 历史朝代表 ---------- */

export interface Dynasty {
  name: string
  start: string // 展示文本
  end: string
  startNum: number // 排序用（公元前为负年）
  capital: string
  founder: string
}

export const DYNASTIES: Dynasty[] = [
  { name: '夏', start: '约前 2070', end: '约前 1600', startNum: -2070, capital: '阳城（今河南登封一带）', founder: '禹' },
  { name: '商', start: '约前 1600', end: '前 1046', startNum: -1600, capital: '亳 → 殷（今安阳）', founder: '商汤' },
  { name: '西周', start: '前 1046', end: '前 771', startNum: -1046, capital: '镐京（今西安）', founder: '周武王姬发' },
  { name: '东周（春秋·战国）', start: '前 770', end: '前 221', startNum: -770, capital: '洛邑（今洛阳）', founder: '周平王' },
  { name: '秦', start: '前 221', end: '前 207', startNum: -221, capital: '咸阳', founder: '秦始皇嬴政' },
  { name: '西汉', start: '前 202', end: '公元 8', startNum: -202, capital: '长安', founder: '汉高祖刘邦' },
  { name: '新莽', start: '9', end: '23', startNum: 9, capital: '长安', founder: '王莽' },
  { name: '东汉', start: '25', end: '220', startNum: 25, capital: '洛阳', founder: '汉光武帝刘秀' },
  { name: '三国（魏蜀吴）', start: '220', end: '280', startNum: 220, capital: '洛阳 / 成都 / 建业', founder: '曹丕 / 刘备 / 孙权' },
  { name: '西晋', start: '265', end: '316', startNum: 265, capital: '洛阳', founder: '晋武帝司马炎' },
  { name: '东晋 · 十六国', start: '317', end: '420', startNum: 317, capital: '建康（今南京）', founder: '晋元帝司马睿' },
  { name: '南北朝', start: '420', end: '589', startNum: 420, capital: '建康、平城、洛阳等', founder: '刘裕（南朝宋）等' },
  { name: '隋', start: '581', end: '618', startNum: 581, capital: '大兴（今西安）', founder: '隋文帝杨坚' },
  { name: '唐', start: '618', end: '907', startNum: 618, capital: '长安', founder: '唐高祖李渊' },
  { name: '五代十国', start: '907', end: '979', startNum: 907, capital: '开封、洛阳等', founder: '朱温（后梁）等' },
  { name: '辽', start: '916', end: '1125', startNum: 916, capital: '上京（今巴林左旗）', founder: '耶律阿保机' },
  { name: '北宋', start: '960', end: '1127', startNum: 960, capital: '东京（今开封）', founder: '宋太祖赵匡胤' },
  { name: '西夏', start: '1038', end: '1227', startNum: 1038, capital: '兴庆（今银川）', founder: '李元昊' },
  { name: '金', start: '1115', end: '1234', startNum: 1115, capital: '会宁 → 中都（今北京）', founder: '完颜阿骨打' },
  { name: '南宋', start: '1127', end: '1279', startNum: 1127, capital: '临安（今杭州）', founder: '宋高宗赵构' },
  { name: '元', start: '1271', end: '1368', startNum: 1271, capital: '大都（今北京）', founder: '元世祖忽必烈' },
  { name: '明', start: '1368', end: '1644', startNum: 1368, capital: '应天 → 北京', founder: '明太祖朱元璋' },
  { name: '清', start: '1636（入关 1644）', end: '1912', startNum: 1636, capital: '北京', founder: '皇太极（入关后顺治帝）' },
  { name: '中华民国', start: '1912', end: '1949', startNum: 1912, capital: '南京（临时政府）', founder: '孙中山（临时大总统）' },
]

/* ---------- 服装尺码对照（成人口径：身高 cm / 围度 cm） ---------- */

export interface SizeRow {
  intl: string // 国际码
  cn: string // 中国标码（身高）
  eu: string // 欧码
  chest: string // 胸围范围
  waist: string // 腰围范围
  shoulder?: string
}

export interface SizeChart {
  cat: string
  female?: boolean
  rows: SizeRow[]
}

export const SIZE_CHARTS: SizeChart[] = [
  {
    cat: '上衣（男）',
    rows: [
      { intl: 'S', cn: '165/84A', eu: '44', chest: '84–88', waist: '72–76', shoulder: '41–43' },
      { intl: 'M', cn: '170/88A', eu: '48', chest: '88–92', waist: '76–81', shoulder: '43–45' },
      { intl: 'L', cn: '175/92A', eu: '50', chest: '92–97', waist: '81–86', shoulder: '45–47' },
      { intl: 'XL', cn: '180/96A', eu: '52', chest: '97–102', waist: '86–91', shoulder: '47–49' },
      { intl: '2XL', cn: '185/100A', eu: '54', chest: '102–107', waist: '91–96', shoulder: '49–51' },
    ],
  },
  {
    cat: '上衣（女）',
    female: true,
    rows: [
      { intl: 'S', cn: '155/80A', eu: '36', chest: '80–84', waist: '62–66', shoulder: '36–38' },
      { intl: 'M', cn: '160/84A', eu: '38', chest: '84–88', waist: '66–70', shoulder: '38–40' },
      { intl: 'L', cn: '165/88A', eu: '40', chest: '88–92', waist: '70–74', shoulder: '40–42' },
      { intl: 'XL', cn: '170/92A', eu: '42', chest: '92–96', waist: '74–78', shoulder: '42–44' },
      { intl: '2XL', cn: '175/96A', eu: '44', chest: '96–100', waist: '78–82', shoulder: '44–46' },
    ],
  },
  {
    cat: '裤装（男）',
    rows: [
      { intl: 'S', cn: '165/74A', eu: '29', chest: '—', waist: '72–76' },
      { intl: 'M', cn: '170/78A', eu: '31', chest: '—', waist: '76–81' },
      { intl: 'L', cn: '175/82A', eu: '33', chest: '—', waist: '81–86' },
      { intl: 'XL', cn: '180/86A', eu: '35', chest: '—', waist: '86–91' },
      { intl: '2XL', cn: '185/90A', eu: '37', chest: '—', waist: '91–96' },
    ],
  },
  {
    cat: '裤装（女）',
    female: true,
    rows: [
      { intl: 'S', cn: '155/62A', eu: '26', chest: '—', waist: '62–66' },
      { intl: 'M', cn: '160/66A', eu: '28', chest: '—', waist: '66–70' },
      { intl: 'L', cn: '165/70A', eu: '30', chest: '—', waist: '70–74' },
      { intl: 'XL', cn: '170/74A', eu: '32', chest: '—', waist: '74–78' },
      { intl: '2XL', cn: '175/78A', eu: '34', chest: '—', waist: '78–82' },
    ],
  },
  {
    cat: '连衣裙（女）',
    female: true,
    rows: [
      { intl: 'S', cn: '155/80A', eu: '34', chest: '80–84', waist: '62–66' },
      { intl: 'M', cn: '160/84A', eu: '36', chest: '84–88', waist: '66–70' },
      { intl: 'L', cn: '165/88A', eu: '38', chest: '88–92', waist: '70–74' },
      { intl: 'XL', cn: '170/92A', eu: '40', chest: '92–96', waist: '74–78' },
      { intl: '2XL', cn: '175/96A', eu: '42', chest: '96–100', waist: '78–82' },
    ],
  },
  {
    cat: '内衣（女 · 下胸围 cm）',
    female: true,
    rows: [
      { intl: '70A/B', cn: '155/76A', eu: '32', chest: '下围 68–72', waist: 'A 罩杯 ±10 / B 罩杯 ±12.5' },
      { intl: '75A/B', cn: '160/80A', eu: '34', chest: '下围 73–77', waist: 'A 罩杯 ±10 / B 罩杯 ±12.5' },
      { intl: '80A/B', cn: '165/84A', eu: '36', chest: '下围 78–82', waist: 'A 罩杯 ±10 / B 罩杯 ±12.5' },
      { intl: '85A/B', cn: '170/88A', eu: '38', chest: '下围 83–87', waist: 'A 罩杯 ±10 / B 罩杯 ±12.5' },
    ],
  },
  {
    cat: '童装（身高 cm）',
    rows: [
      { intl: '90', cn: '90（约 2 岁）', eu: '2Y', chest: '48–52', waist: '47–51' },
      { intl: '110', cn: '110（约 5 岁）', eu: '5Y', chest: '56–60', waist: '53–57' },
      { intl: '130', cn: '130（约 8 岁）', eu: '8Y', chest: '62–66', waist: '57–61' },
      { intl: '150', cn: '150（约 11 岁）', eu: '11Y', chest: '70–74', waist: '61–65' },
      { intl: '160', cn: '160（约 13 岁）', eu: '13Y', chest: '76–80', waist: '65–69' },
    ],
  },
]

/** 按身高体重粗略推荐国际码（成人上衣口径，仅供参考） */
export function recommendSize(heightCm: number, weightKg: number, female: boolean): string {
  const bmiIdx = weightKg / Math.max(1, (heightCm / 100) ** 2) - 21.5 // 相对标准体型偏移
  let base = heightCm < 158 ? 0 : heightCm < 165 ? 1 : heightCm < 172 ? 2 : heightCm < 179 ? 3 : 4
  if (female) base -= 1
  base += bmiIdx > 2 ? 1 : bmiIdx < -2 ? -1 : 0
  base = Math.min(4, Math.max(0, base))
  return ['S', 'M', 'L', 'XL', '2XL'][base]!
}
