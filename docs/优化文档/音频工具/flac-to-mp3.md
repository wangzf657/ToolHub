# FLAC 转 MP3（flac-to-mp3）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：`src/lib/audioEngine`（浏览器原生 FLAC 解码 + lamejs 编码，默认路径免 ffmpeg）｜注册：`registry.ts:21`（needModel: true）
> 对标标杆：123apps online-audio-converter.com（无损转有损分发流量王）＋ foobar2000（转档预设参照，桌面）

## 七维评分：62 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 码率滑条+单声道（AudioConvert.vue:140-144）；缺码率场景预设（归档 320/分发 192/试听 128）、FLAC Vorbis Comment 标签不透传（`audioEngine.ts:70-89` 无 ID3 写入）、无批量 |
| 可用性 | 20 | 12 | 12 | 默认目标恰为 MP3✓（:29 与 slug 一致）；Chrome/Firefox 原生解 FLAC 秒转（`audioEngine.ts:16-26`）；但编码无进度（:79 未传 onProgress）、无试听无体积对比 |
| 实用价值 | 15 | 13 | 13 | "无损转 MP3 便于分发"（registry.ts:21）是乐迷/播客主真实高频动线；全本地对私藏音库友好 |
| 交互便捷性 | 15 | 10 | 10 | 两步完成；输出名硬编码 -converted（:85）、设置不记忆、整张专辑逐个拖 |
| UI 美观性 | 10 | 7 | 7 | 波形+元信息条工整（AudioToolBase.vue:109-117）；家族共性 M-15 |
| 灵魂度 | 20 | 8 | 8 | 解码即转流畅；但"320 归档还是 192 分发"零引导，无损转有损这个有后悔成本的操作无任何码率-音质说明 |
| **加权总分** | 100 | | **62** | 路径诚实顺畅，缺的是无损人群要的预设引导与标签 |
| 附加：大文件性能 | 10 | 6 | — | encodeMp3 主线程同步循环（`audioEngine.ts:80-86`），整轨 FLAC（5-10 分钟）编码期间 UI 冻结 |
| 附加：移动端 | 10 | 6 | — | 单列可用；家族共性（M-15） |

## 结论与优先级

**交互优化** · P1

判据：62 分无硬伤——默认目标正确、真解码真编码；差距在预设引导、标签透传、批量三点，均为可落地交互优化。

## 扣分点明细

1. 【交互】needModel 过度预警：注册标 needModel: true（`registry.ts:21`）让页面预挂 25MB 预期，但 flac 源+mp3 目标不命中 `srcNeedsFf`（`AudioConvert.vue:45`），Chrome/Firefox `decodeAudioData` 原生解 FLAC——**主流环境此工具根本不需要 ffmpeg**
2. 【功能】无损转有损零引导：码率滑条 64~320（`:142`）无场景预设与说明——对比 foobar2000 转档器的预设组（archive/standard/portable），本工具让乐迷裸选
3. 【功能】标签丢失：FLAC 的 Vorbis Comment（标题/艺术家/专辑/曲目号）与封面图不透传，lamejs 不写 ID3（`audioEngine.ts:70-89`）——整专转完歌名全空是乐迷高频痛点
4. 【可用性】编码无进度：`AudioConvert.vue:79` 未传引擎已支持的 onProgress（`audioEngine.ts:70`）；长曲目 lamejs 编码 10~30 秒静默（家族共性，见 audio-trimmer.md 扣分点3）
5. 【可用性】无输出试听与体积对比：点击即下载（`AudioConvert.vue:146`、`DownloadButton.vue:21-31`），FLAC→MP320 的体积收益是用户核心关切却不显示
6. 【功能】无批量：整张专辑 10+ 首逐个拖（`AudioToolBase.vue:101` single）
7. 【功能】输出采样率随设备重采样（`audioEngine.ts:17` AudioContext 默认采样率），44.1k 专辑在 48k 设备上输出规格漂移
8. 【家族共性】波形纯静态（`AudioToolBase.vue:70-81`，见 audio-trimmer.md 扣分点1）；空态无引导、按钮流内底部（M-15；共性-根因 1/4）

## 行业对标与差距

- **123apps online-audio-converter**：批量+逐文件码率+输出试听。差距：批量与结果确认。
- **foobar2000 转档器**（桌面参照，纯浏览器可逼近其交互）：预设组+标签映射（Vorbis Comment→ID3v2 逐字段）+处理队列。差距：**标签映射与预设引导代差**。
- 借鉴优先级：**码率场景预设 > 标签透传 > 编码进度 > 批量 > needModel 修正**。

## 可拓展性

- 短期（1 周）：needModel 修正；三预设 chip（320 归档/192 通用/128 省空间）；onProgress 接线
- 中期（1 月）：lamejs 后补写 ID3（从文件名解析"艺术家 - 标题"兜底）；批量队列+zip；体积对比卡
- 远期：与 mp3-tag-editor 打通"转换后补标签"动线；Web Worker 化编码

## 优化处方（验收标准）

1. **码率预设**：滑条上方三枚场景 chip。→ **验收：点"192 分发"滑条跳 192 且旁注"流媒体/网盘分发推荐"**
2. **needModel 修正**：去除注册项预警。→ **验收：Chrome 打开页面无 25MB 提示，全流程零下载**
3. **标签透传**（中期）：输出 MP3 带源标题/艺术家 ID3。→ **验收：输出文件在 /t/mp3-tag-editor 打开可见标题字段**
4. **体积对比卡**：完成后显示"38.0MB → 7.4MB（-81%）"+试听输出。→ **验收：百分比与实际一致，试听可播放**
5. **编码进度**：忙条百分比 0→100%。→ **验收：10 分钟 FLAC 转 MP3 期间进度递增**
6. **批量**（中期）：一次拖整专 12 首，统一 192k，zip 下载。→ **验收：12 首全部转换且文件名保留原曲名**
