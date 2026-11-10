# -*- coding: utf-8 -*-
"""utility 注册表追加 P2 批次 35 件（教育文化/画布/生活/娱乐/创作）。"""
import io

p = 'src/tools/utility/registry.ts'
s = io.open(p, encoding='utf-8').read()

ADD = r'''  {
    slug: 'idiom-dictionary', title: '成语词典', category: 'utility',
    desc: '三万条成语随查随用：拼音、释义、出处、例句，支持成语接龙与随机抽读。',
    keywords: ['成语', '词典', '接龙', '释义'],
    needModel: true,
    component: () => import('./components/IdiomDictionary.vue'),
  },
  {
    slug: 'xiehouyu-lookup', title: '歇后语查询', category: 'utility',
    desc: '一万四千条歇后语检索与随机抽签，写作聊天趣味加分。',
    keywords: ['歇后语', '俗语', '谜语'],
    needModel: true,
    component: () => import('./components/XiehouyuLookup.vue'),
  },
  {
    slug: 'hanzi-stroke-order', title: '汉字笔顺演示', category: 'utility',
    desc: '逐字播放标准笔顺动画，支持描红练习，家长辅导语文神器。',
    keywords: ['笔顺', '汉字', '描红', '笔画'],
    needModel: true,
    component: () => import('./components/HanziStrokeOrder.vue'),
    steps: ['输入一个汉字', '点播放看笔顺动画', '切描红模式用鼠标描写'],
  },
  {
    slug: 'poem-search', title: '古诗词检索', category: 'utility',
    desc: '唐诗三百首 + 宋词三百首精选语料，按题目、作者、名句即时检索。',
    keywords: ['古诗词', '唐诗', '宋词', '诗句'],
    component: () => import('./components/PoemSearch.vue'),
  },
  {
    slug: 'phonetic-lookup', title: '英语音标查询', category: 'utility',
    desc: '两万高频词英美音标与中文释义速查，背单词发音参考。',
    keywords: ['音标', '发音', '词典', '英语'],
    needModel: true,
    component: () => import('./components/PhoneticLookup.vue'),
  },
  {
    slug: 'periodic-table', title: '元素周期表', category: 'utility',
    desc: '交互式 118 元素周期表：类别着色、性质速查、按符号或中文名搜索。',
    keywords: ['元素周期表', '化学', '元素'],
    needModel: true,
    component: () => import('./components/PeriodicTable.vue'),
  },
  {
    slug: 'dynasty-timeline', title: '历史朝代表', category: 'utility',
    desc: '从夏商周到明清的朝代时间轴与速查表，含都城与建立者。',
    keywords: ['朝代', '历史', '时间轴'],
    component: () => import('./components/DynastyTimeline.vue'),
  },
  {
    slug: 'university-lookup', title: '全国高校查询', category: 'utility',
    desc: '公办本科名单按省份、类别与 985/211/双一流标签筛选。',
    keywords: ['高校', '大学', '985', '高考'],
    needModel: true,
    component: () => import('./components/UniversityLookup.vue'),
  },
  {
    slug: 'latex-editor', title: 'LaTeX 公式编辑器', category: 'utility',
    desc: 'KaTeX 实时渲染数学公式，常用模板一键插入，导出高清 PNG。',
    keywords: ['latex', '公式', '数学', 'katex'],
    component: () => import('./components/LatexEditor.vue'),
  },
  {
    slug: 'sudoku-solver', title: '数独生成与求解', category: 'utility',
    desc: '三档难度出题（唯一解）、冲突标红、逐格提示，也可手输题目求解。',
    keywords: ['数独', 'sudoku', '解谜'],
    component: () => import('./components/SudokuSolver.vue'),
  },
  {
    slug: 'whiteboard', title: '在线白板', category: 'utility',
    desc: '画笔/直线/矩形/椭圆/文字随手涂画，撤销重做，导出 PNG。',
    keywords: ['白板', '涂鸦', '画板', '草图'],
    component: () => import('./components/Whiteboard.vue'),
  },
  {
    slug: 'er-diagram-editor', title: '数据库 ER 图设计器', category: 'utility',
    desc: '拖拽建表、连线标外键，导出 MySQL 建表 SQL 与设计图 PNG。',
    keywords: ['er图', '数据库', '建表', 'sql'],
    component: () => import('./components/ErDiagramEditor.vue'),
  },
  {
    slug: 'kids-coloring', title: '儿童涂色画板', category: 'utility',
    desc: '六款原创线稿点选填色，可打印成涂色卡，亲子手工首选。',
    keywords: ['涂色', '儿童', '画画', '亲子'],
    component: () => import('./components/KidsColoring.vue'),
  },
  {
    slug: 'garbage-classifier', title: '垃圾分类查询', category: 'utility',
    desc: '四千条常见物品干湿/可回收/有害分类速查（上海四分类口径）。',
    keywords: ['垃圾分类', '干垃圾', '湿垃圾'],
    needModel: true,
    component: () => import('./components/GarbageClassifier.vue'),
  },
  {
    slug: 'food-calorie-lookup', title: '食物热量速查', category: 'utility',
    desc: '常见食物热量与三大营养素查询，可逐项加入「一餐」累计。',
    keywords: ['食物热量', '卡路里', '营养'],
    needModel: true,
    component: () => import('./components/FoodCalorieLookup.vue'),
  },
  {
    slug: 'invoice-assistant', title: '发票抬头助手', category: 'utility',
    desc: '抬头信息生成二维码与文本，前台扫码开票，多抬头本机保存。',
    keywords: ['发票', '抬头', '开票', '税号'],
    component: () => import('./components/InvoiceAssistant.vue'),
  },
  {
    slug: 'mbti-personality-test', title: 'MBTI 人格测试', category: 'utility',
    desc: '28 题快速版 MBTI 自测，四维度百分比与类型解读，娱乐向。',
    keywords: ['mbti', '人格', '性格测试'],
    component: () => import('./components/MbtiTest.vue'),
    steps: ['凭直觉答完 28 题', '查看四维度倾向', '复制结果分享'],
  },
  {
    slug: 'digital-muyu', title: '电子木鱼', category: 'utility',
    desc: '敲木鱼积功德，敲击音效与连击动效，解压摸鱼神器（可挂机）。',
    keywords: ['木鱼', '功德', '解压'],
    component: () => import('./components/DigitalMuyu.vue'),
  },
  {
    slug: 'handheld-marquee', title: '手持弹幕 LED', category: 'utility',
    desc: '全屏滚动大字：接机、演唱会应援、直播间标语，支持镜像翻转。',
    keywords: ['弹幕', 'led', '接机', '应援'],
    component: () => import('./components/HandheldMarquee.vue'),
  },
  {
    slug: 'teleprompter', title: '提词器', category: 'utility',
    desc: '口播录制全屏匀速滚动台词，可调速、镜像与焦点线，滚完自停。',
    keywords: ['提词器', '口播', '台词', '直播'],
    component: () => import('./components/Teleprompter.vue'),
  },
  {
    slug: 'online-piano', title: '虚拟钢琴', category: 'utility',
    desc: '一个半八度虚拟键盘，鼠标点击或键盘映射弹奏，音色本地合成。',
    keywords: ['钢琴', '键盘', '乐器', '弹奏'],
    component: () => import('./components/OnlinePiano.vue'),
  },
  {
    slug: 'qr-code-repair', title: '二维码修复', category: 'utility',
    desc: '识别模糊、带 Logo 的旧二维码，重新生成高纠错的干净新码。',
    keywords: ['二维码修复', '模糊', '去logo'],
    component: () => import('./components/QrCodeRepair.vue'),
  },
  {
    slug: 'seal-generator', title: '印章示意图生成', category: 'utility',
    desc: '圆形/椭圆章风格示意图（弧形文字+五角星），文档示意与 PPT 配图。',
    keywords: ['印章', '示意图', '图章'],
    component: () => import('./components/SealGenerator.vue'),
  },
  {
    slug: 'name-generator', title: '随机起名器', category: 'utility',
    desc: '按风格与性别偏好批量生成中文名（附拼音），起名灵感参考。',
    keywords: ['起名', '取名', '名字生成'],
    component: () => import('./components/NameGenerator.vue'),
  },
  {
    slug: 'avatar-generator', title: '随机头像生成器', category: 'utility',
    desc: '八种 DiceBear 风格按 seed 生成稳定头像，批量导出 PNG。',
    keywords: ['头像', '生成器', 'dicebear', '卡通'],
    component: () => import('./components/AvatarGenerator.vue'),
  },
  {
    slug: 'text-to-handwriting', title: '手写体文字图', category: 'utility',
    desc: '文字渲染成楷体「手写作业」图（横线/方格纸+抖动），导出 PNG/PDF。',
    keywords: ['手写体', '作业', '楷体', '生成'],
    component: () => import('./components/TextToHandwriting.vue'),
  },
  {
    slug: 'text-behind-image', title: '文字藏于主体后', category: 'utility',
    desc: '海报级效果：大字被人像/主体遮挡，色键抠图本地完成无需模型。',
    keywords: ['文字遮挡', '海报', '抠图'],
    component: () => import('./components/TextBehindImage.vue'),
  },
  {
    slug: 'calendar-printer', title: '可打印日历', category: 'utility',
    desc: '带农历与法定节假日的月历/年历，打印或导出 PNG，可做桌面日历。',
    keywords: ['日历', '打印', '年历', '农历'],
    component: () => import('./components/CalendarPrinter.vue'),
  },
  {
    slug: 'citation-generator', title: '参考文献引用生成', category: 'utility',
    desc: '按 GB/T 7714-2015 与 APA 7 生成图书/期刊/网页等文献引用。',
    keywords: ['参考文献', '引用', 'gb7714', 'apa', '论文'],
    calcDef: {
      fields: [
        { key: 'type', label: '文献类型', type: 'select', default: 'journal', choices: [
          { value: 'book', label: '图书 [M]' }, { value: 'journal', label: '期刊论文 [J]' },
          { value: 'thesis', label: '学位论文 [D]' }, { value: 'web', label: '网页/电子资源 [EB/OL]' },
          { value: 'conference', label: '会议论文 [C]' },
        ] },
        { key: 'authors', label: '作者（多人用逗号分隔）', type: 'text', default: '' },
        { key: 'title', label: '题名', type: 'text', default: '' },
        { key: 'year', label: '年份', type: 'text', default: '' },
        { key: 'journal', label: '期刊名 / 会议名 / 学校', type: 'text', default: '', hint: '按类型填写对应项' },
        { key: 'volume', label: '卷期（如 45(3)）', type: 'text', default: '' },
        { key: 'pages', label: '页码（如 12-18）', type: 'text', default: '' },
        { key: 'url', label: '网址（网页类）', type: 'text', default: '' },
      ],
      compute: (v) => {
        const f = {
          type: String(v.type),
          authors: String(v.authors ?? ''),
          title: String(v.title ?? ''),
          year: String(v.year ?? ''),
          journal: String(v.journal ?? ''),
          volume: String(v.volume ?? ''),
          pages: String(v.pages ?? ''),
          url: String(v.url ?? ''),
        }
        if (!f.title) return [{ label: '请填写题名', value: '—' }]
        const r = formatCitation(f)
        return [
          { label: 'GB/T 7714-2015', value: r.gb, primary: true },
          { label: 'APA 7', value: r.apa },
        ]
      },
      note: '口径：GB/T 7714-2015 顺序编码制与 APA 第 7 版常用格式；投稿前请以目标期刊/学校的格式要求逐项核对。',
    },
  },
  {
    slug: 'blood-type-inheritance', title: '血型遗传计算', category: 'utility',
    desc: '父母 ABO 血型推出子女可能血型，附 Rh 血型说明。',
    keywords: ['血型', '遗传', 'abo'],
    calcDef: {
      fields: [
        { key: 'fa', label: '父亲血型', type: 'select', default: 'A', choices: [
          { value: 'A', label: 'A 型' }, { value: 'B', label: 'B 型' }, { value: 'AB', label: 'AB 型' }, { value: 'O', label: 'O 型' },
        ] },
        { key: 'mo', label: '母亲血型', type: 'select', default: 'B', choices: [
          { value: 'A', label: 'A 型' }, { value: 'B', label: 'B 型' }, { value: 'AB', label: 'AB 型' }, { value: 'O', label: 'O 型' },
        ] },
      ],
      compute: (v) => {
        const r = bloodInherit(v.fa as never, v.mo as never)
        const fmt = (arr: string[]) => arr.map((x) => x + ' 型').join('、')
        return [
          { label: '子女可能血型', value: fmt(r.possible), primary: true },
          { label: '子女不可能血型', value: r.impossible.length ? fmt(r.impossible) : '四种都有可能' },
          { label: 'Rh 血型说明', value: 'Rh+ 为显性遗传，父母均 Rh− 时子女必为 Rh−；其余组合以血检为准' },
        ]
      },
      note: '口径：ABO 血型按 AB 显性遗传规则推导可能集；极罕见孟买血型等例外未计入，实际以实验室血型鉴定为准。',
    },
  },
  {
    slug: 'clothing-size-chart', title: '服装尺码对照', category: 'utility',
    desc: '男女上衣/裤装尺码对照（国际/中国/身高体重推荐），海淘购物参考。',
    keywords: ['尺码', '服装', '衣服尺码', '海淘'],
    calcDef: {
      fields: [
        { key: 'sex', label: '性别', type: 'select', default: 'male', choices: [{ value: 'male', label: '男装' }, { value: 'female', label: '女装' }] },
        { key: 'kind', label: '品类', type: 'select', default: 'top', choices: [
          { value: 'top', label: '上装（T恤/衬衫/外套）' }, { value: 'pants', label: '裤装' },
        ] },
        { key: 'h', label: '身高', type: 'number', default: '', suffix: 'cm' },
        { key: 'w', label: '体重', type: 'number', default: '', suffix: 'kg' },
      ],
      compute: (v) => {
        const female = v.sex === 'female'
        const kind = v.kind === 'pants' ? 'pants' : 'top'
        const h = Number(v.h), w = Number(v.w)
        if (!(h > 0 && w > 0)) return [{ label: '请填写身高与体重', value: '—' }]
        const rec = recommendSize(h, w, female)
        const chart = SIZE_CHARTS.find((c) => c.sex === (female ? 'female' : 'male') && c.kind === kind)
        if (!chart) return [{ label: '暂无该品类对照', value: '—' }]
        const rows: CalcResultRow[] = chart.rows.map((r) => ({
          label: `${r.intl}（中国 ${r.cn}）`,
          value: `身高 ${r.height} · ${r.detail}`,
        }))
        rows.unshift({ label: '按身高体重推荐', value: rec, primary: true, hint: '宽松/修身偏好请上下调一档' })
        return rows
      },
      note: '口径：常见休闲服装版型对照表，不同品牌剪裁差异大（修身/宽松），以具体商品尺码表为准。',
    },
  },
  {
    slug: 'address-parser', title: '收货地址解析', category: 'utility',
    desc: '乱序地址智能拆出省/市/区/详细地址，支持批量，电商打单利器。',
    keywords: ['地址解析', '地址库', '省市区', '打单'],
    textDef: {
      options: [
        { key: 'fmt', label: '输出格式', type: 'select', default: 'lines', choices: [
          { value: 'lines', label: '分行（省/市/区/详址）' }, { value: 'csv', label: 'CSV（一行一条）' },
        ] },
      ],
      placeholder: '每行一条地址，支持乱序，如：上海市浦东新区张江高科技园区博云路2号 13800000000 王小明',
      transform: async (t, o) => parseAddresses(t, o.fmt === 'csv'),
    },
  },
  {
    slug: 'retirement-calculator', title: '退休年龄计算', category: 'utility',
    desc: '按渐进式延迟退休新政推算法定退休年月与距今年数。',
    keywords: ['退休', '延迟退休', '退休年龄'],
    calcDef: {
      fields: [
        { key: 'kind', label: '人员类别', type: 'select', default: 'male', choices: RETIRE_KINDS.map((k) => ({ value: k.value, label: k.label })) },
        { key: 'birth', label: '出生年月', type: 'date', default: '' },
      ],
      compute: (v) => {
        const birth = String(v.birth ?? '')
        if (!birth) return [{ label: '请选择出生年月', value: '—' }]
        const r = retirementFor(birth, v.kind as never)
        if (!r) return [{ label: '日期无效', value: '请检查出生年月' }]
        return [
          { label: '法定退休时间', value: r.retireYm, primary: true },
          { label: '退休年龄', value: r.retireAgeText },
          { label: '距离退休', value: r.yearsToGo },
          { label: '缴费年限参考', value: r.contribYearsText },
        ]
      },
      note: '口径：2024 年全国人大常委会「渐进式延迟法定退休年龄」决定（自 2025-01-01 起按每 4 个月延迟 1 个月）；实际以社保经办机构核定为准。',
    },
  },
  {
    slug: 'shelf-life-calculator', title: '保质期计算器', category: 'utility',
    desc: '生产日期 + 保质期算到期日与剩余天数，食品药妆临期提醒。',
    keywords: ['保质期', '到期日', '临期'],
    calcDef: {
      fields: [
        { key: 'prod', label: '生产日期', type: 'date', default: '' },
        { key: 'n', label: '保质期数值', type: 'number', default: 12 },
        { key: 'unit', label: '单位', type: 'select', default: 'month', choices: [
          { value: 'day', label: '天' }, { value: 'month', label: '月' }, { value: 'year', label: '年' },
        ] },
      ],
      compute: (v) => {
        const prod = String(v.prod ?? '')
        const n = Number(v.n)
        if (!prod || !(n > 0)) return [{ label: '请填写生产日期与保质期', value: '—' }]
        const [y, m, d] = prod.split('-').map(Number)
        const exp = new Date(y!, m! - 1, d!)
        if (v.unit === 'month') exp.setMonth(exp.getMonth() + Math.round(n))
        else if (v.unit === 'year') exp.setFullYear(exp.getFullYear() + Math.round(n))
        else exp.setDate(exp.getDate() + Math.round(n))
        const days = Math.ceil((exp.getTime() - Date.now()) / 86400000)
        const state = days < 0 ? `已过期 ${-days} 天` : days <= 7 ? `⚠ 临期，仅剩 ${days} 天` : `剩余 ${days} 天`
        return [
          { label: '到期日期', value: `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`, primary: true },
          { label: '状态', value: state, primary: days < 0 },
        ]
      },
      note: '口径：按整月/整年顺延（如 1-31 + 1 月 → 2-28/29 回退）；开封后保质期与标注不同，请以包装说明为准。',
    },
  },
  {
    slug: 'shift-schedule-calculator', title: '倒班排班计算', category: 'utility',
    desc: '两班倒/三班倒/四班三运转：锚定班次查任意日期，快速排班参考。',
    keywords: ['倒班', '排班', '三班倒', '班次'],
    calcDef: {
      fields: [
        { key: 'model', label: '班制', type: 'select', default: 'two', choices: SHIFT_MODELS.map((m) => ({ value: m.id, label: m.label })) },
        { key: 'anchor', label: '锚点日期（该天上的班次）', type: 'date', default: '' },
        { key: 'anchorIdx', label: '锚点当天是第几班（从 0 开始）', type: 'number', default: 0 },
        { key: 'query', label: '查询日期', type: 'date', default: '' },
      ],
      compute: (v) => {
        const model = SHIFT_MODELS.find((m) => m.id === v.model)
        const anchor = String(v.anchor ?? '')
        const query = String(v.query ?? '')
        if (!model || !anchor || !query) return [{ label: '请选择班制并填写两个日期', value: '锚点=你知道班次的某一天' }]
        const r = shiftOn(model, anchor, Math.max(0, Math.round(Number(v.anchorIdx) || 0)), query)
        return [
          { label: `${query} 的班次`, value: r.name, primary: true },
          { label: '周期位置', value: `第 ${r.cyclePos + 1} 天 / 共 ${model.cycle} 天` },
          { label: '班制说明', value: model.desc },
        ]
      },
      note: '口径：以「周期天数 + 锚点」线性推算；节假日是否上班与调休由单位排班表决定，本工具只按固定周期推算。',
    },
  },
]

export default tools'''

ANCHOR = """    component: () => import('./components/KeyboardTest.vue'),
  },
]

export default tools"""
assert ANCHOR in s, 'anchor missing'
s = s.replace(ANCHOR, """    component: () => import('./components/KeyboardTest.vue'),
  },
""" + ADD)

# imports
s = s.replace(
    "import { idCardValid, cnDate, phoneCarrier } from '@/lib/validators'",
    "import { idCardValid, cnDate, phoneCarrier } from '@/lib/validators'\n"
    "import { retirementFor, RETIRE_KINDS, shiftOn, SHIFT_MODELS, bloodInherit, formatCitation } from '@/lib/utilLife'\n"
    "import { SIZE_CHARTS, recommendSize } from '@/lib/utilData'\n"
    "import { parseAddresses } from '@/lib/textExt'")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('utility P2 ok, slug count:', s.count("slug: '"))
