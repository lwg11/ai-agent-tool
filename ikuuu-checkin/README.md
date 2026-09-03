# ikuuu 签到工具

调用 `POST {baseUrl}/user/checkin` 每日签到领流量。独立小工具，接口地址与 Cookie 全部来自同目录 `config.json`，代码零写死。

## 配置

复制 `config.example.json` 为 `config.json`，填入：

| 字段 | 说明 |
|---|---|
| `baseUrl` | ikuuu 站点域名（该站常换域名，只改这里） |
| `cookie` | 浏览器登录后 F12 → Network 里整段复制的 cookie 请求头 |
| `timeoutMs` | 请求超时，默认 20000 |

`config.json` 已被 .gitignore 忽略，不会提交。

## 运行

```bash
node ikuuu-checkin/ikuuu-checkin.js
```

- 签到成功 / 已签到 → 退出码 0
- Cookie 失效（返回非 JSON）或 ret≠1 → 退出码 1，日志给出处理建议

日志以 `[api:ikuuu-checkin]` 打印真实请求与响应，便于追溯。
