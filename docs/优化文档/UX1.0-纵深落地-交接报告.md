# UX1.0 处方纵深落地工程 — 工作交接报告

> 交接日期 2026-11-14 · 分支 `UX1.0` · 代码基线 `376ac25` + **372 个未提交改动文件**（本工程全部产出，均未 commit）
> 交付物性质：批量 UX 处方落地（开发执行）· 前置文档：《docs/优化文档》520 档案 + `UX1.0-修改报告.md` + `qa/UX1.0_v2/04-test-report.md`
> **给接手人的一句话：仓库当前是绿的（TSC 0 错误 / 254 用例 0 失败），但 372 个文件的改动未经 review 与 commit；剩余约 860 条处方中，~145 条有现成任务书可直接派发，~740 条是重交互长尾。**

---

## 一、开发目的（为什么做这件事）

1. **源头**：《docs/优化文档》工程为全站 520 个工具建立了逐工具档案（七维评分 + 行业对标 + **「优化处方（验收标准）」编号条目**，511 活跃工具共 2463 条），并设定门禁四指标（README §6.6）：全站均分 ≥70 · P0 硬伤清零 · 盲盒下载归零 · 灵魂度达成率 ≥55%。
2. **此前的位置**：UX1.0 修改轮（7 笔提交，见 `UX1.0-修改报告.md`）只落地了「结构性处方层」（三壳/家族杠杆/21 缺陷），处方落地率仅 **10%**（244/2463，见 `qa/UX1.0_v2/05-ux-evaluation-v2.md`）；全站均分 63.2，距 70 门槛差 6.8 分。
3. **本工程的使命**（用户指令「彻底实现所有功能纵深规划」）：把剩余 2219 条待落地处方批量实现，让工具从「能用/好用」向档案验收标准（对标 regex101/JSON Crack/Squoosh 级）推进。
4. **质量红线**（全程有效，接手人必须继续遵守）：
   - AGENTS.md 工程契约（懒加载、中文文案、单文件 ≤300 行、producer=ToolHub、useToast 中文错误）
   - **哨兵只增不删**：`scripts/tests/` 与 `qa/_scripts/` 的断言一律不得修改来迁就实现；红灯 = 实现错误，回退实现
   - 任何执行路径必须有终点态（产物或中文错误提示），不许静默失败
   - 测试与开发分离：功能验收以 `qa/UX1.0_v2/` 报告口径为准，修复后需 QA 回归

## 二、执行架构（方法论，可直接复用）

```
workqueue.mjs（队列生成器）
  └─ 解析 520 档案处方 → 杠杆规则判定已落地/待落地 → 2219 条待落地队列（21 种工型分桶）
       └─ 域代理并行执行（每代理：互斥文件所有权 + 统一门禁纪律 + 逐处方报告格式）
            └─ 主控集中处理：registry 纠偏代应用 / 代理死亡后破损修复 / 跨域契约协调 / 集成门禁
                 └─ ledger-v2.mjs（达标判定器）复算落地率 → 修改报告沉淀
```

- 队列文件：`qa/UX1.0_v2/workqueue.json`（每条含 `slug/cat/rx/rxTitle/rest/type/archive`，archive 指向档案路径——**做每条前必读档案的验收标准**）
- 各域代理的完整逐处方报告存于 ZCode 会话代理输出（关键数字已抄录本报告第三节；逐条明细以各代理报告为准）

## 三、完成进度全景（约 1360 / 2219 条 ≈ 61%）

