# 稀土掘金签到工具

走掘金官方 `growth_api`：先 `get_today_status` 查今日状态（不需要风控参数），未签才 `check_in`，避免重复请求。独立小工具，Cookie / uuid / msToken / aBogus 全部来自同目录 `config.json`，代码零写死。

## 风控说明（实测结论，2026-09）

`check_in` 接口有字节系风控，**必须在 query 中携带 `msToken` + `a_bogus` 一对签名**：

- 二者成对出现、与参数绑定，服务端做密码学校验——伪造或缺任一都会被**静默拦截**（HTTP 200 + 空 body）
- `x-secsdk-csrf-token` 请求头经消融实验确认**不是**必需项
- 签名对由浏览器侧 VM 脚本生成，无法在本地用开源算法复现（抖音版 a_bogus 算法签出的值掘金不认）
- 实测该签名对捕获后数小时内重放依然有效，因此作为配置项存放，失效后按下面步骤重新抓取替换

## 配置

复制 `config.example.json` 为 `config.json`，填入：

| 字段 | 说明 | 获取方式 |
|---|---|---|
| `cookie` | 登录 Cookie（需含 sessionid） | 登录 juejin.cn → F12 → Network → 任意 `api.juejin.cn` 请求的 Request Headers 里整段复制 |
| `uuid` | 用户 uuid | 同一条请求的 Query 参数 `uuid` |
| `userId` | 用户 id（可选） | 同一条请求的 Query 参数 `user_id` |
| `msToken` | 签到风控参数（**必填**） | 见下方抓取步骤 |
| `aBogus` | 签到风控参数（**必填**） | 见下方抓取步骤，与 msToken 同一条请求 |
| `aid` | 站点 id | 默认 `2608`，一般不用改 |

### msToken / aBogus 抓取步骤（建议在签到前一天的任意时间操作）

1. 浏览器登录 juejin.cn，`F12` 打开 DevTools → Network 面板
2. 点击页面上的**签到按钮**（若当天已签，可先清除该站点 cookie 重登，或次日再抓）
3. 在 Network 里找到 `check_in` 请求
4. URL Query 中 `msToken=` 和 `a_bogus=` 两个参数的值，分别填入 `config.json` 的 `msToken` / `aBogus`（注意：粘贴 `a_bogus` 时把 `%2F` 还原为 `/`，即用 URL 解码后的原始值）

> 省事做法：右键该请求 → Copy → Copy as cURL，整段交给 AI 工具解析回填。

`config.json` 已被根 .gitignore 的 `**/config.json` 规则忽略，不会提交。

## 运行

```bash
node juejin-checkin/juejin-checkin.js
```

- 签到成功：打印服务端返回数据，退出码 0
- 今日已签：直接退出码 0，不重复请求 check_in（get_today_status 已拦截）
- msToken/aBogus 失效：check_in 返回空 body，退出码 1 并打印更新步骤
- Cookie 失效：get_today_status 返回 err_no 非 0，退出码 1 并提示重新抓取 cookie

日志以 `[api:juejin-get_today_status]`、`[api:juejin-check_in]` 打印真实请求与响应（msToken/a_bogus 打码），便于追溯。
