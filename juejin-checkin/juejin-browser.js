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
 * 用法：node juejin-browser.js
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
    browser = await chromium.launch({ headless: HEADLESS });
    const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
    // 基础反检测
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Cookie 注入（必须先处于掘金域下）
    const page = await context.newPage();
    console.log('[api:juejin-browser] goto', JUEJIN_URL);
    await page.goto(JUEJIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await context.addCookies(parseCookieString(COOKIE));
    console.log(`[api:juejin-browser] 已注入 ${parseCookieString(COOKIE).length} 条 cookie`);

    console.log('[api:juejin-browser] goto', SIGNIN_URL);
    await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 等页面就绪（签到统计出现）
    try {
      await page.waitForSelector('text=连续签到天数', { timeout: 20000 });
    } catch {
      console.log('[juejin-browser] 未等到"连续签到天数"文本，继续尝试（页面结构可能变化）');
    }

    // 登录态检查
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
    if (/登录|login/i.test(bodyText.slice(0, 2000)) && !bodyText.includes('连续签到天数')) {
      throw new Error('登录态失效（页面未出现签到统计），请重新复制 cookie 更新 config.json / Secret');
    }

    // 已签到检查
    if (bodyText.includes('今日已签到')) {
      console.log('[juejin-browser] ✅ 今日已签到（免重复操作）');
      await browser.close();
      process.exit(0);
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
        btn = loc;
        console.log(`[juejin-browser] 找到${s.label}: "${(await loc.innerText().catch(() => '')).trim()}"`);
        break;
      }
    }
    if (!btn) throw new Error('未找到签到按钮（页面结构可能变化），附失败截图 failure.debug.png');
    await btn.click();
    console.log('[api:juejin-browser] 已点击签到按钮');

    // 等结果弹窗
    let reward = '签到成功';
    try {
      const popup = await page.waitForSelector('text=/签到成功|获得\\s*\\d+/', { timeout: 8000 });
      const txt = (await popup.innerText().catch(() => '')) || '';
      const m = txt.match(/(\d+)/);
      if (m) reward = `签到成功，获得 ${m[1]} 矿石`;
    } catch {
      // 弹窗没等到也不判定失败：以页面状态二次确认
      await page.waitForTimeout(3000);
      const t2 = (await page.locator('body').innerText().catch(() => '')) || '';
      if (t2.includes('今日已签到')) {
        console.log('[juejin-browser] ✅ 签到成功（状态已变更为"今日已签到"）');
        await browser.close();
        process.exit(0);
      }
      throw new Error('点击后未见签到结果（弹窗未出现且状态未变更），附失败截图 failure.debug.png');
    }

    // 统计信息（尽力而为）
    const t3 = (await page.locator('body').innerText().catch(() => '')) || '';
    const cont = t3.match(/(\d+)\s*(?:天)?\s*连续签到天数/);
    const total = t3.match(/(\d+)\s*(?:天)?\s*累计签到天数/);
    if (cont) console.log(`[juejin-browser] 连续签到: ${cont[1]} 天`);
    if (total) console.log(`[juejin-browser] 累计签到: ${total[1]} 天`);

    console.log(`[juejin-browser] ✅ ${reward}`);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('[juejin-browser] ❌ 失败:', err.message);
    // 失败截图便于排查
    try {
      if (browser) {
        const pages = browser.contexts()[0].pages();
        if (pages.length) await pages[pages.length - 1].screenshot({ path: path.join(__dirname, 'failure.debug.png') });
      }
    } catch { /* 截图失败忽略 */ }
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
})();
