# URL 解析器（url-parser）

> 分类：开发工具｜模式：B 变体（输入行＋结果行堆叠）｜组件：`src/tools/developer/components/UrlParser.vue`（全文 163 行）｜引擎：组件内 new URL＋searchParams（:27-50）｜注册：`src/tools/developer/registry.ts:199`
> 对标标杆：urlparser.io ＋ freeformatter.com URL Parser（批量方向，经 WebSearch 核实）

## 七维评分：61 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 10 | 10 | protocol/hostname/port/username/path/origin/hash 七行拆解＋query 参数逐条列表（:44 searchParams 自动解码）；**只读不可编辑重构、无子域/主域/TLD 三段拆分、无 path 分段、无批量解析** |
| 可用性 | 20 | 13 | 13 | 结果行与参数行卡片化、默认预填带 user:pass＋query＋hash 的富示例（:8）打开点一次即有结果；错误行内 notice（:48）带格式示例 |
| 实用价值 | 15 | 12 | 12 | 调试跳转/排查 query 真实高频；密码打码"••••（已隐藏）"（:38）体现隐私意识；与 url-encoder（registry.ts:25-39）分工明确不重复 |
| 交互便捷性 | 15 | 11 | 11 | 参数值点击复制＋1.5s 对勾（:52-58）✓回车触发✓；但只复制值不复制键/键值对、无整段 query 复制，改参数要复制出去改完再找编码器 |
| UI 美观性 | 10 | 8 | 8 | 键左值右布局统一（:100-123）；参数键 min-width 90px（:139）长 key 挤压换行；res-row 标签宽 70px 写死（:116） |
| 灵魂度 | 20 | 7 | 7 | 密码打码＋富示例预填是亮点；缺"懂我"：编码值无 raw/decoded 对照（searchParams 已解码但用户看不到 `%E4%B8%AD` 原始形态），端口默认值补全（:40）算半个 |
| **加权总分** | 100 | | **61** | |
| 附加：大文件性能 | 10 | 9 | — | 单 URL 解析毫秒级；千级参数列表无虚拟滚动但实际罕见 |
| 附加：移动端 | 10 | 7 | — | 结果行长值 overflow-wrap anywhere 兜底✓（:122-123）；堆叠后参数区在 1~2 屏外 |

## 结论与优先级

**交互优化 + 需拓展** · P1

判据：拆解主链路无硬伤（可用性 13/20）；"只读"是与 urlparser.io 的代差核心——query 表格化编辑重构是这个工具的下半场。

## 扣分点明细

1. 【功能-疑似缺陷】Parsed.host 已计算但从未展示（`UrlParser.vue:39` 赋值、:73-79 模板无对应行）——带非默认端口时 hostname＋port 要自己拼，与 regex-visualizer 的 size 死数据同病（疑似漏渲染或冗余字段，请开发确认意图）
2. 【功能】query 只读：不能增删改参数后重新生成 URL（urlparser.io 的核心闭环），"改个 utm 再复制链接"要绕道 url-encoder
3. 【交互】参数只可复制值不可复制键/键值对（:83,:88 只绑 value），拼 curl query 串时要手动补 `=`
4. 【功能】无 raw/decoded 切换：searchParams 自动解码（:44）后编码问题排查时看不到原始形态
5. 【功能】无域名三段拆分（subdomain/domain/TLD）与 path 分段列表——SEO 与前端路由调试各缺一角
6. 【交互】非实时：URL 改一个字符需重点"解析"（:27-50），与 cron/进制家族的实时口径不齐
7. 【灵魂】无安全提示：user:pass 明文走 http 的场景不警告——密码打码了却对明文传输沉默
8. 【功能】hash 内路由不解析：SPA 常见的 `https://app.com/#/page?a=1` 中 query 位于 hash 域，searchParams 解析为空列表（:42,:79 整串塞进 hash 行），前端路由调试场景失明

## 行业对标与差距

- **urlparser.io**：拆解＋**编辑重构**（参数表格可增删改、实时重组 URL、一键复制）、单参数编码切换。差距：**只读 vs 可写代差**（URL 对象反向序列化纯前端可及）。
- **freeformatter URL Parser**：批量解析（每行一条）＋参数导出表格。差距：批量缺席。
- 借鉴优先级：**query 编辑重构 > raw/decoded 切换 > 键值对复制 > 域名三段拆分 > 批量解析**。

## 可拓展性

- 短期（1 周）：补 host 行（或删字段，二选一确认意图）；参数行加"复制键值对"；watch 400ms 防抖实时解析
- 中期（1 月）：query 参数表格化编辑（增删改行→searchParams 重组→输出新 URL＋复制）；raw/decoded 每参数切换
- 远期：域名三段拆分卡（公开后缀表简化规则）；path 分段列表；与 url-encoder 组"URL 工作台"（解析/编码/重构三 Tab）

## 优化处方（验收标准）

1. **host 行补齐**：res-list 在主机与端口之间插入"主机:端口"行。→ **验收：默认示例解析后显示 `example.com:8443`，与 origin 的协议后段一致**
2. **query 编辑重构**：参数表每行加删除钮与可编辑输入，底部"生成新 URL"。→ **验收：删 page=2 并把 lang 改 fr 后生成 `…search?q=vue3&lang=fr#results`，一键复制**
3. **raw/decoded 切换**：参数区加切换 Tab。→ **验收：URL 含 `q=%E4%B8%AD` 时 decoded 显示 `中`、raw 显示原始串**
4. **键值对复制**：每行加第二枚钮复制 `k=v`。→ **验收：复制结果可直接拼入 curl 命令 query**
5. **实时解析**：合法 URL 输入 400ms 内自动出结果，非法时保留上次结果＋错误条。→ **验收：连续删改 URL 过程中无"清空闪屏"**
