# M4A 转 WAV（m4a-to-wav）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 共用）｜引擎：`src/lib/audioEngine`（浏览器原生 AAC 解码 + encodeWav，默认路径免 ffmpeg）｜注册：`registry.ts:19`（needModel: true）
> 对标标杆：CloudConvert（输出规格天花板）＋ 123apps online-audio-converter.com

## 七维评分：55 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 解码→WAV 一条路走通；但位深写死 16bit（`audioEngine.ts:54`）、采样率随设备（`audioEngine.ts:17` AudioContext 默认值，"供后期处理"需要的 48k/24bit 全不可控）、无批量 |
| 可用性 | 20 | 9 | 9 | **硬伤：默认目标=MP3（`AudioConvert.vue:29`，组件不读路由）**——M4A 拖入一键得到 192kbps MP3，页面承诺"供后期处理"（registry.ts:19）的 WAV 要自己发现并切换 chip；无输出体积预估（WAV 动辄上百 MB） |
| 实用价值 | 15 | 13 | 13 | 语音备忘录/素材转 WAV 进剪辑软件是真实后期动线；免 ffmpeg 秒转是速度优势 |
| 交互便捷性 | 15 | 8 | 8 | 正确流程四步且首步就有默认值陷阱；>50MB 输出无预警（AGENTS.md 大文件提示纪律未在此落实） |
| UI 美观性 | 10 | 7 | 7 | 快底座波形+元信息条（AudioToolBase.vue:109-117）对输入确认友好；家族共性 M-15 |
| 灵魂度 | 20 | 7 | 7 | 无输出规格回显（采样率/位深）、无体积预估——转 WAV 的人最关心的三个数字界面一字不提 |
| **加权总分** | 100 | | **55** | 引擎快路径扎实，入口默认值陷阱与规格不可控是主因 |
| 附加：大文件性能 | 10 | 5 | — | 1 小时 M4A 解码进内存 + encodeWav 同步拼 600MB ArrayBuffer（`audioEngine.ts:34-68`）无预警 |
| 附加：移动端 | 10 | 6 | — | 单列可用；大体积下载在移动端更敏感 |

## 结论与优先级

**交互优化** · P0

判据：可用性 9/20 硬伤（默认产出错误格式）；规格选项缺失在"后期处理"场景是实打实的功能洞，但修默认值属交互优化且是最大杠杆。

## 扣分点明细

1. 【可用性-硬伤】默认目标与页面语义相反：`target = ref('mp3')`（`AudioConvert.vue:29`）+ MP3 chip 高亮居首（:124-128），/t/m4a-to-wav 页拖入 M4A 直接"转换并下载"得到 `xxx-converted.mp3`——**给后期用的页面默认产出有损压缩格式**，与 desc"供后期处理"（registry.ts:19）相悖
2. 【功能】输出规格不可控：位深 16bit 写死（`audioEngine.ts:54` setInt16）；采样率=设备 AudioContext 采样率（`audioEngine.ts:17` 未指定 sampleRate，44.1k 源在 48k 设备输出 48k）——后期工程对齐 48kHz/24bit 的需求两头都落空
3. 【可用性】无体积预估与大文件预警：10 分钟立体声 WAV≈103MB，下载前毫无提示（AGENTS.md">50MB 给提示"纪律未落实）
4. 【可用性】编码/解码无进度：快路径仅 spinner+忙条（`AudioToolBase.vue:107,119`）；`AudioConvert.vue:79` 未传引擎已支持的 onProgress（`audioEngine.ts:70`）
5. 【交互】needModel: true（`registry.ts:19`）过度预警——Chrome/Firefox 原生解 AAC，默认路径从不加载 ffmpeg
6. 【功能】无批量（语音备忘录批量转 WAV 进 DAW 是典型场景，`AudioToolBase.vue:101` single）
7. 【灵魂】无输出规格回显、无试听（`AudioConvert.vue:146` 即下载）
8. 【家族共性】波形纯静态（`AudioToolBase.vue:70-81`，见 audio-trimmer.md 扣分点1）；空态无引导、按钮流内底部（M-15；共性-根因 1/4）

## 行业对标与差距

- **CloudConvert**：WAV 输出采样率×位深×声道全可选，页内明示输出规格。差距：规格可控性代差。
- **123apps**：转换完成在线试听+批量。差距：结果确认与批量。
- 借鉴优先级：**slug 预设目标 > 输出规格回显 > 体积预警 > 规格选项 > 批量**。

## 可拓展性

- 短期（1 周）：按路由 slug 初始化 target='wav'；输出规格回显条；>50MB 预警
- 中期（1 月）：`new AudioContext({ sampleRate })` 指定解码采样率；encodeWav 24bit；批量
- 远期：输出规格面板组件化，全 WAV 系工具共用

## 优化处方（验收标准）

1. **slug 预设目标**：/t/m4a-to-wav 挂载即 WAV chip 高亮。→ **验收：拖入 M4A 直接下载 .wav，无需手动切换；故意切回 MP3 仍可（保留母工具能力）**
2. **输出规格回显**：文件加载后显示"将输出 48.0kHz / 16bit / 立体声 ≈ 103MB"。→ **验收：回显与实际文件属性一致；体积随预估超 50MB 时附加黄色预警**
3. **解码采样率指定**（中期）：可选 44.1/48kHz。→ **验收：48k 设备上选 44.1k 输出 WAV 头部 sampleRate=44100**
4. **编码进度**：忙条百分比。→ **验收：1 小时文件转换期间进度可见**
5. **needModel 修正**：去除注册项预警或改条件提示。→ **验收：Chrome 全流程无 25MB 提示**
