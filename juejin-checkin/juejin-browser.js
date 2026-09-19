#!/usr/bin/env node
/**
 * 掘金自动签到 —— 无头浏览器版（全自动，免抓参数）。
 *
 * 原理：真实浏览器打开掘金签到页，页面自身的 JS 会生成 msToken/a_bogus 等所有
 * 动态风控参数，脚本只负责注入 Cookie、点签到按钮、读结果。因此 config.json
 * 只需要 cookie 一项凭证，无需再抓 msToken/aBogus（API 直调路线已证实不可行，
 * 风控对与请求 URL/UA/时间强绑定且 <24h 失效）。
 *
 * 依赖：npm install playwright && npx playwright install chromium
 * 用法：node juejin-browser.js                # 签到 + 每日免费单抽
 *       node juejin-browser.js --draw-only    # 仅免费单抽（控制台「手动单抽」走这里）
 *       node juejin-browser.js --ten-draw-only # 仅十连抽（手动触发专用，消耗 2000 矿石）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const cfgPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(cfgPath)) {
  console.error('[juejin-browser] 缺少 config.json，请按 README 配置 cookie');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const COOKIE = cfg.cookie || '';
const HEADLESS = cfg.headless !== false; // 默认无头
if (!COOKIE || COOKIE.includes('在此粘贴')) {
  console.error('[juejin-browser] config.json 的 cookie 未配置');
  process.exit(1);
}

const JUEJIN_URL = 'https://juejin.cn/';
const SIGNIN_URL = 'https://juejin.cn/user/center/signin?from=main_page';
const LOTTERY_URL = 'https://juejin.cn/user/center/lottery?from=lucky_lottery_menu_bar';
// 仅单抽模式（跳过签到，直接进抽奖页）
const DRAW_ONLY = process.argv.includes('--draw-only');
// 仅十连抽模式（手动触发专用：十连抽无免费次数概念，每次消耗 2000 矿石，
// 余额不足由服务端拒绝（err_no != 0），不会扣成负数）
const TEN_DRAW_ONLY = process.argv.includes('--ten-draw-only');
// 任务键：失败截图文件名与 run-all 的任务 key 对齐（run-all 靠它关联截图）
const TASK_KEY = TEN_DRAW_ONLY ? 'juejin-ten-draw' : DRAW_ONLY ? 'juejin-draw' : 'juejin';
// 失败截图统一落仓库根 screenshots/（北京时间日期命名，workflow 随历史一起提交、
// 控制台页面展示；run-all 重试成功后会清理对应截图，14 天滚动清理防膨胀）
const SHOT_DIR = path.join(__dirname, '..', 'screenshots');
const shotName = () => `${new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)}-${TASK_KEY}.png`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function parseCookieString(str) {
  const cookies = [];
  for (const item of str.split(';')) {
    const t = item.trim();
    if (!t || !t.includes('=')) continue;
    const idx = t.indexOf('=');
    cookies.push({ name: t.slice(0, idx).trim(), value: t.slice(idx + 1).trim(), domain: '.juejin.cn', path: '/' });
  }
  return cookies;
}

(async () => {
  let browser;
  try {
    const { chromium } = require('playwright');
    console.log('[juejin-browser] 启动无头 Chromium...');
    browser = await chromium.launch(
      cfg.executablePath
        ? { headless: HEADLESS, executablePath: cfg.executablePath } // 本地版本错位时手动指定，云端无需配置
        : { headless: HEADLESS }
    );
    const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
    // 基础反检测
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Cookie 注入（必须先处于掘金域下）
    const page = await context.newPage();
    // 网络监听：捕获 check_in 接口的真实响应——签到成败以接口为准（UI 弹窗偶发不出现，不可靠）
    let lastCheckin = null; // { errNo, point }
    let lastLotteryConfig = null; // { errNo, freeCount } —— 免费次数以页面真实接口响应为准
    let lastDraw = null; // { errNo, msg, name }
    let lastTenDraw = null; // { errNo, msg, names } —— 十连抽结果
    page.on('response', async (resp) => {
      try {
        const u = resp.url();
        if (u.includes('/growth_api/v1/check_in')) {
          let body = '';
          try { body = (await resp.text()) || ''; } catch { body = ''; }
          console.log(`[api:juejin-check_in] HTTP ${resp.status()} ${body.slice(0, 200)}`);
          try {
            const j = JSON.parse(body);
            lastCheckin = { errNo: j.err_no, point: j.data && typeof j.data.incr_point === 'number' ? j.data.incr_point : null };
          } catch { lastCheckin = { errNo: -1, point: null }; }
        }
        if (u.includes('/growth_api/v1/lottery_config/get')) {
          let body = '';
          try { body = (await resp.text()) || ''; } catch { body = ''; }
          console.log(`[api:juejin-lottery_config] HTTP ${resp.status()} ${body.slice(0, 120)}`);
          try {
            const j = JSON.parse(body);
            const fc = j.data && typeof j.data.free_count === 'number' ? j.data.free_count : null;
            lastLotteryConfig = { errNo: j.err_no, freeCount: fc };
          } catch { lastLotteryConfig = { errNo: -1, freeCount: null }; }
        }
        if (u.includes('/growth_api/v1/lottery/draw')) {
          let body = '';
          try { body = (await resp.text()) || ''; } catch { body = ''; }
          console.log(`[api:juejin-draw] HTTP ${resp.status()} ${body.slice(0, 200)}`);
          try {
            const j = JSON.parse(body);
            lastDraw = { errNo: j.err_no, msg: j.err_msg || '', name: j.data && j.data.lottery_name ? j.data.lottery_name : null };
          } catch { lastDraw = { errNo: -1, msg: '', name: null }; }
        }
        // 十连抽接口（/lottery/ten_draw 与 /lottery/draw 子串不重叠，独立分支）
        if (u.includes('/growth_api/v1/lottery/ten_draw')) {
          let body = '';
          try { body = (await resp.text()) || ''; } catch { body = ''; }
          console.log(`[api:juejin-ten_draw] HTTP ${resp.status()} ${body.slice(0, 200)}`);
          try {
            const j = JSON.parse(body);
            // 09-19 实测：ten_draw 返回 data.LotteryBases（大写 L 开头），不是 lottery_list
            const raw = j.data && (Array.isArray(j.data.LotteryBases) ? j.data.LotteryBases : Array.isArray(j.data.lottery_list) ? j.data.lottery_list : null);
            const list = raw ? raw.map((x) => (x && x.lottery_name) || '?') : null;
            lastTenDraw = { errNo: j.err_no, msg: j.err_msg || '', names: list };
          } catch { lastTenDraw = { errNo: -1, msg: '', names: null }; }
        }
      } catch { /* 忽略监听竞态 */ }
    });
    // 禁图提速（海外 runner 访问掘金较慢）
    await context.route('**/*', (route) => {
      try {
        if (route.request().resourceType() === 'image') return route.abort();
        return route.continue();
      } catch { /* 忽略路由竞态 */ }
    });

    // goto 带重试：GitHub Actions（海外）访问 juejin.cn 偶发超时
    const gotoWithRetry = async (url, tries = 3) => {
      for (let i = 1; i <= tries; i++) {
        try {
          console.log(`[api:juejin-browser] goto ${url}（第 ${i}/${tries} 次）`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          return;
        } catch (e) {
          console.log(`[juejin-browser] 第 ${i} 次加载失败: ${e.message.split('\n')[0]}`);
          if (i === tries) throw e;
          await page.waitForTimeout(5000);
        }
      }
    };

    await gotoWithRetry(JUEJIN_URL);
    await context.addCookies(parseCookieString(COOKIE));
    console.log(`[api:juejin-browser] 已注入 ${parseCookieString(COOKIE).length} 条 cookie`);

    // ---- 按钮查找公共逻辑 ----
    // 教训（09-19 实测）：按钮文案随状态变化——免费次数>0 时是「免费抽奖次数：1次」，
    // 用完后是「单抽」；精确 text= 匹配只命中单一状态。必须用正则模糊匹配 +
    // waitFor 渲染等待（云端 runner 慢，config 接口返回时 DOM 可能还没渲染完）。
    const findBtn = async (selectors, tag) => {
      for (const s of selectors) {
        const loc = page.locator(s.name).first();
        try {
          await loc.waitFor({ state: 'visible', timeout: 8000 });
          console.log(`[${tag}] 找到${s.label}: "${((await loc.innerText().catch(() => '')) || '').trim().slice(0, 30)}"`);
          return loc;
        } catch { /* 该候选未命中，试下一个 */ }
      }
      // 全部未命中：输出页面可见文本片段辅助诊断（截图在失败出口统一落盘）
      const body = (await page.locator('body').innerText().catch(() => '')) || '';
      console.error(`[${tag}] ❌ 按钮未找到，页面可见文本片段: ${body.replace(/\s+/g, ' ').slice(0, 400)}`);
      return null;
    };

    // ---- 每日免费单抽（页面自身生成风控参数，免抓取） ----
    // 安全前提：只有页面真实接口 lottery_config/get 返回 free_count > 0 才点击，
    // 否则一律不点（点击无免费次数的单抽会扣 200 矿石）。
    const doDraw = async () => {
      await gotoWithRetry(LOTTERY_URL);
      // 等待页面加载并发出 lottery_config/get（最多 10 秒）
      for (let i = 0; i < 10 && !lastLotteryConfig; i++) await page.waitForTimeout(1000);
      const bt = (await page.locator('body').innerText().catch(() => '')) || '';
      if (bt.includes('访问异常')) throw new Error('抽奖页触发掘金风控拦截页（"访问异常"）');
      if (!lastLotteryConfig || typeof lastLotteryConfig.freeCount !== 'number' || lastLotteryConfig.errNo !== 0) {
        throw new Error('未捕获到 lottery_config/get 的 free_count（安全起见不点击，防止误扣矿石）');
      }
      if (lastLotteryConfig.freeCount <= 0) {
        return '今日免费次数已用完（free_count=0），跳过单抽';
      }
      console.log(`[juejin-draw] 免费次数 ${lastLotteryConfig.freeCount} 次，点击单抽...`);
      // 免费次数>0 时按钮文案为「免费抽奖次数：N次」；用完后为「单抽」。正则覆盖两种状态
      const candidates = [
        { name: 'text=/免费抽奖/', label: '免费抽奖按钮' },
        { name: 'text="单抽"', label: '单抽按钮' },
        { name: 'text=/单抽/', label: '单抽按钮(正则)' },
      ];
      const drawBtn = await findBtn(candidates, 'juejin-draw');
      if (!drawBtn) throw new Error('未找到单抽按钮（免费抽奖/单抽均未命中）');
      lastDraw = null;
      await drawBtn.click({ timeout: 5000 }).catch(() => {});
      console.log('[api:juejin-draw] 已点击单抽，等待抽奖接口响应（转盘动画最长 15 秒）...');
      for (let i = 0; i < 15 && !lastDraw; i++) await page.waitForTimeout(1000);
      if (lastDraw && lastDraw.errNo === 0) return `单抽成功: ${lastDraw.name || '(未知奖品)'}`;
      if (lastDraw && lastDraw.errNo !== 0) {
        if (/次数|用完|免费/.test(lastDraw.msg)) return `免费次数已用完（服务端返回: ${lastDraw.msg}）`;
        throw new Error(`draw err_no=${lastDraw.errNo}, err_msg=${lastDraw.msg}`);
      }
      // 接口监听未命中时兜底看结果弹窗
      const t = (await page.locator('body').innerText().catch(() => '')) || '';
      const m = t.match(/恭喜[^。]{0,40}?获得\s*([^\s，。]{1,20})/);
      if (m) return `单抽成功: ${m[1]}（弹窗确认）`;
      throw new Error('点击后未见 draw 接口响应与结果弹窗，附失败截图 failure.debug.png');
    };

    // ---- 手动十连抽（每次消耗 2000 矿石，无免费次数概念） ----
    // 仅手动触发（--ten-draw-only / 控制台菜单），绝不接入自动流程；
    // 余额不足由服务端拒绝（err_no != 0），脚本不额外拦截。
    const doTenDraw = async () => {
      await gotoWithRetry(LOTTERY_URL);
      for (let i = 0; i < 10 && !lastLotteryConfig; i++) await page.waitForTimeout(1000);
      const bt = (await page.locator('body').innerText().catch(() => '')) || '';
      if (bt.includes('访问异常')) throw new Error('抽奖页触发掘金风控拦截页（"访问异常"）');
      const balance = bt.match(/(\d+)\s*矿石/);
      if (balance) console.log(`[juejin-ten-draw] 当前矿石余额（页面读取）: ${balance[1]}`);
      console.log('[juejin-ten-draw] 点击十连抽（将消耗 2000 矿石）...');
      const candidates = [
        { name: 'text="十连抽"', label: '十连抽按钮' },
        { name: 'text=/十连抽/', label: '十连抽按钮(正则)' },
      ];
      const tenBtn = await findBtn(candidates, 'juejin-ten-draw');
      if (!tenBtn) throw new Error('未找到十连抽按钮');
      lastTenDraw = null;
      await tenBtn.click({ timeout: 5000 }).catch(() => {});
      console.log('[api:juejin-ten-draw] 已点击十连抽，等待 ten_draw 接口响应（动画最长 20 秒）...');
      for (let i = 0; i < 20 && !lastTenDraw; i++) await page.waitForTimeout(1000);
      if (lastTenDraw && lastTenDraw.errNo === 0) {
        const names = Array.isArray(lastTenDraw.names) ? lastTenDraw.names.join('、') : '(未解析到奖品列表)';
        return `十连抽成功: ${names}`;
      }
      if (lastTenDraw && lastTenDraw.errNo !== 0) {
        if (/矿石|不足|余额/.test(lastTenDraw.msg)) return `矿石余额不足，未执行（服务端返回: ${lastTenDraw.msg}）`;
        throw new Error(`ten_draw err_no=${lastTenDraw.errNo}, err_msg=${lastTenDraw.msg}`);
      }
      throw new Error('点击后未见 ten_draw 接口响应（20 秒），附失败截图 failure.debug.png');
    };
    // 签到流程收尾（含尽力而为的单抽：单抽失败不影响签到结果记录）
    const finishSigned = async (msg) => {
      console.log(`[juejin-browser] ✅ ${msg}`);
      if (!DRAW_ONLY && !TEN_DRAW_ONLY) {
        try {
          const drawMsg = await doDraw();
          console.log(`[juejin-draw] ${drawMsg.startsWith('单抽成功') ? '✅' : 'ℹ️'} ${drawMsg}`);
        } catch (e) {
          console.log(`[juejin-draw] ⚠️ 单抽未完成（不影响签到结果）: ${e.message}`);
        }
      }
      await browser.close();
      process.exit(0);
    };

    if (TEN_DRAW_ONLY) {
      const r = await doTenDraw();
      console.log(`[juejin-ten-draw] ✅ ${r}`);
      await browser.close();
      process.exit(0);
    }

    if (DRAW_ONLY) {
      const r = await doDraw();
      await finishSigned(r);
    }

    await gotoWithRetry(SIGNIN_URL);

    // 等页面就绪（签到统计出现）
    try {
      await page.waitForSelector('text=连续签到天数', { timeout: 20000 });
    } catch {
      console.log('[juejin-browser] 未等到"连续签到天数"文本，继续尝试（页面结构可能变化）');
    }

    // 登录态检查
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
    if (bodyText.includes('访问异常')) {
      throw new Error('触发掘金风控拦截页（"访问异常"）——多为短时间内访问过频，请稍后重试；正常每日一次的定时节奏不会触发');
    }
    if (/登录|login/i.test(bodyText.slice(0, 2000)) && !bodyText.includes('连续签到天数')) {
      throw new Error('登录态失效（页面未出现签到统计），请重新复制 cookie 更新 config.json / Secret');
    }

    // 已签到检查
    if (bodyText.includes('今日已签到')) {
      await finishSigned('今日已签到（免重复操作）');
    }

    // 找签到按钮（按优先级）
    const btnSelectors = [
      { name: 'button:has-text("立即签到")', label: '立即签到按钮' },
      { name: '.signin-btn', label: '.signin-btn' },
      { name: '.check-in-btn', label: '.check-in-btn' },
      { name: 'button:has-text("签到")', label: '签到按钮(宽匹配)' },
    ];
    let btn = null;
    for (const s of btnSelectors) {
      const loc = page.locator(s.name).first();
      if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
        const btnText = (await loc.innerText().catch(() => '')).trim();
        // 已签状态下按钮会变成"已签到"字样 —— 直接视为成功
        if (btnText.includes('已签')) {
          await finishSigned('今日已签到（按钮状态为已签）');
        }
        btn = loc;
        console.log(`[juejin-browser] 找到${s.label}: "${btnText}"`);
        break;
      }
    }
    if (!btn) {
      // 兜底：找不到按钮但页面有"已签到"字样 → 视为已签成功
      const signedEl = page.locator('text=/已签/').first();
      if ((await signedEl.count()) > 0 && (await signedEl.isVisible().catch(() => false))) {
        await finishSigned('今日已签到（页面含已签状态文本）');
      }
      throw new Error('未找到签到按钮（页面结构可能变化），附失败截图 failure.debug.png');
    }
    // 点击签到（最多 3 次尝试）：掘金前端偶发点击无反应（签到请求未发出），
    // 服务端幂等（已签再点无害），无反应时自动重试
    let reward = '签到成功';
    let signed = false;
    for (let attempt = 1; attempt <= 3 && !signed; attempt++) {
      if (attempt > 1) console.log(`[juejin-browser] 点击无反应，第 ${attempt}/3 次重试`);
      await btn.click({ timeout: 5000 }).catch(() => {});
      console.log(`[api:juejin-browser] 已点击签到按钮（第 ${attempt} 次）`);
      lastCheckin = null;
      // 每次点击后观察 ~8 秒：接口响应 / 页面状态 / 弹窗，任一出现即判定
      for (let i = 0; i < 8 && !signed; i++) {
        await page.waitForTimeout(1000);
        if (lastCheckin && (lastCheckin.errNo === 0 || lastCheckin.errNo === 15001)) {
          reward = lastCheckin.errNo === 15001
            ? '今日已签到（接口 err_no=15001）'
            : `签到成功，获得 ${lastCheckin.point} 矿石`;
          signed = true;
          break;
        }
        const t = (await page.locator('body').innerText().catch(() => '')) || '';
        if (t.includes('今日已签到')) {
          reward = '签到成功（状态已变更为"今日已签到"）';
          signed = true;
          break;
        }
        const pop = page.locator('text=/签到成功|获得\\s*\\d+/').first();
        if ((await pop.count()) > 0 && (await pop.isVisible().catch(() => false))) {
          const txt = (await pop.innerText().catch(() => '')) || '';
          const m = txt.match(/(\d+)/);
          reward = `签到成功，获得 ${m ? m[1] : '?'} 矿石（弹窗确认）`;
          signed = true;
          break;
        }
      }
    }
    // 点击均未见结果 → reload 复核：点击可能已在服务端生效（签到请求实际发出并成功），
    // 但 UI 弹窗与接口监听都没捕捉到；以 reload 后页面真实状态为准，避免误报失败
    if (!signed) {
      console.log('[juejin-browser] 点击均未见签到结果，reload 页面复核实际签到状态...');
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);
        const t2 = (await page.locator('body').innerText().catch(() => '')) || '';
        if (t2.includes('今日已签到')) {
          reward = '签到成功（reload 后状态为"今日已签到"）';
          signed = true;
        }
      } catch { /* reload 失败按原失败路径处理 */ }
    }
    if (!signed) throw new Error('连续 3 次点击后均未见签到结果（接口无响应、状态未变更、reload 复核仍未签到）（见 screenshots/ 失败截图）');

    // 统计信息（尽力而为）
    const t3 = (await page.locator('body').innerText().catch(() => '')) || '';
    const cont = t3.match(/(\d+)\s*(?:天)?\s*连续签到天数/);
    const total = t3.match(/(\d+)\s*(?:天)?\s*累计签到天数/);
    if (cont) console.log(`[juejin-browser] 连续签到: ${cont[1]} 天`);
    if (total) console.log(`[juejin-browser] 累计签到: ${total[1]} 天`);

    await finishSigned(reward);
  } catch (err) {
    console.error('[juejin-browser] ❌ 失败:', err.message);
    // 失败截图便于排查：统一落 screenshots/（文件名 <北京日期>-<任务键>.png，
    // run-all 检测到后挂到结果上，workflow 随 checkin-history.json 一起提交，控制台展示）
    try {
      if (browser) {
        const pages = browser.contexts()[0].pages();
        if (pages.length) {
          fs.mkdirSync(SHOT_DIR, { recursive: true });
          const shot = path.join(SHOT_DIR, shotName());
          await pages[pages.length - 1].screenshot({ path: shot });
          console.log(`[juejin-browser] 📸 失败截图已保存: screenshots/${shotName()}`);
        }
      }
    } catch { /* 截图失败忽略 */ }
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
})();
