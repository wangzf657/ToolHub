# MP3 转 M4A（mp3-to-m4a）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + FfAudioBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：ffmpeg.wasm `-c:a aac`（FFmpeg 原生 AAC 编码器，`AudioConvert.vue:97-98`——非 MediaRecorder 拼装，实现真实）｜注册：`registry.ts:18`（needModel: true）
> 对标标杆：CloudConvert（AAC 参数天花板）＋ 123apps online-audio-converter.com

## 七维评分：54 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | AAC 编码真实（`-c:a aac -b:a`，AudioConvert.vue:97-98）但 profile 不可选（HE-AC/AAC-LC 无从选）、无元数据（`-map_metadata` 未用 :94-111）、无批量 |
| 可用性 | 20 | 9 | 9 | **硬伤：默认目标=MP3（`AudioConvert.vue:29`，组件不读路由）与页面"MP3 转 M4A"相反**——拖入 MP3 直接下载得到 MP3→MP3 双代有损；切到 M4A 后底座换 FfAudioBase，波形/时长/声道显示全部消失（`FfAudioBase.vue:107-112` 仅文件名+大小） |
| 实用价值 | 15 | 12 | 12 | "苹果友好、同码率音质更优"（registry.ts:18）场景成立（iPhone 铃声/播客分发），但受众窄于 MP3/WAV 系 |
| 交互便捷性 | 15 | 8 | 8 | 正确路径=拖入→辨 chip→切 M4A→等 25MB→转换；25MB 首次下载仅 note 文案无下载进度（`FfAudioBase.vue:48`） |
| UI 美观性 | 10 | 7 | 7 | ffmpeg 进度条带百分比（`FfAudioBase.vue:118-121`）是家族里反馈最好的路径；但两底座视觉割裂（波形区凭空消失） |
| 灵魂度 | 20 | 7 | 7 | 已选文件跨底座自动携带（`AudioConvert.vue:50-56`）是亮点；但"同码率体积更小"desc 承诺（registry.ts:18）无任何量化对比兑现 |
| **加权总分** | 100 | | **54** | 编码器真实可靠，入口默认值与底座切换体验拖累整体 |
| 附加：大文件性能 | 10 | 7 | — | ffmpeg 路径有百分比进度（家族最佳），WASM 转码速度可接受 |
| 附加：移动端 | 10 | 5 | — | 25MB WASM 在移动网络不友好且无 WiFi 预检 |

## 结论与优先级

**交互优化** · P0

判据：可用性 9/20 触发硬伤——页面默认产出与承诺相反的格式；AAC 实现本身真实无水分，问题全在入口与底座切换体验。

## 扣分点明细

1. 【可用性-硬伤】默认目标与页面语义相反：`target = ref('mp3')`（`AudioConvert.vue:29`）+ chip 行 MP3 高亮居首（:124-128），/t/mp3-to-m4a 页拖入 MP3 一键得到 `xxx-converted.mp3`（再编码双代有损，且格式根本没变）；notice"默认目标为 MP3…请按需切换"（:134）不足以拦截
2. 【可用性】底座切换降级：选 M4A 后 AudioToolBase→FfAudioBase，波形图、时长/声道/采样率元信息条全部消失（`FfAudioBase.vue:107-112`），用户对输入文件的确认手段骤降；文件虽自动携带（:50-56）但展示断层
3. 【功能】AAC 编码参数单一：仅码率可调（:151-153），profile（AAC-LC/HE-AAC）、采样率不可选——64~320 滑条下限对 HE-AAC 语音场景偏保守且无提示
4. 【可用性】25MB 首次下载横幅（`FfAudioBase.vue:113-116`）必要但加载过程仅"正在加载 ffmpeg 引擎"文案（:48），无下载进度条——弱网用户不知要等多久
5. 【功能】无元数据：ffmpeg 命令未加 `-map_metadata 0`（`AudioConvert.vue:94-111`），MP3 的 ID3 歌名/封面到 M4A 全丢
6. 【灵魂】"同码率音质更优"卖点无量化兑现：无输入/输出体积对比、无试听（点击即下载 `DownloadButton.vue:21-31`）
7. 【家族共性】空态无引导、执行按钮流内底部（M-15；共性-根因 1/4）；波形纯静态仅快底座才有（`AudioToolBase.vue:70-81`）

## 行业对标与差距

- **CloudConvert**：AAC 输出可选 profile/采样率/声道，转换后在线试听，元数据保留选项。差距：参数颗粒度与结果确认。
- **Apple Music/itunes 编码参照**：AAC-LC 256kbps VBR 是苹果官方归档档位——本工具连"推荐档位"文案都没有。
- 站内动线：转 M4A 的用户常接 iPhone 导入/铃声制作，结果页即下载、无"接下来做什么"引导，convert-audio 母工具入口也未互挂。
- 借鉴优先级：**slug 预设目标 > 25MB 下载进度 > 底座切换保留波形/元信息 > profile 预设 > 元数据透传**。

## 可拓展性

- 短期（1 周）：按路由 slug 初始化 target；getFf 下载加进度（fetch 流式读取可算百分比）
- 中期（1 月）：FfAudioBase 补时长/声道显示（ffprobe 或解码探测）；AAC 预设（语音 64k HE/通用 128k/音乐 256k）；元数据透传
- 远期：双底座统一抽象（同一文件卡组件），消除切换断层

## 优化处方（验收标准）

1. **slug 预设目标**：挂载时按路由设 target='m4a'。→ **验收：打开 /t/mp3-to-m4a 时 M4A chip 高亮，拖入 MP3 直接产出 .m4a，无需手动切换**
2. **25MB 下载进度**：getFf 期间显示"下载引擎 12.4/25.3MB"。→ **验收：首次加载出现体积进度且完成后不再出现**
3. **底座切换保留输入确认**：FfAudioBase 文件行补时长/声道/采样率（ffprobe 一行命令可得）。→ **验收：切 M4A 目标后文件卡仍显示"3:24 · 立体声 · 44.1kHz"**
4. **AAC 预设**：三档 chip（语音/通用/高保真）映射 64/128/256k。→ **验收：点"语音"后码率自动 64k 且文案说明 HE-AC 适用场景**
5. **体积对比**：完成后显示"8.2MB → 5.1MB"。→ **验收：百分比与实际文件一致**
