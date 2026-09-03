# ai-agent-tool

AI Agent 小工具集合（签到类）。**所有接口地址、Cookie、Token 均在 `config.json` 中配置，代码里不写死任何凭证**——换了账号、换了域名、Cookie 过期，只需要改配置文件。

## 工具清单

| 工具 | 说明 | 运行命令 |
|---|---|---|
| ikuuu 签到 | POST `{baseUrl}/user/checkin`，用 Cookie 签到领流量 | `npm run ikuuu` |
| 稀土掘金签到 | 调掘金官方 `checkin_api`（先查今日状态再签到，避免重复） | `npm run juejin` |
| 全部执行 | 顺序跑上面所有工具，输出汇总 | `npm run all` |

## 配置说明（config.json）

```jsonc
{
  "ikuuu": {
    "baseUrl": "https://ikuuu.foo",   // 域名会变（.foo/.one/...），改这里即可
    "cookie": "uid=xxx; email=xxx; key=xxx; ip=xxx; expire_in=xxx; ..." // 登录后的完整 Cookie
  },
  "juejin": {
    "apiBase": "https://api.juejin.cn",
    "aid": "2608",                    // 掘金站点 id，默认 2608
    "uuid": "",                       // 登录 juejin.cn 后，DevTools→Network 里 api.juejin.cn 请求 query 中的 uuid
    "cookie": "",                     // 登录后的完整 Cookie（需含 sessionid）
    "antiContent": "",                // 可选：遇到风控校验失败时，填浏览器请求头 anti-content 的值
    "timeoutMs": 20000
  }
}
```

### 掘金 Cookie / uuid 获取方法

1. 浏览器登录 https://juejin.cn
2. `F12` 打开 DevTools → Network 面板
3. 随便刷新一个页面，点开任意一条 `api.juejin.cn` 的请求
4. Request Headers 里的 `cookie` 整段复制 → 填入 `config.json` 的 `juejin.cookie`
5. Query 参数里的 `uuid` 复制 → 填入 `juejin.uuid`

### ikuuu Cookie 获取方法

1. 浏览器登录 ikuuu（当前域名见 `config.json`）
2. `F12` → Network → 找一条对站点域名的请求，整段复制 `cookie` 请求头
3. 填入 `config.json` 的 `ikuuu.cookie`

## 运行方式

依赖：Node.js ≥ 18（自带 fetch，无第三方依赖）。

```bash
cd ai-agent-tool
npm run all      # 一键全部签到
npm run ikuuu    # 只跑 ikuuu
npm run juejin   # 只跑掘金
```

日志中所有真实接口响应以 `[api:xxx]` 形式打印，便于联调追溯。

## 定时执行（Windows 任务计划程序）

每天 10:00 自动签到，管理员 PowerShell 执行一次即可：

```powershell
$action  = New-ScheduledTaskAction -Execute "node.exe" -Argument "run-all.js" -WorkingDirectory "<本仓库路径>"
$trigger = New-ScheduledTaskTrigger -Daily -At 10:00
Register-ScheduledTask -TaskName "ai-agent-tool 签到" -Action $action -Trigger $trigger
```

## 常见问题

- **ikuuu 返回非 JSON / 重定向**：Cookie 失效，重新登录后更新 `config.json`。
- **掘金 err_no 非 0（风控/校验失败）**：更新 Cookie；仍不行则把浏览器请求头里的 `anti-content` 填入配置。
- **掘金提示已签**：工具会先查 `get_today_status`，已签当天不会重复请求签到接口。

## 版本管理

仓库：`git@github.com:lwg11/ai-agent-tool.git`
