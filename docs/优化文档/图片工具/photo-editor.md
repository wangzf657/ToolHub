# 照片编辑器（photo-editor）

> 分类：图片工具｜模式：E（三栏工作室 132px/1fr/250px，画布 max-height 68vh——PhotoStudio.vue:468、:510）｜组件：`src/tools/editors/components/PhotoStudio.vue`（588 行）｜**注册重复**：`src/tools/image/registry.ts:70`（本 slug）与 `src/tools/editors/registry.ts:7`（photo-studio）指向**同一组件**｜引擎：src/lib/imageEngine（applyOps 防抖管线）
> 对标标杆：Photopea（纯前端修图天花板）＋ Polarr（轻量滤镜修图）
> **评估口径**：本 slug 能力与编辑器工作室 photo-studio.md（71 分，全站最高档）完全一致，本档案不重复其逐条证据，聚焦"图片分类为何存在第二个入口"与并入方案；评分在 photo-studio 基础上因重复建设对实用价值扣 2 分

## 七维评分：69 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 13 | 13 | 同 photo-studio.md：六模块（调整/滤镜/文字/裁剪/画笔/导出）全站最全；裁剪只能居中最大区域（applyCrop PhotoStudio.vue:203，:399 按钮文案自认）、无旋转/翻转、无局部调整——均与 photo-studio.md 扣分一致 |
| 可用性 | 20 | 14 | 14 | 68vh 画布 + Tab 化选项全站最佳实践（:510）✓；但中栏被 ToolPage 300px 侧栏压至 ~400~500px（ToolPage.vue:158-168，共性-根因 3）——同 photo-studio.md |
| 实用价值 | 15 | 11 | 11 | 组件本身一站式修图价值高；但**同一组件双 URL 分流**（image/registry.ts:70 vs editors/registry.ts:7）：SEO 重复内容、站内搜索/分类页出两张同卡、维护口径分裂——重复建设直接折损入口价值 |
| 交互便捷性 | 15 | 11 | 11 | 参数防抖实时渲染、画笔增量绘制✓（同 photo-studio.md）；文字移动靠 X/Y 数字不能拖拽（同其扣 3） |
| UI 美观性 | 10 | 8 | 8 | 三栏布局/透明棋盘底纹全站最佳（同 photo-studio.md）；本入口的 steps 文案"调整 / 滤镜 / 文字 / 裁剪"（image/registry.ts:70）比 photo-studio 的三步更准确✓ |
| 灵魂度 | 20 | 12 | 12 | 同 photo-studio.md：涂抹层与裁剪几何同步是工程巧思；但无撤销/重做（唯一退路 resetAll :126 抹掉全部）——同其扣 1 硬伤边缘项 |
| **加权总分** | 100 | | **69** | 组件质量=photo-studio（71）级；双入口分流使实用价值 13→11 |
| 附加：大文件性能 | 10 | 6 | — | 同 photo-studio.md：任意参数变动全量管线重渲染，20MP 图无降采样预览 |
| 附加：移动端 | 10 | 6 | — | 同 photo-studio.md：≤960px 塌单列（:472）失去工作台意义 |

## 结论与优先级

**交互优化 + 阉割（本入口并入 photo-studio）** · P1

判据：组件本身无新账（扣分点全部沿用 photo-studio.md 结论：交互优化 P1）；但 image 分类下这个重复 slug 是"高度重复"的典型（README 结论判据：高度重复→阉割/并入）——应 301 至 /t/photo-studio 而非维护两个入口。

## 扣分点明细

