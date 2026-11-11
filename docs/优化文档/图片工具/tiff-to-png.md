# TIFF 转换器（tiff-to-png）

> 分类：图片工具｜模式：C（单列堆叠文件流，imgcvt 通用组件）｜组件：`src/components/common/ImageConvertTool.vue`（135 行）｜引擎：`src/lib/imageEngine.ts:57-76`（decodeTiff，懒加载 UTIF，仅取 ifds[0] 首页）
> 对标标杆：ezgif（TIFF 转换全家）＋ CloudConvert（多页 TIFF 逐页导出）
> 家族注：15 个 imgcvt 共用组件，家族共性详见 `png-to-jpg.md`；本工具是家族中唯一依赖 wasm/JS 解码器的输入源

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | 仅 PNG 单目标（registry.ts:34 quality:false）；**多页 TIFF 只取首页**（imageEngine.ts:64-66 ifds[0]，desc 有交代但不给选择）；无压缩格式选项（LZW/ZIP 的 TIFF 依赖 UTIF 支持面）；无页码选择/逐页导出 |
| 可用性 | 20 | 10 | 10 | 完成即自动 zip 无结果预览（ImageConvertTool.vue:55，家族共性+M-12）；**首次使用静默下载 utif 解码器**——无 needModel 标记（registry.ts:34）、无"正在加载解码器"文案，用户面对大 TIFF 卡顿不明所以 |
| 实用价值 | 15 | 12 | 12 | "扫描仪/传真出的 TIFF 打不开"痛点真实，desc 承诺"解决浏览器打不开的问题"兑现；但 TIFF 常是扫描多页文档，只出首页价值折半 |
| 交互便捷性 | 15 | 11 | 11 | 批量+自动打包；无 resize、无质量滑条（PNG 无损合理）；多页场景想要第 3 页？没有任何入口 |
| UI 美观性 | 10 | 7 | 7 | 同家族：进度条 6px（:114-119）；≤560px 堆叠（共性-根因 5） |
| 灵魂度 | 20 | 6 | 6 | 无 TIFF 格式科普（为何浏览器不支持）、无"该文件含 N 页，已转换第 1 页"的告知——多页信息 UTIF.decode 明明拿到了（:64 ifds 数组）却不用 |
| **加权总分** | 100 | | **56** | 家族中体验最弱：解码器静默加载+多页价值折半+desc 失实三连 |
| 附加：大文件性能 | 10 | 5 | — | UTIF.decodeImage+toRGBA8 主线程同步（:66-67），大 TIFF 页冻结 UI 且无进度；无 needModel 缓冲提示 |
| 附加：移动端 | 10 | 6 | — | 堆叠可用；移动浏览器同样不支持 TIFF，解码路径一致 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：56 分接近"劝退"线；解码器加载无感知（可用性）+ 多页 TIFF 只出首页（功能面 vs ezgif/CloudConvert 明显缺失）双重缺口。

## 扣分点明细

1. 【可用性-硬伤（家族级）】自动 zip 下载、无结果预览（`ImageConvertTool.vue:55`；M-12）——首页转得对不对、色彩是否失真（TIFF 常见 CMYK）只能下载后验证
2. 【可用性-个性】**解码器静默加载**：UTIF 为懒加载依赖（`imageEngine.ts:58`），但 registry.ts:34 未标 needModel、组件无"首次需加载解码器"提示位——违反 AGENTS.md「首用需下载解码器的工具必须显示下载提示」纪律，首次转换表现为无故等待（对照 png-to-jpg.md 扣分点 6 同源问题，本工具 100% 触发）
3. 【功能-个性】**多页 TIFF 仅首页**：decodeTiff 硬取 ifds[0]（`imageEngine.ts:64-67`）；ifds 数组长度即页数，信息可得却未展示、无"逐页导出/选页"能力——ezgif 与 CloudConvert 均支持逐页
4. 【功能-疑似文案失实】desc 写"TIFF/TIF 转 PNG/JPG"（`registry.ts:34`），但 imgcvt target 钉死 image/png，JPG 路径不存在——与 png-to-jpg.md 扣分点 8 同模式的承诺失实
5. 【功能】CMYK/ICC 色彩配置文件：UTIF.toRGBA8 输出按 RGBA 直绘（:67-74），CMYK TIFF 色偏风险无预警
6. 【灵魂】无"N 页"告知：明明解码时知道页数，UI 无任何体现
7. 【家族共性】文件列表无缩略图、进度条 6px、无逐张重转——见 `png-to-jpg.md` 扣分点 5/6/7

## 行业对标与差距

- **ezgif**：TIFF 转 PNG/JPG/GIF 多目标+多页逐帧导出+结果页逐张下载。差距：多页处理代差。
- **CloudConvert**：页码范围选择（如 2-5 页）、逐文件参数、失败原因回执。差距：选页能力。
- 借鉴优先级：**解码器加载提示 > 多页页码选择/逐页导出 > desc 修正 > 结果列表（家族级）**。

## 可拓展性

- 短期（1 周）：registry.ts:34 补 needModel 或组件内检测 .tiff 输入时显示"首次需加载 TIFF 解码器…"；desc 改为"转 PNG"
- 中期（1 月）：decodeTiff 返回页数组，UI 加页码勾选（默认首页），逐页导出 ZIP；家族结果列表落地后逐页入列
- 远期：并入"图片格式转换工作台"；CMYK TIFF 经色彩转换近似处理并预警

## 优化处方（验收标准）

1. **解码器加载提示**：检测到 TIFF 输入时立即显示"首次处理 TIFF 需加载解码器（约 X KB）…"。→ **验收：清缓存后拖入 .tif，200ms 内出现加载提示，加载完成前按钮有 spinner**
2. **多页告知**：解码后显示"该文件含 N 页，本次转换第 1 页"。→ **验收：拖入 3 页 TIFF 显示含页数文案**
3. **逐页导出**：提供页码复选（1~N，默认 1），勾选多页时逐页转 PNG 入 ZIP。→ **验收：3 页 TIFF 全选后 ZIP 内 3 个 PNG，页序与文档一致**
4. **desc 修正**：registry.ts:34 文案改为"TIFF/TIF 转 PNG（多页取首页）"或补齐 JPG 目标。→ **验收：desc 与实际能力一一对应**
5. **家族处方 1~7** 同步落地。→ **验收：同 `png-to-jpg.md` 处方 1~6**
