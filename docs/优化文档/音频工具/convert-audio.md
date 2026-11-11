# 音频格式转换（convert-audio）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase/FfAudioBase 双底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行）｜引擎：`src/lib/audioEngine`（encodeMp3/encodeWav）+ ffmpeg.wasm 兜底｜注册：`registry.ts:10`（needModel: true）
> 对标标杆：CloudConvert（格式转换天花板）＋ 123apps online-audio-converter.com（在线音频转换流量王）

## 七维评分：64 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | 7 目标格式 chip + 64~320kbps 码率滑条 + 单声道（AudioConvert.vue:124-128,140-155）覆盖基本盘；缺批量、缺元数据（ID3/封面）保留、缺输出试听 |
| 可用性 | 20 | 12 | 12 | 快路径 WAV/MP3 解码即转（免 ffmpeg 是对视频家族的代差优势）；但 MP3 编码无进度（引擎支持 onProgress 却未接线，AudioConvert.vue:79 vs `audioEngine.ts:70`）、结果点击即下载无预览 |
| 实用价值 | 15 | 13 | 13 | 全格式互转母工具，全本地隐私强卖点；WMA/OPUS 等不可解码源自动落 ffmpeg（:45-47）兜底诚实 |
| 交互便捷性 | 15 | 11 | 11 | 切换目标时已选文件自动跨底座携带（:50-56）是贴心细节；但两步可达的前提是读懂 notice 长文（:129-136），chip 无有损/无损标注 |
| UI 美观性 | 10 | 7 | 7 | chip 行 + notice + 底座层级清晰；切底座时波形区突然消失/出现造成布局跳变 |
| 灵魂度 | 20 | 8 | 8 | 跨底座带文件（:50-56）+ ffmpeg 百分比进度条（FfAudioBase.vue:118-121）是亮点；但码率/目标/单声道全不记忆，输出名硬编码 -converted（:85） |
| **加权总分** | 100 | | **64** | 引擎路径诚实、兜底完善，反馈与批量是主要短板 |
| 附加：大文件性能 | 10 | 6 | — | encodeMp3 主线程同步循环阻塞 UI（`audioEngine.ts:80-86`），长音频静默；ffmpeg 路径有进度 |
| 附加：移动端 | 10 | 6 | — | 单列堆叠可用；notice 长文+chip 换行后首屏更满（M-15 家族） |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：可用性无硬伤（默认目标 MP3 对母工具语义合理），但编码无进度、无结果预览、无批量——相比 CloudConvert/123apps 的功能面差距明确，处方均可落地。

## 扣分点明细

1. 【可用性】快路径编码无进度：`encodeMp3` 引擎自带 onProgress 形参（`audioEngine.ts:70,85`），调用处 `AudioConvert.vue:79` 未传，仅有"正在处理，请稍候…"忙条（`AudioToolBase.vue:119`）；5 分钟音频 lamejs 编码约 10~20 秒无百分比（家族共性，见 audio-trimmer.md 扣分点3）
2. 【可用性】结果无预览：DownloadButton 点击即 saveBlob（`AudioConvert.vue:146`、`DownloadButton.vue:21-31`），转换前后无试听对照、无输出体积回显——"转得对不对"只能下载后自己开播放器验证
3. 【功能】无批量：两底座 FileDrop 均 `multiple="false"`（`AudioToolBase.vue:101`、`FfAudioBase.vue:101`）；123apps 转换器支持多文件+逐文件设置，整张专辑逐个拖是硬摩擦
4. 【功能】元数据不保留：快路径 lamejs 输出裸 MPEG 帧不写 ID3（`audioEngine.ts:70-89`）；ffmpeg 命令无 `-map_metadata 0` 且 `-vn` 剥封面（`AudioConvert.vue:94-111`）——歌名/歌手/封面全丢
5. 【交互-疑似功能问题】码率滑条 step=32（`:142,:153`）会出现 288kbps——MPEG-1 L3 标准码率表无此档；WMA 等不可解码源走 ffmpeg libmp3lame `-b:a 288k`（`:105-106`）预期直接报错，需实测确认
6. 【交互】7 个 chip 仅以"· ffmpeg"后缀区分引擎（`:20-27`），有损/无损、是否触发 25MB 下载全靠 notice 长文阅读理解（`:129-136`），无徽标无 tooltip
7. 【灵魂】目标/码率/单声道不记忆（组件无 localStorage），输出文件名不可自定义（`:85` 硬编码 -converted）
8. 【家族共性】空态无操作引导、拖放区 top≈273、执行按钮在流内底部（M-15；共性-根因 1/4）

## 行业对标与差距

- **CloudConvert**：300+ 格式、批量队列、目标高级参数（采样率/声道/码率分列）、转换完成在线试听。差距：参数颗粒度与结果确认闭环。
- **123apps online-audio-converter**：批量拖放、逐文件码率、预估输出体积。差距：批量能力与量化反馈。
- 借鉴优先级：**编码进度接线 > 结果试听+体积对比 > 批量 > 目标 chip 有损/无损徽标 > 元数据保留**。

## 可拓展性

- 短期（1 周）：onProgress 接线变百分比；结果卡显示输入/输出体积对比 + 试听输出按钮（URL.createObjectURL）
- 中期（1 月）：批量队列（逐文件进度+逐文件设置）；chip 加"无损/有损/需 25MB"徽标；偏好记忆
- 远期：与 compress-audio 合并"转换+压缩"双模式；元数据透传（ffmpeg 路径加 -map_metadata）

## 优化处方（验收标准）

1. **编码进度**：`encodeMp3(src, kbps, p => …)` 接线到忙条。→ **验收：192kbps 转 3 分钟 MP3 时忙条显示 0→100% 递增，不再只有"请稍候"**
2. **结果卡**：转换完成后在按钮上方显示"输出 4.2MB（原 38.0MB，-89%）"+试听按钮。→ **验收：试听可直接播放输出文件；体积百分比与实际文件一致**
3. **chip 徽标**：WAV/FLAC chip 标"无损"，ffmpeg 系 chip 标"首次 25MB"。→ **验收：hover/查看 chip 即可判断格式性质，无需读 notice**
4. **码率档位改标准表**：`[96,128,160,192,256,320]`。→ **验收：滑条任意位置不出现 288；WMA→MP3@320 转换成功**
5. **偏好记忆**：目标/码率/单声道写 localStorage。→ **验收：选 FLAC+256kbps 刷新后保持**
6. **批量**（中期）：多文件列表 + 逐文件目标/码率，打包 zip 下载。→ **验收：一次拖 5 个文件全部转换并可整包下载**
