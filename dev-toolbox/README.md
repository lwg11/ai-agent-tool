# 前端瑞士军刀 · Dev Swiss Knife 🇨🇭

一个**单文件、零依赖、纯本地**运行的前端开发工具集 —— 双击 `dev-toolbox.html` 即用，数据不出浏览器。

专为前端日常联调场景设计：cURL 转代码、接口日志解析、JSON 对比、API 调试、Mock 生成、AES / 国密加解密、请求集合收藏、SSE 流式调试、凭证泄露扫描、文件 Base64 互转与 multipart 构造、Cookie / 请求头解析、px/rem/vw 单位换算、内置 JS 控制台（F12 式直执行）……

## 🧰 前端百宝箱 v2.0（antd 版，与 v1 并存）

`dev-toolbox-v2.html` —— 同样 20 个模块的 **React 17 + antd 4.24 全量重写版**：

- **单文件、零构建、离线可用**：React / ReactDOM / moment / antd（JS+CSS）/ htm 全部 UMD 内嵌（约 1.8MB），双击即用，数据不出浏览器
- **UI 全套 antd 组件**：Layout / Menu / Card / Table / Tabs / Select / Modal / Alert / Tag / message 等
- **数据与 v1 互通**：请求集合（`dsk-coll`）、环境变量（`dsk-env`）共用同一 localStorage，两边可无缝切换
- **核心逻辑零改动移植**：cURL 解析（tokenizeCurl/parseCurl）、国密库（SM3/SM4/SM2，已交叉验证）、凭证扫描规则（SEC_RULES）、请求头解析（hdrsParse）、JS 控制台（REPL 末行返回 + console 捕获）均取自 v1 已验证实现
- **构建可复现**：源码在 `v2-build/`（app-src.js + parts/ + build.py），`python3 v2-build/build.py` 一键重新生成（UMD 库缺失时自动下载）；`v2-build/smoke.js` 为 Playwright 冒烟测试（20 模块渲染 + 切换 + SM3 标准向量断言）
- v1 原生版 `dev-toolbox.html` 继续保留，两版独立迭代

## ✨ 功能模块（20 个）

| # | 模块 | 功能 |
|---|------|------|
| 1 | 🌀 cURL 转换器 | DevTools「Copy as cURL」→ fetch / axios / Console 即贴代码，支持 `$'...'` 转义、续行符、query 展开；解析后可**一键直接发起请求**看响应 |
| 2 | 🧱 JSON + TS 生成 | 格式化 / 压缩 / 校验（尾逗号容错），一键生成 TypeScript interface（数组合并采样，null 自动标 `?`） |
| 3 | 🧾 接口日志解析 | 按 `[api:xxx]` 标记切分控制台日志、提取格式化 JSON；无标记时降级提取行内 JSON |
| 4 | 🔀 JSON 对比 | 两个 JSON 递归对比，按路径标出新增 / 删除 / 修改 —— 联调时对比文档示例与真实返回 |
| 5 | ⏱️ 时间戳转换 | 秒(10位)/毫秒(13位)自动识别，本地 / ISO / UTC / 相对时间全格式 |
| 6 | 🔐 编解码 | Base64（UTF-8 安全）/ URL / Unicode / HTML 实体双向 |
| 7 | 🎫 JWT 解析 | 本地解码 header / payload，exp / iat 自动换算并标注是否过期 |
| 8 | 🔍 正则测试 | 实时高亮、捕获组表格、常用正则速查 |
| 9 | 🎨 颜色工具 | HEX / RGB / HSL 互转 + WCAG 对比度 AA / AAA 判定 |
| 10 | 🎲 生成器换算 | UUID v4 / 随机密码 / px·rem·vw 三向联动换算（根字号 + 视口宽度双基准）。|
| 11 | 📡 API 调试台 | 本地 mini Postman：cURL 一键导入、浏览器直发请求、CORS 被拦时生成 Node 脚本绕过、环境变量 `{{token}}` 全局替换、请求历史（最近 50 条）、响应一键转 Mock / TS 接口 / JSON 对比 / **axios 拦截器** |
| 12 | 🛡️ AES 加解密 | AES-128/192/256 · ECB/CBC · PKCS7，纯本地实现（已用 Node crypto 交叉验证），密钥/IV 支持 Text/Hex/Base64 |
| 13 | 🔌 WebSocket 调试台 | 连接 / 收发日志（JSON 自动美化）/ ping 心跳保活 / 断线自动重连 / 消息计数 / http(s)→ws(s) 自动转换 |
| 14 | 🔏 国密 SM2/SM3/SM4 | 纯 JS 国密套件：SM3 哈希、SM4 ECB/CBC 加解密、SM2 签名验签与公钥加密/私钥解密（已用 Node crypto + sm-crypto 交叉验证） |
| 15 | 📚 请求集合 | 接口收藏：按项目分组、localStorage 持久化、一键重放、复制 cURL、**从 API 调试台导入**、**从 cURL 粘贴导入** |
| 16 | 🌊 SSE 调试台 | Server-Sent Events 流式调试：EventSource(GET) 与 fetch 流双模式，自动解析 data/event/id/retry，JSON 自动美化 |
| 17 | 🕵️ 凭证泄露扫描 | 代码/日志扫描 AWS/GitHub/Slack/Stripe/Google Token、私钥、JWT、URL 密码与高熵疑似密钥，命中自动脱敏 |
| 18 | 📎 文件 Base64 & multipart | 图片/文件 ⇄ Base64 互转（FileReader，可预览/下载），构造 multipart/form-data 请求体（文本/文件字段，生成原始体 + fetch(FormData)/cURL -F 代码） |
| 19 | 🍪 Cookie / 请求头解析 | 粘贴 Cookie 串或 DevTools 请求头 dump，解析为结构化 KV（Cookie: 自动展开），导出 表格/JSON/JS 对象/cURL -H/环境变量 |
| 20 | 🖥️ JS 控制台 | 内置 F12 式控制台：直接写 JS 并执行，捕获 console.log/info/warn/error 与表达式返回值（支持 top-level await，循环引用安全） |

