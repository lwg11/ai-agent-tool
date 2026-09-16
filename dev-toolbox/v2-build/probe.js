/* 在页面中逐段复刻 CurlMod 根模板，定位 #31 */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Users/liang/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', headless: true });
  const p = await b.newPage();
  await p.goto('file:///C:/Users/liang/WorkBuddy/2026-09-03-18-00-30/dev-toolbox/.v2libs/v2-debug.html', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const res = await p.evaluate(() => {
    const out = [];
    const t = (name, tpl) => {
      const div = document.createElement('div'); document.body.appendChild(div);
      try { ReactDOM.render(tpl, div); out.push(name + ': OK'); }
      catch (e) { out.push(name + ': FAIL ' + String(e.message || e).slice(0, 80)); }
      ReactDOM.unmountComponentAtNode(div); div.remove();
    };
    const noop = () => {};
    // A: 无 extra，仅 TextArea
    t('A-no-extra', html`
    <${Card} title="curl">
      <TextArea rows="6" value="" onChange=${noop} placeholder="p" />
      ${null}
    <//>`);
    // B: 带 extra 嵌套模板
    t('B-with-extra', html`
    <${Card} title="curl" extra=${html`<${Space}>
        <${Button} type="primary" size="small" onClick=${noop}>解析</${Button}>
        <${Button} size="small" disabled=${true}>执行</${Button}>
      <//>`}>
      <TextArea rows="6" value="" onChange=${noop} placeholder="p" />
      ${null}
    <//>`);
    // C: false 占位
    t('C-false-hole', html`
    <${Card} title="curl">
      <TextArea rows="6" />
      ${false}
    <//>`);
    // D: 字符串标签 TextArea
    t('D-string-textarea', html`<${Card}><TextArea rows="6" /><//>`);
    // E: 完整复刻（含 req=null 时的 placeholder 反斜杠与 $'）
    t('E-real-ph', html`
    <${Card} title="🌀 cURL 转换器" extra=${html`<${Space}>
        <${Button} type="primary" size="small" onClick=${noop}>解析</${Button}>
        <${Button} size="small" disabled=${true}>🚀 直接执行</${Button}>
      <//>`}>
      <TextArea rows="6" value="" onChange=${noop}
        placeholder="粘贴 DevTools → Copy as cURL 的内容，支持续行符 \ 和 $'...' 转义" />
      ${null}
    <//>`);
    return out;
  });
  res.forEach(r => console.log(r));
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