| 批次 | 范围 | 落地数 | 关键产出 |
|---|---|---|---|
| 域A 开发域 | developer 60 组件 + 全站壳级乘数 | ~225 | `usePasteRun.ts`（粘贴即处理/Ctrl+Enter 全族接入）、json-formatter 树 Tab/错误跳行/同步滚动、SM3/HMAC 标准向量验证、RSA JWK/PBES2 |
| 域D 图片 | image 57 组件 + 7 新文件 | ~232 | `ExportBar.vue`（质量滑杆+实时体积+格式 chips+全族记忆）、`CompareSlider.vue`、EXIF 深解析 30+ 标签、水印统一范式、Otsu 自动档、透视校正 |
| 域G AI+SEO+编辑器 | ai/seo/editors | ~142 | schema 六件套全表单化、readability 逐句标色+仪表、grammar matchLen 止损、端侧双引擎（BLIP/YOLOS 确认框+进度）、四工作室撤销栈+自由裁剪 |
| 域C data+finance+开发保留8 | data/finance 全部 + json-visualizer/regex 双雄等 | ~213 | 正则节点中文解释层+SVG 保真导出、JSON Schema 回验 Tab、种子复现 mock、finance 14 计算器口径增强（久期/凸性/IV 反推/敏感度） |
| 域F+B 视频+音频+实用 | video/audio/utility | ~230 | **P0 16/16 全清**、耗时预期家族（FfExpectHint 23 组件）、trim 双把手/区间循环/倒放流复制、QR 全族（修复重试链/宾客立牌）、word-counter 平台上限对标 |
| 域E PDF+商业 | pdf/business 全部 | ~294 | 页缩略图排序、拆分三模式、pdf-to-word 表格真还原、深删改外扩防泄漏、批量四动作、MRR 瀑布图、简历向导+分页估算、全员 ≤300 行拆分 |
| 主控亲自（代理死亡接管） | 修复+G 追加批+H 批 | ~45 | 见第四节 |

**门禁四指标当前推算**：落地率 10% → **~61%**；P0 63 档 → **已清零**（63 档的硬伤处方全部落地，含 imgcvt 解码提示之外的 49 档单点）；均分 63.2 → 预计 **~68-70**（未经 ledger-v2 复算与 QA 重评，见第八节）；盲盒下载基本归零；灵魂度预计 ~50%（未达标，纵深类处方是主因）。

## 四、主控亲自完成部分（三个代理配额中断后的接管，接手人应知）

1. **中断破损修复 6 处**（A 代理死在半途留下的）：CodeMinifier `run` 先用后声明、registry `CASE_TARGETS` 导入缺失、jsonToYaml 行级引号化误伤数字（**重写为 dump 内按类型引号化**）、jsonEscape 反转义不剥外层引号、base32 截断告警误报（**判据改为数据位长度余数 ∈ {1,3,6} 才告警**）、yamlToJson 空输入返回 undefined。
2. **registry 集中纠偏 15 项**：editors 三工作室 desc 去虚假宣传（变速/AI 增强/Parquet）、image 10 项（needModel/resize/desc 口径）、audio flac-to-wav 假 needModel 移除、video mp4-to-mp3 steps、imageEngine invert 死代码删除。
3. **G 追加批（6 个 textDef→component 切换 + 可测性提取）**：
   - 新组件接线：text-summarizer / keyword-extractor / grammar-corrector / paraphraser（ai）、keyword-density-checker / readability-checker（seo）
   - 新纯逻辑模块（组件与测试同源）：`summarizer.ts`（G 原有）+ **grammarRules / paraphraserCore / keywordExtractor / readabilityReport / keywordDensityCore**（主控新写）
   - grammar 补**通用叠字收缩规则**（合法叠词白名单豁免：匆匆/悄悄/谢谢/星星…约 50 词），否则哨兵「我我/去去」断言无法满足
   - 测试基建：`src/tools/testables.ts` barrel + `run-textcalc-tests.mjs` 第二 esbuild 打包 + 6 条断言迁移（**这是唯一被授权修改的测试文件，迁移后断言意图不变**）
   - 注意：用例总数 268→254 的差额 = 6 工具组件化后退出「textDef 不变式扫描」（空输入/选项检查），**不是断言被删**，6 条迁移断言全过（探针验证过）
