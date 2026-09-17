/* 视觉审查截图：遍历全部模块，逐个截图到 v2-build/review/ */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/liang/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  const file = 'file:///C:/Users/liang/WorkBuddy/2026-09-03-18-00-30/dev-toolbox/dev-toolbox-v2.html';
  await page.goto(file, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-menu-item')).map(el => el.textContent.trim()));
  console.log('modules:', keys.length, JSON.stringify(keys));

  for (let i = 0; i < keys.length; i++) {
    await page.evaluate(idx => {
      document.querySelectorAll('.ant-menu-item')[idx].click();
    }, i);
    await page.waitForTimeout(350);
    const name = ('0' + (i + 1)).slice(-2) + '-' + keys[i].replace(/[^\w\u4e00-\u9fa5]+/g, '');
    await page.screenshot({ path: 'v2-build/review/' + name + '.png' });
    console.log('shot:', name, errors.length ? ('errors so far: ' + errors.length) : '');
  }
  console.log('DONE, total errors:', errors.length);
  await browser.close();
})();
