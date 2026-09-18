#!/usr/bin/env node
/**
 * 稀土掘金每日免费单抽（lottery/draw）
 * 接口: POST {apiBase}/growth_api/v1/lottery/draw
 *
 * 风控（2026-09-18 消融实测）：
 *   - 必须携带 msToken + a_bogus 风控对（从 draw 请求抓取，与 URL 绑定）
 *   - 必须携带 x-secsdk-csrf-token 请求头（check_in 不需要它，draw 需要）
 *   - 三者任一缺失返回 HTTP 200 + 空 body（静默风控拦截）
 *   - 完整携带时成功；免费次数用尽后服务端返回 err_no != 0（以 err_msg 为准）
 *
 * 凭证读取同目录 config.json（与签到共用 cookie）：cookie / uuid / msToken / aBogus / csrfToken
 * 用法: node juejin-checkin/juejin-draw.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

function fail(msg, extra) {
  console.error('[juejin-draw] 失败:', msg);
  if (extra) console.error(extra);
  process.exit(1);
}

function parseJsonOrFail(text, label, status) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 300);
    fail(`${label} 返回内容不是 JSON（HTTP ${status}）。返回片段: ${snippet}`);
  }
}

(async () => {
  const cfgPath = path.join(__dirname, 'config.json');
  if (!fs.existsSync(cfgPath)) fail('找不到配置文件 ' + cfgPath);
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

  if (!cfg.apiBase) fail('config.json 中缺少 apiBase');
  for (const f of ['cookie', 'uuid', 'msToken', 'aBogus', 'csrfToken']) {
    if (!cfg[f] || !String(cfg[f]).trim())
      fail(`config.json 中缺少 ${f}（draw 风控必需，三者任一缺失都会被静默拦截）。抓取步骤见 README`);
  }

  const apiBase = cfg.apiBase.replace(/\/+$/, '');
  const qs =
    `aid=${cfg.aid || '2608'}` +
    `&uuid=${encodeURIComponent(cfg.uuid.trim())}` +
    '&spider=0' +
    `&msToken=${encodeURIComponent(cfg.msToken.trim())}` +
    `&a_bogus=${encodeURIComponent(cfg.aBogus.trim())}`;
  const url = `${apiBase}/growth_api/v1/lottery/draw?${qs}`;
  console.log(
    '[api:juejin-draw] POST',
    url.replace(/msToken=[^&]+/, 'msToken=***').replace(/a_bogus=[^&]+/, 'a_bogus=***')
  );

  let res, text;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': cfg.cookie.trim(),
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        'Referer': 'https://juejin.cn/',
        'Origin': 'https://juejin.cn',
        'content-type': 'application/json',
        'accept': '*/*',
        'x-secsdk-csrf-token': cfg.csrfToken.trim(),
      },
      body: '{}',
      signal: AbortSignal.timeout(cfg.timeoutMs || 20000),
    });
    text = await res.text();
  } catch (e) {
    fail('请求异常: ' + e.message);
  }
  console.log('[api:juejin-draw] HTTP', res.status);

  // 空 body = 被风控静默拦截（与 check_in 同特征）
  if (!text.trim()) {
    fail(
      'draw 返回空 body，说明 msToken/aBogus 风控对或 x-secsdk-csrf-token 已失效。\n' +
      '更新方法：浏览器打开 juejin.cn/user/center/lottery → F12 → Network → 点「免费抽奖」→\n' +
      '找到 draw 请求：URL query 里的 msToken / a_bogus 填回 config.json 的 msToken / aBogus 字段，\n' +
      '请求头 x-secsdk-csrf-token 的值填回 csrfToken 字段。'
    );
  }
  const data = parseJsonOrFail(text, 'draw', res.status);
  console.log('[api:juejin-draw] 响应:', JSON.stringify(data).slice(0, 300));

  if (Number(data.err_no) === 0) {
    const prize = data.data && data.data.lottery_name ? data.data.lottery_name : JSON.stringify(data.data || {}).slice(0, 120);
    console.log(`[juejin-draw] 单抽成功: ${prize}`);
    process.exit(0);
  }

  const msg = String(data.err_msg || '');
  // 免费次数用尽：服务端业务拒绝，视为当日完成（幂等成功）
  if (/次数|用完|已用|免费/.test(msg)) {
    console.log(`[juejin-draw] 今日已无可抽次数（服务端返回: ${msg}），视为完成`);
    process.exit(0);
  }

  fail(`draw err_no=${data.err_no}, err_msg=${msg}`);
})().catch((e) => {
  fail('脚本异常: ' + ((e && e.stack) || e));
});