4. **H 批壳级/引擎增量**（解锁 ~15 条半程处方）：
   - `CalcTool.vue` 三增量：**route query 字段预填**（互链 links.query 的对端消费闭环）、**CalcResultRow.tone 三色着色**、**CalcToolDef.samples 示例 chips**（`src/types.ts` 同步加了可选字段）
   - `TextTool.vue`：`?text=` 预填契约接收端（seo/ai 互链带参跳转的另一半）
   - `pdfEngine.ts` 四项 + 三组件接线：protectPdf **权限位+独立权限密码**（ProtectPdf.vue 已接 UI）、pdfToPdfa **1b/2b 版本 XMP 标识**（PdfToPdfa.vue 版本下拉）、FormFieldInfo **page/rect 字段定位**（FillForm.vue 页码列）、compressPdf 真实进度语义（0~0.85 渲染+0.85~1 重排）
   - `audioEngine.ts` 两项**算法重写（已写入、tsc 通过、但无专测——冒烟验证任务被中断，接手人第一件事应补）**：changeSpeed 改 OLA Hann 窗变速（50ms 颗粒 50% 重叠+窗和归一化，消颗粒接缝爆音）；mergeBuffers 最近邻取样改线性插值重采样

## 五、新增技术资产清单（接手人速查）

**壳与基建**：`src/composables/usePasteRun.ts`（installPasteRun/installCtrlEnter/debounceRun）· `src/tools/testables.ts`（测试出口）· types.ts 新增 `CalcResultRow.tone` / `CalcToolDef.samples`

**纯逻辑模块（*.ts，可测）**：ai/`summarizer·grammarRules·paraphraserCore·keywordExtractor` · seo/`readabilityReport·keywordDensityCore` · developer/`regexExplain·mockSeeded` · image/`cropSel·exifParser·stegCore·maskComposite·handoff` · pdf/`pptxCompress·extractImagesCore·tableDetect·batchActions·insertPlacements` · editors/`studio/undoStack·photoUndo·dataShared` · business/`useMrrStore·useCashFlowStore` · utility/`sciCalc`

**新组件**：image/`ExportBar·CompareSlider` · ai/`TextSummarizer·KeywordExtractor·GrammarCorrector·Paraphraser·ZoomOverlay` + `imagenetZh.ts` · seo/`KeywordDensity·ReadabilityChecker` + `schema/`七件 · pdf/`InsertPreviewStage` · editors/`studio/CropOverlay` · video/`FfExpectHint·FrameStrip`+`useFrameShot.ts` · audio/`AudioExport` · business/`ResumePreview`

**跨域契约（生产端/接收端已就绪对）**：`?text=`（readability/entity→word-counter/pii-scrubber ✓）、`?sitemap=`（sitemap→robots **接收端未做**）、`toolhub.seo.meta-sync`（serp↔meta **接收端未做**）、`toolhub.transfer.<slug>`（A 域转料对）、handoff 带图接力（scan-enhancer/circle-crop→jpg-to-pdf ✓）

## 六、当前仓库状态（诚实披露）

| 项 | 状态 |
|---|---|
| vue-tsc -b | **0 错误**（最新实测） |
| npm test | **254 通过 / 0 失败 / 11 警告**（警告=Node 无 DOM 等 ENV 转浏览器项，基线一致） |
| npm run build | **未在最新改动后跑过**（上次 build 于 376ac25 基线）——接手人应先跑一次 |
| 未提交改动 | **372 个文件**（本工程全部产出）。**建议接手人第一步：逐域 review 后分批 commit**（可按第五节资产分组） |
| 进行中的代理 | 3 个（J/K/L）已于起步期停止，**0 产出无半成品**；其任务书内容并入第七节剩余工作 |
| 已知未验证项 | ① audioEngine 两项重写（无冒烟测试）② build 分包 ③ E2E 浏览器层（本轮全部改动只有 typecheck+单测门禁，**未经浏览器实测**，QA 回归轮未做） |

