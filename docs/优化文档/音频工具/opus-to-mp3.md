# OPUS 转 MP3（opus-to-mp3）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + FfAudioBase 兜底）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行）＋ `FfAudioBase.vue`（165 行）｜引擎：ffmpeg.wasm 强制兜底（srcNeedsFf 命中 opus）｜注册：`registry.ts:26`（needModel: true，desc 主打"微信等导出的 OPUS 语音"）
> 对标标杆：123apps online-audio-converter.com ＋ CloudConvert

## 七维评分：53 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | FF 路径参数齐（码率/单声道，AudioConvert.vue:151-156）；但 desc 主打场景疑似不兑现——微信 .opus 实为 SILK 封装，ffmpeg-core 无 SILK 解码器；无输出试听、无 ID3 |
| 可用性 | 20 | 11 | 11 | FfAudioBase 进度条带百分比（FfAudioBase.vue:118-121）是大文件反馈亮点✓；但失败报错晦涩（:87 原始信息透传）、FF 底座无波形无时长确认（:107-111） |
| 实用价值 | 15 | 11 | 11 | 标准 Ogg Opus 转码价值真实；微信语音场景若 SILK 判断属实则该入口对主力用户不可用，价值大打折扣 |
| 交互便捷性 | 15 | 8 | 8 | 必下 25MB 引擎（srcNeedsFf 强制，`AudioConvert.vue:45`）——Chrome/Firefox 本可 WebAudio 解真 Opus 走快路径，能力未被利用；25MB 提示选文件后才见（FfAudioBase.vue:113-116） |
| UI 美观性 | 10 | 7 | 7 | FF 底座文件条+进度条工整；但相比快底座少了波形与元信息，两个底座体验断差明显 |
| 灵魂度 | 20 | 6 | 6 | SILK/损坏文件失败时无格式识别与中文解释，只抛"ffmpeg 处理失败：…"；码率不记忆、输出名不可自定义（:85、:113） |
| **加权总分** | 100 | | **53** | 架构保守但诚实，败笔在 desc 主打场景的兑现风险与 25MB 强制成本 |
| 附加：大文件性能 | 10 | 6 | — | ffmpeg.wasm 全量内存处理，100MB+ 文件 32 位浏览器可能崩溃且无预警；进度条✓是安慰 |
| 附加：移动端 | 10 | 5 | — | 25MB 引擎下载在移动流量下更痛；无断点/失败重试指引 |

## 结论与优先级

**交互优化 + 需拓展** · P1（SILK 识别与真 Opus 快路径属功能拓展；若 SILK 实测失败则 desc 承诺落空升 P0 复核）

判据：53 分——needModel 预警本入口是准确的（确实要 ffmpeg），进度条完善；但"微信 OPUS 语音"这一注册文案承诺的主力场景大概率解不了（需实测确认），且标准 Opus 本可免引擎秒转而未做。

## 扣分点明细

1. 【功能-疑似硬伤】desc 主打场景兑现存疑：微信语音导出的 .opus 多为 SILK v3 封装（`#!SILK_V3` 头）而非标准 Opus，@ffmpeg/core 0.12.10（`ffmpeg.ts:8`）不含 SILK 解码器——大概率直接报"ffmpeg 处理失败"（`AudioConvert.vue:115`）。需实测确认；若属实，registry.ts:26 的 desc 对最大搜索意图用户是不可用的
2. 【交互】真 Opus 被强制走 ffmpeg：srcNeedsFf 命中 opus（`AudioConvert.vue:45`）→ 永远 25MB；而 Chrome/Firefox 的 decodeAudioData 可解标准 Ogg Opus，快路径+lamejs 本可零下载秒转——保守取舍保证了 Safari 一致性，但牺牲了多数用户的速度
3. 【可用性】失败报错晦涩：SILK/损坏文件只透传 ffmpeg 原始信息（`AudioConvert.vue:115`、`FfAudioBase.vue:83-87`），无"微信导出可能为 SILK 格式，本工具暂不支持"的识别与中文引导
4. 【可用性】FF 底座无确认信息：加载后仅文件名+体积（`FfAudioBase.vue:107-111`），无时长/采样率/声道——文件是否被正确识别要到转码完才知道
5. 【功能】码率滑条下限 64（`:153`）够不到 Opus 语音甜点（32~48kbps 足够）；组件内 24~320 clamp（`:104`）因滑条限制形同虚设
6. 【功能】无输出试听、无前后体积对比：`:113` saveBlob 直接下载；ID3 丢失（家族共性）
7. 【交互】25MB 引擎下载提示在选文件后才出现（`FfAudioBase.vue:113-116`），且 getFf 下载阶段无进度回报（`ffmpeg.ts:14-30` 仅文案 :48），弱网用户面对无反馈等待
8. 【家族共性】执行按钮流内底部（M-15；共性-根因 4）；fast 底座波形静态问题见 audio-trimmer.md 扣分点1（本入口走 FF 底座连静态波形都没有）

## 行业对标与差距

- **123apps online-audio-converter.com**：接受 Opus/WMA 等重格式输入，云端转码免下载引擎——同为"重型格式"场景对方无 25MB 门槛（云架构天花板，诚实标注）；但对方上传隐私成本是本站优势，应在页面明示这一权衡。
- **CloudConvert**：格式识别完善、失败原因分类清晰。差距：失败诊断与格式识别反馈。
- 借鉴优先级：**SILK 识别与中文解释 > 真 Opus 快路径 > 转换前格式探测（时长/采样率） > 输出试听 > 语音低码率档**。

## 可拓展性

- 短期（1 周）：ffmpeg 失败+源扩展 .opus 时输出 SILK 疑似提示；FF 底座补时长/采样率显示（转码前一次快速 exec 解析）
- 中期（1 月）：Chrome/Firefox 先试 decodeAudioData 的"混合路径"——成功即免引擎，失败再落 ffmpeg；语音预设（mono 40kbps）
- 远期：引入 SILK 解码（silk-v3-decoder 移植 wasm）真正兑现"微信语音转 MP3"承诺；或 desc 诚实改为"标准 Opus 转 MP3"

## 优化处方（验收标准）

1. **SILK 识别**：ffmpeg 失败且源为 .opus 时提示"该文件可能是微信导出的 SILK 格式，暂不支持"。→ **验收：构造 `#!SILK_V3` 头文件转换时出现该中文提示而非原始报错**
2. **混合快路径**：Chrome/Firefox 下标准 Ogg Opus 先走 WebAudio 解码+lamejs。→ **验收：标准 Opus 文件在 Chrome 转换零引擎下载、3 分钟内文件秒级完成**
3. **格式探测**：拖入后显示时长/采样率/声道（FF 快速探测）。→ **验收：拖入文件 5 秒内显示三项元信息**
4. **语音码率档**：预设 chip 增加"语音 mono 40k"。→ **验收：点选后输出 40kbps 单声道 MP3，体积约为 192k 方案 1/5**
5. **输出试听**：转码完成后卡片内可播放对比。→ **验收：试听正常出声且显示 原体积→新体积**
6. **desc 诚实化**：若处方 1 证实 SILK 不可解，desc 改为"标准 Opus 格式转 MP3（微信导出语音为 SILK 封装暂不支持）"。→ **验收：页面与注册文案一致披露边界**
