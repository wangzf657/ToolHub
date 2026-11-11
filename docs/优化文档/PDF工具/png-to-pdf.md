# PNG 转 PDF（png-to-pdf）

> 分类：PDF工具｜模式：C（单列文件流）｜组件：`src/tools/pdf/components/ImagesToPdf.vue`（87 行，与 images-to-pdf / jpg-to-pdf 完全复用，无任何差异化默认值）＋ `FileDrop.vue`｜引擎：`pdfEngine.ts` imagesToPdf（:481-518）
> 对标标杆：iLovePDF ＋ Smallpdf
> 家族共性（无缩略图/假拖拽手柄/↑↓ 逐位排序）见 `merge-pdf.md`；本 slug 与 images-to-pdf 逐行同构，只记个性差异。

## 七维评分：56 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 11 | 11 | 与 images-to-pdf 完全相同（尺寸/边距/横向）；"PNG 专属"能力为零——FileDrop `accept="image/*"`（ImagesToPdf.vue:43）连格式过滤都没做 |
| 可用性 | 20 | 12 | 12 | 同 images-to-pdf：无进度、完成即下载、零预览；选项聚焦按钮可达 |
| 实用价值 | 15 | 10 | 10 | 三胞胎 slug 中重复度最高：与 images-to-pdf 相比无任何行为差异，用户"PNG 转 PDF"得到的与"随便什么图转 PDF"一字不差 |
| 交互便捷性 | 15 | 10 | 10 | ↑↓ 逐位排序家族共性；边距裸数字 pt；ZIP 命名问题不适用（单文件输出）但输出名固定"图片合成.pdf"（:31） |
| UI 美观性 | 10 | 7 | 7 | 与 images-to-pdf 完全一致；列表无缩略图 |
| 灵魂度 | 20 | 6 | 6 | 注册表 desc 写"保留透明区域（铺白底）"（registry.ts:23）与实际行为矛盾：embedPng 保留 alpha 通道（pdfEngine.ts:491），并非铺白底——文案口径失真 |
| **加权总分** | 100 | | **56** | |
| 附加：大文件性能 | 10 | 5 | — | 同 images-to-pdf：无进度回调、串行解码无反馈 |
| 附加：移动端 | 10 | 6 | — | 同 images-to-pdf |

## 结论与优先级

**交互优化 + 需拓展**（体验整改与 images-to-pdf 共用处方；slug 本身长期建议 301 并入 images-to-pdf，保留 SEO 落地页跳转）

判据：56 分且个性扣分几乎全部来自"重复存在而无差异"；单独整改本 slug 无意义，价值在于推动三胞胎收敛。

## 扣分点明细

1. 【功能】零差异化：组件、选项、默认值与 images-to-pdf / jpg-to-pdf 完全一致（`ImagesToPdf.vue` 全文无 slug 判断，对比 PdfToImages.vue:15-17 尚按 slug 换默认格式），PNG 用户没有获得任何"PNG 该有的"待遇（透明保留说明、无损承诺均无）
2. 【灵魂/文案失真】注册表 desc"保留透明区域（铺白底）"（`registry.ts:23`）自相矛盾：实际 embedPng 保留透明（`pdfEngine.ts:491`），页内 notice 也未提及透明行为——承诺与交付两头都没说清
3. 【功能】accept 过滤名不副实：desc 承诺"PNG 图片转单个 PDF"，实际 `accept="image/*"` 接受任意图片（`ImagesToPdf.vue:43`），拖入 JPG 也不报错——slug 语义未落地
4. 【实用】重复度稀释体验：三个入口共享同一实现，任一处的体验缺陷在另两处同步存在（JPG→PNG 重编码、无预览等，详见 images-to-pdf 档案扣分 1/3），维护与文档口径三倍成本
5. 【交互】输出名固定"图片合成.pdf"（`ImagesToPdf.vue:31`）：与 png-to-pdf 的语义也不匹配（合成的明明可能是 JPG）
6. 【灵魂】PNG 无损入档的价值点未传达：PNG 经 PNG 重嵌入实际无损（这是本 slug 相对 JPG 路径唯一真实的优势），页内无任何说明，用户无从建立"转 PNG 用这个"的认知

## 行业对标与差距

- **iLovePDF**：PNG to PDF 与 JPG to PDF 共用引擎但页面明确差异点（透明背景处理说明、格式过滤），并统一收敛为一个"图片转 PDF"主入口 + SEO 别名。差距：**收敛策略与差异说明**。
- **Smallpdf**：图片转 PDF 单入口，格式差异在帮助文档中说明。差距：同上。
- 借鉴优先级：**文案与行为对齐 > 差异点说明（透明保留）> 与 images-to-pdf 收敛 > 缩略图（随主体处方）**。
- 站内协同：收敛方向应为"images-to-pdf 能力主体 + jpg-to-pdf/png-to-pdf 落地页别名"，避免三处维护。

## 可拓展性

- 短期（1 周）：修正 registry desc（透明保留 + 移除"铺白底"）；页内加一行"PNG 按原样无损嵌入，透明区域保留"；accept 按需收紧或明确说明接受所有图片
- 中期（1 月）：随 images-to-pdf 中期处方同步获得缩略图/拖拽排序/预览能力（同一组件一次改造三处受益）
- 远期：slug 收敛——png-to-pdf 保留为 SEO 落地页，内容指向 images-to-pdf 预选 PNG 模式（组件按 slug 定制默认文案，参考 PdfToImages 的 slug 判断先例）

## 优化处方（验收标准）

1. **文案对齐**：registry desc 改为"PNG 图片转 PDF，透明区域原样保留，本地即时完成"。→ **验收：desc 与页内说明不再出现"铺白底"；含"透明"关键词**
2. **透明行为说明**：页内选项区加提示行"PNG 透明背景将保留（PDF 查看器中显示为白或深色取决于阅读器）"。→ **验收：拖入透明 PNG 后提示行可见**
3. **差异默认值**：组件按 slug 切换默认（png-to-pdf 默认"跟随图片尺寸"+PNG 说明；images-to-pdf 默认同现状）。→ **验收：从 /t/png-to-pdf 进入时页面标题区出现 PNG 专属说明**
4. **收敛（远期）**：png-to-pdf 页顶部提供"更多图片格式？使用 图片合成 PDF"链接指向 images-to-pdf。→ **验收：页面出现跳转链接且不劫持主流程**
5. **随主体整改**：images-to-pdf 处方 1~5（JPG 直通/自动横竖/边距预设/缩略图/体积汇报）在本 slug 同步生效。→ **验收：三 slug 行为与文案一致，任一缺陷修复三处可验证**