## 七、剩余工作清单（~860 条，按可执行度排序）

### 7.1 有现成任务书的三批（~145 条/项，直接可派发或手做）

**批 J（imgcvt+textDef+契约，~115 条）**——所有权：`ImageConvertTool.vue`、`developer/registry.ts+textDefs.ts`、`jsEngine.ts` 两处、`MetaTagGenerator/RobotsTxtGenerator.vue`：
1. imgcvt 13 工具 51 条：**解码器加载提示**（heic/tiff/avif 等待态）、**体积膨胀预警**（增大→黄条建议改格式）、**动图检测提示**（GIF/WebP 仅取首帧预告警）+ 各档案逐条（进度/双目标/ZIP 命名）
2. developer registry textDef ~60 条：base64/url/json 家族/csv-to-markdown/gzip/punycode(steps)/cookie-parser/map-coordinate/code-minifier mangle 档位等（**先读 textDefs.ts 现状，部分已迁移勿重复**）
3. jsEngine 两处：docxToHtml styleMap strike→del；fakeRows 可选种子参数
4. 跨域契约接收端 2 处：MetaTagGenerator 读 `toolhub.seo.meta-sync`；RobotsTxtGenerator 读 `?sitemap=`

**批 K（壳级媒体引擎，10 项工程）**——所有权：`FfBase.vue`、`AudioToolBase.vue`、`videoEngine.ts`、`subtitles.ts`、`audioEngine.ts`（仅验证）：
1. **audioEngine 冒烟验证**（最优先）：变速 0.5/2.0 长度≈len/speed、无 NaN、能量非零；异采样率合并长度正确
2. FfBase：主操作按钮 `position:sticky;bottom:0`（~30 工具家族处方1）、25MB 核心下载进度下沉引擎 onProgress+顶部统一进度条、FileDrop accept 可按 slug 覆盖（gif-to-mp4 用）
3. AudioToolBase：fade 首尾包络阴影（联动重绘，不动交互 API）
4. videoEngine：`probeTracks(file)` 音轨/字幕轨探测（ffmpeg 不可用诚实返 null）
5. subtitles.ts：ASS 解析/序列化（SRT API 兼容；参考 MergeAudio 域内极简实现语义）

**批 L（business/finance 接线闭环，~20 条）**——所有权：仅两份 registry（壳能力已就绪）：
burn#3 判定 tone、rule-of-40#5 达标 tone、roi#4 samples 三档、cac/ltv/churn/saas-pricing 互链 query 键名核对、position-size 风险档 samples、finance 各互链 query 补齐

### 7.2 重 O 长尾（~740 条，组件级重写，建议按专项排期）

- **音频小工具族**（每工具 4~5 条）：audio-equalizer / pitch-shift / visualizer / waveform-generator / decibel-meter / metronome / instrument-tuner / mp3-tag-editor
- **视频重交互**：blur/crop 画布框选、resize 模糊填充、stabilize 两阶段、remove-silence-from-video 同步剪整改、add-text 中文贴图、add-music 选项族、audiogram 全部、webm-to-mp4 批量队列
- **utility**：id-card-validator 批量、calendar-printer、copybook 页眉、kids-coloring 撤销、file-encryptor 选项族、text-behind-image、vcard、random-group-splitter、banned-words、text-cleaner 等
- **developer/数据少数**：FunctionPlotter 拖拽平移/参数滑块、GradientGenerator 色标拖拽/角度盘、BorderRadius 角点拖拽/blob、UnicodeLookup、CodeScreenshot
- 完整清单：`qa/UX1.0_v2/workqueue.json` 按 type 分桶（`O-单点改造` 1494 条起点，随落地递减）

### 7.3 已知妥协项（前轮如实登记，接手人可择机升级）

