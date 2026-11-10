# AGENTS.md — ToolHub 百宝工具箱

百宝工具箱 ToolHub：纯浏览器端工具聚合平台（**520 个工具，文件永不上传，无任何后端**），独立实现，构建产物为纯静态文件。

## 命令

```bash
npm install
npm run dev         # 开发服务器 http://localhost:5173
npm run typecheck   # vue-tsc -b --noEmit（类型门禁）
npm run build       # 先 vue-tsc -b 类型检查，再 vite build → dist/
npm run preview     # 预览构建产物
npm run test        # 纯 Node 引擎/注册表测试（scripts/tests/，229+41+34 用例）
```

没有 lint；`npm run build` 自带类型检查，改完代码至少跑 `npm run typecheck`；改动引擎或注册表后跑 `npm run test` 防回归。

## 功能测试纪律（最高优先级，必须遵守）

**凡用户要求功能测试 / 测试验收 / 回归测试，必须先完整阅读并全程严格遵守 `docs/测试要求.md`（Web QA 工程师规约），不得跳过、不得变通。** 该规约的核心红线：

- **只测试，不修复**：发现 Bug 只做记录（复现步骤、预期/实际结果、截图与 Console/Network 证据），**严禁"测着测着顺手改 bug"**——测试期间不允许修改任何业务代码、样式、配置，不允许放宽断言、跳过失败用例或伪造通过来让测试变绿。
- 不挑容易通过的用例：按 P0→P3 顺序逐项执行；无法执行标 BLOCKED，未执行标 NOT RUN，必须如实披露。
- 每个重要功能至少覆盖正常、边界、异常三类场景；以真实运行结果为据，不得凭读代码判定功能正常。
- 功能之外必须评体验：每个工具按七维评分（功能完善性 / 可用性 / 实用价值 / 交互便捷性 / UI 美观性 / 灵魂度 / 结论，满分 100）逐项评估，并找同类行业 top 产品对标（台账 `qa/V<主.次>/05-ux-evaluation.md`）；可用性硬伤（结果区没法看、核心操作要下滑才能触达等）按缺陷登记。验收标准是"好用"，不是"能用"。
- 测试产出（系统分析 / 测试计划 / 用例 / 报告 / 缺陷 / 截图）一律按被测版本写入 `qa/V<主.次>/`（不入库），最终报告 `qa/V<主.次>/04-test-report.md` 必须给出明确结论（PASS / PASS WITH ISSUES / FAIL / INCONCLUSIVE）。
- 测试与开发角色分离：缺陷清单交回用户决定是否修复；修复完成后再做回归验证。如环境提供 `qa-engineer` 子代理，优先以其独立角色执行测试。

## 技术栈与硬约束

- Vue 3.5 `<script setup lang="ts">` + TypeScript strict + Vite 6；路径别名 `@` → `src/`。
- 路由为 **history 模式**（`createWebHistory`，`src/router.ts`），配合 `base: '/'`（静态资源一律绝对路径）：SEO 要求，百度不收录 hash SPA。宿主必须支持 SPA 回退（EdgeOne Pages/Cloudflare Pages/`vite preview` 均支持），**不再支持子目录部署**。构建时 `scripts/gen-sitemap.mjs` 依 `site.siteUrl` 生成 sitemap.xml/robots.txt（域名在 `src/data/site.ts` 填写）。
- **懒加载纪律**：重依赖（pdfjs-dist、@cantoo/pdf-lib、lamejs、gifenc、chart.js、heic2any、utif、qrcode、jsbarcode、prettier、@ffmpeg/ffmpeg 等）一律 `await import(...)` 动态引入；静态入口只保留 Vue/router/样式。
- 所有用户可见文案为简体中文，代码注释用中文。
- 品牌名为 **ToolHub / 百宝工具箱**（`src/data/site.ts` 为唯一品牌来源）。所有文案与视觉资产均为原创（中文文案 + 自绘 SVG），**不得引入任何第三方站点的文案、品牌或素材**。
- 单文件保持精简（>300 行需拆分组件/composable）。

## 架构：注册表驱动

