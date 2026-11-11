# cURL 转 fetch（curl-to-fetch）

> 分类：开发工具｜模式：D 变体（单列 textarea＋stat 卡＋ResultBox 代码输出）｜组件：`src/tools/developer/components/CurlToFetch.vue`（全文 104 行）｜引擎：`src/lib/jsEngine.ts` curlToFetch（:664-708）｜注册：`src/tools/developer/registry.ts:200`
> 对标标杆：curlconverter.com（30+ 语言天花板，对标库收录）＋ reqbin.com

## 七维评分：58 / 100

| 维度 | 满分 | 得分 | 加权 | 一句话依据 |
|---|---|---|---|---|
| 功能完善性 | 20 | 9 | 9 | -X/-H/-d/--data-raw/--data-binary 解析＋GET→POST 推断（jsEngine.ts:675-682）＋反斜杠续行合并（:666）；**-u/--user 等带参 flag 被当裸 flag 丢弃且其参数被误认成 URL（:683-688，疑似缺陷）**；-F 表单静默丢弃；仅 fetch 一种输出语言 |
| 可用性 | 20 | 11 | 11 | stat 三卡（方法/URL/头数）＋头清单＋Body 预览结构清楚（CurlToFetch.vue:45-57）；代码区 ResultBox min-height 230 双重钉高（:59；ResultBox.vue:69，共性-根因 2），长代码小窗内滚 |
| 实用价值 | 15 | 12 | 12 | 从 DevTools"Copy as cURL"转 fetch 是前端联调真实高频；输出代码含错误检查样板（jsEngine.ts:701-703）拿来即用 |
| 交互便捷性 | 15 | 11 | 11 | 默认预填典型示例（:9-12）打开即有结构可看；ResultBox 复制/下载✓；非实时、解析失败只抛整句 message 无 flag 定位 |
| UI 美观性 | 10 | 8 | 8 | stat 卡＋头行 mono 排布工整（:66-103）；代码无语法高亮；长 URL overflow-wrap 兜底✓ |
| 灵魂度 | 20 | 7 | 7 | "令牌等敏感值请转换后自行替换"提醒（:62）是对安全边界的诚实标注✓；但 @file 引用、Windows ^ 续行等 curl 方言差异无提示，失败不指名坏在哪个 flag |
| **加权总分** | 100 | | **58** | |
| 附加：大文件性能 | 10 | 9 | — | 命令级文本解析毫秒级，无风险 |
| 附加：移动端 | 10 | 6 | — | 堆叠后代码区在 1.5 屏外；`.stat.wide` 定义 span 1 列（:84-86）与普通卡同宽——疑似未完成的死样式，URL 卡并未拉宽 |

## 结论与优先级

**交互优化 + 需拓展** · P1（-u 误解析按疑似功能缺陷登记，建议优先修）

判据：主链路（-H/-d/-X）可用但 flag 解析有结构性真缺陷；对照 curlconverter.com 的多语言与容错属功能面代差。

## 扣分点明细

1. 【功能-疑似缺陷】-u/--user/--url/-o 等带独立参数的 flag 落入"未知裸 flag"分支直接 continue（`jsEngine.ts:683-685`），其参数在下一轮被当作 URL 抢占（:686-688）——`curl -u user:pass https://api.dev/x` 解析出 url=`user:pass` 且真 URL 丢失，属解析器结构性错误而非单纯缺功能
2. 【功能】-F/--form 表单静默跳过（:684-685 只跳过参数不生成 multipart 代码），转换结果与原命令语义不等价且无"表单字段已忽略"警告
3. 【功能】单语言输出：仅 fetch，curlconverter.com 的 axios/Python-requests/Go/Spring 等 30+ 语言 Tab 全缺——标注：语言模板层纯前端可实现，属可追差距而非架构限制
4. 【可用性】代码输出 ResultBox min-height 230 双重钉高（`CurlToFetch.vue:59`；`ResultBox.vue:69`），40 行以上生成代码在 230px 内滚动
5. 【交互】错误提示无定位：只抛"未在命令中找到 URL"类整句（jsEngine.ts:690），复杂多 flag 命令不知道哪个 flag 没被识别（与扣分 1 连带）
6. 【灵魂】无 curl 方言提示：Windows CMD 的 ^ 续行、-d @data.json 文件引用按字面塞进 body（:681）无警告
7. 【美观-疑似缺陷】`.stat.wide { grid-column: span 1 }`（`CurlToFetch.vue:84-86`）名为 wide 实与普通卡同宽，疑似样式未完成的死代码，URL 长串被挤在 1/3 栏内
8. 【交互】无 Ctrl+Enter 快捷转换、无"从剪贴板粘贴并转换"一键——DevTools 复制后要"切窗口→粘贴→点按钮"三步，高频转换场景步骤冗余

## 行业对标与差距

- **curlconverter.com**：30+ 目标语言 Tab、-u 转 Authorization Basic/Digest、-F 转 FormData、解析错误指名 flag 与位置。差距：**flag 覆盖完整性与语言矩阵代差**（模板生成器架构纯前端可及）。
- **reqbin.com**：转换即试发（在线执行）。差距：架构边界（纯浏览器 CORS 限制），应诚实标注而非补齐。
- 借鉴优先级：**修带参 flag 解析（缺陷）> -F 转 FormData＋警告 > 多语言 Tab（axios/Python 优先）> 代码高亮 > 错误 flag 定位**。

## 可拓展性

- 短期（1 周）：带参 flag 白名单（-u/--user/--url/-A/-e/--retry 等）跳过其参数并计入"已忽略 flag"清单展示；错误提示列出首个未识别 flag
- 中期（1 月）：-F→FormData 代码生成；axios/Python requests 两语言 Tab；代码输出接弹性高度（同 json-formatter.md 处方 1 机制）
- 远期：语言矩阵扩至 Go/Java/PHP；Body JSON 自动格式化预览；浏览器无法携带某些头（如 Cookie 强制）时的 CORS 边界诚实标注

## 优化处方（验收标准）

1. **修带参 flag 解析**：已知带参 flag 表跳过其后一个 token 并计入"已忽略"清单。→ **验收：粘贴 `curl -u admin:1234 https://api.dev/v1` 后 URL 卡显示 `https://api.dev/v1`，忽略清单列出 `-u`**
2. **-u 生成 Authorization**：-u 值按 base64(user:pass) 生成头。→ **验收：上例生成代码含 `"Authorization": "Basic YWRtaW46MTIzNA=="`**
3. **-F 转 FormData＋警告**：-F 字段生成 `form.append(...)` 且 Body 预览标注"原命令含表单字段 N 个"。→ **验收：`-F file=@a.png -F k=v` 生成两行 append 且 method 为 POST**
4. **多语言 Tab**：输出区加 fetch/axios/Python Tab。→ **验收：axios Tab 产出 `axios({ method, url, headers, data })` 且 headers 与 fetch 版一致**
5. **代码区弹性高度**：ResultBox 接 expand 模式（同 json-formatter 处方 1）。→ **验收：1366×768 下 60 行生成代码同屏可见 ≥28 行**
