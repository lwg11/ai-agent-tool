# 前端瑞士军刀 · Dev Swiss Knife 🇨🇭

一个**单文件、零依赖、纯本地**运行的前端开发工具集 —— 双击 `dev-toolbox.html` 即用，数据不出浏览器。

专为前端日常联调场景设计：cURL 转代码、接口日志解析、JSON 对比、API 调试、Mock 生成、AES 加解密……

## ✨ 功能模块（13 个）

| # | 模块 | 功能 |
|---|------|------|
| 1 | 🌀 cURL 转换器 | DevTools「Copy as cURL」→ fetch / axios / Console 即贴代码，支持 `$'...'` 转义、续行符、query 展开 |
| 2 | 🧱 JSON + TS 生成 | 格式化 / 压缩 / 校验（尾逗号容错），一键生成 TypeScript interface（数组合并采样，null 自动标 `?`） |
| 3 | 🧾 接口日志解析 | 按 `[api:xxx]` 标记切分控制台日志、提取格式化 JSON；无标记时降级提取行内 JSON |
| 4 | 🔀 JSON 对比 | 两个 JSON 递归对比，按路径标出新增 / 删除 / 修改 —— 联调时对比文档示例与真实返回 |
| 5 | ⏱️ 时间戳转换 | 秒(10位)/毫秒(13位)自动识别，本地 / ISO / UTC / 相对时间全格式 |
| 6 | 🔐 编解码 | Base64（UTF-8 安全）/ URL / Unicode / HTML 实体双向 |
| 7 | 🎫 JWT 解析 | 本地解码 header / payload，exp / iat 自动换算并标注是否过期 |
| 8 | 🔍 正则测试 | 实时高亮、捕获组表格、常用正则速查 |
| 9 | 🎨 颜色工具 | HEX / RGB / HSL 互转 + WCAG 对比度 AA / AAA 判定 |
| 10 | 🎲 生成器换算 | UUID v4 / 随机密码 / px ⇄ rem |
| 11 | 📡 API 调试台 | 本地 mini Postman：cURL 一键导入、浏览器直发请求、CORS 被拦时生成 Node 脚本绕过、环境变量 `{{token}}` 全局替换、请求历史（最近 50 条）、响应一键转 Mock / TS 接口 / JSON 对比 / **axios 拦截器** |
| 12 | 🛡️ AES 加解密 | AES-128/192/256 · ECB/CBC · PKCS7，纯本地实现（已用 Node crypto 交叉验证），密钥/IV 支持 Text/Hex/Base64 |
| 13 | 🔌 WebSocket 调试台 | 连接 / 收发日志（JSON 自动美化）/ ping 心跳保活 / 断线自动重连 / 消息计数 / http(s)→ws(s) 自动转换 |

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
- `Esc`：关闭所有弹窗
- `Enter`（URL 框内）：API 调试台直接发送

## 🔒 隐私

- 所有处理均在本地浏览器完成，不上传任何数据
- 唯一的网络行为：API / WebSocket 调试台主动发起的连接（发往你指定的地址）
- 请求历史 / 环境变量存 localStorage，仅本机可见

## 🧪 AES 实现说明

AES 模块为纯 JS 手写实现（无 SubtleCrypto 依赖，保证 file:// 直接打开可用），已与 Node.js `crypto` 模块交叉验证：6 种配置（128/192/256 × ECB/CBC）× 6 组文本（含中文、emoji、非对齐长度）= **36/36 全部通过**。
