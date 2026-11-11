# MP4 转 MP3（mp4-to-mp3）

> 分类：视频工具｜模式：C（单列堆叠文件流，FfBase 基座）｜组件：`src/tools/video/components/FfmpegExtractAudio.vue`（63 行，与 video-to-mp3 共用）＋ 基座 `FfBase.vue`（272 行）｜引擎：`src/lib/ffmpeg.ts`（`-vn` + libmp3lame 重编码，FfmpegExtractAudio.vue:20）｜注册：`registry.ts:28`（needModel）｜家族共性参见 `compress-video.md`；共用组件分析参见 `video-to-mp3.md`
> 对标标杆：mp3cut.net / 123apps（提取类流量王）＋ CloudConvert（云，**架构天花板**）

## 七维评分：59 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 三格式+输出名可编辑；缺多音轨选择（`-vn` 默认取最优音轨不可指定）、缺码率选项、缺片段提取 |
| 可用性 | 20 | 11 | 11 | MP4+H.264/AAC 全浏览器可解析，**挡门概率为四件套最低**（这是本 slug 的核心可用性资产）；家族基线照旧：按钮流内底部（FfBase.vue:199-206，M-14）、输出无试听（:135-138） |
| 实用价值 | 15 | 12 | 12 | "MP4 转 MP3"是全球最高频提取检索词之一，但与 video-to-mp3 完全同能力（同组件同命令），站内重复度真实存在 |
| 交互便捷性 | 15 | 9 | 9 | 落地页定制为零：PRESETS 预置的 mp3 与默认值相同（FfmpegExtractAudio.vue:9,12），整页无一条 MP4 语境文案 |
| UI 美观性 | 10 | 7 | 7 | 家族统一样式；340px 视频预览（FfBase.vue:215-221）对音频任务是死重 |
| 灵魂度 | 20 | 9 | 9 | 码率诚实披露（:38）+ 25MB notice（FfBase.vue:184-187）；无耗时预期、无试听、无 MP4 场景叙事 |
| **加权总分** | 100 | | **59** | 门禁最稳的提取页，但"标题即功能、页面零定制"使 slug 价值只剩搜索入口 |
| 附加：大文件性能 | 10 | 5 | — | 纯音频编码较快但无耗时预告（家族共性） |
| 附加：移动端 | 10 | 4 | — | 家族共性（M-14 同构） |

## 结论与优先级

**交互优化** · P1（快路径 + 页面场景化定制 + 试听）

判据：59 分；功能与门禁都稳，但作为独立落地页它对 video-to-mp3 无任何差异化——预置值等于默认值（FfmpegExtractAudio.vue:9,12），体验与叙事都不配"独立页面"之名，先补 MP4 场景定制再谈快路径。

## 扣分点明细

1. 【交互-个性】落地页定制为零：`PRESETS['mp4-to-mp3']='mp3'`（FfmpegExtractAudio.vue:12）而默认本就是 mp3（:9）——预置不改变任何行为，页面无"提取 BGM/人声/会议录音"等 MP4 场景文案
2. 【实用-个性】与 video-to-mp3 完全同能力（组件注释自认"多个注册 slug 复用"，:2），用户搜"mp4 to mp3"与"视频提取音频"得到同一工具的两张皮；页内无差异叙事亦无互相引流
3. 【功能】快路径未用：MP4 是 decodeAudioData 可行性最高的源（audioEngine.ts:20），站内 wav-to-mp3 已证明免 25MB 路线可行（audio/registry.ts:11），本页却 needModel——5MB MP4 提音频要先下 25MB（registry.ts:28）
4. 【功能】多音轨不可选：MP4 常带多音轨（原声/配音/解说），命令无 `-map` 显式选轨（FfmpegExtractAudio.vue:22），用户要哪条轨道无从指定
5. 【可用性】输出无试听：onDone 直接下载（FfBase.vue:135-138），提取的是不是目标音轨只能下载后验证
6. 【可用性-家族】执行按钮流内底部（FfBase.vue:199-206，M-14，共性-根因 4）
7. 【灵魂-家族】无耗时预期、25MB 无下载进度、无 beforeunload（同 compress-video.md 扣分 2/4/5）
8. 【功能-边界】HEVC MP4（iPhone"高效格式"导出）在 Chrome 的 loadVideo 行为需实测——若视频轨致 onerror 挡门（videoEngine.ts:27-30），则"为了提取 AAC 音轨被不需要的视频轨挡在门外"是家族结构性荒诞的 MP4 版

## loadVideo 门禁影响评估

四件套中最稳：MP4 是浏览器支持度最高的容器，H.264/AAC 组合可正常进门（FfBase.vue:167 面板正常渲染）；唯 HEVC 编码 MP4 在 Chrome/Edge 存在挡门可能（需实测），若挡门属 P1 级边界缺陷而非 P0。

## 行业对标与差距

- **mp3cut.net / 123apps**：波形选段、音量归一、试听、选轨。差距：本页连"哪条音轨"都选不了，只能全凭默认。
- **CloudConvert**（云）：mp4→mp3 参数矩阵（CBR/VBR/码率/采样率）。差距：架构天花板；快路径与选轨纯前端可追。
- 借鉴优先级：**快路径免 25MB > 多音轨选择 > 试听 > MP4 场景文案**。

## 可拓展性

- 短期（1 周）：decodeAudioData 快路径兜底 ffmpeg；结果区 `<audio>` 试听；补 MP4 场景 steps 文案（registry.ts:28 无 steps）
- 中期（1 月）：`-map 0:a:N?` 选轨 UI（源含多音轨时显示）；码率档位
- 远期：与 video-to-mp3/mov-to-mp3/mp4-to-wav 合并为单入口"提取音频"页 + 深链 preset（四页一价）

## 优化处方（验收标准）

1. **快路径**：MP4 源先尝试 decodeAudioData + encodeMp3。→ **验收：5MB MP4 首次转换无 25MB 下载提示，产物可播**
2. **场景化落地页**：页头下增加"典型场景"文案（会议录像/网课/直播回放）与注册表 steps。→ **验收：registry.ts 该条目含 3 条定制 steps 并在侧栏显示**
3. **试听**：onDone 渲染 `<audio controls>` + 下载按钮。→ **验收：完成后页内可播放输出，不点下载不落盘**
4. **多音轨**：载入后探测音轨数，>1 时显示轨道下拉。→ **验收：双音轨 MP4 可选第 2 条并输出对应音频**
5. **家族处方 1-2**：按钮置顶＋耗时预期文案（compress-video.md 处方 1/2）
