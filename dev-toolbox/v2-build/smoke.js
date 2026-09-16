/* 冒烟测试：渲染 + 控制台错误 + 逐模块切换 */
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liang/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const file = 'file:///C:/Users/liang/WorkBuddy/2026-09-03-18-00-30/dev-toolbox/dev-toolbox-v2.html';
  await page.goto(file, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  // 1) React 是否渲染
  const cards = await page.locator('.ant-card').count();
  const menuItems = await page.locator('.ant-menu-item').count();
  console.log('ant-card count:', cards);
  console.log('menu items:', menuItems);

  // 2) 逐模块点击切换，检查每个模块渲染出一个 ant-card 且无新错误
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-menu-item')).map(el => el.textContent.trim()));
  console.log('modules:', keys.length, JSON.stringify(keys));
  for (let i = 0; i < keys.length; i++) {
    const before = errors.length;
    await page.locator('.ant-menu-item').nth(i).click();
    await page.waitForTimeout(250);
    const visible = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('.ant-layout-content > div'));
      return divs.filter(d => d.style.display !== 'none').length;
    });
    if (errors.length > before) console.log('  ERR after switching to', keys[i], '=>', errors.slice(before).join(' | '));
    if (visible !== 1) console.log('  WARN visible modules =', visible, 'at', keys[i]);
  }
  console.log('switched through all', keys.length, 'modules');

  // 3) 功能抽测：SM3 哈希（切到国密模块，输入 abc 计算摘要）
  await page.evaluate(() => localStorage.setItem('dsk2-cur', 'gm'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.locator('.ant-menu-item').last().nth(0); // noop
  // 国密模块是第14项（index 13）
  await page.locator('.ant-menu-item').nth(13).click();
  await page.waitForTimeout(300);
  const sm3Ta = page.locator('#rc Tabs').first();
  // SM3 输入框是模块内第一个 textarea
  const ta = page.locator('.ant-tabs-tabpane-active textarea').first();
  await ta.fill('abc');
  await page.getByRole('button', { name: /计 算|计算/ }).first().click();
  await page.waitForTimeout(300);
  const sm3out = await page.locator('.ant-tabs-tabpane-active textarea').nth(1).inputValue();
  const expect = '66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0';
  console.log('SM3(abc) =', sm3out.slice(0, 70));
  console.log('SM3 match:', sm3out === expect ? 'PASS' : 'FAIL (expected ' + expect + ')');

  // 4) 截图
  await page.screenshot({ path: 'v2-smoke.png', fullPage: false });
  console.log('screenshot saved: v2-smoke.png');
  console.log('--- total errors:', errors.length);
  errors.slice(0, 10).forEach(e => console.log(e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
