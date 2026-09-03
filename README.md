# ai-agent-tool

AI Agent 小工具集合。**每个工具是独立文件夹**，自带脚本、config、README，互不依赖；接口地址、Cookie、Token 全部在各工具目录的 `config.json` 中配置，代码零写死。

```
ai-agent-tool/
├── ikuuu-checkin/       # ikuuu 签到（POST /user/checkin 领流量）
│   ├── ikuuu-checkin.js
│   ├── config.json      # 凭证（不入库）
│   ├── config.example.json
│   └── README.md
├── juejin-checkin/      # 稀土掘金签到（官方 checkin_api，防重复签）
│   ├── juejin-checkin.js
│   ├── config.json      # 凭证（不入库）
│   ├── config.example.json
│   └── README.md
├── run-all.js           # 可选：一键跑全部签到并汇总
├── package.json
└── 人寿团单下载工具/ 等既有工具目录
```

## 运行

依赖：Node.js ≥ 18（自带 fetch，无第三方依赖）。

```bash
node ikuuu-checkin/ikuuu-checkin.js     # 单独跑 ikuuu
node juejin-checkin/juejin-checkin.js   # 单独跑掘金
node run-all.js                         # 一键全部（npm run all 等价）
```

各工具用法与凭证获取方式见各自目录下的 README.md。

## 新增一个工具的规范

1. 在仓库根目录新建 `<工具名>/` 文件夹
2. 放入 `<工具名>.js` + `config.example.json`（凭证字段模板）+ `README.md`
3. 脚本只从 `__dirname/config.json` 读凭证，不写死任何接口地址 / Cookie / Token
4. 根 `.gitignore` 已用 `**/config.json` 拦截所有凭证文件入库

## 日志规范

真实接口响应以 `[api:<工具>-<接口>]` 形式打印，便于联调追溯。

## 定时执行方案 A：GitHub Actions（推荐，云端跑，本机关机也照跑）

工作流：`.github/workflows/daily-checkin.yml`，每天**北京时间约 10:00** 自动执行 `run-all.js`（cron 为 UTC 01:00，GitHub 可能有 0~30 分钟触发延迟）。

首次配置只需两步：

1. 打开仓库 GitHub 页面 → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
2. 添加两个 Secret（Name 必须一字不差）：

   | Secret 名称 | 值 |
   |---|---|
   | `IKUUU_CONFIG_JSON` | 本地 `ikuuu-checkin/config.json` 的**完整内容**（整个 JSON 原样粘贴） |
   | `JUEJIN_CONFIG_JSON` | 本地 `juejin-checkin/config.json` 的**完整内容**（整个 JSON 原样粘贴） |

Secret 安全性：GitHub 会加密存储，日志中自动打码，不会出现在代码里。凭证失效后更新 Secret 里的 JSON 内容即可。

手动测试：仓库页面 → `Actions` → `daily-checkin` → `Run workflow`。运行结果与日志在 Actions 列表查看。

## 定时执行方案 B：Windows 任务计划程序（本地跑）

```powershell
$action  = New-ScheduledTaskAction -Execute "node.exe" -Argument "run-all.js" -WorkingDirectory "<本仓库路径>"
$trigger = New-ScheduledTaskTrigger -Daily -At 10:00
Register-ScheduledTask -TaskName "ai-agent-tool 签到" -Action $action -Trigger $trigger
```

仓库：`git@github.com:lwg11/ai-agent-tool.git`