xlsx 单元格底色（社区版 xlsx 库不支持 fill）、ocr 区域识别为数值输入（非拖框选）、psd-to-jpg readPsd 同步解析大文件冻结窗、screen-color-picker toast 内链接（改常驻入口）、ResultBox wrap prop、json-formatter 树节点 hover 复制路径按钮（需改共享 JsonTreeNode）、break-even 交叉图（calcDef 无图表位，需组件化）、excel-to-csv GBK 输出（TextEncoder 不支持，置灰）

## 八、未来规划（建议路线）

### 8.1 收尾本工程（1~2 天）

跑 `npm run build` 确认分包 → 372 文件分域 review + commit → audioEngine 冒烟验证（§7.1 批 K 第 1 项）→ 派发/手做 J/K/L 三批 → 全量门禁 → `ledger-v2.mjs` 复算落地率。

### 8.2 质量收敛循环（核心：全量测试 → 修改 → 回归测试 → 修改 … 直到生产就绪）

本工程 ~1360 条改动**至今只过了静态门禁（tsc/单测），未经任何浏览器实测**。因此合入 main 前必须执行以下**迭代循环，且循环不止一轮——每轮回归暴露的新问题修复后必须再回归，直到满足 §8.3 的上线生产标准为止**：

```
┌─ 全量测试轮（QA 角色，严格遵守 docs/测试要求.md：只测试不修复）─────────────┐
│  L1 门禁三绿 → L2 注册表完整性 → L3 全站 511 页爬测（本轮改动重点加采处方信号）│
│  → L4 金标准 8 套件 → L5 E2E 深测（本轮 ~1360 条落地的高危面：audioEngine 变速│
│  听感/OLA 爆音、ExportBar 实时体积、schema 六件套、PDF 权限位、grammar 叠字、  │
│  component 化 6 工具、CalcTool query/tone/samples、跨域契约跳转链路）         │
│  → L6 异常边界 → 缺陷清单（P0~P3 分级 + 复现步骤 + 截图证据）                 │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼ 缺陷清单交开发
┌─ 修复轮（开发角色，用户授权后执行）────────────────────────────────────────┐
│  按 P0→P3 逐条修复；每条修复必须实机自验；不动哨兵；修复清单对照缺陷编号      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ 回归测试轮（QA 角色）──────────────────────────────────────────────────┐
│  ① 原失败用例逐条复验（须有实测证据，不采信开发自测）                      │
│  ② 修复面关联功能冒烟（防修 A 坏 B）                                      │
│  ③ 抽样全量爬测（511 页渲染回归）                                         │
│  → 全过？→ 判断是否达 §8.3 标准：未达标 → 带着新缺陷清单回到「全量测试轮」  │
│           （下一轮测试范围 = 上一轮修复面 + 未覆盖区，逐轮收敛）            │
└─────────────────────────────────────────────────────────────────────┘
```

**每轮产出**（qa/UX1.0_v2/ 或按被测版本新开目录）：01 系统分析（增量）/ 02 计划 / 03 用例 / 04 报告（四档结论：PASS / PASS WITH ISSUES / FAIL / INCONCLUSIVE）/ 05 体验台账 / defects/ + screenshots/ + logs/。**测试与开发角色分离**（AGENTS.md 最高优先级纪律）：测试者不修代码，修复者不自评通过。

**预期轮次**：本轮改动面大（372 文件），首轮全量测试预计暴露 5~15 个缺陷（重点风险：浏览器端 audioEngine 听感与爆音、6 个 component 化工具的 UI 回归、ExportBar 在真实图片上的体积测算、跨域 query 的中文编码）；修复+回归 1~2 轮后应收敛。**严禁因迭代次数多而放宽断言或跳过失败用例**。

### 8.3 上线生产标准（循环的退出判据，全部满足才可合入 main / 部署）

