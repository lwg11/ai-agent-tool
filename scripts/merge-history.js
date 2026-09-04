#!/usr/bin/env node
/**
 * 把 checkin-result.json（本次运行结果）合并进 checkin-history.json（历史，随仓库提交）。
 * 每天一条记录，同日重复运行覆盖；最多保留 90 天。
 * 供资料库「签到控制台」页面通过 GitHub API 拉取展示。
 * 用法: node scripts/merge-history.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const resPath = path.join(root, 'checkin-result.json');
const histPath = path.join(root, 'checkin-history.json');

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

let hist = [];
if (fs.existsSync(histPath)) {
  try {
    hist = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    if (!Array.isArray(hist)) hist = [];
  } catch {
    hist = [];
  }
}

// 每天一条，同日重复运行覆盖
hist = hist.filter((e) => e && e.date !== res.date);
hist.push(res);
hist.sort((a, b) => (a.date < b.date ? -1 : 1));
if (hist.length > 90) hist = hist.slice(-90);

fs.writeFileSync(histPath, JSON.stringify(hist, null, 2) + '\n');
console.log(`[merge-history] 历史写回完成（累计 ${hist.length} 天记录，最新 ${res.date}）`);