## 🚀 使用

无需安装任何东西：

```bash
# 方式一：直接双击 dev-toolbox.html
# 方式二：本地起个服务（推荐，避免 file:// 协议限制）
npx serve .
```

## ⌨️ 快捷键

按 `?` 呼出速查面板（输入框内不会误触发）：

- `Alt + 1~0`：切换前 10 个模块
- `Alt + Q`：API 调试台
- `Alt + A`：AES 加解密
- `Alt + W`：WebSocket 调试台
- `Alt + G`：国密 SM2/SM3/SM4
- `Alt + C`：请求集合
- `Alt + E`：SSE 调试台
- `Alt + X`：凭证泄露扫描
- `Alt + B`：文件 Base64 & multipart
- `Alt + H`：Cookie / 请求头解析
- `Alt + J`：JS 控制台（F12 式）
- `Esc`：关闭所有弹窗
- `Enter`（URL 框内）：API 调试台直接发送

## 🔒 隐私

- 所有处理均在本地浏览器完成，不上传任何数据
- 唯一的网络行为：API / WebSocket 调试台主动发起的连接（发往你指定的地址）
- 请求历史 / 环境变量存 localStorage，仅本机可见

## 🧪 AES 实现说明

AES 模块为纯 JS 手写实现（无 SubtleCrypto 依赖，保证 file:// 直接打开可用），已与 Node.js `crypto` 模块交叉验证：6 种配置（128/192/256 × ECB/CBC）× 6 组文本（含中文、emoji、非对齐长度）= **36/36 全部通过**。

## 🔐 国密实现说明

国密（SM2/SM3/SM4）模块为纯 JS 手写实现（零依赖，file:// 直接打开可用），与 Node.js `crypto`（SM3/SM4）及 `sm-crypto`（SM2 权威参考实现）交叉验证：

- **SM3**：`abc` / 空 / 中文长文本的哈希与 Node `crypto` 逐字节一致
- **SM4**：ECB/CBC 已知标准向量与随机密钥/明文全量一致（含 PKCS7 填充）
- **SM2**：与 `sm-crypto` 互相验签、互相解密均通过（C1C3C2 格式，兼容带 / 不带 `04` 前缀两种密文）

曲线参数采用 sm2p256v1（GB/T 32918 / RFC 8998），基点 G 已验证在曲线上；密文格式支持 `04` 前缀开关，方便与主流国密库对接。
