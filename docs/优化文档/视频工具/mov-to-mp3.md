# MOV 转 MP3（mov-to-mp3）

> 分类：视频工具｜模式：C（单列堆叠文件流，FfBase 基座）｜组件：`src/tools/video/components/FfmpegExtractAudio.vue`（63 行，与 video-to-mp3 共用）＋ 基座 `FfBase.vue`（272 行）｜引擎：`src/lib/ffmpeg.ts`（`-vn` + libmp3lame 重编码，FfmpegExtractAudio.vue:20）｜注册：`registry.ts:29`（needModel）｜家族共性参见 `compress-video.md`；共用组件分析参见 `video-to-mp3.md`
> 对标标杆：mp3cut.net / 123apps（提取类流量王）＋ CloudConvert（云，**架构天花板**）

## 七维评分：57 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 三格式+输出名可编辑；缺多音轨选择、缺码率选项、缺片段提取（同 mp4-to-mp3.md 扣分 4） |
| 可用性 | 20 | 10 | 10 | **目标人群恰是挡门高危人群**：iPhone"高效格式"录 HEVC MOV，Chrome/Edge 无法解码 → loadVideo 大概率 onerror（videoEngine.ts:27-30）面板不渲染（FfBase.vue:167）；家族按钮底部（:199-206，M-14） |
| 实用价值 | 15 | 12 | 12 | "iPhone 录像转 MP3"（采访/课堂/亲子记录）真实高频；与 video-to-mp3 同能力重复 |
| 交互便捷性 | 15 | 9 | 9 | 落地页零定制：preset mp3 即默认值（FfmpegExtractAudio.vue:9,12）；HEVC 用户看不到"加载失败怎么办"的预案文案 |
| UI 美观性 | 10 | 7 | 7 | 家族统一样式；340px 视频预览（FfBase.vue:215-221）对音频任务是死重 |
| 灵魂度 | 20 | 8 | 8 | desc 点名"从 MOV 录像里提取"（registry.ts:29）却无任何 iPhone 语境叙事；无试听（FfBase.vue:135-138）；家族耗时/下载进度缺位 |
| **加权总分** | 100 | | **57** | 场景明确、人群明确，但门禁风险与人群特征正面对撞且页内毫无应对 |
| 附加：大文件性能 | 10 | 5 | — | 纯音频编码较快但无耗时预告（家族共性） |
| 附加：移动端 | 10 | 4 | — | 家族共性（M-14 同构）；iPhone 用户占比高的页面对移动端体验敏感度更高 |

## 结论与优先级

**交互优化** · P1（含 HEVC 挡门实测定性）

判据：57 分；MOV 源的可用性风险与 mp4-to-mp3 不同级——本页的典型用户（iPhone 摄像）恰好最可能触发 HEVC 挡门，若实测确认则核心场景不可用，须升级 P0 处理。

## 扣分点明细

1. 【可用性-个性-疑似挡门】HEVC MOV 挡门风险：Chrome/Edge 不解码 HEVC，iPhone 默认"高效格式"的录像 loadVideo 大概率 onerror（videoEngine.ts:27-30 → FfBase.vue:167 面板不渲染）；而其音轨（AAC）本可直接解码——"为了提取音频被用户根本不需要的视频轨挡门"是 loadVideo 只验视频轨的结构性荒诞（videoEngine.ts:13-32），需实测定性
2. 【灵魂-个性】无高危场景预案：页内无"加载失败？你的录像可能是 HEVC 编码，试试视频格式转换"的引导——挡门时的 toast（videoEngine.ts:29）还让用户去"ffmpeg 转码类工具"，可他此刻就在转码工具里
3. 【功能】快路径未用（同 video-to-mp3.md 扣分 1）：MOV+AAC 源 decodeAudioData 在 Safari/Chrome 均可行，却强制 25MB（registry.ts:29 needModel）
4. 【功能】多音轨不可选：QuickTime 容器可含多条音轨，命令无 `-map`（FfmpegExtractAudio.vue:22）
5. 【可用性】输出无试听：onDone 直接下载（FfBase.vue:135-138）
6. 【可用性-家族】执行按钮流内底部（FfBase.vue:199-206，M-14，共性-根因 4）
7. 【交互-个性】落地页零定制：preset 与默认值相同（FfmpegExtractAudio.vue:9,12），无"iPhone 录像/采访记录"场景文案与 steps（registry.ts:29 无 steps）
8. 【灵魂-家族】无耗时预期、25MB 无下载进度、无 beforeunload（同 compress-video.md 扣分 2/4/5）

## loadVideo 门禁影响评估

四件套中风险最高：MOV 容器本身 Chrome 通常宽容（H.264+AAC 的 MOV 可进门），但 HEVC 编码的 MOV（iPhone"高效格式"默认开启存储优化时）大概率挡门——与本页目标人群高度重叠。挡门影响的是"能不能进门"，本工具唯一要做的是音轨，架构上应改用音频侧校验（decodeAudioData 探测）替代视频轨校验。

## 行业对标与差距

- **mp3cut.net / 123apps**：云端解码不依赖浏览器 codec，HEVC MOV 直接吃。差距：**解码架构天花板**（云端）；但 wasm ffmpeg 本身含 HEVC 解码能力不足（core 版不含 hevc 解码器），可用"挡门放行+黑屏预览+直接跑音频"的诚实路径逼近。
- **CloudConvert**（云）：MOV→MP3 成熟稳定。差距：同上，架构天花板。
- 借鉴优先级：**HEVC 挡门放行（音频侧校验）> 预案文案 > 快路径 > 选轨**。

## 可拓展性

- 短期（1 周）：HEVC 挡门放行（loadVideo 失败也进入流程：黑屏预览+说明+允许直接提取）；错误 toast 按工具语境改写
- 中期（1 月）：decodeAudioData 快路径；多音轨选择；场景化 steps
- 远期：与 mov-to-mp4 共享"MOV 救援"引导层（HEVC 检测→分流到提取或转码）

## 优化处方（验收标准）

1. **HEVC 实测与放行**：用 HEVC MOV 夹具实测 loadVideo；确认挡门后改为"预览失败仍可提取音频"。→ **验收：HEVC MOV 能走到"提取音频"并产出可播 MP3**
2. **音频侧门禁**：门禁逻辑改按"音轨能否解码"判断（decodeAudioData 探测），视频轨仅用于预览。→ **验收：视频轨不支持的 MOV 不再触发整体拒绝**
3. **预案文案**：加载失败 toast 改为"无法预览该视频（可能为 HEVC 编码），仍可尝试提取音频"。→ **验收：HEVC 源触发该文案而非通用错误**
4. **快路径 + 试听**：同 video-to-mp3.md 处方 1/2
5. **家族处方 1-2**：按钮置顶＋耗时预期文案（compress-video.md 处方 1/2）
