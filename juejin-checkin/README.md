# 稀土掘金签到工具

走掘金官方 checkin_api：先 `get_today_status` 查今日状态，未签才 `checkin`，避免重复请求。独立小工具，Cookie / aid / uuid / anti-content 全部来自同目录 `config.json`，代码零写死。

## 配置

复制 `config.example.json` 为 `config.json`，填入：

| 字段 | 说明 | 获取方式 |
|---|---|---|
| `cookie` | 登录 Cookie（需含 sessionid） | 登录 juejin.cn → F12 → Network → 任意 `api.juejin.cn` 请求的 Request Headers 里整段复制 |
| `uuid` | 用户 uuid | 同一条请求的 Query 参数 `uuid` |
| `aid` | 站点 id | 默认 `2608`，一般不用改 |
| `antiContent` | 风控参数（可选） | 返回 err_no 非 0（校验失败）时，把浏览器请求头 `anti-content` 的值填进来 |

`config.json` 已被 .gitignore 忽略，不会提交。

## 运行

```bash
node juejin-checkin/juejin-checkin.js
```

- 签到成功：打印获得矿石、当前矿石、连续签到天数
- 今日已签：直接退出码 0，不重复请求
- Cookie 失效 / 风控：退出码 1，日志给出处理建议

日志以 `[api:juejin-get_today_status]`、`[api:juejin-checkin]` 打印真实请求与响应，便于追溯。