- **必读契约：`docs/基础设计规约.md`**（唯一全版本规约：产品/IA/视觉总纲 + 工程契约——注册表格式、11 种实现模式、lib 引擎 API）。版本增量文档在 `docs/V<主.次>/`（需求/设计/工具清单/依赖清单四件套，当前 V1.1 全站 520、历史 V1.0 全站 402）；测试文档一律按版本放 `qa/V<主.次>/`（gitignore，不入库）。详见下方「文档规约」。
- 每个分类一个目录 `src/tools/<cat>/registry.ts`（导出 `ToolDef[]`）+ `components/*.vue`，统一聚合在 `src/tools/index.ts`（`allTools`/`toolMap`）。新增工具 = 注册表加一条 +（通常）一个懒加载组件。
- `ToolDef`（`src/types.ts`）实现方式四选一：`component`（懒加载组件）/ `textDef`（通用 TextTool）/ `calcDef`（通用 CalcTool）/ `imgcvt`（通用 ImageConvertTool）。
- `slug` 即 URL（`/t/:slug`），全站唯一，一经发布不要更改（外部链接/收藏可能依赖）。
- 工具组件只渲染面板内容（输入区 + 选项 + 执行 + 结果/下载），**不带页面框架**——H1、隐私徽章、面包屑、相关工具由 `pages/ToolPage.vue` 负责。
- 重逻辑一律放 `src/lib/` 共享引擎（imageEngine/pdfEngine/audioEngine/videoEngine/csvEngine/textEngine/nlpEngine/finance 等 20 个）；工具组件只做输入交互。
- 首次使用需下载模型/编解码器的工具（OCR、抠图、转写、ffmpeg）注册时标 `needModel: true`，UI 必须显示下载提示（ffmpeg 约 30MB）。
- 编辑器工作室（`studio: true`，共 8 个注册项，复用 `src/tools/editors/` 下 4 个组件）在 `src/tools/editors/`，首页编辑器区展示。

## 文档规约（2026-11-10 起，所有版本遵守）

- **docs/ 只允许三类内容**：`docs/基础设计规约.md`（唯一全版本规约 = 产品总纲 + 工程契约）、`docs/V<主.次>/` 版本文档文件夹、`docs/测试要求.md`（功能测试纪律规约，见「功能测试纪律」一节）。README 引用的截图资产放根目录 `assets/`；**`public/` 只放运行时资源**（工具首用 fetch 的数据集/wasm），README 专用图不得放入（public/ 会原样拷进 dist/ 发布）。根目录与 docs/ 不得散放其他 md（路线图/调研类文档一律归入对应版本文件夹）。
- **每个版本文件夹固定四件套**：`需求文档.md`（渠道调研/路线图原文）、`设计文档.md`（设计与落地沉淀：范围台账、新依赖、新引擎、门禁结论、已知边界、遗留）、`工具清单-V<主.次>.md`（脚本生成的基线快照）、`依赖清单-V<主.次>.md`（截至该版本的累计依赖）。**当前版本 V1.1（520 项）；历史版本快照只读，不再修改**。
- **测试文档一律按版本进 `qa/V<主.次>/`**（已 gitignore，本地留存，**不入库**）：测试报告、回归记录、截图证据都放 `qa/V<主.次>/`，跨版本复用的金标准脚本/夹具放 `qa/_scripts/`、`qa/_fixtures/`；不得写入 docs/ 或提交版本管理。需要长期沉淀的工程结论（坑位/口径/防复发哨兵）写进对应版本的 `设计文档.md`。
- **新版本落地流程**：新建 `docs/V<新>/` 四件套 → `node scripts/gen-tool-list.mjs --out docs/V<新>/工具清单-V<新>.md` → 同步更新 `scripts/gen-tool-list.mjs` 的 `DEFAULT_DOC` 与 `scripts/reorder-registry.mjs` 注释里的版本指向 → 更新本文件与基础设计规约中的「当前版本」。
- **改动注册表/依赖后**：`node scripts/gen-tool-list.mjs` 重生成**当前版本**的工具清单，依赖变更登记到当前版本 `依赖清单-V<主.次>.md`；历史基线快照不动。

## 改动时的联动点（易漏）

- 新增分类需同时改三处：`src/types.ts`（`CategoryId`）、`src/data/categories.ts`、`src/router.ts` 的分类路径正则（router.ts:11）。
- 通用 UI 组件在 `src/components/common/`（FileDrop/ResultBox/TextTool/CalcTool/ImageConvertTool 等），布局在 `layout/`。
- 收藏/主题等偏好走 `src/composables/`（localStorage，key 前缀 `toolhub`）；错误提示统一 `useToast` 中文文案。
- 大文件处理：异步 + 进度条，>50MB 给提示；金融/单位换算需附「计算口径」说明。
- 图片工具用 `imageEngine.applyOps` + `CanvasStage` 实时预览 + `DownloadBar` 输出；下载统一走 `lib/download.ts`（saveBlob/saveText/saveZip）。
- PDF/Office 生成文件的元数据（producer/creator）统一写 `ToolHub`（`lib/pdfEngine.ts`、`lib/officeEngine.ts`）。
