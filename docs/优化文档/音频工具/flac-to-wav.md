# FLAC 转 WAV（flac-to-wav）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：`src/lib/audioEngine`（浏览器原生 FLAC 解码 + encodeWav，默认路径免 ffmpeg）｜注册：`registry.ts:23`（needModel: true）
> 对标标杆：CloudConvert（无损互转规格天花板）＋ foobar2000（位深/采样率保真参照，桌面）

## 七维评分：53 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 解码→WAV 走通；但位深写死 16bit（`audioEngine.ts:54`）——Hi-Res 24bit FLAC 静默降位深；采样率随设备 AudioContext（`audioEngine.ts:17`）；声道封顶 2（`audioEngine.ts:35`）；无批量 |
| 可用性 | 20 | 8 | 8 | **硬伤：默认目标=MP3@192kbps（`AudioConvert.vue:29,:141`）**——"FLAC 转 WAV"页一键产出的是**有损** MP3，把页面存在意义（无损互转）直接击穿；且不读路由、notice 文字拦截无效（:134） |
| 实用价值 | 15 | 12 | 12 | "两者音质完全一致"（registry.ts:23）场景真实（DAW 导入/烧录），但 24bit 降 16bit+采样率漂移让"完全一致"名不副实 |
| 交互便捷性 | 15 | 8 | 8 | 正确流程四步且默认值指向错误目标；输出规格（kHz/bit）不回显，无损人群无法核验 |
| UI 美观性 | 10 | 7 | 7 | 波形+元信息条（AudioToolBase.vue:109-117）可用；家族共性 M-15 |
| 灵魂度 | 20 | 7 | 7 | 无任何"保真核验"细节——转无损的人最想看到输出规格与源一致性的确认，界面一字不提 |
| **加权总分** | 100 | | **53** | 家族内最危险入口：默认行为与承诺相悖+静默降位深 |
| 附加：大文件性能 | 10 | 5 | — | Hi-Res FLAC 解码进内存+encodeWav 同步拼 ArrayBuffer（`audioEngine.ts:34-68`），24bit/96k 专辑内存数百 MB 无预警 |
| 附加：移动端 | 10 | 6 | — | 单列可用；大 WAV 下载无 WiFi 预检 |

## 结论与优先级

**交互优化** · P0

判据：可用性 8/20 硬伤且性质最重——默认有损输出+静默降位深双重违背"无损互转"承诺；两者都是单点改造，先修默认值。

## 扣分点明细

1. 【可用性-硬伤】默认目标与页面语义相反且后果最重：`target = ref('mp3')`（`AudioConvert.vue:29`），/t/flac-to-wav 页拖入 FLAC 一键得到 `xxx-converted.mp3`（192kbps 有损，`:141` 默认码率）——desc"两者音质完全一致"（registry.ts:23）被默认行为直接证伪；不知情用户把有损 MP3 当无损 WAV 拿去母带/存档是数据事故
2. 【功能-硬伤边缘】24bit FLAC 静默降为 16bit：`encodeWav` 固定写 16bit PCM 头（`audioEngine.ts:54` setUint16）+Int16 量化（:63），Hi-Res 源无任何降位提示；叠加解码重采样（`audioEngine.ts:17` AudioContext 按设备采样率），输出与源"逐样本一致"实际不成立且无免责说明
3. 【功能】声道封顶 2：`Math.min(2, channels)`（`audioEngine.ts:35`），5.1 多声道 FLAC 不支持且无提示
4. 【交互】needModel: true（`registry.ts:23`）过度预警——Chrome/Firefox 原生解 FLAC，默认路径从不加载 ffmpeg
5. 【可用性】无输出规格回显（kHz/位深/声道）与体积预估（1 小时 16bit/48k WAV≈660MB，>50MB 提示纪律未落实）
6. 【可用性】解码/编码无进度（快路径仅 spinner+忙条 `AudioToolBase.vue:107,119`；`AudioConvert.vue:79` 未传引擎已支持的 onProgress `audioEngine.ts:70`）
7. 【功能】无批量（整专逐首拖）；无输出试听（`AudioConvert.vue:146` 即下载）
8. 【家族共性】波形纯静态（`AudioToolBase.vue:70-81`，见 audio-trimmer.md 扣分点1）；空态无引导、按钮流内底部（M-15；共性-根因 1/4）

## 行业对标与差距

- **CloudConvert**：WAV 输出位深（16/24/32f）×采样率（44.1/48/96k）×声道全可选，参数页明示"与源一致"选项。差距：**保真可控性代差**——Hi-Res 用户在本工具拿不到 24bit 输出。
- **foobar2000**：转档时位深处理策略可选（source/16/24）+重采样开关。差距：静默降位深 vs 显式策略选择。
- 借鉴优先级：**slug 预设目标 > 24bit 支持+降位提示 > 输出规格回显 > needModel 修正 > 批量**。

## 可拓展性

- 短期（1 周）：slug 预设 target='wav'；输出规格回显+源规格对比（"源 24bit/96k → 输出 16bit/48k"黄色警示）；needModel 修正
- 中期（1 月）：encodeWav 24bit 路径（Int24 写入）；`new AudioContext({ sampleRate })` 保采样率；多声道支持
- 远期：位深策略选择（保持源/降 16 显式确认）；与 audio-equalizer 等共用输出规格面板

## 优化处方（验收标准）

1. **slug 预设目标**：/t/flac-to-wav 挂载即 WAV chip 高亮。→ **验收：拖入 FLAC 直接下载 .wav，全程无手动切换**
2. **降位/重采样警示**：输出规格回显与源不一致时黄色警示"源 24bit/96kHz 将降为 16bit/48kHz"。→ **验收：拖入 Hi-Res FLAC 后警示条出现；16bit/44.1k 源不出现**
3. **24bit 输出**（中期）：encodeWav 支持 Int24。→ **验收：24bit FLAC 输出 WAV 头部 bitsPerSample=24（`audioEngine.ts:54` 扩展）， Audacity 验证无量化损失**
4. **needModel 修正**：去除注册项预警。→ **验收：Chrome 全流程无 25MB 提示**
5. **体积预警**：预估输出 >50MB 时提示。→ **验收：1 小时专辑转 WAV 显示预警文案**
