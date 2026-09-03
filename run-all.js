#!/usr/bin/env node
/**
 * 一键跑全部签到工具（每个工具是独立文件夹，各自读自己的 config.json）。
 * 任何一项失败整体退出码为 1，便于接入定时任务告警。
 * 用法: node run-all.js
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const tasks = [
  { name: 'ikuuu 签到', script: path.join(__dirname, 'ikuuu-checkin', 'ikuuu-checkin.js') },
  { name: '掘金签到', script: path.join(__dirname, 'juejin-checkin', 'juejin-checkin.js') },
];

const results = [];
let hasFail = false;

for (const t of tasks) {
  console.log(`\n========== ${t.name} ==========`);
  const r = spawnSync(process.execPath, [t.script], { stdio: 'inherit' });
  const ok = r.status === 0;
  if (!ok) hasFail = true;
  results.push(`${ok ? '✅' : '❌'} ${t.name}`);
}

console.log('\n========== 汇总 ==========');
results.forEach((x) => console.log(x));
process.exit(hasFail ? 1 : 0);
