# OGG 转 MP3（ogg-to-mp3）

> 分类：音频工具｜模式：C（单列堆叠文件流，AudioConvert 薄壳 + AudioToolBase 底座）｜组件：`src/tools/audio/components/AudioConvert.vue`（182 行，与 convert-audio 等 10 入口共用）｜引擎：`src/lib/audioEngine`（decodeAudio 原生解 Ogg Vorbis + lamejs 编码，默认路径免 ffmpeg）｜注册：`registry.ts:24`（needModel: true）
> 对标标杆：123apps online-audio-converter.com（转换流量王）＋ CloudConvert

## 七维评分：61 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 12 | 12 | 码率滑条 64~320+单声道（AudioConvert.vue:142-144）；ID3 不写（`audioEngine.ts:70-89` 裸 MPEG 帧）、无批量、无源码率检测 |
| 可用性 | 20 | 12 | 12 | 默认目标恰为 MP3（:29）且 OGG 属快路径（:45 正则不含 ogg），主流浏览器原生解 Vorbis 即时完成✓；但编码无进度（:79 未传 onProgress）、无输出试听 |
| 实用价值 | 15 | 13 | 13 | OGG→MP3 解决"设备不认 ogg"的真实长尾需求；全本地免引擎比云端竞品快一个量级 |
| 交互便捷性 | 15 | 10 | 10 | 拖入即转两步完成；但 needModel: true（`registry.ts:24`）页面预挂"首次需下载引擎"预期而快路径根本不加载——预警失真 |
| UI 美观性 | 10 | 7 | 7 | 快底座波形+元信息条（时长/声道/采样率，AudioToolBase.vue:109-117）确认友好；家族布局见 M-15 |
| 灵魂度 | 20 | 7 | 7 | 解码即转流畅；但专属落地页的首条提示却在讲通用规则与"WAV→MP3 语义"（:129-135），OGG 用户第一眼读到的全是无关信息 |
| **加权总分** | 100 | | **61** | 解码路径真实顺畅，输在预警失真与量化反馈 |
| 附加：大文件性能 | 10 | 6 | — | encodeMp3 主线程同步（`audioEngine.ts:80-86`），长音频编码期间 UI 冻结 |
| 附加：移动端 | 10 | 6 | — | 单列可用；波形窄屏缩小后纯装饰（家族共性，见 audio-trimmer.md） |

## 结论与优先级

**交互优化** · P1

判据：61 分无硬伤——OGG 是全家族解码兼容性最好的入口之一（Chrome/Edge/Firefox 及较新 Safari 的 decodeAudioData 均原生解 Ogg Vorbis，`audioEngine.ts:16-26`），扣分集中在 needModel 误预警、编码无进度、mono 文案错误三点，均属交互级整改。

## 扣分点明细

1. 【交互】needModel 过度预警：注册标 `needModel: true`（`registry.ts:24`），但 ogg 源不命中 srcNeedsFf 强制正则（`AudioConvert.vue:45` 仅 wma/opus/amr 等），Vorbis 由 WebAudio 原生解——绝大多数用户永远见不到 ffmpeg，页面却带 25MB 下载预期，损耗信任（同 m4a-to-mp3 已登记问题）
2. 【可用性】编码无进度：`:79` 调 `encodeMp3(src, kbps)` 未传第三参，引擎签名支持 onProgress（`audioEngine.ts:70、:85`），接线即得（家族共性，见 audio-trimmer.md 扣分点3）
3. 【功能】ID3 元数据丢失：lamejs 输出裸帧无 tag，歌名/专辑/封面全空且无提示，需用户自行去 mp3-tag-editor 补写而页面不引导
4. 【交互-疑似事实性错误】"混为单声道（体积约减半）"（`:144`）：CBR MP3 体积=码率×时长，与声道数无关——同码率下单声道不省体积，收益是音质集中，文案误导
5. 【功能】有损→有损转码无源码率提示：源 OGG 均值码率可由 体积×8/时长 现算（file.size 与 meta.duration 均已在手），64kbps 源转 320kbps 只涨体积不涨音质，UI 零提醒
6. 【灵魂】通用 notice 未按入口定制：OGG→MP3 专属页首条提示先讲 M4A/FLAC 规则与"默认目标为 MP3（WAV→MP3 语义）请按需切换"（`:129-135`）——SEO 落地用户被无关信息稀释焦点
7. 【交互】码率滑条 step=32 产生 288kbps 非标准 MP3 档（`:142`，MPEG-1 L3 码率表无 288，家族共性，lamejs 行为需实测）；输出名硬编码 -converted、参数不记忆（`:85`）
8. 【家族共性】波形纯静态（`AudioToolBase.vue:70-81`，见 audio-trimmer.md 扣分点1）；执行按钮流内底部（M-15；共性-根因 4）

## 行业对标与差距

- **123apps online-audio-converter.com**：接受 OGG 输入、批量、转换前音质预估、完成后前后体积对比。差距：批量与量化反馈。
- **CloudConvert**：OGG→MP3 预设组+元数据保留选项。差距：ID3 透传（本站有 mp3-tag-editor 可接力但无动线提示）。
- 借鉴优先级：**needModel 修正 > 编码进度 > 源码率提示 > 入口定制文案 > ID3 透传**。

## 可拓展性

- 短期（1 周）：注册项 needModel 改 false 或运行时判定；onProgress 接线；mono 文案更正
- 中期（1 月）：批量队列+zip；源码率检测与"建议输出码率"提示；按入口定制 notice 首句
- 远期：与 mp3-tag-editor 联动"转换后补标签"；转换结果页挂"继续压缩到指定体积"入口（compress-audio 动线）

## 优化处方（验收标准）

1. **预警修正**：needModel 改运行时判定。→ **验收：Chrome 拖入 OGG 全流程零下载、页面无 25MB 提示**
2. **编码进度**：忙条显示百分比。→ **验收：5 分钟 OGG 转 MP3 期间进度 0→100% 递增**
3. **源码率提示**：加载后显示"源约 X kbps，建议输出 ≤128kbps"。→ **验收：拖入 3MB/5 分钟 OGG 后提示出现且估算误差 <15%**
4. **mono 文案更正**：改"同码率音质更集中（体积不变）"。→ **验收：文案不再出现"体积约减半"**
5. **入口定制文案**：notice 首句按 slug 定制为"OGG 解码即时完成，无需下载引擎；切换 M4A/FLAC 等目标才会加载"。→ **验收：ogg-to-mp3 页首行提示含"OGG 即时完成"字样**
