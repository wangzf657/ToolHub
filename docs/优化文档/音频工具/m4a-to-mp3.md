# M4A 转 MP3（m4a-to-mp3）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：`src/lib/audioEngine`（浏览器原生 AAC 解码 + lamejs 编码，默认路径免 ffmpeg）｜注册：`registry.ts:17`（needModel: true）
> 对标标杆：123apps online-audio-converter.com（iPhone 语音备忘录转换主力场景）＋ CloudConvert

## 七维评分：63 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 码率滑条+单声道（AudioConvert.vue:140-144）；**ID3 标签不写**（lamejs 输出裸 MPEG 帧，`audioEngine.ts:70-89`）——语音备忘录的日期/标题丢失；无批量 |
| 可用性 | 20 | 12 | 12 | 默认目标恰为 MP3✓（:29 与 slug 语义一致）；Chrome/Firefox 原生解 AAC（`audioEngine.ts:16-26`）秒转；但编码无进度（:79 未传 onProgress）、无结果试听 |
| 实用价值 | 15 | 14 | 14 | iPhone 语音备忘录/QuickTime→通用 MP3 是站内最真实的转档需求之一；免 ffmpeg 即时完成是相对竞品的速度优势 |
| 交互便捷性 | 15 | 10 | 10 | 拖入即转两步完成；但页面预挂"需下载模型"预期（needModel: true，`registry.ts:17`）实际默认路径根本不加载 ffmpeg——过度预警 |
| UI 美观性 | 10 | 7 | 7 | 快底座波形+元信息（时长/声道/采样率，AudioToolBase.vue:109-117）对 M4A 输入确认友好；家族共性 M-15 |
| 灵魂度 | 20 | 8 | 8 | 解码即转流畅；但标签全丢不提示（用户导出后才发现歌名没了）、无"采样率将随设备重采样"说明（`audioEngine.ts:17`） |
| **加权总分** | 100 | | **63** | 路径最诚实的入口之一：真解码真编码零捷径，输在标签与反馈 |
| 附加：大文件性能 | 10 | 6 | — | encodeMp3 主线程同步（`audioEngine.ts:80-86`）；1 小时会议录音编码期间 UI 冻结 |
| 附加：移动端 | 10 | 6 | — | 单列可用；iOS Safari 解 M4A 无碍（家族共性 M-15） |

## 结论与优先级

**交互优化** · P1

判据：63 分无硬伤，默认目标正确、实现路径诚实（浏览器解码+lamejs 重编码，非 MediaRecorder 拼装）；扣分集中在 needModel 误预警、ID3 丢失、无进度三点，均属交互优化级。

## 扣分点明细

1. 【交互】needModel 过度预警：注册标 `needModel: true`（`registry.ts:17`）使页面带"首次需下载引擎"预期，但 m4a 源+mp3 目标组合 `srcNeedsFf`（`AudioConvert.vue:45`）不命中、Chrome/Firefox `decodeAudioData` 原生解 AAC——**绝大多数用户永远见不到 ffmpeg**，预警与实际不符损耗信任
2. 【功能】ID3 元数据丢失：lamejs 编码不写任何 tag（`audioEngine.ts:70-89`），M4A→MP3 后标题/艺术家/封面全空；语音备忘录的录制时间元数据同丢
3. 【可用性】编码无进度：`AudioConvert.vue:79` 未传 onProgress（引擎 `audioEngine.ts:70` 支持，接线即得）；会议录音（1 小时+）lamejs 编码数十秒无反馈
4. 【可用性】无输出试听与体积对比：点击即下载（`AudioConvert.vue:146`、`DownloadButton.vue:21-31`）
5. 【功能】无批量：语音备忘录一次导出几十条是典型批量场景，FileDrop `multiple=false`（`AudioToolBase.vue:101`）逐个拖最疼
6. 【交互-疑似功能问题】码率滑条 step=32 出现 288kbps 非标准档（`:142`，MPEG-1 L3 码率表无 288），lamejs 行为需实测
7. 【功能】输出采样率随设备重采样不可控（`audioEngine.ts:17` AudioContext 默认采样率）——转 MP3 影响小于 WAV，但 44.1k 素材在 48k 设备上输出规格漂移
8. 【家族共性】波形纯静态（`AudioToolBase.vue:70-81`，见 audio-trimmer.md 扣分点1）；空态无引导、按钮流内底部（M-15；共性-根因 1/4）

## 行业对标与差距

- **123apps online-audio-converter**：批量+逐文件码率+输出试听；iPhone 用户占比最高的正是 M4A→MP3。差距：批量能力。
- **CloudConvert**：保留元数据选项、ID3 编辑联动。差距：标签透传——本站有 mp3-tag-editor 可接力但本工具不提示这条动线。
- 借鉴优先级：**needModel 修正 > 编码进度 > ID3 写入（标题至少透传） > 批量 > 输出试听**。

## 可拓展性

- 短期（1 周）：注册项 needModel 改 false 或运行时判定；onProgress 接线；结果卡显示"标签将丢失"提示
- 中期（1 月）：lamejs 后补写 ID3v1/v2 基本标签（标题/艺术家透传）；批量队列
- 远期：与 mp3-tag-editor 联动"转换后立即补标签"动线

## 优化处方（验收标准）

1. **预警修正**：m4a-to-mp3 注册项去除 needModel（或 ToolPage 文案改"仅特殊格式需加载引擎"）。→ **验收：页面不再出现 25MB 下载提示，Chrome 全流程零下载**
2. **编码进度**：忙条百分比 0→100%。→ **验收：1 小时 M4A 转 MP3 期间进度递增且 UI 可响应（或至少有确定态反馈）**
3. **标签透传**：转换后 MP3 带源文件标题/艺术家 ID3。→ **验收：输出文件在 mp3-tag-editor 打开可见标题字段**
4. **标签丢失提示**：若短期不实现透传，结果卡提示"ID3 标签未保留，可用 MP3 标签编辑器补写"并挂入口。→ **验收：提示文案出现且链接直达 /t/mp3-tag-editor**
5. **批量**（中期）：多文件统一 192kbps 输出 zip。→ **验收：一次拖 10 条语音备忘录全部转换**
