#!/usr/bin/env node
/**
 * 稀土掘金自动签到工具
 * 接口（掘金官方 checkin_api）:
 *   1) GET  {apiBase}/checkin_api/v1/get_today_status?aid={aid}&uuid={uuid}&spider=0  查询今日是否已签
 *   2) POST {apiBase}/checkin_api/v1/checkin?aid={aid}&uuid={uuid}&spider=0           签到
 * Cookie / aid / uuid / antiContent 全部读取同目录 config.json，代码中不写死。
 *
 * 用法: node juejin-checkin/juejin-checkin.js
 *
 * 获取 uuid：登录 juejin.cn 后，浏览器 DevTools → Network 里随便找一条
 * api.juejin.cn 请求，query 中的 uuid 参数即所需值。
 * 若返回 err_no 非 0 且提示风控（如校验失败），可在 config.json 的
 * antiContent 填入浏览器请求头中的 anti-content 值再试。
 */
'use strict';

const fs = require('fs');
const path = require('path');

function fail(msg, extra) {
  console.error('[juejin] 失败:', msg);
  if (extra) console.error(extra);
  process.exit(1);
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

  const aid = cfg.aid || '2608';
  const qs = `aid=${encodeURIComponent(aid)}&uuid=${encodeURIComponent(cfg.uuid.trim())}&spider=0`;
  const baseHeaders = {
    'Cookie': cfg.cookie.trim(),
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://juejin.cn/',
    'Origin': 'https://juejin.cn',
    'Accept': 'application/json, text/plain, */*',
  };
  if (cfg.antiContent && cfg.antiContent.trim()) {
    baseHeaders['anti-content'] = cfg.antiContent.trim();
  }
  const timeout = cfg.timeoutMs || 20000;
  const apiBase = cfg.apiBase.replace(/\/+$/, '');

  // ---- 第 1 步：查询今日签到状态 ----
  const statusUrl = `${apiBase}/checkin_api/v1/get_today_status?${qs}`;
  console.log('[api:juejin-get_today_status] GET', statusUrl);
  let statusRes, statusData;
  try {
    statusRes = await fetch(statusUrl, {
      method: 'GET',
      headers: baseHeaders,
      signal: AbortSignal.timeout(timeout),
    });
    statusData = await statusRes.json();
  } catch (e) {
    fail('查询签到状态异常: ' + e.message);
  }
  console.log('[api:juejin-get_today_status] HTTP', statusRes.status, JSON.stringify(statusData));

  if (Number(statusData.err_no) !== 0) {
    fail(`查询状态接口 err_no=${statusData.err_no}, err_msg=${statusData.err_msg}（通常是 Cookie 失效或触发了风控）`);
  }

  // today_status: 1 = 今日已签，0 = 未签（以服务端原始响应为准，见上方打印）
  if (statusData.data && Number(statusData.data.today_status) === 1) {
    console.log(
      `[juejin] 今日已签到，无需重复操作（连续签到 ${statusData.data.checked_in_count} 天）`
    );
    process.exit(0);
  }

  // ---- 第 2 步：执行签到 ----
  const checkinUrl = `${apiBase}/checkin_api/v1/checkin?${qs}`;
  console.log('[api:juejin-checkin] POST', checkinUrl);
  let checkinRes, checkinData;
  try {
    checkinRes = await fetch(checkinUrl, {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(timeout),
    });
    checkinData = await checkinRes.json();
  } catch (e) {
    fail('签到请求异常: ' + e.message);
  }
  console.log('[api:juejin-checkin] HTTP', checkinRes.status, JSON.stringify(checkinData));

  if (Number(checkinData.err_no) === 0) {
    const d = checkinData.data || {};
    console.log(
      `[juejin] 签到成功！获得矿石 ${d.increase_score}，当前矿石 ${d.sum_score}，连续签到 ${d.checked_in_count} 天`
    );
    process.exit(0);
  }

  fail(`签到接口 err_no=${checkinData.err_no}, err_msg=${checkinData.err_msg}`);
})();
