# 稀土掘金签到工具（无头浏览器版，全自动）

**免抓参数**：用无头 Chromium 打开掘金签到页，页面自身的 JS 会生成 msToken / a_bogus 等所有动态风控参数，脚本只负责注入 Cookie、点签到按钮、读结果。**唯一凭证是 cookie**，无需再抓任何签名参数。

## 原理与背景（2026-09 实测结论）

- 掘金 `check_in` 接口有字节系风控：query 必须携带 `msToken` + `a_bogus` 成对签名，且与请求 URL、UA、时间戳强绑定
- **API 直调 + 手工抓参数路线已证实不可行**：签名对有效期 < 24h（隔夜失效），且离开生成环境重放大概率被静默拦截（HTTP 200 + 空 body）
- 因此改用社区成熟方案（无头浏览器，参考 makerll/juejin_auto_sign）：签名由页面自己的运行时生成，天然合法；cookie 约一个月以上有效期，过期后重新复制一次即可

## 配置

复制 `config.example.json` 为 `config.json`，填入：

| 字段 | 说明 | 获取方式 |
|---|---|---|
| `cookie` | 登录 Cookie（需含 sessionid） | 登录 juejin.cn → F12 → Network → 任意请求的 Request Headers 里 `cookie:` 整段复制 |
| `headless` | 是否无头模式 | 默认 `true`；本地调试想看浏览器操作可改 `false` |

## 安装与运行

依赖 Node.js ≥ 18。首次使用需安装 Playwright 与 Chromium（各执行一次）：

```bash
npm install playwright
npx playwright install chromium
```

运行：

```bash
node juejin-browser.js     # 本工具
node ../run-all.js         # 或一键全跑
```

## 脚本行为

1. 打开 juejin.cn → 注入 cookie → 跳转签到页
2. 页面出现"连续签到天数"即视为登录态正常；若发现"今日已签到"文本，直接成功退出
3. 找到签到按钮（按 `立即签到` → `.signin-btn` → `.check-in-btn` 优先级匹配）并点击
4. 等"签到成功 / 获得 N 矿石"弹窗，输出矿石数与连续/累计天数
5. 失败时保存 `failure.debug.png` 截图辅助排查（已 gitignore）

## 旧版 API 直调脚本（备用，已弃用）

`juejin-checkin.js` 保留作参考：走 `growth_api/v1/get_today_status` + `check_in`，**需要手工抓 msToken/aBogus 且隔夜失效，仅 `get_today_status` 查询状态可用**。日常请用浏览器版。
