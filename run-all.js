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
  // 每日免费单抽：复用无头浏览器脚本 --draw-only 模式（页面自身生成风控参数，免抓取），
  // 独立任务、同样享受当日幂等（skip 已成功项）
  { key: 'juejin-draw', label: '掘金单抽', script: path.join(__dirname, 'juejin-checkin', 'juejin-browser.js'), args: ['--draw-only'] },
  // 十连抽：每次消耗 2000 矿石，manualOnly——自动 all 流程永不执行，
  // 仅控制台「手动十连抽」显式 --only 才跑；同样享受当日幂等（防止同日误点双倍扣矿石）
  { key: 'juejin-ten-draw', label: '掘金十连抽(手动)', script: path.join(__dirname, 'juejin-checkin', 'juejin-browser.js'), args: ['--ten-draw-only'], manualOnly: true },
];

// 失败截图目录与北京日期（必须在任务循环之前定义——下方 entry.screenshot 与
// 清理块都引用；此前的定义在编辑事故中丢失，导致所有 run 在收尾时
// ReferenceError 崩溃、checkin-result.json 从未写出、控制台无记录）
const SHOT_DIR = path.join(__dirname, 'screenshots');
const bjDateShot = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

// 支持单工具执行：--only=ikuuu / --only=juejin-draw（控制台按钮触发用）。
// 注意：任务 key 含连字符（juejin-draw / juejin-ten-draw），字符类必须含 '-'，
// 否则正则不匹配 → onlyArg 为空 → 静默退化为跑全部任务（09-19 实测踩坑）
const onlyArg = process.argv.slice(2).map((a) => a.match(/^--only=([\w,-]+)$/)).filter(Boolean)[0];
const skipArg = process.argv.slice(2).map((a) => a.match(/^--skip=([\w,-]*)$/)).filter(Boolean)[0];
const skipSet = new Set(skipArg ? skipArg[1].split(',').filter(Boolean) : []);
const activeTasks = onlyArg
  ? tasks.filter((t) => onlyArg[1].split(',').includes(t.key))
  : tasks.filter((t) => !t.manualOnly); // 自动流程（无 --only）跳过 manualOnly 任务（十连抽扣矿石）
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
  const r = spawnSync(process.execPath, [t.script].concat(t.args || []), { encoding: 'utf8' });
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
  const entry = { key: t.key, label: t.label, ok, message };
  // 奖品信息：脚本成功时输出 PRIZES: 行（多个奖品以 | 分隔），解析后挂进记录，
  // 控制台表格「奖品」列展示
  const prizeLine = lines.filter((l) => /^PRIZES:/.test(l)).pop();
  if (prizeLine) entry.prizes = prizeLine.slice('PRIZES:'.length).trim();
  // 失败时若脚本落了失败截图（screenshots/<北京日期>-<任务键>.png），把文件名挂到
  // 结果上——merge-history 原样透传进 checkin-history.json，控制台据此展示截图
  if (!ok) {
    const shotName = `${bjDateShot}-${t.key}.png`;
    if (fs.existsSync(path.join(SHOT_DIR, shotName))) entry.screenshot = shotName;
  }
  results.push(entry);
}

console.log('\n========== 汇总 ==========');
results.forEach((x) => console.log(`${x.ok ? '✅' : '❌'} ${x.label} ${x.message}`));

// 清理已成功任务当日的失败截图：重试成功后旧失败截图已无对应记录，
// 不删会被误提交成"无主截图"（服务器只跑一轮，本地调试残留同样清掉）
for (const t of activeTasks) {
  const r = results.find((x) => x.key === t.key);
  if (r && r.ok) fs.rmSync(path.join(SHOT_DIR, `${bjDateShot}-${t.key}.png`), { force: true });
}

// 机器可读结果（日期与时间为北京时间）
const now = new Date();
const bj = new Date(now.getTime() + 8 * 3600 * 1000);
const bjTime = bj.toISOString().slice(11, 19);
const result = {
  date: bjDateShot,
  bjTime,
  runAt: now.toISOString(),
  allOk: !hasFail,
  tools: results.map(({ key, label, ok, message, screenshot, prizes }) => ({
    key, label, ok, message, ...(screenshot ? { screenshot } : {}), ...(prizes ? { prizes } : {}),
  })),
};
try {
  fs.writeFileSync(path.join(__dirname, 'checkin-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('\n[run-all] 结果已写入 checkin-result.json');
} catch (e) {
  console.error('\n[run-all] 写结果文件失败:', e.message);
}

process.exit(hasFail ? 1 : 0);
