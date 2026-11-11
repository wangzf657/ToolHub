# MP4 转 WAV（mp4-to-wav）

> 分类：视频工具｜模式：C（单列堆叠文件流，FfBase 基座）｜组件：`src/tools/video/components/FfmpegExtractAudio.vue`（63 行，与 video-to-mp3 共用）＋ 基座 `FfBase.vue`（272 行）｜引擎：`src/lib/ffmpeg.ts`（`-vn` + pcm_s16le 重编码，FfmpegExtractAudio.vue:20）｜注册：`registry.ts:30`（needModel）｜家族共性参见 `compress-video.md`；共用组件分析参见 `video-to-mp3.md`
> 对标标杆：CloudConvert（云，**架构天花板**）＋ Audacity（桌面剪辑链路的 WAV 输入参照）

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | pcm_s16le 输出对剪辑/语音识别场景够用（FfmpegExtractAudio.vue:20）；缺位深选择（16bit 写死）、缺采样率控制、缺片段提取、缺多音轨选择 |
| 可用性 | 20 | 11 | 11 | MP4 源挡门概率低（同 mp4-to-mp3.md 评估）；家族按钮底部（FfBase.vue:199-206，M-14）；**无输出体积预估**——WAV 约 10MB/分钟，长视频输出数百 MB 无任何预警 |
| 实用价值 | 15 | 12 | 12 | 剪辑软件与 ASR 的通用输入（desc 与 ext-note 一致，registry.ts:30、FfmpegExtractAudio.vue:38），场景真实；但与站内 mp3-to-wav 的"WAV 侧"叙事部分重叠 |
| 交互便捷性 | 15 | 9 | 9 | preset wav 正确生效（PRESETS['mp4-to-wav']='wav'，FfmpegExtractAudio.vue:12，非 no-op）；无体积预估、无试听、按钮底部拖后腿 |
| UI 美观性 | 10 | 7 | 7 | 家族统一样式；340px 视频预览（FfBase.vue:215-221）对音频任务是死重 |
| 灵魂度 | 20 | 8 | 8 | **desc"提取无损 WAV 音轨"口径误导**（registry.ts:30）：源音轨几乎必为有损 AAC，转 PCM 只是"容器无损"，不能还原已丢失的音质；ext-note（:38）只说适用场景未纠正 |
| **加权总分** | 100 | | **58** | 输出正确、场景真实，但"无损"话术与"巨体积无预警"是两处诚信/负担缺口 |
| 附加：大文件性能 | 10 | 4 | — | WAV 输出体积 ≈ 源码率的 10~30 倍，全部在 wasm 虚拟 FS 内存中写读（ffmpeg.ts:44-58），1 小时源 ≈600MB 输出，标签页崩溃风险高且无预警 |
| 附加：移动端 | 10 | 3 | — | 家族共性 + 大内存输出在手机上更危险（M-14 同构） |

## 结论与优先级

**交互优化** · P1（口径修正 + 体积预估 + 快路径）

判据：58 分；功能正确，但 desc 的"无损"承诺在绝大多数场景是假命题（源是有损 AAC），且 WAV 的体积代价完全未管理——两处都属"诚实性"缺口，先修口径再做体验。

## 扣分点明细

1. 【灵魂-口径】"提取无损 WAV 音轨"（registry.ts:30）误导：MP4 音轨几乎必为有损编码，解码→pcm_s16le 只是换封装（且量化到 16bit），**不能还原编码时已丢失的信息**；ext-note（FfmpegExtractAudio.vue:38）只说"WAV 适合剪辑与语音识别"，未说明"无损指的是容器，音质上限=源 AAC"——用户带着"无损=音质提升"的期待来，带着误解走
2. 【可用性-个性】无输出体积预估：WAV≈10.3MB/分钟（48kHz/16bit/立体声），载入 1 小时讲座即 ~620MB，页内无"预计输出 X MB"提示（FfmpegExtractAudio.vue:22 无任何体积逻辑；对照 compress-video 有目标体积控制）
3. 【功能】快路径未用且本页最有资格免下载：WAV 编码是四格式中最轻的（PCM 封装），站内 encodeWav 已被音频分类 wav-to-mp3/mp3-to-wav 证明免 25MB 可行（audio/registry.ts:11-12、AudioConvert.vue:13），本页却 needModel（registry.ts:30）
4. 【功能】16bit 硬编码：pcm_s16le 写死（FfmpegExtractAudio.vue:20），无 24bit/32bit float 选项——专业剪辑链路（Audacity/达芬奇）会挑位深，源音轨信息也无处查看
5. 【附加-性能】输出全内存驻留：ffRun 在虚拟 FS 写入+readFile（ffmpeg.ts:44-58）无流式路径，数百 MB WAV 可能直接把 wasm 堆打爆，失败时只报"未生成输出文件"（FfBase.vue:130）——用户无法理解是内存上限
6. 【可用性】输出无试听：onDone 直接下载（FfBase.vue:135-138）
7. 【可用性-家族】执行按钮流内底部（FfBase.vue:199-206，M-14，共性-根因 4）
8. 【灵魂-家族】无耗时预期、25MB 无下载进度、无 beforeunload（同 compress-video.md 扣分 2/4/5）

## loadVideo 门禁影响评估

同 mp4-to-mp3：MP4+H.264/AAC 稳定进门；HEVC MP4 在 Chrome 存在挡门可能（需实测），但音轨校验才应该是本页门禁的正确口径（见 mov-to-mp3.md 处方 2）。

## 行业对标与差距

- **CloudConvert**（云）：mp4→wav 含采样率/位深/声道参数矩阵。差距：架构天花板；参数面纯前端可追。
- **Audacity / 剪辑软件**：导入即显示位深/采样率/声道，导出可选 16/24/32f。差距：**参数透明度**——本页连源音轨是什么编码都不展示。
- 借鉴优先级：**口径修正 > 输出体积预估 > 快路径 > 位深/采样率选项**。

## 可拓展性

- 短期（1 周）：ext-note 补"源为有损编码时 WAV 无法还原音质"披露；载入后显示"预计输出 ≈ 时长×10MB/分钟"；decodeAudioData+encodeWav 快路径
- 中期（1 月）：位深（16/24/32f）与采样率（44.1/48k）选项；超阈值（>300MB）预警并建议改用 M4A/MP3
- 远期：与 convert-audio 的 WAV 系列合并"WAV 工作台"（统一位深/采样率/裁剪）

## 优化处方（验收标准）

1. **口径修正**：desc 与页内文案改为"WAV 无损封装（音质上限取决于源音轨）"。→ **验收：registry.ts:30 与 ext-note 不再出现"提取无损"式绝对表述**
2. **体积预估**：载入视频后显示"预计 WAV 输出 ≈ X MB"。→ **验收：5:00 视频显示约 150MB（±10%），且 >300MB 时黄色预警建议改用 M4A**
3. **快路径**：MP4 源优先 decodeAudioData+encodeWav。→ **验收：5MB MP4 首次转换无 25MB 下载提示，产物可被 Audacity 导入且采样率与源一致**
4. **位深选项**：新增 16/24/32f 下拉。→ **验收：选 32f 后命令串含 pcm_f32le**
5. **家族处方 1-2**：按钮置顶＋耗时预期文案（compress-video.md 处方 1/2）
