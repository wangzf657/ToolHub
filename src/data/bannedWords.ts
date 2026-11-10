/** 广告法/平台违禁词库（核心词表内置，按类别分组；页面提示仅供参考，以最新法规与平台规则为准） */

export interface BannedWord {
  w: string
  cat: 'extreme' | 'authority' | 'medical' | 'finance' | 'platform'
  fix?: string // 建议替换
}

export const BAN_CATS: Record<BannedWord['cat'], string> = {
  extreme: '极限用语',
  authority: '权威背书',
  medical: '医疗功效',
  finance: '收益承诺',
  platform: '平台风险词',
}

const M = (w: string, fix?: string): BannedWord => ({ w, cat: 'extreme', fix })
const D: BannedWord[] = [
  // —— 极限用语（广告法第九条重点）——
  M('第一', '领先 / 靠前'),
  M('最', '更 / 较'),
  M('顶级', '高端'),
  M('顶尖', '高端'),
  M('极致', '出色'),
  M('极品', '优选'),
  M('绝对', '相对'),
  M('绝对值', undefined),
  M('终极', '进阶'),
  M('万能', '多功能'),
  M('全国第一', '广受欢迎'),
  M('全网第一', '广受欢迎'),
  M('全球第一', '广受欢迎'),
  M('销量第一', '销量领先'),
  M('No.1', '广受欢迎'),
  M('TOP1', '广受欢迎'),
  M('排名第一', '排名靠前'),
  M('首个', '较早'),
  M('首款', '旗下新品'),
  M('第一个', '较早的'),
  M('唯一', '少有'),
  M('独家', '自研 / 特色'),
  M('独一无二', '有特色'),
  M('史无前例', '少有'),
  M('空前', '少有'),
  M('绝无仅有', '少见'),
  M('史前', undefined),
  M('空前绝后', undefined),
  M('最新', '新'),
  M('最低价', '优惠价'),
  M('最便宜', '实惠'),
  M('最先进', '先进'),
  M('最新科学', '新'),
  M('最先进加工工艺', '先进工艺'),
  M('最后一波', '近期活动'),
  M('最时尚', '时尚'),
  M('最受欢迎', '广受欢迎'),
  M('最完美', '完善'),
  M('最佳', '优质'),
  M('最优', '优'),
  M('最大', '大'),
  M('最强', '强'),
  M('最高级', '高级'),
  M('最好', '好'),
  M('最大程度', '较大程度'),
  M('百分之百', '大部分'),
  M('100%', undefined),
  M('彻底', '有效'),
  M('永久', '长期'),
  M('永久性', '长期'),
  M('终身', '长期'),
  M('终身免费', '长期免费'),
  M('绝版', undefined),
  M('万能', '多功能'),
  M('无敌', '出色'),
  M('秒杀全网', '限时优惠'),
  M('史上最低', '优惠'),
  M('破冰价', '活动价'),
  M('纯天然', '天然成分'),
  M('零添加', '配方表见详情'),
  M('无添加', '配方表见详情'),
  M('国家级', '行业认可'),
  M('世界级', '国际水准'),
  M('全球级', '国际水准'),
  M('宇宙级', undefined),
  M('驰名', '知名'),
  M('品质至尊', '品质优良'),
  M('王者', '出色'),
  M('之王', '代表之一'),
  M('第一品牌', '知名品牌'),
  M('领先品牌', '品牌'),
  M('至尊', '优质'),
  M('王牌', '主力'),
  M('冠军', '优胜'),
  // —— 权威背书 ——
  { w: '国家领导人推荐', cat: 'authority' },
  { w: '国家机关推荐', cat: 'authority', fix: '删去机关名称' },
  { w: '专供', cat: 'authority', fix: '删去' },
  { w: '特供', cat: 'authority', fix: '删去' },
  { w: '国家认证', cat: 'authority', fix: '改为具体认证证书名称' },
  { w: '质量免检', cat: 'authority' },
  { w: '免检', cat: 'authority' },
  { w: '著名商标', cat: 'authority' },
  { w: '领导品牌', cat: 'authority' },
  // —— 医疗功效（普通商品不得宣称）——
  { w: '治疗', cat: 'medical' },
  { w: '疗效', cat: 'medical' },
  { w: '治愈', cat: 'medical' },
  { w: '根治', cat: 'medical' },
  { w: '药到病除', cat: 'medical' },
  { w: '消炎', cat: 'medical', fix: '舒缓（普通化妆品）' },
  { w: '杀菌', cat: 'medical', fix: '清洁（按产品资质）' },
  { w: '抑菌', cat: 'medical' },
  { w: '抗菌', cat: 'medical' },
  { w: '祛疤', cat: 'medical' },
  { w: '再生', cat: 'medical' },
  { w: '修复受损细胞', cat: 'medical' },
  { w: '抗癌', cat: 'medical' },
  { w: '防癌', cat: 'medical' },
  { w: '降血压', cat: 'medical' },
  { w: '降血糖', cat: 'medical' },
  { w: '降血脂', cat: 'medical' },
  { w: '助眠', cat: 'medical', fix: '放松（普通食品）' },
  { w: '美白', cat: 'medical', fix: '提亮（普通化妆品）/ 祛斑美白须特证' },
  { w: '祛斑', cat: 'medical', fix: '须持祛斑美白特证' },
  { w: '生发', cat: 'medical' },
  { w: '丰胸', cat: 'medical' },
  { w: '减肥', cat: 'medical', fix: '体重管理' },
  { w: '燃脂', cat: 'medical' },
  { w: '瘦身', cat: 'medical' },
  { w: '无毒副作用', cat: 'medical' },
  { w: '无副作用', cat: 'medical' },
  { w: '安全无副作用', cat: 'medical' },
  { w: '有效率', cat: 'medical' },
  { w: '治愈率', cat: 'medical' },
  // —— 收益承诺 ——
  { w: '稳赚', cat: 'finance', fix: '有风险' },
  { w: '稳赚不赔', cat: 'finance' },
  { w: '保本保收益', cat: 'finance' },
  { w: '保本', cat: 'finance', fix: '风险等级见详情' },
  { w: '无风险', cat: 'finance', fix: '低风险（如有资质）' },
  { w: '零风险', cat: 'finance' },
  { w: '躺赚', cat: 'finance' },
  { w: '翻倍', cat: 'finance' },
  { w: '年化收益保证', cat: 'finance' },
  { w: '必涨', cat: 'finance' },
  { w: '必赚', cat: 'finance' },
  { w: '包过', cat: 'finance', fix: '提供辅导' },
  { w: '百分百中奖', cat: 'finance' },
  // —— 平台风险词（通用电商/社媒）——
  { w: '点击领奖', cat: 'platform' },
  { w: '恭喜获奖', cat: 'platform' },
  { w: '全民免单', cat: 'platform' },
  { w: '点击有惊喜', cat: 'platform' },
  { w: '免费送', cat: 'platform', fix: '具体活动规则' },
  { w: '白嫖', cat: 'platform' },
  { w: '抽奖', cat: 'platform', fix: '注明活动规则与概率' },
  { w: '秒杀', cat: 'platform', fix: '限时优惠（注明规则）' },
  { w: '抢购', cat: 'platform' },
  { w: '错过不再', cat: 'platform' },
  { w: '最后一天', cat: 'platform', fix: '具体活动截止时间' },
  { w: '仅此一天', cat: 'platform' },
  { w: '加微信', cat: 'platform' },
  { w: '加V', cat: 'platform' },
  { w: '私聊', cat: 'platform' },
  { w: '款到发货', cat: 'platform' },
  { w: '原价X现价Y', cat: 'platform', fix: '标注真实成交基准价' },
  { w: '旺旺', cat: 'platform' },
  { w: 'QQ', cat: 'platform' },
  { w: '微信', cat: 'platform' },
  { w: '链接', cat: 'platform' },
  { w: '二维码', cat: 'platform' },
]

