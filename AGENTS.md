# AGENTS.md — ToolHub 百宝工具箱

百宝工具箱 ToolHub：纯浏览器端工具聚合平台（**402 个工具，文件永不上传，无任何后端**），独立实现，构建产物为纯静态文件。

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

## 技术栈与硬约束

- Vue 3.5 `<script setup lang="ts">` + TypeScript strict + Vite 6；路径别名 `@` → `src/`。
- 路由为 **history 模式**（`createWebHistory`，`src/router.ts`），配合 `base: '/'`（静态资源一律绝对路径）：SEO 要求，百度不收录 hash SPA。宿主必须支持 SPA 回退（EdgeOne Pages/Cloudflare Pages/`vite preview` 均支持），**不再支持子目录部署**。构建时 `scripts/gen-sitemap.mjs` 依 `site.siteUrl` 生成 sitemap.xml/robots.txt（域名在 `src/data/site.ts` 填写）。
- **懒加载纪律**：重依赖（pdfjs-dist、@cantoo/pdf-lib、lamejs、gifenc、chart.js、heic2any、utif、qrcode、jsbarcode、prettier、@ffmpeg/ffmpeg 等）一律 `await import(...)` 动态引入；静态入口只保留 Vue/router/样式。
- 所有用户可见文案为简体中文，代码注释用中文。
- 品牌名为 **ToolHub / 百宝工具箱**（`src/data/site.ts` 为唯一品牌来源）。所有文案与视觉资产均为原创（中文文案 + 自绘 SVG），**不得引入任何第三方站点的文案、品牌或素材**。
- 单文件保持精简（>300 行需拆分组件/composable）。

## 架构：注册表驱动

- **必读契约：`docs/03-实现模式与引擎规格.md`**（注册表格式、11 种实现模式、lib 引擎 API）。其他文档：`docs/01-产品结构与设计说明.md`（产品/IA/视觉总纲）、`docs/02-工具清单.md`（工具总表）、`docs/04-依赖清单.md`（每个依赖的引入理由）。
- 每个分类一个目录 `src/tools/<cat>/registry.ts`（导出 `ToolDef[]`）+ `components/*.vue`，统一聚合在 `src/tools/index.ts`（`allTools`/`toolMap`）。新增工具 = 注册表加一条 +（通常）一个懒加载组件。
- `ToolDef`（`src/types.ts`）实现方式四选一：`component`（懒加载组件）/ `textDef`（通用 TextTool）/ `calcDef`（通用 CalcTool）/ `imgcvt`（通用 ImageConvertTool）。
- `slug` 即 URL（`/t/:slug`），全站唯一，一经发布不要更改（外部链接/收藏可能依赖）。
- 工具组件只渲染面板内容（输入区 + 选项 + 执行 + 结果/下载），**不带页面框架**——H1、隐私徽章、面包屑、相关工具由 `pages/ToolPage.vue` 负责。
- 重逻辑一律放 `src/lib/` 共享引擎（imageEngine/pdfEngine/audioEngine/videoEngine/csvEngine/textEngine/nlpEngine/finance 等 20 个）；工具组件只做输入交互。
- 首次使用需下载模型/编解码器的工具（OCR、抠图、转写、ffmpeg）注册时标 `needModel: true`，UI 必须显示下载提示（ffmpeg 约 30MB）。
- 编辑器工作室（`studio: true`，共 8 个注册项，复用 `src/tools/editors/` 下 4 个组件）在 `src/tools/editors/`，首页编辑器区展示。

## 改动时的联动点（易漏）

- 新增分类需同时改三处：`src/types.ts`（`CategoryId`）、`src/data/categories.ts`、`src/router.ts` 的分类路径正则（router.ts:11）。
- 通用 UI 组件在 `src/components/common/`（FileDrop/ResultBox/TextTool/CalcTool/ImageConvertTool 等），布局在 `layout/`。
- 收藏/主题等偏好走 `src/composables/`（localStorage，key 前缀 `toolhub`）；错误提示统一 `useToast` 中文文案。
- 大文件处理：异步 + 进度条，>50MB 给提示；金融/单位换算需附「计算口径」说明。
- 图片工具用 `imageEngine.applyOps` + `CanvasStage` 实时预览 + `DownloadBar` 输出；下载统一走 `lib/download.ts`（saveBlob/saveText/saveZip）。
- PDF/Office 生成文件的元数据（producer/creator）统一写 `ToolHub`（`lib/pdfEngine.ts`、`lib/officeEngine.ts`）。
