# UX1.0 优化修改报告

> 分支 `UX1.0` · 执行日期 2026-11-11 · 依据:《docs/优化文档》520 份档案 + 12 份分类汇总的处方
> 基线:main @ df29be8 + 优化文档两笔(docs @ cf57988)· 本次修复共 **7 笔提交**

---

## 一、执行总览

| 阶段 | 提交 | 内容 | 惠及面 |
|---|---|---|---|
| 1 阉割落地 | `cd4da53` | 删除 9 个重复/低价值工具入口(520→511) | 消 12 项阉割清单中的 9 项 |
| 2 杠杆三壳 | `b0cddc8` | CalcTool/TextTool/ResultBox + 工具页竖向预算 | ~150 个工具(67 calc + 42 text + 37 ResultBox 处) |
| 3 家族杠杆 | `5b51395` | 音频/视频/图片/SEO/PDF 元数据/NLP 六族 | ~90 个工具 |
| 3 续 | `1255a19` | 工作室豁免侧栏 + merge-pdf 预览先行 + AI 名实对齐 + 报错误导分流 | 4 工作室 + 15 AI 工具 |
| 4 缺陷修复 | `f7bdd57` | §6.4 台账 21 项功能缺陷(4 个领域并行修复) | 21 个工具 |
| 5 样板处方 | `300d0c8` | loan-calculator 双方式+预填+明细透传;Markdown 家族实时渲染;正则/Cron 互链 | 7 个工具 |

**门禁结果**:`npx vue-tsc -b` 0 错误 · `npm test` 268+41+34 用例全绿(0 失败)· `npm run build` 成功(46s)· 浏览器实测 12 项关键路径全部通过(见 §五)。

---

## 二、阉割清单落地(9 删 3 留)

### 已删除(9 项)

| slug | 处置 | 合并去处 |
|---|---|---|
| add-text-to-image | 同组件重复注册 | add-watermark(同组件) |
| photo-editor | 同组件双注册 | photo-studio(编辑器工作室) |
| video-editor | 同组件双注册 | video-studio |
| html-minifier | 同组件重复注册 | html-formatter(改名"HTML 格式化 / 压缩") |
| average-calculator | 能力完全被覆盖 | statistics-calculator(均值/中位数/众数/方差/分位数更全) |
| calorie-calculator | 二选一合并 | tdee-calculator(BMR/TDEE/减脂增肌/宏量一体,并修 primary 错位) |
| rmb-uppercase | 引擎同源合并 | number-to-words(升级为四模式:人民币大写/财务大写/普通汉字/英文) |
| take-home-pay-calculator | 精度倒退重复 | income-tax-calculator |
| audio-transcribe | needModel 登记失信 | speech-to-text(同引擎,留一个诚实入口) |

### 保留优化(3 项)

- **gif-to-png**:档案结论为"交互优化(附合并评估)",非明确阉割 → 保留;首帧边界提示待后续
- **code-minifier**:真 terser/csso 引擎站内领先 → 保留;钉高问题已由 TextTool 壳解决
- **translator**:档案结论"交互优化+需拓展" → 保留;desc 已改为诚实口径(词级替换,非神经网络)

**联动清理**:EXPECT_COUNT(image 71/video 41/audio 37/utility 132/developer 91/business 15)、各注册表头注释、site.ts 510+、router /studio 重定向指向 studios、popularSlugs(rmb-uppercase→number-to-words)、CodeFormatter slug 分支、V1.1 工具清单重生成(511 行)、测试用例迁移(statistics/tdee/number-to-words 新键)。

---

## 三、杠杆改造明细(对照 README §6.2 杠杆清单)