/** 小红书/抖音等社媒扩展词（笔记与短视频描述易限流的表达） */
export const SOCIAL_EXTRA: BannedWord[] = [
  { w: '全网最低', cat: 'extreme', fix: '近期优惠' },
  { w: '史上最强', cat: 'extreme' },
  { w: '超级无敌', cat: 'extreme' },
  { w: '神仙', cat: 'extreme', fix: '很棒' },
  { w: '闭眼入', cat: 'platform' },
  { w: '无限回购', cat: 'extreme', fix: '多次回购' },
  { w: '必买', cat: 'extreme', fix: '值得考虑' },
  { w: '必入', cat: 'extreme' },
  { w: '一用就见效', cat: 'medical' },
  { w: '三天见效', cat: 'medical' },
  { w: 'X天见效', cat: 'medical' },
  { w: '瘦X斤', cat: 'medical' },
  { w: '医美', cat: 'medical' },
  { w: '抗衰', cat: 'medical', fix: '紧致（须资质）' },
  { w: '抗老', cat: 'medical', fix: '紧致（须资质）' },
  { w: '祛皱', cat: 'medical' },
  { w: '除螨', cat: 'medical' },
  { w: '三无', cat: 'platform' },
  { w: '高仿', cat: 'platform' },
  { w: '复刻', cat: 'platform' },
  { w: '平替', cat: 'platform', fix: '同类选择' },
  { w: '仿冒', cat: 'platform' },
  { w: '水货', cat: 'platform' },
  { w: '代购', cat: 'platform' },
  { w: '海淘链接', cat: 'platform' },
]

const ALL = [...D, ...SOCIAL_EXTRA]

export interface PlatformSets {
  generic: BannedWord[]
  ecommerce: BannedWord[]
  social: BannedWord[]
}

/** 按平台切词集：通用=广告法核心；电商=通用+平台营销词；社媒=通用+社媒扩展+平台词 */
export const PLATFORM_SETS: PlatformSets = {
  generic: D.filter((x) => x.cat !== 'platform'),
  ecommerce: D,
  social: [...D.filter((x) => x.cat !== 'platform'), ...SOCIAL_EXTRA],
}

export interface BanHit {
  word: string
  cat: BannedWord['cat']
  catLabel: string
  fix?: string
  index: number // 命中位置
  context: string // 前后文
}

/** 扫描文案，返回全部命中（按出现位置排序） */
export function scanBannedWords(text: string, words: BannedWord[] = PLATFORM_SETS.generic): BanHit[] {
  const hits: BanHit[] = []
  for (const item of words) {
    const re = new RegExp(item.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = Math.max(0, m.index - 8)
      const end = Math.min(text.length, m.index + m[0].length + 8)
      hits.push({
        word: m[0],
        cat: item.cat,
        catLabel: BAN_CATS[item.cat],
        fix: item.fix,
        index: m.index,
        context: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''),
      })
      if (m.index === re.lastIndex) re.lastIndex++ // 防零宽死循环
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}
