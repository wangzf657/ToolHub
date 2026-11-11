# WAV 转 FLAC（wav-to-flac）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + FfAudioBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：ffmpeg.wasm `-c:a flac`（FFmpeg 原生 FLAC 编码器，`AudioConvert.vue:99-100`，真无损实现）｜注册：`registry.ts:22`（needModel: true，预警准确）
> 对标标杆：CloudConvert（无损参数天花板）＋ foobar2000（压缩等级/标签映射参照，桌面）

## 七维评分：54 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | FLAC 真编码（`AudioConvert.vue:99-100`）但压缩等级（-compression_level 0~12）不可调、WAV INFO 标签不映射为 Vorbis Comment（:94-111 无 -map_metadata）、无批量 |
| 可用性 | 20 | 9 | 9 | **硬伤：默认目标=MP3（`AudioConvert.vue:29`，组件不读路由）**——"WAV 转 FLAC"页一键产出的是 192kbps 有损 MP3；切 FLAC 后底座换 FfAudioBase，波形+元信息消失（`FfAudioBase.vue:107-112`）；25MB 下载无进度（:48） |
| 实用价值 | 15 | 12 | 12 | "音质不变体积减半"（registry.ts:22）对音库归档真实有用；但归档用户往往要批量+压缩等级，本工具都不给 |
| 交互便捷性 | 15 | 8 | 8 | 正确路径=拖入→切 chip→首次等 25MB→转换；无压缩率预估/回显，归档价值无法当场验证 |
| UI 美观性 | 10 | 7 | 7 | ffmpeg 百分比进度条（`FfAudioBase.vue:118-121`）反馈好；底座切换布局跳变 |
| 灵魂度 | 20 | 7 | 7 | 文件跨底座携带（`AudioConvert.vue:50-56`）是亮点；但"减半"承诺（registry.ts:22）无量化兑现——压缩率恰是此工具的灵魂数字 |
| **加权总分** | 100 | | **54** | 无损实现无水分，入口默认值与量化反馈两头失守 |
| 附加：大文件性能 | 10 | 7 | — | ffmpeg 百分比进度家族最佳；WASM FLAC 编码速度可接受 |
| 附加：移动端 | 10 | 5 | — | 25MB WASM+大 WAV 上传内存压力，移动端不友好 |

## 结论与优先级

**交互优化** · P0

判据：可用性 9/20 硬伤——无损归档页的默认行为产出有损格式，直接违背页面存在意义；修复属于单点交互改造。

## 扣分点明细

1. 【可用性-硬伤】默认目标与页面语义相反：`target = ref('mp3')`（`AudioConvert.vue:29`）+ MP3 chip 高亮居首（:124-128），/t/wav-to-flac 页拖入 WAV 一键产出 `xxx-converted.mp3`——**归档页默认执行有损转码**，与"音质不变"承诺（registry.ts:22）根本对立
2. 【可用性】底座切换信息断层：选 FLAC 触发 useFf（`AudioConvert.vue:46-47`），快底座波形（`AudioToolBase.vue:70-81`）+元信息条（:109-117）整体替换为纯文件名行（`FfAudioBase.vue:107-112`），WAV 输入确认手段归零
3. 【功能】压缩等级不可调：ffmpeg FLAC 支持 `-compression_level` 0~12（速度/压缩率权衡），命令未暴露（`AudioConvert.vue:99-100` 仅 `-c:a flac`）——归档用户的唯一可调项缺席
4. 【功能】"体积减半"零量化：加载后即可按时长×声道×采样率预估 WAV 体积、按经验系数估 FLAC 结果，UI 无预估无回显无试听（`AudioConvert.vue:146` 即下载）
5. 【可用性】25MB 首次下载仅文案（`FfAudioBase.vue:48,113-116`）无下载进度
6. 【功能】标签不映射：WAV INFO 块→FLAC Vorbis Comment 无 `-map_metadata 0`（`AudioConvert.vue:94-111`）
7. 【灵魂】无"为什么需要 ffmpeg"能力说明（浏览器无原生 FLAC 编码器，WASM 是唯一正解——说了用户就愿等 25MB）；设置不记忆
8. 【家族共性】空态无引导、执行按钮流内底部（M-15；共性-根因 1/4）

## 行业对标与差距

- **CloudConvert**：FLAC 输出可选压缩等级/位深/采样，转换后试听。差距：参数颗粒度。
- **foobar2000**：FLAC 压缩等级 0~8 预设+标签映射+批量队列。差距：归档工作流三件套全缺。
- 借鉴优先级：**slug 预设目标 > 压缩率回显 > 压缩等级选项 > 25MB 下载进度 > 标签映射**。

## 可拓展性

- 短期（1 周）：slug 预设 target='flac'；结果卡显示压缩率（输出/输入体积）；getFf 下载进度
- 中期（1 月）：压缩等级下拉（0~12，默认 5）；WAV→FLAC 标签映射；批量+zip
- 远期：纯 JS FLAC 编码器（libflac.js）探测——免 25MB 的替代路径，编码耗时换下载体积可作选项

## 优化处方（验收标准）

1. **slug 预设目标**：/t/wav-to-flac 挂载即 FLAC chip 高亮。→ **验收：拖入 WAV 直接产出 .flac，全程无手动切换**
2. **压缩率回显**：完成后显示"61.8MB → 31.2MB（-50%，无损）"。→ **验收：数字与实际文件一致且标注"无损"字样**
3. **压缩等级**（中期）：下拉 0~12 默认 5，附"等级越高压缩越慢文件越小"。→ **验收：等级 12 输出比等级 0 更小且转换时间可感更长**
4. **25MB 下载进度**：显示"下载引擎 17.2/25.3MB"。→ **验收：首次加载有体积进度**
5. **底座信息保留**：切 FLAC 后文件卡仍显示时长/声道/采样率。→ **验收：输入信息字段与快底座一致**
