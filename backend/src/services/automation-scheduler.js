/**
 * Automation Scheduler - 定时检查并触发自动化规则
 * 使用 node-cron 或 setInterval 实现
 */

import automationService from './automation.service.js';

let schedulerInterval = null;

export function startScheduler() {
  if (schedulerInterval) {
    console.log('[Automation Scheduler] Already running');
    return;
  }

  console.log('[Automation Scheduler] Starting...');

  // 每30分钟检查一次是否有到期规则
  // 周末问候/行业动态/案例发送的实际触发逻辑在service里通过时间判断
  const CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟

  // 启动时先跑一次
  setTimeout(() => {
    runCheck().catch(err => console.error('[Automation Scheduler] Initial check error:', err));
  }, 60 * 1000); // 延迟1分钟等服务完全启动

  schedulerInterval = setInterval(() => {
    runCheck().catch(err => console.error('[Automation Scheduler] Check error:', err));
  }, CHECK_INTERVAL);

  console.log(`[Automation Scheduler] Started, checking every ${CHECK_INTERVAL / 60000} minutes`);
}

async function runCheck() {
  const now = new Date();
  console.log(`[Automation Scheduler] Running check at ${now.toISOString()}`);
  await automationService.checkAndRunScheduledRules();
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Automation Scheduler] Stopped');
  }
}
