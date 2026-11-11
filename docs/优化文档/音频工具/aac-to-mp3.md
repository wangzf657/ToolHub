# AAC 转 MP3（aac-to-mp3）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 等 10 入口共用）｜引擎：`src/lib/audioEngine`（decodeAudio 平台解码 AAC + lamejs 编码，默认路径免 ffmpeg）｜注册：`registry.ts:25`（needModel: true）
> 对标标杆：123apps online-audio-converter.com ＋ CloudConvert

## 七维评分：60 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 码率滑条+单声道（AudioConvert.vue:142-144）；缺源码率检测（有损叠转无提醒）、ID3 不写（`audioEngine.ts:70-89`）、无批量 |
| 可用性 | 20 | 12 | 12 | 默认目标 MP3（:29）、AAC 走快路径（:45 正则不含 aac）即时完成✓；但 Firefox/Linux 等平台解不了的文件只给一句通用报错（`audioEngine.ts:22`），不告知平台差异 |
| 实用价值 | 15 | 13 | 13 | 裸 .aac（ADTS 流）多来自录音笔/抓流，"打不开"痛点真实；但注意大多数"AAC 文件"实为 .m4a 容器（另见 m4a-to-mp3.md），本入口覆盖的是更窄的长尾 |
| 交互便捷性 | 15 | 10 | 10 | 拖入即转两步；needModel: true（`registry.ts:25`）预警与快路径实际不符——主流平台解码 AAC 根本不加载 ffmpeg |
| UI 美观性 | 10 | 7 | 7 | 快底座波形+元信息（AudioToolBase.vue:109-117）友好；家族布局见 M-15 |
| 灵魂度 | 20 | 6 | 6 | 解码即转流畅；但对"源已是低码率 AAC"的用户零引导——转 320kbps 输出纯属自我安慰，UI 不拦不提醒 |
| **加权总分** | 100 | | **60** | 路径真实顺畅，输在平台差异披露与有损叠转引导 |
| 附加：大文件性能 | 10 | 6 | — | encodeMp3 主线程同步（`audioEngine.ts:80-86`），长录音编码期间 UI 冻结无进度 |
| 附加：移动端 | 10 | 6 | — | 单列可用；iOS Safari 解 AAC 无碍（家族共性 M-15） |

## 结论与优先级

**交互优化** · P1

判据：60 分无硬伤——AAC 在 Chrome/Edge/Safari 及 Win/macOS 版 Firefox 均可解码快路径完成；扣分集中在 needModel 误预警、解码失败时平台差异不披露、有损叠转零引导三点。

## 扣分点明细

1. 【交互】needModel 过度预警：注册标 `needModel: true`（`registry.ts:25`）页面挂"需下载引擎"预期，但 aac 源不命中 srcNeedsFf（`AudioConvert.vue:45`），AAC 走 decodeAudioData 快路径——主流平台用户永远见不到 ffmpeg
2. 【可用性】解码失败不披露平台差异：Firefox/Linux 无平台 AAC 库、部分老 Edge 会 decodeAudioData 失败，此时只报"浏览器无法直接解码该音频格式…"（`audioEngine.ts:22`）——不说明"你的浏览器/系统组合不支持 AAC"，也不挂站内 convert-audio（ffmpeg 兜底）直达入口，用户自己找路
3. 【功能】有损叠转无源码率提示：AAC 源均值码率可现算（file.size/meta.duration 在手），64kbps 源转 320kbps 输出只涨体积不涨音质——压缩类工具最该拦的误区，UI 零提醒
4. 【功能】ID3 元数据丢失：lamejs 裸帧无 tag（`audioEngine.ts:70-89`），标题/封面全空且无"可用 MP3 标签编辑器补写"引导
5. 【可用性】编码无进度：`:79` 未传 onProgress（引擎 `audioEngine.ts:70` 支持，接线即得；家族共性，见 audio-trimmer.md 扣分点3）
6. 【交互-疑似事实性错误】"混为单声道（体积约减半）"（`:144`）：CBR MP3 体积=码率×时长与声道无关，同码率 mono 不省体积——文案误导（见 compress-audio.md 扣分点1 的同族分析）
7. 【交互】码率滑条 step=32 出 288kbps 非标档（`:142`，家族共性需实测）；输出名硬编码 -converted、参数不记忆（`:85`）
8. 【家族共性】波形纯静态（`AudioToolBase.vue:70-81`，见 audio-trimmer.md 扣分点1）；执行按钮流内底部（M-15；共性-根因 4）

## 行业对标与差距

- **123apps online-audio-converter.com**：接受 AAC/M4A 输入、批量、转换前音质预估、前后体积对比。差距：批量与量化反馈。
- **CloudConvert**：AAC→MP3 预设+元数据保留。差距：ID3 透传与"源码率检测、建议不升码率"的专业引导。
- 借鉴优先级：**needModel 修正 > 解码失败平台诊断+兜底入口 > 源码率提示 > 编码进度 > ID3**。

## 可拓展性

- 短期（1 周）：needModel 改运行时判定；解码失败 toast 挂"改用 ffmpeg 引擎转换"按钮直达 convert-audio 动线；mono 文案更正
- 中期（1 月）：源码率检测与建议输出码率；批量队列+zip；ID3 标题透传
- 远期：转换结果页挂"补标签/再压缩"动线（mp3-tag-editor、compress-audio 串联）

## 优化处方（验收标准）

1. **预警修正**：needModel 改运行时判定。→ **验收：Chrome 拖入 .aac 全流程零下载、页面无 25MB 提示**
2. **失败诊断**：解码失败时按 UA 区分文案并给兜底入口。→ **验收：Firefox（无 AAC 环境模拟）下提示"当前环境不支持 AAC 解码"，点击"用 ffmpeg 引擎转换"后同一文件可完成转换**
3. **源码率提示**：加载后显示"源约 X kbps，建议输出 ≤X"。→ **验收：拖入 4MB/5 分钟 .aac 显示约 107kbps，误差 <15%，输出码率低于源时出现黄色提醒**
4. **编码进度**：忙条百分比 0→100%。→ **验收：1 小时 AAC 转码期间进度递增且页面可响应（或至少确定态反馈）**
5. **标签引导**：结果卡提示"ID3 标签未保留"+直达 /t/mp3-tag-editor 链接。→ **验收：提示出现且链接跳转正确**