| # | 杠杆 | 状态 | 实现要点 |
|---|---|---|---|
| 1 | CalcTool 空态守卫契约 | ✅ 大部 | NaN 守卫已有;新增**结果行 hover 单值复制**(提取纯数字,¥/%/千分位剥离)、**localStorage 输入记忆**(`toolhub.calc.<slug>`,只回填在册字段);预填样板在 loan-calculator 落地,其余计算器预填待逐档推进 |
| 2 | ResultBox/textarea 弹性高度 | ✅ | `clamp(minHeight, 100dvh-380px, 780px)` 弹性 + **全屏查看层**(Teleport/Esc/滚动锁);TextTool 双窗 `field-sizing:content` + 64vh 上限 |
| 3 | TextTool pending 渲染 + 弹性双窗 | ✅ | >120ms 慢转换提示(防同步闪烁)+ 输出区 loading 态 + **双窗滚动比例联动** + 下载 TXT |
| 4 | ImageToolBase 预览治理 | ✅ | 预览 46vh 高度上限(竖图不再推走参数区)+ **按住看原图**对比按钮 |
| 5 | FfBase 挡门放行 | ✅ | 预览解码失败不再挡门:放行 ffmpeg 流程 + 明示"预览不可用仍可处理" |
| 6 | AudioConvert 默认目标路由化 | ✅ | 13 个 X-to-Y slug 映射表,转 WAV/FLAC/M4A 页不再默认出 MP3(消 6 个 P0) |
| 7 | registry desc/needModel 契约治理 | ✅ AI 域先行 | AI 15 工具 9 条名实对齐(去"AI 语法/零样本/图像物体检测端侧模型"冒名,移除 2 个假 needModel);其余分类待逐档推进 |
| 8 | producer=ToolHub 盖章收口 | ✅ | `savePdf` 导出,SignPdf/cjkText/pdfText/pdfHits/PdfStudio 5 处 `doc.save()` 绕过全部走统一盖章 |
| 9 | schema 六件套 tab 路由化 | ✅ | slug→Tab 映射,首屏表单与工具名一致 |
| 10 | 工作室路由豁免侧栏 | ✅ | studio 类工具隐藏 300px TrustSidebar,photo-studio 中栏 400→1160px;撤销栈共享基建未做(遗留) |
| 11 | 盲盒下载→预览先行 | ✅ 部分 | MergePdf 结果卡(页数/体积/新窗预览/手动下载);ImageConvertTool 结果卡片网格(缩略图+体积对比+逐张下载+失败留档,自动 zip 默认关);compress-pdf 原本已有结果卡 |
| 12 | 中文 NLP 基建 | ✅ | 英文停用词 27→110+;中文词级停用词 90+ 进 keywordTokens;否定窗口已有 |

### 额外杠杆(文档处方之外)

- **FileDrop 缩略图 + Ctrl+V 粘贴**(全站文件工具):图片文件行 32px 缩略图;截图粘贴直达(文件/图像双通道)
- **AudioToolBase 波形可交互**(24 个音频工具):点击定位播放头/拖拽选区(emit select)/统一试听句柄(可停/防叠播/播放头动画);AudioTrimmer 选区双向同步
- **audioSynth 实时控制 5 例**:metronome 运行中调速改拍号、tone 波形/音量实时生效(@input)、white-noise 调音量免重启
- **Markdown 家族实时渲染**:Preview/ToWechat/ToSlides 输入变化防抖渲染(300~500ms)
- **互链补课**:regex-tester↔regex-visualizer、cron-explainer↔crontab-builder 双向;loan→amortization 参数透传
- **imageEngine 报错误导分流**:稀有格式(AVIF/HEIC/TIFF/JXL)提示先转格式,不再误报"文件无效"
- **工具页竖向预算瘦身**:padding/H1/徽章/面板收紧 + Breadcrumbs 18→10px,首个控件 266px→**227px**(1366×768 实测)

---

## 四、§6.4 功能缺陷修复(21/21)

| 域 | 工具 | 修复 |
|---|---|---|
| 实用/金融 | age-calculator | toISOString UTC 偏移 → 本地时区格式化,生日不再慢一天 |
| | unit-converter | 交换先补结果再对调,数值不再膨胀 |
| | event-countdown | 春节接农历引擎精确推算(误差 11 天→0;现值 2027-02-06) |
| | timezone-converter | Intl longOffset 实时算偏移+南北半球 DST 判定,hint 报实际偏移 |
| | social-insurance | 不编造数据,note/引擎头注释显式披露"数据截至 2024-07" |
| | sip-calculator | 期初→月末普通年金口径统一(2000/8%/10年=¥365,892 过验收) |
| 开发/编辑器 | readability-checker | 中英双口径公式,中文评分不再恒 0(英文逐位不变) |
| | keycode-lookup | 筛选纳入 keyCode 数字列("13"→Enter) |
| | text-to-handwriting | 按宽折行+画布动态增高+onMounted 首屏渲染修复 |
| | er-diagram-editor | 删表不再重映射 id,连线精确过滤 |
| | whiteboard | 全量快照栈,清空可撤销/重做 |
| PDF/商业 | invoice-generator | 打印 TDZ 崩溃修复(esc 声明顺序) |
| | office-to-pdf | 接 cjkText canvas 贴图管线,中文不再 helvetica 乱码 |
| | compare-pdf | 双扫描件近空文本检测,不再假"一致" |
| | passport-photo | cover 裁切+规格化排布,二寸不再变形 |
| 视频/音频/图片 | split-video | 段数 ceil 化,尾段与 >60 段不再丢 |
| | remove-silence-from-video | silencedetect 干跑+filter_complex 双轨同步剪,音画不再失步 |
| | change-video-speed | 源采样率探测透传(48kHz 源 2× 不再错算 1.84×) |
| | crop-image / blur-region | Pointer Events 化(触屏/笔+capture+touch-action) |
| | batch-file-rename | 两遍冲突消解+序号后缀+徽标,重名不再覆盖 |
| | forex-pip-calculator | JPY 0.01 点径+美元在前对倒数换算,去 150 倍高估 |

