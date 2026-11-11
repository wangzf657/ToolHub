# GIF 转 MP4（gif-to-mp4）

> 分类：视频工具｜模式：C（单列堆叠文件流，FfBase 基座）｜组件：`src/tools/video/components/FfmpegConvert.vue`（93 行，与 convert-video 共用）＋ 基座 `FfBase.vue`（272 行）｜引擎：`src/lib/ffmpeg.ts`（libx264 crf23 重编码，FfmpegConvert.vue:42）｜注册：`registry.ts:31`（needModel）｜家族共性参见 `compress-video.md`；共用组件分析参见 `convert-video.md`/`avi-to-mp4.md`
> 对标标杆：ezgif（GIF↔视频全能流量王）＋ CloudConvert（云，**架构天花板**）

## 七维评分：55 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 5 目标格式+faststart 复用母工具（FfmpegConvert.vue:24-30,44）；缺帧率/宽度选项（ezgif 标配）、缺 pix_fmt/偶数尺寸适配、WebM 之外无 APNG/WebP 等现代动图目标 |
| 可用性 | 20 | 8 | 8 | **GIF 源疑似双重挡门**：accept="video/*"（FfBase.vue:159）把 image/gif 挡在选择器外，拖拽进门后 loadVideo 用 `<video>` 解析 GIF 必 onerror（videoEngine.ts:27-30）→ 面板不渲染（FfBase.vue:167）——需实测定性 |
| 实用价值 | 15 | 13 | 13 | desc"体积通常缩小到十分之一"（registry.ts:31）是全家族最锋利的价值主张：10MB 动图→1MB MP4 正中社交平台限制痛点 |
| 交互便捷性 | 15 | 9 | 9 | preset mp4 正确、流复制默认关正确（FfmpegConvert.vue:17,21）；但流复制开关对无音轨的 GIF 源是必败陷阱项（:59-62 不按源隐藏） |
| UI 美观性 | 10 | 7 | 7 | 家族统一样式；GIF 源预览本可用 `<img>` 优雅呈现，340px video 预览（FfBase.vue:215-221）在挡门修复前无从谈起 |
| 灵魂度 | 20 | 8 | 8 | 十分之一卖点页内无验证闭环（onDone 直接下载，FfBase.vue:135-138，无"源 X MB→输出 Y MB"对比）；挡门 toast 让用户"去 ffmpeg 转码类工具"（videoEngine.ts:29）而他就在转码工具里 |
| **加权总分** | 100 | | **55** | 卖点最锋利、门禁最荒诞并存的一页 |
| 附加：大文件性能 | 10 | 6 | — | GIF 源普遍小（<20MB）低分辨率，转码本身快——家族中少有的"可给快速承诺"场景却无文案（同 avi-to-mp4.md 扣分 4） |
| 附加：移动端 | 10 | 4 | — | 家族共性（M-14 同构） |

## 结论与优先级

**交互优化** · P0（疑似功能缺陷"GIF 挡门"实测定性后整改优先）

判据：55 分；若实测确认 GIF 无法进门（accept 过滤 + `<video>` 无法解码 GIF 双重门），本页在其存在的唯一理由上不可用——比 avi-to-mp4.md 扣分 1 更结构性：AVI 至少能拖进门，GIF 连选择器都过不去。

## 扣分点明细

