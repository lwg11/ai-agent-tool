#!/usr/bin/env node
/**
 * 一键跑全部签到工具（每个工具是独立文件夹，各自读自己的 config.json）。
 * 任何一项失败整体退出码为 1，便于接入定时任务告警。
 * 同时写 checkin-result.json（机器可读结果），供 Actions 写回 checkin-history.json，
 * 供资料库「签到控制台」页面展示。
 * 用法: node run-all.js [--only=ikuuu,juejin] [--skip=ikuuu,juejin]
 *   --only  只跑指定工具；--skip 跳过指定工具（当日已成功，不发起请求）
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tasks = [
  { key: 'ikuuu', label: 'ikuuu 签到', script: path.join(__dirname, 'ikuuu-checkin', 'ikuuu-checkin.js') },
  { key: 'juejin', label: '掘金签到(浏览器)', script: path.join(__dirname, 'juejin-checkin', 'juejin-browser.js') },
  // 每日免费单抽：独立任务、同样享受当日幂等（skip 已成功项），自动跑 all 时排在掘金签到之后
  { key: 'juejin-draw', label: '掘金单抽', script: path.join(__dirname, 'juejin-checkin', 'juejin-draw.js') },
];

// 支持单工具执行：--only=ikuuu / --only=juejin（控制台按钮触发用）
// 支持跳过指定工具：--skip=ikuuu,juejin（当日已成功的工具，跳过且不发起任何请求，
// 避免重复提交——ikuuu 重复提交有 cookie 失效风险）。跳过的工具记为成功。
const onlyArg = process.argv.slice(2).map((a) => a.match(/^--only=([\w,]+)$/)).filter(Boolean)[0];
const skipArg = process.argv.slice(2).map((a) => a.match(/^--skip=([\w,]*)$/)).filter(Boolean)[0];
const skipSet = new Set(skipArg ? skipArg[1].split(',').filter(Boolean) : []);
const activeTasks = onlyArg ? tasks.filter((t) => onlyArg[1].split(',').includes(t.key)) : tasks;
if (!activeTasks.length) {
  console.error(`[run-all] 未找到匹配的签到任务: ${onlyArg ? onlyArg[1] : '(无)'}`);
  process.exit(1);
}

const results = [];
let hasFail = false;

for (const t of activeTasks) {
  console.log(`\n========== ${t.label} ==========`);
  if (skipSet.has(t.key)) {
    console.log(`[run-all] ${t.key} 今日已成功签到，跳过本次执行（避免重复提交）`);
    results.push({ key: t.key, label: t.label, ok: true, message: '今日已成功签到，跳过本次执行（避免重复提交）' });
    continue;
  }
  const r = spawnSync(process.execPath, [t.script], { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  if (out) console.log(out);
  const ok = r.status === 0;
  if (!ok) hasFail = true;
  // 提取结果摘要：优先带 ✅/❌ 标记的行；崩溃堆栈时 "Node.js vXX" 固定是最后一行、
  // 无信息量，改为优先捞含 Error/[工具名]/失败/异常 的行（通常是真实报错），否则取最后一行
  const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
  const marked = lines.filter((l) => l.startsWith('✅') || l.startsWith('❌'));
  const errLike = lines.filter((l) => /(\[(ikuuu|juejin[\w-]*|run-all)\]|Error|失败|异常)/i.test(l));
  const message = (
    marked[marked.length - 1] ||
    errLike[errLike.length - 1] ||
    lines[lines.length - 1] ||
    (ok ? '成功' : '失败（无输出）')
  ).slice(0, 200);
  results.push({ key: t.key, label: t.label, ok, message });
}

console.log('\n========== 汇总 ==========');
results.forEach((x) => console.log(`${x.ok ? '✅' : '❌'} ${x.label} ${x.message}`));

// 机器可读结果（日期与时间为北京时间）
const now = new Date();
const bj = new Date(now.getTime() + 8 * 3600 * 1000);
const bjDate = bj.toISOString().slice(0, 10);
const bjTime = bj.toISOString().slice(11, 19);
const result = {
  date: bjDate,
  bjTime,
  runAt: now.toISOString(),
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