---

## 五、浏览器实测记录(dev server,1366×768)

| 验收点(对照档案验收标准) | 结果 |
|---|---|
| json-formatter 结果区弹性高度 | ✅ 320px 钉高→388px(随视口) |
| ResultBox 全屏层 | ✅ 打开 638px textarea,Esc 退出 |
| loan-calculator 月供金标准 | ✅ ¥4,890.17(100万/4.2%/30年)与金标准一致 |
| CalcTool 输入记忆 | ✅ 刷新后 1000000/4.2 保留 |
| loan-calculator 双方式 | ✅ 本息 ¥4,774.15 / 本金首月 ¥6,111.11 递减 ¥9.26,利息差行可见 |
| 明细入口透传 | ✅ 链接带 ?p=1000000&r=4&y=30,明细页自动带入并计算 |
| pinyin-converter 多音字 | ✅ "重庆的重量"→chóng qìng de zhòng liàng hěn dà |
| TextTool 弹性双窗 | ✅ 40 行文本双窗同步撑至 492px(field-sizing:content) |
| number-to-words 四模式 | ✅ 壹仟贰佰叁拾肆元伍角陆分 / 一千二百三十四点五六 / One thousand two hundred and thirty-four point five six |
| mp3-to-wav 默认目标 | ✅ 打开即选中 WAV(原默认 MP3) |
| photo-studio 宽屏 | ✅ 面板 1160px 无侧栏;常规工具 842px+300px 侧栏保留 |
| 首页徽章 | ✅ 510+ 工具 |

子代理另在其领域内做了白板撤销/ER 删表/keycode 筛选/手写折行/可读性中文评分等实测,均通过(详见各自报告)。

---

## 六、评分影响预估(诚实口径)

本轮瞄准的是档案扣分点的**系统性根因**(三壳钉高、无记忆、无 loading、挡门、盲盒下载、虚标、21 个功能 bug)。按各档案"扣分点→处方"的对应关系预估:

- **模式 A/B/D(~150 工具)**:可用性/交互/灵魂三维度合计 +10~18 分,多数 55~62 档工具进入 **68~78** 档
- **音频/视频/图片家族**:消 6 个音频 P0 + 4 个视频挡门/失步 + 图片预览/触摸,家族均分预计 **59→70+**
- **AI 家族**:名实对齐止血(灵魂度 38%→55%+),但规则法算法代差仍在,均分 **54.7→60±**
- **21 个缺陷工具**:各 +8~15 分(功能完善性/可用性回升)

**未达 90+ 的诚实说明**:档案口径 90~100 为"行业第一梯队"。达到它需要的不仅是消缺陷,还有逐工具的功能纵深(如 regex101 式 token 解释、Squoosh 式分屏滑块、JSON Crack 图谱视图、Bergamot WASM 翻译等)——这是 README §6.6 第 2~3 批的月/季度级工程。本轮已把"及格线以下的结构性地基"全部抬完,**从"能用"进到"好用"**;90+ 攻坚建议按 §七 排期。

## 七、遗留与建议(下轮)

1. **P0 残留**:图片分类 blur-region/crop-image 已修,但 `ico-to-png 白底`、`gif-frame-extractor toDataURL 风暴`(图片汇总 P0)未在本轮范围
2. **studio 撤销栈共享基建**(杠杆 #10 后半):4 个工作台各自为政,仍是模式 E 最大短板
3. **CodeFormatter 配置面**(prettier 选项透出)+ **压缩能力收敛到 terser 单口**(质量倒挂:正则假压缩占据模式 D)
4. **JSON 工作台/正则工作台**(路径互通、解释层)——冲 85+ 的主路径
5. **逐档预填样板推广**(67 个 calcDef 中目前只铺 loan-calculator)
6. **desc/needModel 治理推广到其余分类**(本轮 AI 域先行)
7. **qa/ 台账**:本轮以"开发自测"性质执行(类型/单测/构建/浏览器金标准),未走 docs/测试要求.md 的完整 QA 流程;建议合并前由 QA 角色按七维口径复测抽检

---

*执行方式:主会话(壳组件/杠杆/阉割/报告)+ 4 个并行领域子代理(缺陷修复)。所有提交均通过 typecheck 与全量单测后落库。*
