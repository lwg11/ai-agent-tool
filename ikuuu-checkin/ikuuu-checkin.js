#!/usr/bin/env node
/**
 * ikuuu 签到工具
 * 接口: POST {baseUrl}/user/checkin
 * 凭证（baseUrl / cookie）全部读取同目录 config.json，代码中不写死。
 *
 * 用法: node ikuuu-checkin/ikuuu-checkin.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

function fail(msg, extra) {
  console.error('[ikuuu] 失败:', msg);
  if (extra) console.error(extra);
  process.exit(1);
}

(async () => {
  const cfgPath = path.join(__dirname, 'config.json');
  if (!fs.existsSync(cfgPath)) fail('找不到配置文件 ' + cfgPath);
  const raw = fs.readFileSync(cfgPath, 'utf8');
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    // Secret 内容不完整/不是 JSON 时在此崩溃（此前直接裸崩，日志只剩 "Node.js vXX"）
    const head = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    fail(
      `config.json 不是合法 JSON（${e.message}）。开头内容: "${head}"。` +
      '请检查 Secret IKUUU_CONFIG_JSON 是否为完整的 config.json 内容（含 baseUrl/cookie 字段的 JSON 对象），而不是纯 cookie 字符串'
    );
  }
  if (!cfg.baseUrl) fail('config.json 中缺少 baseUrl（现有字段: ' + Object.keys(cfg).join(', ') + '）');
  if (typeof cfg.cookie !== 'string')
    fail(`config.json 中 cookie 字段类型错误（期望 string，实际 ${typeof cfg.cookie}）`);
  if (!cfg.cookie.trim()) fail('config.json 中缺少 cookie，请填入登录后的 Cookie');

  const url = cfg.baseUrl.replace(/\/+$/, '') + '/user/checkin';
  const headers = {
    'Cookie': cfg.cookie.trim(),
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': cfg.baseUrl.replace(/\/+$/, '') + '/user',
    'Accept': 'application/json, text/plain, */*',
  };

  console.log('[api:ikuuu-checkin] POST', url);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(cfg.timeoutMs || 20000),
    });
  } catch (e) {
    fail('请求异常: ' + e.message);
  }

  let text;
  try {
    text = await res.text();
  } catch (e) {
    fail('读取响应体异常: ' + e.message);
  }
  console.log('[api:ikuuu-checkin] HTTP', res.status);

  // 正常应返回 JSON: {"ret":1,"msg":"获得了 xxx MB 流量"}
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    // 非 JSON：通常是 Cookie 失效后返回了登录页 HTML
    const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
    fail(
      `返回内容不是 JSON（HTTP ${res.status}）。多半是 Cookie 失效/被重定向到登录页，请到 ${cfg.baseUrl} 重新登录后更新 config.json 的 ikuuu.cookie。返回片段: ${snippet}`
    );
  }

  if (data && typeof data.ret !== 'undefined') {
    if (Number(data.ret) === 1) {
      console.log('[ikuuu] 签到成功:', data.msg || '(无消息)');
      process.exit(0);
    }
    // ret != 1：可能是已签到、登录失效等，以服务端 msg 为准
    if (typeof data.msg === 'string' && data.msg.includes('已经签到')) {
      console.log('[ikuuu] 今日已签到，无需重复操作（服务端返回:', data.msg + '）');
      process.exit(0);
    }
    fail(`ret=${data.ret}, msg=${data.msg || '(无消息)'}`);
  }

  fail('响应 JSON 中没有 ret 字段，请人工确认接口返回结构: ' + text.slice(0, 300));
})().catch((e) => {
  // 兜底：任何未捕获异常（含堆栈）以受控方式输出，避免日志只剩 "Node.js vXX"
  fail('脚本异常: ' + ((e && e.stack) || e));
});
