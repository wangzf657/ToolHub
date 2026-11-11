# 视频转 GIF（video-to-gif）

> 分类：视频工具｜模式：C（单列堆叠文件流，FfBase 基座）｜组件：`src/tools/video/components/FfmpegToGif.vue`（78 行）＋ 基座 `FfBase.vue`（272 行）｜引擎：`src/lib/ffmpeg.ts`（fps+scale lanczos+split 单命令 palettegen/paletteuse 两阶段调色板，FfmpegToGif.vue:24）｜注册：`registry.ts:10`（needModel）｜家族共性（按钮底部/进度带/25MB 提示）参见 `compress-video.md`
> 对标标杆：ezgif（video-to-gif 流量王，功能全 UI 旧）＋ Clideo（云，GIF Maker——架构天花板标注）

## 七维评分：63 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | palettegen/paletteuse 两阶段正确落地（:24，ezgif 同款质量路线）；4 参数覆盖基本盘；缺 dither/循环次数/倒放回弹、30 秒硬上限（:41）、fps 8~15 封顶（:47）、无批量 |
| 可用性 | 20 | 11 | 11 | 家族进度反馈全站最完善（FfBase.vue:189-197）✓；但生成完直接下载无 GIF 预览（FfBase.vue:135-138）——色带/闪烁要下载后开图才发现；按钮流内底部（M-14） |
| 实用价值 | 15 | 14 | 14 | 表情包/教程动图是全站最高频的视频下游需求之一；本地调色板法画质真实可用、隐私加分；mimeFor 正确给 image/gif（ffmpeg.ts:109） |
| 交互便捷性 | 15 | 10 | 10 | 开始/时长全靠数字输入（:37,:41）——预览 video 就在上方（FfBase.vue:169）却不能看着画面选段；生成后无体积反馈，"GIF vs 源视频体积差"灵魂卖点未展示 |
| UI 美观性 | 10 | 7 | 7 | 选项盒工整、SliderRow 帧率滑杆直观；预览 340px 钉死（FfBase.vue:215-221，共性-根因 2） |
| 灵魂度 | 20 | 9 | 9 | "建议控制在 10 秒内"体积预警（:50）懂 GIF 之痛、status 明示"两步调色板"（:27）；但 start 超出时长时 d 可为负（:23）直接传 -t，报错走通用提示——懂我与坑我并存 |
| **加权总分** | 100 | | **63** | 视频分类核心明星工具：质量路线正确、需求顶级，败在选段交互与结果反馈两块 |
| 附加：大文件性能 | 10 | 5 | — | GIF 编码随帧数×宽度增长，wasm 单线程长片段分钟级，无耗时预估 |
| 附加：移动端 | 10 | 5 | — | 家族共性（M-14 同构）；GIF 预览与体积核对在手机上更难完成 |

## 结论与优先级

**交互优化** · P1（结果报告 + 可视化选段两大杠杆）

判据：63 分为家族最高档（与 trim-video 并列）：palettegen 质量关键已做对、desc 口径诚实（"从视频采样调色板"属实）；短板集中在"盲选段 + 无结果反馈"，无正确性缺陷，是家族中离 ezgif 最近、也最该追平的一个。

## 扣分点明细

1. 【交互-个性】无可视化选段：开始/时长是两个数字框（FfmpegToGif.vue:37,41），做表情包的典型操作"看着画面掐时间"只能拖播放器读秒后手抄——trim-video（registry.ts:7）已解决过选段问题，本页作为同家族明星工具反而退回数字时代
2. 【灵魂-个性】体积对比缺失：GIF 工具的灵魂反馈是「源 MP4 X MB → GIF Y MB（省 Z%）」，现 meta-bar 只显示源大小（FfBase.vue:173）、生成后仅 toast"已开始下载"（FfBase.vue:138）——ezgif 结果页直接列出输出尺寸/体积/帧数
3. 【可用性】生成完直接下载（FfBase.vue:135-138），无 GIF 预览与"不满意调参重来"回路；img 标签渲染 blob 即可预览，白白放弃
4. 【功能-边界】30 秒硬上限（:41 max=30，watch :16 同步钳制）且无原因说明——ezgif 支持整段转换（长 GIF 应由体积警告兜底而非静默上限）；fps 8~15 封顶（:47）挡住游戏/运动类高流畅需求
5. 【功能-边界】start 超出视频时长无校验：d = Math.min(Math.max(0.2, dur), duration - start)（:23）可为负值直接传 `-t`，ffmpeg 报错走通用 toast（FfBase.vue:142），用户不知是"开始时间填大了"
6. 【功能】无 dither/调色板选项：paletteuse 默认 dither 在渐变画面易色带，ezgif 提供 dither 开关与算法选择——palettegen 管线已就位，加参数即可
7. 【家族】执行按钮流内底部（FfBase.vue:199-206，M-14，共性-根因 4）；25MB 核心下载无进度（FfBase.vue:184-187）；无 beforeunload

## loadVideo 门禁简评

MP4/MOV/WebM 正常进门；AVI/WMV 挡门、MKV 依编码而定（videoEngine.ts:27-30）。GIF 素材多为录屏/短视频（MP4 为主），门禁影响低，家族中门禁与需求匹配最好的工具之一。

## 行业对标与差距

- **ezgif**：除本页 4 参数外还有 crop、变速、倒放回弹、dither/调色板控制、逐帧编辑、结果页体积/帧数报告。差距："功能追平 ezgif + UI 好于它"是站内合理愿景——调色板质量已追平（同 palettegen 法），差距在参数面与结果反馈，而 UI 赢面明显。
- **Clideo（云，天花板）**：拖滑杆选段+即时预览。差距：选段可视化纯前端可做（预览 video currentTime 事件源现成）。
- 借鉴优先级：**生成后体积/尺寸报告+GIF 预览 > 可视化选段 > dither 选项 > start 前置校验 > 放宽上限**。

## 可拓展性

- 短期（1 周）：结果区体积徽章+GIF 预览；start/dur 前置校验
- 中期（1 月）：可视化选段（复用 trim 交互）；dither/循环次数/倒放回弹；fps 放宽到 20 并配体积预警
- 远期：与 gif-to-mp4、GIF 压缩系列共建"GIF 工作台"：录屏→转 GIF→压缩一条管线

## 优化处方（验收标准）

1. **结果报告+预览**：onDone 改为结果区渲染 `<img>`（GIF blob）+「源 X MB → GIF Y MB（省 Z%）· N 帧」徽章+下载按钮。→ **验收：生成 5 秒 GIF 后页面直接显示动画，徽章体积与下载文件属性一致**
2. **可视化选段**：预览下提供"设为起点/设为终点"按钮（读 currentTime）+选段时长实时回显。→ **验收：播放到 3.2s 点"设为起点"后开始时间框变 3.2，无需手输**
3. **前置校验**：start ≥ 时长时 toast"开始时间超出视频时长"并钳制，不触发 ffmpeg。→ **验收：6 秒视频 start 填 6.5 时不产生任何执行日志**
4. **dither 选项**：paletteuse 增加 none/bayer/floyd_steinberg 三选（默认 bayer）。→ **验收：选 floyd_steinberg 后参数串含 dither=floyd_steinberg，渐变素材色带可感知减轻**
5. **家族处方 1-2**：按钮置顶＋耗时预期文案（compress-video.md 处方 1/2 变体）
