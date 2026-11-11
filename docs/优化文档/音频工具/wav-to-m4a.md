# WAV 转 M4A（wav-to-m4a）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + FfAudioBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：ffmpeg.wasm `-c:a aac`（FFmpeg 原生 AAC 编码器，`AudioConvert.vue:97-98`，实现真实）｜注册：`registry.ts:20`（needModel: true，此处预警准确）
> 对标标杆：CloudConvert＋ 123apps online-audio-converter.com

## 七维评分：54 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | AAC 真编码（`AudioConvert.vue:97-98`）+码率滑条+单声道；但 profile 不可选、无元数据（-map_metadata 未用 :94-111）、无批量、无压缩等级 |
| 可用性 | 20 | 9 | 9 | **硬伤：默认目标=MP3（`AudioConvert.vue:29`，组件不读路由）**——WAV 拖入一键得到的是 MP3 不是 M4A；且切 M4A 后底座换 FfAudioBase，**WAV 源本可画波形预览却随底座一起消失**（`FfAudioBase.vue:107-112` 仅文件名+大小），输入确认手段归零 |
| 实用价值 | 15 | 12 | 12 | "WAV 压缩为 M4A 体积缩小约 10 倍"（registry.ts:20）场景成立（素材库瘦身/iPhone 分发），但无量化兑现 |
| 交互便捷性 | 15 | 8 | 8 | 正确路径=拖入→切 chip→首次等 25MB→转换；25MB 下载仅文案无进度（`FfAudioBase.vue:48`）；不记忆设置 |
| UI 美观性 | 10 | 7 | 7 | ffmpeg 百分比进度条（`FfAudioBase.vue:118-121`）反馈良好；底座切换布局跳变明显（波形区凭空消失） |
| 灵魂度 | 20 | 7 | 7 | 文件跨底座自动携带（`AudioConvert.vue:50-56`）是亮点；但"体积缩小 10 倍"承诺（registry.ts:20）UI 零兑现，无输入/输出体积对比 |
| **加权总分** | 100 | | **54** | 编码器真实、进度完善，输在入口默认值与底座切换的信息断层 |
| 附加：大文件性能 | 10 | 7 | — | ffmpeg 路径百分比进度是家族最佳；WASM 转码长 WAV 可接受 |
| 附加：移动端 | 10 | 5 | — | 25MB WASM 首用对移动网络不友好，无 WiFi 预检提示 |

## 结论与优先级

**交互优化** · P0

判据：可用性 9/20 硬伤——默认产出错误格式叠加底座切换后输入确认归零；功能面本身不缺大件，故只开交互优化。

## 扣分点明细

1. 【可用性-硬伤】默认目标与页面语义相反：`target = ref('mp3')`（`AudioConvert.vue:29`）+ MP3 chip 高亮居首（:124-128），/t/wav-to-m4a 页拖入 WAV 一键产出 `xxx-converted.mp3`（有损，且非页面承诺的 M4A）
2. 【可用性】底座切换信息断层：选 M4A 触发 useFf（`AudioConvert.vue:46-47`），快底座（波形 `AudioToolBase.vue:70-81` + 元信息 :109-117）整体替换为 FfAudioBase 纯文件名行（`FfAudioBase.vue:107-112`）——WAV 源完全可以在 ffmpeg 底座保留解码前的文件级预览，现状是体验悬崖
3. 【功能】"缩小约 10 倍"无量化：加载后即可按时长×码率预估输出体积，UI 一字不提（registry.ts:20 承诺悬空）
4. 【可用性】25MB 首次下载仅文案（`FfAudioBase.vue:48,113-116`）无下载进度，弱网等待焦虑
5. 【功能】AAC profile 不可选（HE-AAC 低码率语音场景无入口）；64~320 滑条对 8k 电话录音偏高无提示
6. 【功能】元数据丢失：`-map_metadata 0` 未加（`AudioConvert.vue:94-111`）
7. 【灵魂】无"你的浏览器无法原生编码 AAC，故需 ffmpeg"的能力说明——引擎切换对用户纯黑盒；设置不记忆
8. 【家族共性】空态无引导、执行按钮流内底部（M-15；共性-根因 1/4）；此路径无波形可点（快底座的静态波形局限见 audio-trimmer.md 扣分点1）

## 行业对标与差距

- **CloudConvert**：AAC profile/采样率/声道可选+元数据保留+输出试听。差距：参数颗粒度。
- **123apps**：转换前体积预估+完成后试听。差距：量化反馈闭环。
- 借鉴优先级：**slug 预设目标 > 体积预估 > 25MB 下载进度 > 底座信息保留 > profile 预设**。

## 可拓展性

- 短期（1 周）：slug 预设 target='m4a'；按 duration×kbps 显示预估体积；getFf 下载进度
- 中期（1 月）：FfAudioBase 补文件时长/声道行；AAC 预设档；结果体积对比+试听
- 远期：WebCodecs AAC 编码器探测（Chrome 已支持 AAC 编码的 AudioEncoder）——真正免 25MB 的纯浏览器路径，探测成功则降级 ffmpeg

## 优化处方（验收标准）

1. **slug 预设目标**：/t/wav-to-m4a 挂载即 M4A chip 高亮。→ **验收：拖入 WAV 直接产出 .m4a，全程无手动切换**
2. **体积预估**：加载后显示"12:00 @128kbps ≈ 11.5MB（原 61.8MB，-81%）"。→ **验收：预估误差 <10% 且随码率联动**
3. **25MB 下载进度**：显示"下载引擎 8.1/25.3MB"。→ **验收：首次加载有体积进度，缓存后不再出现**
4. **底座信息保留**：切 M4A 后文件卡仍显示时长/声道/采样率。→ **验收：切换前后输入信息卡字段一致**
5. **WebCodecs 探测**（远期）：`AudioEncoder.isConfigSupported(aac)` 成功时走纯浏览器路径。→ **验收：支持的浏览器上 M4A 转换不再触发 25MB 下载**