| # | 判据 | 验证方式 |
|---|---|---|
| 1 | 门禁三绿（tsc 0 错误 / npm test 0 失败 / build 成功且分包懒加载不变） | 每轮回归必跑 |
| 2 | QA 全量测试轮结论 = **PASS**（无任何 P0/P1 阻断缺陷；P2 允许带病上线但须列入已知问题清单） | 04 报告四档结论 |
| 3 | 全站爬测 511/511 + 非工具页全过（渲染/溢出/H1/首控件预算不回归） | 爬测脚本 |
| 4 | 金标准 ≥663/665（仅 2 条结构性浏览器待验标记），引擎层零回归 | verify-v11 8 入口 |
| 5 | 本工程新增面的浏览器实测抽检通过（audioEngine 变速听感、ExportBar、PDF 权限位、grammar、component 化 6 工具、跨域契约链路） | E2E 用例 |
| 6 | 本轮落地处方的抽查验收：按 ledger-v2 落地清单抽 ≥30 条实测，验收标准达成率 ≥90% | QA 抽检记录 |
| 7 | 缺陷收敛趋势：连续两轮回归**无新增 P0/P1**（收敛证明，防止"修一个冒一个"） | 跨轮缺陷台账对比 |
| 8 | 文案口径哨兵全过（510+、511 基线、已删 slug 不复活） | 回归哨兵 |

未满足 → 回到 §8.2 循环；全部满足 → 合入 main，方可进入部署流程（EdgeOne Pages + 百度收录路线，见运营方案）。

### 8.4 第 2 批：重 O 长尾专项（1~2 周，可与质量循环穿插）

按「分类专项」推进（音频小工具族一个代理打包 8 工具；视频画布族一个代理）——预计再消 300~400 条，均分冲 72+。**每批落地后同样走 §8.2 循环**。

### 8.5 第 3 批：85+ 纵深攻坚（月级）

README §6.6 原案：JSON 工作台（JSON Crack 级图谱）、正则工作台（regex101 token 解释层——regexExplain.ts 已有底子）、GIF 质量法（ezgif）、SQL→DuckDB WASM、translator→Bergamot WASM。

### 8.6 持续验收闭环

每批完成 → `ledger-v2.mjs` 重算落地率 → QA 按七维复测抽检 → 更新交接报告附录。四指标（均分 ≥70 / P0 清零 ✓ / 盲盒归零 / 灵魂度 ≥55%）作为版本级门禁；§8.3 作为每次上线级门禁。

## 九、交接操作指南

**门禁三件套**（任何改动前后必跑）：
```bash
npx vue-tsc -b        # 类型门禁，必须 0 错误（npm run typecheck 有预存在 TS6310，勿用）
npm test              # 254 用例 0 失败 11 警告；红灯=回退实现，绝不改测试
npm run build         # 提交前跑；确认重依赖仍是懒加载分包
```

**工具脚本**（qa/UX1.0_v2/scripts/）：
- `workqueue.mjs` → 重新生成待落地队列（落地后重跑，队列自动收缩）
- `ledger-v2.mjs` → 处方达标台账+门禁四指标复算（输出 05-ux-evaluation-v2.md）
- `tally-done.mjs` → 从代理报告解析 ✅ 清单（接手人若用代理工作流可复用）
- `registry-stats.mjs` / `crawl-batch.mjs` → 注册表统计与全站爬测（QA 轮用）

**代理派发模板要点**（本工程实证有效的纪律）：
1. 每代理**互斥文件所有权**清单（能改什么/禁改什么，逐文件列）
2. 开工前先跑门禁确认基线（当前 254/0/11），收尾必须双绿；**红灯=回退自己的改动**（哨兵神圣）
3. 报告格式：逐处方 `slug#rx ✅ file:line / ⏭️原因 / ❌阻塞` + registry 变更申请表 + 门禁结果
4. **并发 ≤3**（7 并发只活 3，配额会耗尽）；**代理死亡后不 resume 旧实例**（会串任务），新开代理并附「中断现场说明」
5. 处方实现前必读该档案验收标准（workqueue 条目的 archive 路径）
6. 需要跨域配合的改动（共享壳/lib/registry），代理只提申请，主控集中应用——避免并发写冲突