1. 【可用性-疑似功能缺陷-硬伤】GIF 源双重挡门：① FileDrop accept="video/*"（FfBase.vue:159），image/gif 不匹配，文件选择器默认过滤 GIF；② 拖拽无类型校验可进门（FileDrop.vue:34-38），但 loadVideo 以 `<video>` 解析——浏览器 video 元素无法解码 GIF，onerror 必然触发（videoEngine.ts:27-30）→ 选项/按钮面板不渲染（FfBase.vue:167）。需实测定性
2. 【灵魂-口径】挡门错误文案自相矛盾："可尝试 ffmpeg 转码类工具"（videoEngine.ts:29）——用户此刻就在 ffmpeg 转码工具页内（同 avi-to-mp4.md 扣分 2，本页荒诞度最高）
3. 【功能-疑似功能缺陷】x264 参数不适配 GIF 源：无 `-pix_fmt yuv420p`（FfmpegConvert.vue:42）——GIF 调色板源直进 x264 可能产 yuv444p，部分播放器绿屏/不兼容；无偶数尺寸处理——GIF 宽高常为奇数（如 499×243），yuv420p 要求偶数会直接编码失败（ezgif 自动 pad）。两项均需实测
4. 【灵魂-个性】十分之一卖点无验证闭环：onDone 直接下载（FfBase.vue:135-138），"源 10MB → 输出 1.2MB（省 88%）"的对比徽章没有——最强卖点用户感知不到
5. 【功能】无帧率/宽度选项：GIF→MP4 用 12~15fps 即肉眼无损，直通源帧率徒增体积；ezgif 有 fps 与宽度缩放选项（FfmpegConvert.vue:24-30 仅格式+流复制）
6. 【交互】流复制开关是陷阱项：GIF 无音轨且容器不同，勾选必失败（FfmpegConvert.vue:59-62）——应按源类型隐藏或禁用
7. 【可用性-家族】执行按钮流内底部（FfBase.vue:199-206，M-14，共性-根因 4）
8. 【灵魂-家族】25MB 无下载进度、无耗时预期、无 beforeunload（compress-video.md 扣分 2/4/5）——GIF 源小而快，是家族中最该给"通常很快"正向承诺的页（同 avi-to-mp4.md 扣分 4）

## loadVideo 门禁影响评估

**本批 9 份中唯一 100% 触发挡门的页**：GIF 不是视频容器，`<video>` 元素无法解码（img 才可以），loadVideo 必然 reject（videoEngine.ts:27-30），FfBase.vue:167 面板永不渲染。修法明确：GIF 源改用 `<img>` 预览（还更省资源）+ 免 loadVideo 直接进入流程，或复用挡门放行策略（avi-to-mp4.md 处方 1）。输出侧（MP4/WebM 文件）无此问题。

## 行业对标与差距

- **ezgif**："GIF to MP4/WebM"支持 fps、宽度、静音保障、批量，转换后在线预览并显示前后体积。差距：**源兼容性**（它吃 GIF 我们疑似不吃）+ 参数面 + 体积对比展示。
- **CloudConvert**（云）：GIF→MP4 自动 yuv420p/偶数化，参数全。差距：架构天花板；但 wasm 内 ffmpeg 手动加 `-vf scale=trunc(iw/2)*2:-2,format=yuv420p` 即可追平。
- 借鉴优先级：**GIF 进门放行 > 偶数化/pix_fmt 兜底 > 体积对比徽章 > fps 选项**。

## 可拓展性

- 短期（1 周）：accept 补 image/gif + GIF 源 img 预览免 loadVideo；命令串加偶数化+format=yuv420p；错误文案按工具语境改写
- 中期（1 月）：帧率（10/12/15/原生）与宽度选项；结果区"源 X MB→输出 Y MB"对比徽章；隐藏 GIF 源的流复制开关
- 远期：与 video-to-gif 组成"GIF↔视频"双向工作台（ezgif 式全能入口，共享 25MB 核心）

## 优化处方（验收标准）

1. **GIF 进门**：FileDrop accept 改 `video/*,image/gif`；GIF 源跳过 loadVideo、用 `<img>` 预览（元信息取自然宽高与文件大小）。→ **验收：499×243 的 GIF 可经文件选择器或拖拽进入流程并显示预览**
2. **编码兜底**：GIF 源命令串加 `-vf scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`。→ **验收：奇数尺寸 GIF 转出的 MP4 在 VLC/微信/手机均可播，无绿屏**
3. **体积对比徽章**：结果区显示"源 X MB → 输出 Y MB（省 Z%）"。→ **验收：10MB GIF 转出后徽章数值与实际文件一致**
4. **fps 选项**：新增 10/12/15/跟随源四档，默认 12。→ **验收：选 12 后命令串含 `-r 12`，输出文件比跟随源档更小**
5. **陷阱项处理**：源为 GIF 时流复制复选框隐藏。→ **验收：GIF 载入后选项区无流复制复选框**
6. **家族处方 1-2**：按钮置顶＋"动图转换通常很快"正向耗时文案（compress-video.md 处方 1/2 变体）
