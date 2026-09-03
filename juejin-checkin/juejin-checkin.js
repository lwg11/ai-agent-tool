#!/usr/bin/env node
/**
 * 稀土掘金自动签到工具
 * 接口（掘金官方 growth_api）:
 *   1) GET  {apiBase}/growth_api/v1/get_today_status  查询今日是否已签（无需风控参数）
 *   2) POST {apiBase}/growth_api/v1/check_in          签到
 *
 * 风控说明（实测结论，2026-09）：
 *   check_in 必须在 query 中携带 msToken + a_bogus（二者成对、与参数绑定，服务端
 *   密码学校验；伪造/缺任一都会被静默拦截返回空 body）。x-secsdk-csrf-token 请求头
 *   经消融实验确认不是必需项。签名对由浏览器侧 VM 生成，无法本地复现，因此作为
 *   配置项存放：失效时按 README 步骤从浏览器重新抓取替换。
 *
 * 全部凭证读取同目录 config.json，代码中不写死。
 * 用法: node juejin-checkin/juejin-checkin.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

function fail(msg, extra) {
  console.error('[juejin] 失败:', msg);
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
  if (!cfg.cookie || !cfg.cookie.trim())
    fail('config.json 中缺少 cookie。请登录 juejin.cn 后，把包含 sessionid 的 Cookie 填入');
  if (!cfg.uuid || !cfg.uuid.trim())
    fail('config.json 中缺少 uuid。登录 juejin.cn 后在 Network 面板 api.juejin.cn 请求的 query 参数里取 uuid');
  if (!cfg.msToken || !cfg.msToken.trim() || !cfg.aBogus || !cfg.aBogus.trim())
    fail('config.json 中缺少 msToken 或 aBogus（check_in 风控必需，成对出现）。抓取步骤见 README');

  const aid = cfg.aid || '2608';
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
  const baseHeaders = {
    'Cookie': cfg.cookie.trim(),
    'User-Agent': ua,
    'Referer': 'https://juejin.cn/',
    'Origin': 'https://juejin.cn',
    'accept': 'application/json, text/plain, */*',
  };
  const timeout = cfg.timeoutMs || 20000;
  const apiBase = cfg.apiBase.replace(/\/+$/, '');

  // user_id 为可选：与浏览器真实请求保持一致，配置了就带上
  const qsParts = [`aid=${encodeURIComponent(aid)}`, `uuid=${encodeURIComponent(cfg.uuid.trim())}`, 'spider=0'];
  if (cfg.userId && cfg.userId.trim()) {
    qsParts.push(`user_id=${encodeURIComponent(cfg.userId.trim())}`);
  }
  const baseQs = qsParts.join('&');

  // ---- 第 1 步：查询今日签到状态（该接口不需要风控参数） ----
  const statusUrl = `${apiBase}/growth_api/v1/get_today_status?${baseQs}`;
  console.log('[api:juejin-get_today_status] GET', statusUrl);
  let statusRes, statusData, statusText;
  try {
    statusRes = await fetch(statusUrl, {
      method: 'GET',
      headers: baseHeaders,
      signal: AbortSignal.timeout(timeout),
    });
    statusText = await statusRes.text();
  } catch (e) {
    fail('查询签到状态异常: ' + e.message);
  }
  statusData = parseJsonOrFail(statusText, 'get_today_status', statusRes.status);
  console.log('[api:juejin-get_today_status] HTTP', statusRes.status, JSON.stringify(statusData));

  if (Number(statusData.err_no) !== 0) {
    fail(`查询状态接口 err_no=${statusData.err_no}, err_msg=${statusData.err_msg}（通常是 Cookie 失效，重新抓取 cookie）`);
  }

  // 已签判定以服务端原始响应为准（见上方打印）：data 为 true 视为今日已签
  if (statusData.data === true) {
    console.log('[juejin] 今日已签到，无需重复操作');
    process.exit(0);
  }

  // ---- 第 2 步：执行签到（query 携带 msToken + a_bogus 风控对） ----
  const checkinQs =
    baseQs +
    `&msToken=${encodeURIComponent(cfg.msToken.trim())}` +
    `&a_bogus=${encodeURIComponent(cfg.aBogus.trim())}`;
  const checkinUrl = `${apiBase}/growth_api/v1/check_in?${checkinQs}`;
  console.log(
    '[api:juejin-check_in] POST',
    checkinUrl.replace(/msToken=[^&]+/, 'msToken=***').replace(/a_bogus=[^&]+/, 'a_bogus=***')
  );
  let checkinRes, checkinData, checkinText;
  try {
    checkinRes = await fetch(checkinUrl, {
      method: 'POST',
      headers: { ...baseHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(timeout),
    });
    checkinText = await checkinRes.text();
  } catch (e) {
    fail('签到请求异常: ' + e.message);
  }

  // 空 body = 被风控静默拦截（msToken/aBogus 对失效）
  if (!checkinText.trim()) {
    fail(
      'check_in 返回空 body，说明 msToken/aBogus 风控对已失效。\n' +
      '更新方法：浏览器打开 juejin.cn → F12 → Network → 点签到按钮 → 找到 check_in 请求 →\n' +
      '把 URL query 里的 msToken 和 a_bogus 两个参数值填回 config.json 的 msToken / aBogus 字段。'
    );
  }
  checkinData = parseJsonOrFail(checkinText, 'check_in', checkinRes.status);
  console.log('[api:juejin-check_in] HTTP', checkinRes.status, JSON.stringify(checkinData));

  if (Number(checkinData.err_no) === 0) {
    console.log('[juejin] 签到成功！服务端返回数据:', JSON.stringify(checkinData.data));
    process.exit(0);
  }
  // 15001 = 今日已签（与 get_today_status 双保险），视为成功
  if (Number(checkinData.err_no) === 15001) {
    console.log('[juejin] 今日已签到，无需重复操作（服务端返回:', checkinData.err_msg + '）');
    process.exit(0);
  }

  fail(`签到接口 err_no=${checkinData.err_no}, err_msg=${checkinData.err_msg}`);
})();