**哨兵契约速查**（易踩）：
- `run-textcalc-tests.mjs`：base32 'abc'→'MFRGG==='、json-escape 往返、case 五风格、json-to-yaml 嵌套（数字不得加引号）、grammar「我我/去去」收缩、remove-line-breaks mode=all 默认**完全移除**（替换符必须留空才生效）
- `qa/_scripts/v11-regression-entry.ts`：全站 511 基线、已删 9 slug 不复活、510+ 文案口径
- finutil/textspec 金标准用 `qa/UX1.0/scripts/ux1-*-entry.ts` 副本跑（qa/_scripts 原版引用已删 rmb-uppercase 会崩）

## 十、坑位与防再犯（本工程实证）

1. **行级文本后处理做「类型引号化」必错**（jsonToYaml 案例）：无法区分数字 1 与字符串 "1"，必须在 dump 函数内按值类型处理。
2. **Base32 截断告警**：去 padding 后长度 %8 ≠ 0 是常态（23 合法），只有余数 ∈ {1,3,6} 才是真截断。
3. **处方与哨兵的默认语义冲突**：把处方要求做成**可选输入**（显式填写才生效），默认行为保持哨兵契约（remove-line-breaks 案例）。
4. **组件化迁移必须「可测性提取」**：纯逻辑放 .ts 模块，组件薄壳调用，测试打 barrel——否则断言与 UI 两个实现必然漂移（本次 6 工具同步迁移零漂移）。
5. **grammar 类规则引擎**：通用叠字收缩必须带合法叠词白名单（匆匆/悄悄/谢谢…），否则破坏正常文本。
6. **@cantoo/pdf-lib encrypt**：permissions.printing 值是 `'highResolution'|'lowResolution'`（非 boolean）；XMP 需经 `doc.context.stream/register + catalog.set('Metadata')`（catalog 是 protected，需 unknown 断言）。
7. **变更 desc 前先核对实现**：本轮 3 个工作室 desc 都在宣传未实现的功能（变速/AI/Parquet）——「desc 承诺 = 实现兑现或如实改口」，二选一。
8. **代理工作流**：并发上限与配额耗尽是常态，主控必须有「亲自接管 + 破损修复」预案；死亡代理的半成品第一时间 `git status` + 全量门禁甄别。
9. **IAB 测试限制**（QA 轮会再遇到）：文件对话框不可用（页内构造 File+DataTransfer）、无渲染帧（RAF/transition 不派发——恰是 UX1-001/002 修复针对的场景）、计时器节流 ~10×、截图能力会话中段可能故障。
10. **单文件 300 行**：超限即拆（本工程新增 30+ 个拆分模块的模式可参考：`Xxx → xxxCore.ts + 子组件.vue`）。

---

## 附录：关键文件索引

| 内容 | 路径 |
|---|---|
| 本工程队列与判定器 | `qa/UX1.0_v2/scripts/{workqueue,ledger-v2,tally-done}.mjs` |
| 待落地队列（实时收缩） | `qa/UX1.0_v2/workqueue.json` + `workqueue.md` |
| 落地台账（v2） | `qa/UX1.0_v2/05-ux-evaluation-v2.md` |
| 第二轮 QA 报告（基线口径） | `qa/UX1.0_v2/04-test-report.md` |
| 前序修改报告 | `docs/优化文档/UX1.0-修改报告.md` |
| 520 档案（处方验收标准） | `docs/优化文档/<分类>/<slug>.md` |
| 代理逐处方报告（已验收的 7 域） | ZCode 会话代理输出（关键数字已抄本报告第三节） |

*交接人：主控（QA→开发执行切换）· 2026-11-14 · 「你的工作不是让测试变绿，而是让系统的真实质量无处藏身。」*
