#!/usr/bin/env node
/**
 * 一键跑全部签到工具（每个工具是独立文件夹，各自读自己的 config.json）。
 * 任何一项失败整体退出码为 1，便于接入定时任务告警。
 * 同时写 checkin-result.json（机器可读结果），供 Actions 写回 checkin-history.json，
 * 供资料库「签到控制台」页面展示。
 * 用法: node run-all.js
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tasks = [
  { key: 'ikuuu', label: 'ikuuu 签到', script: path.join(__dirname, 'ikuuu-checkin', 'ikuuu-checkin.js') },
  { key: 'juejin', label: '掘金签到(浏览器)', script: path.join(__dirname, 'juejin-checkin', 'juejin-browser.js') },
];

const results = [];
let hasFail = false;

for (const t of tasks) {
  console.log(`\n========== ${t.label} ==========`);
  const r = spawnSync(process.execPath, [t.script], { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  if (out) console.log(out);
  const ok = r.status === 0;
  if (!ok) hasFail = true;
  // 提取结果摘要：优先取带 ✅/❌ 标记的最后一行，否则取最后一行（脚本输出已含脱敏处理）
  const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
  const marked = lines.filter((l) => l.startsWith('✅') || l.startsWith('❌'));
  const message = (marked[marked.length - 1] || lines[lines.length - 1] || (ok ? '成功' : '失败（无输出）')).slice(0, 120);
  results.push({ key: t.key, label: t.label, ok, message });
}

console.log('\n========== 汇总 ==========');
results.forEach((x) => console.log(`${x.ok ? '✅' : '❌'} ${x.label} ${x.message}`));

// 机器可读结果（日期为北京时间）
const bjDate = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const result = {
  date: bjDate,
  runAt: new Date().toISOString(),
  allOk: !hasFail,
  tools: results.map(({ key, label, ok, message }) => ({ key, label, ok, message })),
};
try {
  fs.writeFileSync(path.join(__dirname, 'checkin-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('\n[run-all] 结果已写入 checkin-result.json');
} catch (e) {
  console.error('\n[run-all] 写结果文件失败:', e.message);
}

process.exit(hasFail ? 1 : 0);