1. 【实用价值-硬伤】100% 重复登记：image/registry.ts:70 与 editors/registry.ts:7 同指 PhotoStudio.vue，/t/photo-editor 与 /t/photo-studio 两个 URL 同内容——搜索引擎视为重复页面稀释权重、首页/分类/搜索出两张同卡（"存在意义"的答案：没有独立意义，属历史登记冗余）；desc 亦有措辞分裂（"AI 工具" vs "AI 增强"）
2. 【诚信】desc 承诺"AI 工具"失实：image/registry.ts:70 desc 列"调整、滤镜、文字、裁剪与 AI 工具"，PhotoStudio.vue 全文无任何 AI 功能实现——photo-studio.md 扣 5 同病在此入口复发且文案更笃定
3. 【灵魂-硬伤边缘】无撤销/重做：applyCrop 破坏性操作（:203）后仅 resetAll（:126）全抹——photo-studio.md 扣 1 原样适用，本档案不另立处方（修复随组件一并生效）
4. 【可用性】画布中栏 ~400~500px：共性-根因 3（ToolPage.vue:158-168 常驻 300px 侧栏）——修复随"工作室类页面隐藏侧栏"全站件一并生效
5. 【功能】裁剪无区域选择/无旋转翻转：同 photo-studio.md 扣 4/扣 8；image 分类用户从 crop-image（有拖选区）跳进来会感知能力倒退
6. 【交互】文字不能画布拖拽：同 photo-studio.md 扣 3（X/Y 数字输入 :385-386 附近）
7. 【导航】入口语义错位：slug 叫 photo-editor（"编辑器"），用户预期"轻量裁剪/调色"级工具，落地却是全工作台——重活超预期本身不扣分，但与 crop-image/photo-filters 的轻量梯度没有说明页指引，新用户学习成本被放大
8. 【SEO/品牌】两入口 steps/keywords 分裂维护：photo-editor keywords 含"photoshop"（image/registry.ts:70），photo-studio 含"工作室"——关键词各自圈流量、落地同页，统计口径（哪个入口转化好）永久失真

## 行业对标与差距

- **Photopea / Polarr**：能力差距与代差分析全文沿用 photo-studio.md"行业对标与差距"一节（History 撤销栈、滤镜强度、hold-to-compare）——组件共用即结论共用。
- **站内自证重复**：站内并无"轻量版照片编辑器"存在——photo-editor 若想有存在意义，本应是"crop-image 级轻量快修"定位；现状却直接复用重型工作室，两头不靠。
- 借鉴优先级：**双入口合一（301 并入 photo-studio）> AI 文案纠偏 > 其余组件级处方全部引用 photo-studio.md 处方 1~8 不另立**。

## 可拓展性

- 短期（1 周）：image/registry.ts:70 移除或改造——保留 slug 的话在 ToolPage 顶部挂"你正在使用照片工作台完整版，轻量裁剪请用 crop-image →"引导条；desc 删除"AI 工具"
- 中期（1 月）：宿主路由层对 /t/photo-editor 做 301 重定向至 /t/photo-studio（保收藏/外链权重归一）；sitemap 去重（gen-sitemap 依 allTools 生成，registry 移除后自动消失）
- 远期：若确需 image 分类保留入口，做成真正的轻量快修组件（裁剪+亮度+滤镜三步，复用 imageEngine applyOps 子集），与工作室形成"快修/工作台"两级梯度——那是新工具立项而非本档案范围

## 优化处方（验收标准）

1. **入口合一**：从 src/tools/image/registry.ts 移除 photo-editor 条目，宿主为 /t/photo-editor 配 301 → /t/photo-studio。→ **验收：访问 /t/photo-editor 返回 301 且落地 photo-studio；站内搜索/分类页只出现一张工作台卡片**
2. **收藏兼容**：迁移前检测 localStorage 收藏中的 photo-editor 项并映射为 photo-studio。→ **验收：旧收藏用户升级后收藏夹无死链，点击直达工作台**
3. **文案纠偏**：无论保留哪个入口，desc 中"AI 工具/AI 增强"在组件具备 AI 功能前一律移除。→ **验收：registry 全文 grep "AI" 与组件实际能力一一对应**
4. **轻量引导条**（若短期保留双入口）：image 入口顶部显示"这是完整工作台，快速裁剪/调色可使用 crop-image / photo-filters"。→ **验收：引导条含两个直达链接，点击不丢失当前已载入的图片（同页切换场景除外）**
5. **组件级体验项**：撤销栈/自由裁剪/文字拖拽/画布全宽等，验收标准逐条引用 photo-studio.md 处方 1~8，不重复执行。→ **验收：photo-studio.md 各处方通过即视为本 slug 同步通过（同一组件）**
