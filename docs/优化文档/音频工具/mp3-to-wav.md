# MP3 转 WAV（mp3-to-wav）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：`src/lib/audioEngine`（decodeAudio + encodeWav，纯 WebAudio 快路径）｜注册：`registry.ts:12`
> 对标标杆：CloudConvert（参数颗粒度天花板）＋ 123apps online-audio-converter.com

## 七维评分：55 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 转出 WAV 一条路走通；但无采样率选择（输出采样率=设备 AudioContext 采样率，`audioEngine.ts:17` 未指定）、位深写死 16bit（`audioEngine.ts:54`）、无 24bit——对标 CloudConvert 的采样率/位深分列选项差距明显 |
| 可用性 | 20 | 9 | 9 | **硬伤：默认目标=MP3（`AudioConvert.vue:29`，组件不读路由）与页面"MP3 转 WAV"语义相反**——拖入 MP3 直接点"转换并下载"得到的是 192kbps 再编码 MP3（双代有损+格式没变）；notice 文字提醒"请按需切换"（:134）靠不住 |
| 实用价值 | 15 | 13 | 13 | "剪辑软件与语音识别的通用输入"（registry.ts:12）场景真实；解码即转快路径对长音频友好 |
| 交互便捷性 | 15 | 8 | 8 | 正确流程需"拖入→看清 chip 行→点 WAV→下载"四步，首页默认引导却指向错误目标；无输出体积预估（WAV 体积可精确算出） |
| UI 美观性 | 10 | 7 | 7 | 波形+元信息条工整（AudioToolBase.vue:109-117）；家族共性 M-15 |
| 灵魂度 | 20 | 7 | 7 | 无"你的 WAV 输出为 48kHz/16bit"的参数回显——转无损的人最关心的两个数字界面上一字不提 |
| **加权总分** | 100 | | **55** | 引擎没问题，问题在入口默认值与参数透明度 |
| 附加：大文件性能 | 10 | 6 | — | encodeWav 同步拼 ArrayBuffer（`audioEngine.ts:34-68`），1 小时音频约 600MB 内存无预警 |
| 附加：移动端 | 10 | 6 | — | 单列可用；家族共性（M-15） |

## 结论与优先级

**交互优化 + 需拓展** · P0

判据：可用性 9/20 触发硬伤红线——页面默认行为直接产出与页面承诺相反的格式，属于"错误可发生且不可见"级缺陷；采样率/位深选项缺失为拓展项。

## 扣分点明细

1. 【可用性-硬伤】默认目标与页面语义相反：`target = ref<Target>('mp3')`（`AudioConvert.vue:29`）恒定初始 MP3，组件不读路由；`/t/mp3-to-wav` 页 chip 行 MP3 高亮居首（:124-128），用户惯性点击"转换并下载"得到 `xxx-converted.mp3`——MP3 再编码 MP3 双代有损，notice 一句"默认目标为 MP3…请按需切换"（:134）不足以拦截
2. 【功能】无采样率选择且输出采样率≠源采样率：`decodeAudio` 新建 AudioContext 未指定 sampleRate（`audioEngine.ts:17`），浏览器按设备输出采样率解码重采样——44.1kHz MP3 在 48kHz 设备上转出 48kHz WAV，"剪辑软件通用输入"的采样率实际不可控
3. 【功能】位深写死 16bit：`encodeWav` 头部 `setUint16(34,16)`（`audioEngine.ts:54`）+ Int16 量化（:63），无 24bit/32bit float 选项；声道封顶 2（:35）
4. 【可用性】无输出体积预估：WAV 体积=时长×采样率×声道×2 可精确预算，10 分钟≈100MB 的结果用户毫无预期（>50MB 提示纪律未落实）
5. 【可用性】解码/编码无进度（快路径仅 spinner+忙条，`AudioToolBase.vue:107,119`）
6. 【可用性】无输出试听/前后 A/B（`AudioConvert.vue:146` 即下载）
7. 【灵魂】无输出参数回显（采样率/位深/声道），转 WAV 的人无法确认拿到的是什么规格
8. 【家族共性】波形纯静态（`AudioToolBase.vue:70-81`，见 audio-trimmer.md 扣分点1）；空态无引导、按钮流内底部（M-15；共性-根因 1/4）

## 行业对标与差距

- **CloudConvert**：WAV 输出可选采样率（44.1/48/96k）×位深（16/24/32f）×声道，转换页明示输出规格。差距：**参数可控性代差**——专业场景（视频后期 48k、母带 24bit）本工具全覆盖不了。
- **123apps**：转换完成页直接试听输出。差距：结果确认闭环。
- 借鉴优先级：**默认目标按 slug 预设 > 采样率/位深选项 > 输出参数回显 > 体积预估 > 试听**。

## 可拓展性

- 短期（1 周）：按路由 slug 初始化 target（mp3-to-wav → 'wav'）；输出参数回显条
- 中期（1 月）：`new AudioContext({ sampleRate })` 指定解码采样率 + encodeWav 支持 24bit；体积预估
- 远期：快底座升级"输出规格"面板（采样率/位深/声道三选），与 audio-equalizer 等共用

## 优化处方（验收标准）

1. **按 slug 预设目标**：组件挂载时读路由映射目标（mp3-to-wav→wav 等 10 入口各归其位）。→ **验收：打开 /t/mp3-to-wav 时 WAV chip 高亮，拖入 MP3 直接下载 .wav，全程无需手动切换**
2. **输出规格回显**：加载文件后显示"将输出 48.0kHz / 16bit / 立体声 WAV ≈ 103MB"。→ **验收：回显值与下载文件实际属性一致（foveux/Audacity 验证）**
3. **采样率/位深选项**（中期）：下拉选 44.1/48kHz 与 16/24bit。→ **验收：选 24bit 后输出 WAV 头部 bitsPerSample=24（`audioEngine.ts:54` 相应扩展）**
4. **解码采样率指定**：AudioContext 按source或用户选择初始化。→ **验收：44.1kHz MP3 在 48kHz 设备上转出 44.1kHz WAV**
5. **大文件预警**：预估体积 >50MB 时下载按钮旁提示。→ **验收：1 小时 MP3 转 WAV 显示体积预警文案**
