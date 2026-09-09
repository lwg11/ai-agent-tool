#!/usr/bin/env node
/**
 * 把 checkin-result.json（本次运行结果）合并进 checkin-history.json（历史，随仓库提交）。
 * 每次执行追加一条记录（同一次运行按 runAt 去重，不按日期覆盖）；最多保留 800 条。
 * 供资料库「签到控制台」页面通过 GitHub API 拉取展示与查询。
 * 用法: node scripts/merge-history.js
 * 触发方式可选通过环境变量 CHECKIN_TRIGGER 传入（schedule / workflow_dispatch / local）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const resPath = path.join(root, 'checkin-result.json');
const histPath = path.join(root, 'checkin-history.json');
const MAX_RECORDS = 800;

if (!fs.existsSync(resPath)) {
  console.log('[merge-history] checkin-result.json 不存在（签到步骤未执行），跳过历史写回');
  process.exit(0);
}

let res;
try {
  res = JSON.parse(fs.readFileSync(resPath, 'utf8'));
} catch (e) {
  console.error('[merge-history] 结果文件解析失败:', e.message);
  process.exit(0);
}

// 补全记录字段：id（唯一键）、bjTime（北京时间）、trigger（触发方式）
if (!res.runAt) res.runAt = new Date().toISOString();
if (!res.bjTime) {
  res.bjTime = new Date(res.runAt).toISOString().slice(11, 19); // 近似，workflow 传入时为准
}
if (!res.id) {
  res.id = res.runAt + '-' + Math.random().toString(36).slice(2, 6);
}
res.trigger = process.env.CHECKIN_TRIGGER || res.trigger || 'local';

let hist = [];
if (fs.existsSync(histPath)) {
  try {
    hist = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    if (!Array.isArray(hist)) hist = [];
  } catch {
    hist = [];
  }
}

// 同一次运行（runAt 相同）不重复追加；旧格式记录（无 runAt，按日期一天一条）原样保留
const dup = hist.some((e) => e && e.runAt && e.runAt === res.runAt);
if (dup) {
  console.log('[merge-history] 本次运行已写入过历史（runAt 重复），跳过');
  process.exit(0);
}

hist.push(res);
hist.sort((a, b) => {
  const ta = a.runAt || a.date || '';
  const tb = b.runAt || b.date || '';
  return ta < tb ? -1 : ta > tb ? 1 : 0;
});
if (hist.length > MAX_RECORDS) hist = hist.slice(-MAX_RECORDS);

fs.writeFileSync(histPath, JSON.stringify(hist, null, 2) + '\n');
console.log(`[merge-history] 历史写回完成（累计 ${hist.length} 条执行记录，本次 ${res.date} ${res.bjTime}，触发: ${res.trigger}）`);
