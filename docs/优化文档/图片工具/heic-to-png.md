# HEIC 转 PNG（heic-to-png）

> 分类：图片工具｜模式：C（单列堆叠文件流，imgcvt 通用组件）｜组件：`src/components/common/ImageConvertTool.vue`（全文 135 行）｜引擎：`src/lib/imageEngine.ts:47-54`（decodeHeic，懒加载 heic2any/libheif wasm）
> 对标标杆：CloudConvert（云，HEIC→PNG 逐文件参数+结果列表）＋ heictojpg.com（HEIC 专用站）
> 家族说明：自动 zip 无预览/进度条/文件列表等共性已在 `png-to-jpg.md` 建档（其处方 1-8 家族级适用），本档案聚焦 HEIC→PNG 的个性差异。

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 批量+无损导出合格，质量滑条正确隐藏（quality:false→ToolPage.vue:90，注册表配置正确的正面点）；但未标 needModel（registry.ts:24，同 heic-to-jpg 缺陷）、多图 HEIC 静默截断（imageEngine.ts:51）、无 PNG 体积预警 |
| 可用性 | 20 | 10 | 10 | 家族共性：自动下 zip 无预览（ImageConvertTool.vue:55；M-12）；叠加个性——12MP 照片转 PNG 单张 5~8MB，体积爆炸只能下载后震惊 |
| 实用价值 | 15 | 12 | 12 | iPhone 照片几乎不含透明通道，PNG 的无损/透明优势对照片源意义有限，实际用途收窄为"二次编辑前的无损中间格式"——比 heic-to-jpg 窄一档 |
| 交互便捷性 | 15 | 11 | 11 | 家族共性：批量一次完成+自动打包；wasm 解码慢但无单张进度与耗时预估 |
| UI 美观性 | 10 | 7 | 7 | 家族共性：简洁统一；进度条 6px（:114-119）；断点碎片化（共性-根因 5） |
| 灵魂度 | 20 | 7 | 7 | desc 病句"无损无损透明支持"（registry.ts:24）暴露文案未校对；解码等待/多图截断/EXIF 抹除三个边界全部静默 |
| **加权总分** | 100 | | **58** | 配置正确、场景偏窄、文案失修 |
| 附加：大文件性能 | 10 | 4 | — | heic2any 主线程解码单张秒级+PNG 编码放大内存峰值，批量 50 张长时间占主线程（:42-54 串行） |
| 附加：移动端 | 10 | 5 | — | 移动 CPU 解码更慢；输出 PNG 数倍体积在手机存储/传输场景更不友好 |

## 结论与优先级

**交互优化** · P1（含文案级快赢：修 desc）

判据：功能与 heic-to-jpg 同构但场景更窄（58 分），失分主要在 desc 病句、体积无预警与解码等待盲区；若家族做 HEIC 工作台合并，本工具优先级低于 heic-to-jpg。

## 扣分点明细

1. 【灵魂-文案失实】desc"HEIC/HEIF 转 PNG，无损无损透明支持，可批量"（registry.ts:24）——"无损无损"叠词病句，且 HEIC 照片源基本无透明可保留，承诺与场景双重失实
2. 【功能-登记缺失】registry.ts:24 未标 `needModel: true`：heic2any 约 1.5MB+ 首用静默下载（imageEngine.ts:47-54），违背 AGENTS.md 编解码器提示约定（与 heic-to-jpg 共病，见该档案扣分点 1）
3. 【可用性-硬伤（家族级）】完成即自动下 zip、无结果预览（ImageConvertTool.vue:55；M-12），整改见 png-to-jpg.md 处方 1
4. 【可用性-体积盲区】12MP HEIC（约 1.5~3MB）转 PNG 普遍膨胀到 5~8MB，无任何体积预警，也不在结果区提示"照片存档请用 heic-to-jpg，PNG 适合二次编辑"的场景分流
5. 【灵魂-静默截断】多图 HEIC（Live Photo/连拍）只取 heic2any 返回数组第 1 张（imageEngine.ts:51），无提示
6. 【交互（家族共性）】文件列表无缩略图（FileDrop.vue:97-107）——HEIC 源在桌面端本就难预览，双重盲选
7. 【灵魂（家族共性）】EXIF 抹除、首用等待均静默；与 heic-to-jpg 扣分点 3/5 同源，整改方案见该档案处方 2/3

## 行业对标与差距

- **CloudConvert**：HEIC→PNG 支持逐文件参数、转换结果列表带缩略图与体积。差距：结果可见性（家族级）+ 本工具连"PNG 会胖几倍"都不说。
- **heictojpg.com**：单一格式做到极致的极简流。启示：HEIC→PNG 属低频组合，更应考虑并入家族工作台而非独立打磨。
- 借鉴优先级：desc 修正 > 体积预警与场景分流 > needModel 提示 > 结果列表。

## 可拓展性

- 短期（1 周）：registry.ts:24 desc 改为"HEIC/HEIF 转 PNG，无损导出、适合二次编辑；照片源体积会显著增大"，并补 `needModel: true`
- 中期（1 月）：输出体积>输入 2 倍时提示并导流 heic-to-jpg；多图 HEIC 截断提示（与 heic-to-jpg 处方 3 同实现）
- 远期：与 heic-to-jpg 合并为"HEIC 解码工作台"——解码一次，JPG/PNG 双目标勾选输出（解码是同一次 wasm 成本，合并收益最大）

## 优化处方（验收标准）

1. **desc 修正（快赢）**：registry.ts:24 按可拓展性短期条目改写。→ **验收：无叠词病句，承诺与实际能力一致**
2. **体积预警+分流**：run 后比较体积，输出>输入 2 倍时提示"PNG 为无损格式，照片源体积已放大 X 倍；仅存档/分享建议 HEIC 转 JPG"并附跳转。→ **验收：拖入 3MB 照片转 PNG 后出现提示，链接可达 /t/heic-to-jpg**
3. **needModel 登记**：registry.ts:24 加 `needModel: true`。→ **验收：工具页出现解码器下载提示条（同 heic-to-jpg 处方 1）**
4. **多图截断披露**：heic2any 返回数组>1 时 toast"包含 N 张，仅转换第 1 张"。→ **验收：Live Photo 导出 HEIC 触发提示（同 heic-to-jpg 处方 3）**
5. **家族处方 1-3 落地**（结果列表含前后体积、自动下载默认关、进度带百分比）。→ **验收：同 png-to-jpg.md 处方 1-3**
